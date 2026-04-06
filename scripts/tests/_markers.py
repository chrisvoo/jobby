"""Shared pytest markers for the pdf_replace test suite."""
import pytest

try:
    import fitz  # noqa: F401
    _HAS_FITZ = True
except ImportError:
    _HAS_FITZ = False

requires_fitz = pytest.mark.skipif(not _HAS_FITZ, reason="PyMuPDF (fitz) not installed")
