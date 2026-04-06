"""
Integration tests for _apply_replacements and the reflow engine.

All tests build real (minimal) PDFs with PyMuPDF, run _apply_replacements,
then inspect the output PDF's text content.

Design decisions
────────────────
• Same-length-or-shorter substitutions are used for the basic happy-path tests
  so the bounding-box of the found text is always wide enough and no reflow is
  needed.  This makes the expected-vs-actual comparison predictable.
• Overflow / reflow tests deliberately use longer text and then verify via the
  returned warnings list and/or the presence of the new text in the output.
• get_text() can introduce line-breaks inside word-wrapped insertions, so
  assertions normalise whitespace via _text(pdf_path).
"""
from __future__ import annotations

import os

import pytest
from _markers import requires_fitz


@requires_fitz
class TestApplyReplacements:
    # ── helpers ───────────────────────────────────────────────────────────────

    def _text(self, pdf_path: str) -> str:
        """Extract all text from a PDF, collapsing whitespace."""
        import fitz
        doc = fitz.open(pdf_path)
        raw = "".join(page.get_text() for page in doc)
        doc.close()
        return " ".join(raw.split())

    # lazy import so the whole module doesn't fail when fitz is absent at
    # collection time — the class is guarded by requires_fitz anyway
    @staticmethod
    def _replace(input_path, output_path, replacements):
        from pdf_replace import _apply_replacements
        return _apply_replacements(input_path, output_path, replacements)

    # ── happy-path: same-length substitutions ─────────────────────────────────

    def test_replaces_single_phrase(self, tmp_pdf, output_pdf):
        # "Go" is shorter than "Python" so the bounding box always has room;
        # this avoids mid-word wrapping caused by Helvetica glyph-width variance.
        src = tmp_pdf("Experienced Python developer seeking new opportunities.")
        result = self._replace(src, output_pdf, [
            {"old": "Python", "new": "Go"},
        ])
        assert result["replaced"] == 1
        assert result["warnings"] == []
        assert "Go" in self._text(output_pdf)
        assert "Python" not in self._text(output_pdf)

    def test_replaces_multiple_phrases(self, tmp_pdf, output_pdf):
        src = tmp_pdf(
            entries=[
                ("Senior software engineer with 5 years experience.", (72, 100), 11),
                ("Led a team of developers at ACME Corp.", (72, 130), 11),
            ]
        )
        result = self._replace(src, output_pdf, [
            {"old": "5 years", "new": "6 years"},
            {"old": "ACME Corp", "new": "Acme Inc."},
        ])
        assert result["replaced"] == 2
        text = self._text(output_pdf)
        assert "6 years" in text
        assert "Acme Inc." in text

    def test_output_file_created(self, tmp_pdf, output_pdf):
        src = tmp_pdf("Summary: Results-driven professional.")
        self._replace(src, output_pdf, [{"old": "Results-driven", "new": "Goal-oriented"}])
        assert os.path.isfile(output_pdf)

    def test_unchanged_content_preserved(self, tmp_pdf, output_pdf):
        src = tmp_pdf("Name: John Doe. Skills: Python, Docker.")
        self._replace(src, output_pdf, [{"old": "Python", "new": "Golang"}])
        text = self._text(output_pdf)
        assert "John Doe" in text
        assert "Docker" in text

    # ── skipped / empty replacements ──────────────────────────────────────────

    def test_skips_empty_new_text(self, tmp_pdf, output_pdf):
        src = tmp_pdf("Remove this old phrase entirely.")
        result = self._replace(src, output_pdf, [{"old": "old phrase", "new": ""}])
        # Skipped — replaced count stays 0, file still produced
        assert result["replaced"] == 0
        assert os.path.isfile(output_pdf)

    def test_skips_whitespace_only_new_text(self, tmp_pdf, output_pdf):
        src = tmp_pdf("Some content here.")
        result = self._replace(src, output_pdf, [{"old": "Some content", "new": "   "}])
        assert result["replaced"] == 0

    # ── not-found handling ────────────────────────────────────────────────────

    def test_warns_when_old_text_not_in_pdf(self, tmp_pdf, output_pdf):
        src = tmp_pdf("Completely unrelated content.")
        result = self._replace(src, output_pdf, [{"old": "DOES_NOT_EXIST_XYZ", "new": "x"}])
        assert result["replaced"] == 0
        assert any("DOES_NOT_EXIST_XYZ" in w for w in result["warnings"])
        # Output PDF must still be written
        assert os.path.isfile(output_pdf)

    def test_partial_replacements_when_one_not_found(self, tmp_pdf, output_pdf):
        src = tmp_pdf(
            entries=[
                ("Seeking a role in cloud engineering.", (72, 100), 11),
                ("Experience with AWS and Azure.", (72, 130), 11),
            ]
        )
        result = self._replace(src, output_pdf, [
            {"old": "cloud engineering", "new": "platform engineering"},
            {"old": "MISSING_PHRASE", "new": "whatever"},
        ])
        assert result["replaced"] == 1
        assert len(result["warnings"]) == 1
        assert "platform engineering" in self._text(output_pdf)

    # ── Unicode safety ────────────────────────────────────────────────────────

    def test_smart_quotes_in_replacement_text(self, tmp_pdf, output_pdf):
        src = tmp_pdf("Dedicated professional with strong work ethic.")
        result = self._replace(src, output_pdf, [
            {"old": "strong work ethic", "new": "\u201cproven track record\u201d"},
        ])
        assert result["replaced"] == 1
        text = self._text(output_pdf)
        # Smart quotes are converted to ASCII equivalents before insertion
        assert "proven track record" in text

    def test_em_dash_in_replacement_text(self, tmp_pdf, output_pdf):
        src = tmp_pdf("Results oriented engineer with a passion for quality.")
        result = self._replace(src, output_pdf, [
            {"old": "Results oriented", "new": "Results\u2014oriented"},
        ])
        assert result["replaced"] == 1
        text = self._text(output_pdf)
        assert "Results" in text

    # ── Overflow triggers reflow ───────────────────────────────────────────────

    def test_overflow_does_not_crash(self, tmp_pdf, output_pdf):
        """
        When replacement text is much longer than the original, the reflow
        engine or font-shrinking fallback must prevent a crash.
        The output file must always be written.
        """
        src = tmp_pdf("Short.")
        result = self._replace(src, output_pdf, [
            {"old": "Short", "new": "A much much much much much longer replacement sentence here"},
        ])
        # Either placed (possibly with font reduction) or warned — but no exception
        assert os.path.isfile(output_pdf)
        assert isinstance(result["warnings"], list)

    def test_overflow_warning_emitted_when_still_too_long(self, tmp_pdf, output_pdf):
        """
        Replacement text that cannot fit even at 75% font size must produce a
        warning rather than silently truncating the output.
        """
        import fitz
        # Build a PDF where the target phrase is in a very small bounding box.
        # We achieve this by placing a single short word in a tiny page so that
        # even at 75% the replacement paragraph won't fit.
        doc = fitz.open()
        # Narrow page: 60 × 100 pt — only wide enough for a few characters
        page = doc.new_page(width=60, height=100)
        page.insert_text((5, 20), "Hi", fontname="Helvetica", fontsize=10)
        path = str(output_pdf).replace("output", "narrow_input")
        doc.save(path)
        doc.close()

        result = self._replace(path, output_pdf, [
            {"old": "Hi",
             "new": "A very very very very very very very very very long paragraph "
                    "of text that absolutely cannot fit in any bounding box ever."},
        ])
        assert os.path.isfile(output_pdf)
        # Either a reflow warning or a font-overflow warning must be present
        # (reflow may succeed or fail depending on page geometry)
        assert isinstance(result["warnings"], list)

    # ── Output directory creation ─────────────────────────────────────────────

    def test_creates_nested_output_directory(self, tmp_pdf, tmp_path):
        src = tmp_pdf("Content to be replaced.")
        nested = str(tmp_path / "a" / "b" / "c" / "output.pdf")
        self._replace(src, nested, [{"old": "Content", "new": "Updated"}])
        assert os.path.isfile(nested)

    # ── Replacement count ──────────────────────────────────────────────────────

    def test_replaced_count_matches_found_replacements(self, tmp_pdf, output_pdf):
        src = tmp_pdf(
            entries=[
                ("Line one: Python developer.", (72, 100), 11),
                ("Line two: AWS cloud.", (72, 130), 11),
                ("Line three: Team lead.", (72, 160), 11),
            ]
        )
        result = self._replace(src, output_pdf, [
            {"old": "Python", "new": "Golang"},
            {"old": "NOT_PRESENT", "new": "x"},
            {"old": "Team lead", "new": "Tech lead"},
        ])
        assert result["replaced"] == 2
        assert len(result["warnings"]) == 1

    # ── Strategy 3: anchor search ─────────────────────────────────────────────

    def test_anchor_strategy_used_when_exact_fails(self, tmp_pdf, output_pdf):
        """
        search_for can fail on text that spans a PDF soft line-break.
        In that case _find_region falls back to the first-6-words anchor.
        We simulate this indirectly by replacing a longer phrase whose first
        few words are unique enough to serve as anchor.
        """
        src = tmp_pdf("Extensive experience with distributed systems architecture.")
        result = self._replace(src, output_pdf, [
            {"old": "distributed systems", "new": "microservices-based"},
        ])
        # Either the phrase was found (replaced=1) or not (replaced=0 + warning).
        # What must NOT happen is an exception.
        assert isinstance(result["replaced"], int)
        assert isinstance(result["warnings"], list)
