"""
PyMuPDF text-replacement service for Jobby.

Exposes a single HTTP endpoint:

    POST /replace
    {
      "input_pdf":    "/path/to/original.pdf",
      "output_pdf":   "/path/to/output.pdf",
      "replacements": [{"old": "...", "new": "..."}]
    }

For each replacement the script:
  1. Locates every occurrence of `old` in the PDF (multi-strategy search).
  2. Measures whether the replacement text fits in the same bounding box.
  3. If the text overflows, reflow is triggered: same-column content below
     the changed block is shifted down and decorative path drawings are adjusted.
  4. Redacts (erases) the old text and inserts the new text.
"""

from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any

import fitz  # PyMuPDF

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("pdf_replace")

PORT = int(os.environ.get("PORT", "5001"))

# ── Constants ─────────────────────────────────────────────────────────────────

# Minimum whitespace gap (in points) that separates two layout columns.
# Smaller gaps are treated as in-column indentation, not column breaks.
# 20 pt ≈ 7 mm, a typical inter-column gutter.
MIN_COLUMN_GAP: float = 20.0

# A text block whose width exceeds this fraction of page width is considered
# full-width (e.g. page header, footer, full-width section rule).
# 0.8 handles 3-column layouts safely (each col ≈ 33%, spanning two ≈ 66%).
FULL_WIDTH_RATIO: float = 0.8

# Line spacing multiplier used to estimate how many lines a given text block
# occupies. PyMuPDF's default line gap is roughly 1.2 × font size.
LINE_SPACING: float = 1.2

# Safety buffer added to the measured overflow before expanding the insertion
# rect or handing it to the reflow engine.
REFLOW_BUFFER_PT: float = 4.0

# Font size reduction steps attempted when text overflows even after reflow.
FONT_SIZE_STEPS = (1.0, 0.95, 0.90, 0.85, 0.80, 0.75)

# ── Font helpers ──────────────────────────────────────────────────────────────

BASE14 = {
    "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique",
    "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
    "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic",
    "Symbol", "ZapfDingbats",
}
SERIF_KEYWORDS = {"times", "garamond", "georgia", "cambria", "palatino", "book"}
MONO_KEYWORDS  = {"courier", "consolas", "mono", "menlo", "inconsolata", "source code"}

# Explicit substitutions for punctuation / symbols that look wrong in Base-14
_UNICODE_SUBS: dict[str, str] = {
    "\u2014": "--",   # em-dash
    "\u2013": "-",    # en-dash
    "\u2018": "'",    # left single quotation mark
    "\u2019": "'",    # right single quotation mark
    "\u201c": '"',    # left double quotation mark
    "\u201d": '"',    # right double quotation mark
    "\u2022": "*",    # bullet
    "\u2026": "...",  # horizontal ellipsis
    "\u00b7": ".",    # middle dot
    "\u00a0": " ",    # non-breaking space
    "\u00ad": "",     # soft hyphen (invisible)
}


def _safe_text(text: str) -> str:
    """
    Replace characters that Base-14 fonts cannot render reliably.

    Strategy (in order):
    1. Apply explicit substitution table for punctuation/typography.
    2. For any remaining character outside the Latin-1 supplement
       (U+0000–U+00FF), decompose it (NFD) and keep only ASCII-range
       base characters (e.g. é→e, ü→u, ñ→n).
    3. Characters that survive neither step are dropped.
    """
    for ch, sub in _UNICODE_SUBS.items():
        text = text.replace(ch, sub)

    result: list[str] = []
    for ch in text:
        cp = ord(ch)
        if cp <= 0xFF:
            result.append(ch)
            continue
        # Decompose and keep only base ASCII characters
        decomposed = unicodedata.normalize("NFD", ch)
        base = "".join(c for c in decomposed if ord(c) <= 0x7F)
        result.append(base if base else "")

    return "".join(result)


def _pick_base14(font_name: str, flags: int) -> str:
    """Choose the closest Base-14 font by style keywords and flags."""
    low = font_name.lower()
    bold   = bool(flags & (1 << 18))
    italic = bool(flags & (1 << 6))
    if any(k in low for k in MONO_KEYWORDS):
        return ("Courier-BoldOblique" if bold and italic else
                "Courier-Bold" if bold else "Courier-Oblique" if italic else "Courier")
    if any(k in low for k in SERIF_KEYWORDS):
        return ("Times-BoldItalic" if bold and italic else
                "Times-Bold" if bold else "Times-Italic" if italic else "Times-Roman")
    return ("Helvetica-BoldOblique" if bold and italic else
            "Helvetica-Bold" if bold else "Helvetica-Oblique" if italic else "Helvetica")


