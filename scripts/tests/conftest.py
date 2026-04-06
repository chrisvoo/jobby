"""
Shared pytest fixtures for pdf_replace tests.

The `scripts/` directory is added to sys.path so tests can
`from pdf_replace import ...` directly.
"""
from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# Also ensure tests/ itself is on sys.path so _markers can be imported by test modules
sys.path.insert(0, os.path.dirname(__file__))


# ── PDF factory fixtures ───────────────────────────────────────────────────────

def _build_pdf(path: str, entries: list[tuple[str, tuple[float, float], float]]) -> None:
    """
    Create a single-page A4 PDF.

    entries is a list of (text, (x, y), fontsize).
    Each text run is placed at the given point with Helvetica.
    Using a wide 595×842 A4 page ensures there is ample horizontal space for
    same-length substitutions to never trigger overflow.
    """
    import fitz as _fitz
    doc = _fitz.open()
    page = doc.new_page(width=595, height=842)
    for text, origin, size in entries:
        page.insert_text(origin, text, fontname="Helvetica", fontsize=size)
    doc.save(path)
    doc.close()


@pytest.fixture()
def tmp_pdf(tmp_path):
    """
    Return a factory: ``factory(text, *, x=72, y=100, size=11) -> str``.

    Creates a minimal single-line PDF with *text* at the given position and
    returns the file path.  For multi-line PDFs pass a list of (text, origin,
    size) tuples via the *entries* keyword.
    """
    def factory(
        text: str | None = None,
        *,
        x: float = 72,
        y: float = 100,
        size: float = 11,
        entries: list[tuple[str, tuple[float, float], float]] | None = None,
        filename: str = "input.pdf",
    ) -> str:
        pdf_path = str(tmp_path / filename)
        if entries is not None:
            _build_pdf(pdf_path, entries)
        else:
            _build_pdf(pdf_path, [(text or "", (x, y), size)])
        return pdf_path

    return factory


@pytest.fixture()
def output_pdf(tmp_path):
    """Path to a not-yet-created output PDF inside pytest's tmp directory."""
    return str(tmp_path / "output.pdf")
