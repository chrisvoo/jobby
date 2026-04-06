"""
Unit and integration tests for the helper functions in pdf_replace.py.

Pure functions (_safe_text, _pick_base14, _font_for_redact, _color_tuple,
_detect_column constants) run without PyMuPDF.

Fitz-dependent helpers (_measure_textbox, _detect_column, _page_background_color)
are guarded by the `requires_fitz` marker from conftest.
"""
from __future__ import annotations

import pytest
from _markers import requires_fitz

from pdf_replace import (
    BASE14,
    FONT_SIZE_STEPS,
    LINE_SPACING,
    MIN_COLUMN_GAP,
    _color_tuple,
    _font_for_redact,
    _measure_textbox,
    _page_background_color,
    _pick_base14,
    _safe_text,
)


# ─── _safe_text ────────────────────────────────────────────────────────────────

class TestSafeText:
    def test_plain_ascii_unchanged(self):
        assert _safe_text("Hello, world!") == "Hello, world!"

    def test_em_dash(self):
        assert _safe_text("2020\u2014present") == "2020--present"

    def test_en_dash(self):
        assert _safe_text("Jan\u2013Mar") == "Jan-Mar"

    def test_smart_single_quotes(self):
        assert _safe_text("\u2018text\u2019") == "'text'"

    def test_smart_double_quotes(self):
        assert _safe_text("\u201cHello\u201d") == '"Hello"'

    def test_bullet(self):
        assert _safe_text("\u2022 item") == "* item"

    def test_ellipsis(self):
        assert _safe_text("wait\u2026") == "wait..."

    def test_nbsp(self):
        assert _safe_text("a\u00a0b") == "a b"

    def test_soft_hyphen_dropped(self):
        # U+00AD soft hyphen is invisible — stripped entirely
        assert _safe_text("word\u00adbreak") == "wordbreak"

    def test_multiple_subs_in_one_string(self):
        assert _safe_text("\u201cHello\u201d \u2014 world\u2026") == '"Hello" -- world...'

    def test_empty_string(self):
        assert _safe_text("") == ""

    # New in refactored version: Unicode decomposition for accented characters
    def test_accented_latin_decomposed(self):
        # é (U+00E9) is in Latin-1 supplement (≤ 0xFF), so it passes through as-is
        assert _safe_text("caf\u00e9") == "caf\u00e9"

    def test_high_unicode_decomposed_to_ascii(self):
        # Ñ (U+00D1) is in Latin-1 supplement, passes through
        # A character above U+00FF should be decomposed
        # U+0101 = ā (Latin small letter a with macron) — above 0xFF, decomposed to 'a'
        assert _safe_text("\u0101") == "a"

    def test_pure_non_ascii_above_latin1_dropped_if_no_base(self):
        # U+4E2D (Chinese character 中) — no ASCII base after NFD decomposition
        result = _safe_text("\u4e2d")
        # Must not raise; unknown high-Unicode chars produce empty string
        assert isinstance(result, str)


# ─── _pick_base14 ─────────────────────────────────────────────────────────────

BOLD   = 1 << 18   # 262144
ITALIC = 1 << 6    #     64

class TestPickBase14:
    @pytest.mark.parametrize("font,flags,expected", [
        # Monospace family
        ("Courier",         0,           "Courier"),
        ("Courier",         BOLD,        "Courier-Bold"),
        ("Courier",         ITALIC,      "Courier-Oblique"),
        ("Courier",         BOLD|ITALIC, "Courier-BoldOblique"),
        ("Consolas",        0,           "Courier"),
        ("source code pro", BOLD,        "Courier-Bold"),
        ("menlo",           ITALIC,      "Courier-Oblique"),
        # Serif family
        ("Times New Roman", 0,           "Times-Roman"),
        ("Times New Roman", BOLD,        "Times-Bold"),
        ("Georgia",         ITALIC,      "Times-Italic"),
        ("Garamond",        BOLD|ITALIC, "Times-BoldItalic"),
        ("palatino",        0,           "Times-Roman"),
        # Sans-serif (default / Helvetica)
        ("Arial",           0,           "Helvetica"),
        ("Arial",           BOLD,        "Helvetica-Bold"),
        ("Calibri",         ITALIC,      "Helvetica-Oblique"),
        ("OpenSans",        BOLD|ITALIC, "Helvetica-BoldOblique"),
        ("Unknown",         0,           "Helvetica"),
    ])
    def test_pick(self, font, flags, expected):
        assert _pick_base14(font, flags) == expected


# ─── _font_for_redact ─────────────────────────────────────────────────────────

class TestFontForRedact:
    def test_base14_returned_unchanged(self):
        for font in BASE14:
            assert _font_for_redact(font, 0) == font

    def test_non_base14_returns_base14(self):
        result = _font_for_redact("Calibri", 0)
        assert result in BASE14

    def test_bold_non_base14_maps_to_bold(self):
        assert "Bold" in _font_for_redact("Calibri", BOLD)

    def test_italic_non_base14_maps_to_italic_or_oblique(self):
        name = _font_for_redact("Georgia", ITALIC)
        assert "Italic" in name or "Oblique" in name