def _font_for_redact(font_name: str, flags: int) -> str:
    """Return a Base-14 font name safe for insert_textbox()."""
    if font_name in BASE14:
        return font_name
    fallback = _pick_base14(font_name, flags)
    log.debug("Font %r not in Base-14; falling back to %s", font_name, fallback)
    return fallback


def _color_tuple(color: int | list | tuple | None) -> tuple[float, float, float]:
    """Normalise a PyMuPDF span colour to an (r, g, b) tuple in [0, 1]."""
    if color is None:
        return (0.0, 0.0, 0.0)
    if isinstance(color, int):
        return (((color >> 16) & 0xFF) / 255.0,
                ((color >> 8)  & 0xFF) / 255.0,
                 (color        & 0xFF) / 255.0)
    if isinstance(color, (list, tuple)) and len(color) >= 3:
        return (float(color[0]), float(color[1]), float(color[2]))
    return (0.0, 0.0, 0.0)


# ── Span style helper ─────────────────────────────────────────────────────────

def _style_at(page, anchor: str) -> dict:
    """
    Return the font style of the first span that contains anchor text.
    Tries progressively shorter prefixes of anchor so it works even when
    a span contains only a fragment of the full text.
    """
    default = {"font": "Helvetica", "size": 10.0, "flags": 0, "color": (0.0, 0.0, 0.0)}
    td = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

    # Try 30-char, 15-char, and 8-char anchors in descending specificity
    for length in (30, 15, 8):
        needle = anchor[:length].strip()
        if not needle:
            continue
        for blk in td.get("blocks", []):
            if blk.get("type") != 0:
                continue
            for line in blk.get("lines", []):
                for span in line.get("spans", []):
                    if needle in span.get("text", ""):
                        return {
                            "font":  span.get("font",  "Helvetica"),
                            "size":  span.get("size",  10.0),
                            "flags": span.get("flags", 0),
                            "color": _color_tuple(span.get("color")),
                        }
    return default


# ── Region finder ─────────────────────────────────────────────────────────────

def _find_region(
    page, old_text: str
) -> tuple[fitz.Rect | None, list[fitz.Rect], dict]:
    """
    Locate old_text on page using multiple strategies.

    Returns (combined_rect, individual_hit_rects, style).
    combined_rect is used for text insertion (bounding box of all hits).
    individual_hit_rects are used for redaction (erase only matched lines).
    Returns (None, [], default_style) when not found.

    Strategies (tried in order):
    1. Exact search_for(full_text) — PyMuPDF handles multi-line internally.
    2. Per-line union — catches partial matches across PDF line-break encodings.
       Sanity check: combined span must be ≤ 1.5× the expected height of old_text
       (estimated from line count × font size). This catches false positives where
       the same short phrase appears in unrelated parts of the page.
    3. First-6-words anchor — last resort for highly wrapped text.
    """
    default_style = {"font": "Helvetica", "size": 10.0, "flags": 0, "color": (0.0, 0.0, 0.0)}

    def _combine(hits: list[fitz.Rect]) -> fitz.Rect:
        r = fitz.Rect(hits[0])
        for h in hits[1:]:
            r |= h
        return r

    # ── Strategy 1: exact ─────────────────────────────────────────────────────
    hits = page.search_for(old_text)
    if hits:
        return _combine(hits), hits, _style_at(page, old_text[:30])

    # ── Strategy 2: per-line union ────────────────────────────────────────────
    lines = [ln.strip() for ln in old_text.splitlines() if len(ln.strip()) > 8]
    if lines:
        all_hits: list[fitz.Rect] = []
        for ln in lines:
            all_hits.extend(page.search_for(ln))
        if all_hits:
            combined = _combine(all_hits)
            # Sanity: compare combined height to the expected height of old_text.
            # Use the font size of the first matched span as the line height proxy.
            style_probe = _style_at(page, lines[0])
            line_h = style_probe["size"] * LINE_SPACING
            expected_h = len(lines) * line_h * 1.5   # 1.5× tolerance
            if combined.height <= max(expected_h, line_h * 3):
                return combined, all_hits, style_probe

    # ── Strategy 3: anchor (first 6 words) ───────────────────────────────────
    words = re.sub(r"\s+", " ", old_text).strip().split()
    anchor = " ".join(words[:6])
    if len(anchor) > 8:
        hits = page.search_for(anchor)
        if hits:
            return _combine(hits), hits, _style_at(page, anchor)

    return None, [], default_style


# ── Textbox measurement (non-destructive) ─────────────────────────────────────

def _measure_textbox(rect: fitz.Rect, text: str, fontname: str, fontsize: float) -> float:
    """
    Return the overflow value of insert_textbox on a throwaway temp page.
    Positive = space remaining; negative = points of text that didn't fit.
    """
    tmp = fitz.open()
    tmp_page = tmp.new_page(
        width=max(rect.width + 10, 100),
        height=max(rect.height + 200, 200),
    )
    test_rect = fitz.Rect(0, 0, rect.width, rect.height)
    overflow = tmp_page.insert_textbox(
        test_rect, text,
        fontname=fontname, fontsize=fontsize,
        align=fitz.TEXT_ALIGN_LEFT,
    )
    tmp.close()
    return overflow


# ── Column detection ──────────────────────────────────────────────────────────

def _detect_column(page, ref_rect: fitz.Rect) -> tuple[float, float]:
    """
    Return (col_x0, col_x1) for the column that contains ref_rect.

    Algorithm:
    1. Collect the left-edge x0 of every non-full-width text block.
    2. Sort and find ALL gaps ≥ MIN_COLUMN_GAP between consecutive x0 values.
       Each such gap is a column separator, supporting N-column layouts.
    3. Determine which interval [prev_sep, next_sep) contains ref_rect's centre.

    A block is considered full-width (excluded from clustering) when its width
    exceeds FULL_WIDTH_RATIO × page_width.
    """
    page_width  = page.rect.width
    ref_center  = (ref_rect.x0 + ref_rect.x1) / 2

    td = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    x0_vals: list[float] = []
    for blk in td.get("blocks", []):
        if blk.get("type") != 0:
            continue
        bx0, _by0, bx1, _by1 = blk["bbox"]
        if (bx1 - bx0) > page_width * FULL_WIDTH_RATIO:
            continue
        x0_vals.append(round(bx0, 0))

    if not x0_vals:
        return (0.0, page_width)

    sorted_x0 = sorted(set(x0_vals))

    # Find all significant inter-column gaps
    separators: list[float] = []
    for i in range(len(sorted_x0) - 1):
        gap = sorted_x0[i + 1] - sorted_x0[i]
        if gap >= MIN_COLUMN_GAP:
            separators.append((sorted_x0[i] + sorted_x0[i + 1]) / 2.0)

    if not separators:
        # All blocks share the same x-origin — single column
        return (0.0, page_width)

    # Determine which column interval contains ref_center
    col_x0 = 0.0
    col_x1 = page_width
    for sep in separators:
        if ref_center < sep:
            col_x1 = sep - 1
            break
        col_x0 = sep + 1

    return (col_x0, col_x1)


# ── Background colour detection ───────────────────────────────────────────────

def _page_background_color(page) -> tuple[float, float, float]:
    """
    Detect the page's background fill colour.

    Looks for a filled rectangle that covers ≥ 70% of the page area.
    Falls back to white (1, 1, 1) which is correct for the vast majority
    of PDF documents.
    """
    pw = page.rect.width
    ph = page.rect.height
    page_area = pw * ph

    for d in page.get_drawings():
        r = d["rect"]
        fill = d.get("fill")
        if not fill:
            continue
        drawing_area = max(0.0, r.width) * max(0.0, r.height)
        if drawing_area >= page_area * 0.70:
            return (float(fill[0]), float(fill[1]), float(fill[2]))

    return (1.0, 1.0, 1.0)


# ── Path (drawing) shifter ────────────────────────────────────────────────────