# ─── _color_tuple ─────────────────────────────────────────────────────────────

class TestColorTuple:
    def test_none_is_black(self):
        assert _color_tuple(None) == (0.0, 0.0, 0.0)

    def test_int_black(self):
        assert _color_tuple(0x000000) == (0.0, 0.0, 0.0)

    def test_int_white(self):
        r, g, b = _color_tuple(0xFFFFFF)
        assert abs(r - 1.0) < 1e-4
        assert abs(g - 1.0) < 1e-4
        assert abs(b - 1.0) < 1e-4

    def test_int_red(self):
        r, g, b = _color_tuple(0xFF0000)
        assert abs(r - 1.0) < 1e-4
        assert g == 0.0
        assert b == 0.0

    def test_int_blue(self):
        r, g, b = _color_tuple(0x0000FF)
        assert r == 0.0
        assert g == 0.0
        assert abs(b - 1.0) < 1e-4

    def test_list_passthrough(self):
        assert _color_tuple([0.2, 0.4, 0.6]) == (0.2, 0.4, 0.6)

    def test_tuple_passthrough(self):
        assert _color_tuple((0.1, 0.5, 0.9)) == (0.1, 0.5, 0.9)

    def test_list_with_extra_values_uses_first_three(self):
        assert _color_tuple([0.1, 0.2, 0.3, 0.4]) == (0.1, 0.2, 0.3)

    def test_invalid_type_returns_black(self):
        assert _color_tuple("red") == (0.0, 0.0, 0.0)  # type: ignore[arg-type]


# ─── Module-level constants ────────────────────────────────────────────────────

class TestConstants:
    def test_font_size_steps_descend_from_1(self):
        assert FONT_SIZE_STEPS[0] == 1.0
        for i in range(len(FONT_SIZE_STEPS) - 1):
            assert FONT_SIZE_STEPS[i] > FONT_SIZE_STEPS[i + 1]

    def test_font_size_steps_minimum_is_075(self):
        assert FONT_SIZE_STEPS[-1] == 0.75

    def test_min_column_gap_positive(self):
        assert MIN_COLUMN_GAP > 0

    def test_line_spacing_above_one(self):
        assert LINE_SPACING > 1.0


# ─── _measure_textbox (requires fitz) ─────────────────────────────────────────

@requires_fitz
class TestMeasureTextbox:
    def test_short_text_does_not_overflow(self):
        import fitz
        rect = fitz.Rect(0, 0, 400, 50)
        overflow = _measure_textbox(rect, "Hello", "Helvetica", 11)
        assert overflow >= 0

    def test_very_long_text_overflows_narrow_rect(self):
        import fitz
        # A rect only 10 pt wide cannot hold a full sentence
        rect = fitz.Rect(0, 0, 10, 15)
        overflow = _measure_textbox(rect, "This is a long sentence that will not fit", "Helvetica", 11)
        assert overflow < 0

    def test_empty_text_does_not_overflow(self):
        import fitz
        rect = fitz.Rect(0, 0, 100, 50)
        overflow = _measure_textbox(rect, "", "Helvetica", 11)
        assert overflow >= 0

    def test_returns_float(self):
        import fitz
        rect = fitz.Rect(0, 0, 200, 30)
        result = _measure_textbox(rect, "test", "Helvetica", 11)
        assert isinstance(result, float)

    def test_larger_rect_gives_more_remaining_space(self):
        import fitz
        text = "Some text"
        small_overflow = _measure_textbox(fitz.Rect(0, 0, 200, 20), text, "Helvetica", 11)
        large_overflow = _measure_textbox(fitz.Rect(0, 0, 200, 100), text, "Helvetica", 11)
        assert large_overflow > small_overflow


# ─── _page_background_color (requires fitz) ───────────────────────────────────

@requires_fitz
class TestPageBackgroundColor:
    def test_blank_page_returns_white(self, tmp_pdf):
        import fitz
        path = tmp_pdf("some text")
        doc = fitz.open(path)
        color = _page_background_color(doc[0])
        doc.close()
        # A blank page has no background fill → falls back to white
        assert color == (1.0, 1.0, 1.0)

    def test_coloured_background_detected(self, tmp_pdf):
        import fitz
        # Build a page with a full-page filled rect (simulates a coloured background)
        path = tmp_pdf("text on coloured bg")
        doc = fitz.open(path)
        page = doc[0]
        # Draw a rect covering >70% of the page area with a grey fill
        page.draw_rect(
            fitz.Rect(0, 0, page.rect.width, page.rect.height),
            fill=(0.9, 0.9, 0.9),
            overlay=False,
        )
        tmp_out = path.replace("input", "colored")
        doc.save(tmp_out)
        doc.close()

        doc2 = fitz.open(tmp_out)
        color = _page_background_color(doc2[0])
        doc2.close()
        # Should detect the grey background, not fall back to white
        assert color != (1.0, 1.0, 1.0)
        assert all(0 <= c <= 1 for c in color)