def _shift_drawings(
    page,
    col_x0: float,
    col_x1: float,
    shift_below: float,
    delta: float,
) -> None:
    """
    Adjust simple rectangular path drawings in the column below shift_below.

    Two cases:
    - Rect entirely below shift_below  → cover with background colour and
      redraw at y + delta.
    - Rect straddles shift_below (e.g. sidebar background) → append an
      extension rect of height delta below the current bottom edge.
      Skip if the rect already reaches the page bottom (it covers
      everything implicitly).

    Complex paths (curves, multi-segment polygons) are skipped because
    their geometry cannot be reliably mutated without path parsing.
    """
    page_height = page.rect.height
    bg_color    = _page_background_color(page)

    # "Near page bottom" threshold: anything within two standard line heights
    # of the page edge is treated as page-spanning and left alone.
    near_bottom = page_height - 30.0

    for d in page.get_drawings():
        rect = d["rect"]

        # Must overlap the column x-range (no extra tolerance — _detect_column
        # already leaves a 1 pt gap at each separator edge)
        if rect.x1 <= col_x0 or rect.x0 >= col_x1:
            continue
        # Must extend below the shift point
        if rect.y1 <= shift_below + 1:
            continue
        # Only handle single-rectangle paths
        items = d.get("items", [])
        if len(items) != 1 or items[0][0] != "re":
            continue

        raw_fill  = d.get("fill")
        raw_color = d.get("color")
        line_w    = d.get("width", 1.0)
        fill  = (float(raw_fill[0]),  float(raw_fill[1]),  float(raw_fill[2]))  if raw_fill  else None
        color = (float(raw_color[0]), float(raw_color[1]), float(raw_color[2])) if raw_color else None

        if rect.y0 >= shift_below:
            # ── Entirely below: cover with background colour, redraw shifted ──
            page.draw_rect(rect, color=None, fill=bg_color, overlay=True)
            new_rect = fitz.Rect(
                rect.x0, rect.y0 + delta,
                rect.x1, min(rect.y1 + delta, page_height),
            )
            page.draw_rect(new_rect, color=color, fill=fill, width=line_w, overlay=True)

        else:
            # ── Straddles shift_below: extend bottom downward ─────────────────
            if rect.y1 >= near_bottom:
                # Already (near) page-spanning — extending would overflow
                continue
            extension = fitz.Rect(
                rect.x0, rect.y1,
                rect.x1, min(rect.y1 + delta, page_height),
            )
            # overlay=False so the extension is painted before existing text,
            # keeping text visible on top of the background colour
            page.draw_rect(extension, color=color, fill=fill, width=line_w, overlay=False)


# ── Reflow engine ─────────────────────────────────────────────────────────────

def _reflow(page, changed_rect: fitz.Rect, delta: float) -> list[str]:
    """
    Shift all same-column content below changed_rect.y1 downward by delta points.

    Works at the LINE level (not block level) so individual lines within a
    multi-section block (e.g. all work-experience entries in one PDF block)
    are correctly separated and only the lines below the change point are moved.

    Steps:
    1. Detect which column changed_rect belongs to.
    2. Iterate every line in every in-column block; collect lines that start
       below changed_rect.y1.
    3. Snapshot all span data (text, font, position) before any modification.
    4. Redact (erase) those line rects and re-insert spans delta points lower.
    5. Shift / extend decorative path drawings in the same column.

    Returns a list of warning strings (e.g. page-overflow notices).
    """
    warnings: list[str] = []
    page_height = page.rect.height
    col_x0, col_x1 = _detect_column(page, changed_rect)
    shift_below = changed_rect.y1

    td = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

    span_records: list[dict] = []
    redact_rects: list[fitz.Rect] = []

    for blk in td.get("blocks", []):
        if blk.get("type") != 0:
            continue
        bx0, _by0, bx1, _by1 = blk["bbox"]
        # Skip full-width blocks (page-spanning headers / footers)
        if (bx1 - bx0) > page.rect.width * FULL_WIDTH_RATIO:
            continue
        # Skip blocks in a different column
        if bx1 <= col_x0 or bx0 >= col_x1:
            continue

        for line in blk.get("lines", []):
            lx0, ly0, lx1, ly1 = line["bbox"]
            # Only lines that start strictly below the changed block
            if ly0 <= shift_below + 1:
                continue
            if ly1 + delta > page_height:
                warnings.append(
                    f"Reflow: line at y={ly0:.0f} would reach {ly1 + delta:.0f}pt "
                    f"(page height {page_height:.0f}pt) — content may be clipped."
                )
            redact_rects.append(fitz.Rect(line["bbox"]))
            for span in line.get("spans", []):
                txt = span.get("text", "")
                if not txt:
                    continue
                span_records.append({
                    "text":   txt,
                    "font":   span.get("font",  "Helvetica"),
                    "size":   span.get("size",  10.0),
                    "flags":  span.get("flags", 0),
                    "color":  _color_tuple(span.get("color")),
                    "origin": span["origin"],   # (x, baseline_y) in page coords
                })

    if not redact_rects:
        log.info(
            "Reflow: no lines to shift below y=%.0f in column [%.0f, %.0f]",
            shift_below, col_x0, col_x1,
        )
        return warnings

    # Erase current line positions
    for r in redact_rects:
        page.add_redact_annot(r)
    page.apply_redactions()

    # Re-insert spans at shifted y positions
    for sr in span_records:
        ox, oy = sr["origin"]
        page.insert_text(
            fitz.Point(ox, oy + delta),
            sr["text"],
            fontname=_font_for_redact(sr["font"], sr["flags"]),
            fontsize=sr["size"],
            color=sr["color"],
        )

    # Adjust decorative path drawings in the same column
    _shift_drawings(page, col_x0, col_x1, shift_below, delta)

    log.info(
        "Reflow: shifted %d line(s) / %d span(s) by %.0fpt in column [%.0f, %.0f]",
        len(redact_rects), len(span_records), delta, col_x0, col_x1,
    )
    return warnings


# ── Main replacement engine ───────────────────────────────────────────────────

def _apply_replacements(
    input_path: str,
    output_path: str,
    replacements: list[dict[str, str]],
) -> dict[str, Any]:
    """
    Open *input_path*, apply all text replacements, write *output_path*.

    Algorithm per replacement:
    1. Locate old text (multi-strategy search).
    2. Measure whether the replacement fits in the existing bounding box
       using a throwaway temp page — no side effects on the real document.
    3. If overflow, reflow: shift same-column content below the changed block
       downward by the needed amount, then expand the insertion rect.
    4. Redact individual hit rects (erase only the matched lines).
    5. Insert replacement text; if it still overflows, progressively reduce
       the font size (down to 75%) as a last resort.
    """
    doc = fitz.open(input_path)
    total_replaced = 0
    all_warnings: list[str] = []

    for repl in replacements:
        old_text: str = repl["old"]
        new_text: str = repl["new"]

        if not new_text.strip():
            log.info("Skipping empty replacement for: %r", old_text[:60])
            continue

        safe_new = _safe_text(new_text)
        found = False

        for page in doc:
            rect, hits, style = _find_region(page, old_text)
            if rect is None:
                continue
            found = True

            font = _font_for_redact(style["font"], style["flags"])

            # Measure overflow non-destructively before touching the page
            probe = _measure_textbox(rect, safe_new, font, style["size"])

            if probe < 0:
                needed = -probe + REFLOW_BUFFER_PT
                log.info(
                    "Reflow triggered for %r: need %.0f extra pt",
                    old_text[:40], needed,
                )
                reflow_warns = _reflow(page, rect, needed)
                all_warnings.extend(reflow_warns)

                # Expand the insertion rect into the newly freed space
                new_y1 = min(rect.y1 + needed, page.rect.height - 2)
                rect = fitz.Rect(rect.x0, rect.y0, rect.x1, new_y1)

            # Redact (erase) only the exact matched hit rects
            for r in hits:
                page.add_redact_annot(r)
            page.apply_redactions()

            # Insert with progressive font-size reduction as final fallback
            inserted = False
            for pct in FONT_SIZE_STEPS:
                overflow = page.insert_textbox(
                    rect, safe_new,
                    fontname=font,
                    fontsize=style["size"] * pct,
                    color=style["color"],
                    align=fitz.TEXT_ALIGN_LEFT,
                )
                if overflow >= 0:
                    if pct < 1.0:
                        log.info(
                            "Used %d%% font size for %r",
                            int(pct * 100), old_text[:50],
                        )
                    inserted = True
                    break

            if not inserted:
                msg = f"Text overflow even at 75% font size: {old_text[:60]!r}"
                all_warnings.append(msg)
                log.warning(msg)

            total_replaced += 1

        if not found:
            msg = f"Text not found in PDF: {old_text[:80]!r}"
            all_warnings.append(msg)
            log.warning(msg)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path, garbage=4, deflate=True)
    doc.close()

    return {"replaced": total_replaced, "warnings": all_warnings}


# ── HTTP server ───────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self._json_response(200, {"status": "ok"})
            return
        self._json_response(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path != "/replace":
            self._json_response(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            input_pdf    = body.get("input_pdf")
            output_pdf   = body.get("output_pdf")
            replacements = body.get("replacements", [])

            if not input_pdf or not output_pdf:
                self._json_response(400, {"error": "input_pdf and output_pdf are required"})
                return
            if not os.path.isfile(input_pdf):
                self._json_response(400, {"error": f"Input PDF not found: {input_pdf}"})
                return

            log.info("Replacing %d span(s) in %s → %s",
                     len(replacements), input_pdf, output_pdf)
            result = _apply_replacements(input_pdf, output_pdf, replacements)
            self._json_response(200, result)

        except json.JSONDecodeError:
            self._json_response(400, {"error": "Invalid JSON"})
        except Exception as exc:
            log.exception("Replacement failed")
            self._json_response(500, {"error": str(exc)})

    def _json_response(self, status: int, data: dict) -> None:
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: Any) -> None:
        log.info(format, *args)


def main() -> None:
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    log.info("PyMuPDF replace server listening on :%d", PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
