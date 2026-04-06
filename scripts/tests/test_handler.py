"""
Tests for the HTTP handler (Handler class) in pdf_replace.py.

Rather than spinning up a live server, we instantiate Handler directly and
call do_GET / do_POST with mocked socket objects, capturing what
_json_response was called with.  _json_response itself is tested separately
to verify it produces well-formed HTTP bytes.
"""
from __future__ import annotations

import io
import json
from unittest.mock import MagicMock, patch

import pytest

from pdf_replace import Handler


# ── Handler factory ───────────────────────────────────────────────────────────

def _make_handler(
    path: str = "/replace",
    body: dict | None = None,
    *,
    raw_body: bytes | None = None,
    content_length: int | None = None,
) -> Handler:
    """
    Build a Handler instance without a real socket or server.

    The wfile / send_* methods are replaced by MagicMock so no actual I/O
    occurs.  _json_response is also mocked so the tests can inspect what status
    code and payload the handler decided to send.
    """
    encoded = raw_body if raw_body is not None else json.dumps(body or {}).encode()
    length  = content_length if content_length is not None else len(encoded)

    h = Handler.__new__(Handler)
    h.path            = path
    h.rfile           = io.BytesIO(encoded)
    h.headers         = {"Content-Length": str(length)}
    h._json_response  = MagicMock()
    h.send_response   = MagicMock()
    h.send_header     = MagicMock()
    h.end_headers     = MagicMock()
    h.wfile           = MagicMock()
    return h


def _status(h: Handler) -> int:
    return h._json_response.call_args[0][0]

def _body(h: Handler) -> dict:
    return h._json_response.call_args[0][1]


# ── GET /health ───────────────────────────────────────────────────────────────

class TestGetHealth:
    def test_returns_200_ok(self):
        h = _make_handler("/health")
        h.do_GET()
        assert _status(h) == 200
        assert _body(h) == {"status": "ok"}

    def test_called_once(self):
        h = _make_handler("/health")
        h.do_GET()
        h._json_response.assert_called_once()

    def test_unknown_path_returns_404(self):
        h = _make_handler("/unknown")
        h.do_GET()
        assert _status(h) == 404
        assert "error" in _body(h)


# ── POST validation ───────────────────────────────────────────────────────────

class TestPostValidation:
    def test_unknown_path_returns_404(self):
        h = _make_handler("/bad_path", {})
        h.do_POST()
        assert _status(h) == 404

    def test_missing_input_pdf_returns_400(self):
        h = _make_handler("/replace", {"output_pdf": "/out.pdf", "replacements": []})
        h.do_POST()
        assert _status(h) == 400
        assert "input_pdf" in _body(h)["error"]

    def test_missing_output_pdf_returns_400(self):
        h = _make_handler("/replace", {"input_pdf": "/in.pdf", "replacements": []})
        h.do_POST()
        assert _status(h) == 400
        assert "output_pdf" in _body(h)["error"]

    def test_missing_both_fields_returns_400(self):
        h = _make_handler("/replace", {"replacements": []})
        h.do_POST()
        assert _status(h) == 400

    def test_invalid_json_returns_400(self):
        h = _make_handler("/replace", raw_body=b"not-valid-json{{{")
        h.do_POST()
        assert _status(h) == 400
        assert _body(h)["error"] == "Invalid JSON"

    def test_zero_content_length_invalid_json_returns_400(self):
        # Content-Length: 0 → rfile.read(0) = b"" → json.loads("") raises JSONDecodeError
        h = _make_handler("/replace", raw_body=b"", content_length=0)
        h.do_POST()
        assert _status(h) == 400

    def test_nonexistent_input_file_returns_400(self):
        h = _make_handler("/replace", {
            "input_pdf":    "/absolutely/does/not/exist.pdf",
            "output_pdf":   "/out.pdf",
            "replacements": [],
        })
        h.do_POST()
        assert _status(h) == 400
        assert "not found" in _body(h)["error"].lower() or "Input PDF" in _body(h)["error"]


# ── POST happy path ───────────────────────────────────────────────────────────

class TestPostHappyPath:
    def test_calls_apply_replacements_and_returns_200(self, tmp_path):
        pdf = tmp_path / "input.pdf"
        pdf.write_bytes(b"%PDF-1.4 dummy")
        fake_result = {"replaced": 1, "warnings": []}

        h = _make_handler("/replace", {
            "input_pdf":    str(pdf),
            "output_pdf":   str(tmp_path / "output.pdf"),
            "replacements": [{"old": "foo", "new": "bar"}],
        })
        with patch("pdf_replace._apply_replacements", return_value=fake_result) as mock_fn:
            h.do_POST()

        mock_fn.assert_called_once_with(
            str(pdf),
            str(tmp_path / "output.pdf"),
            [{"old": "foo", "new": "bar"}],
        )
        assert _status(h) == 200
        assert _body(h) == fake_result

    def test_empty_replacements_list_forwarded(self, tmp_path):
        pdf = tmp_path / "input.pdf"
        pdf.write_bytes(b"%PDF-1.4 dummy")
        fake_result = {"replaced": 0, "warnings": []}

        h = _make_handler("/replace", {
            "input_pdf":    str(pdf),
            "output_pdf":   str(tmp_path / "output.pdf"),
            "replacements": [],
        })
        with patch("pdf_replace._apply_replacements", return_value=fake_result) as mock_fn:
            h.do_POST()

        _, _, passed = mock_fn.call_args[0]
        assert passed == []
        assert _status(h) == 200

    def test_missing_replacements_key_defaults_to_empty_list(self, tmp_path):
        pdf = tmp_path / "input.pdf"
        pdf.write_bytes(b"%PDF-1.4 dummy")
        fake_result = {"replaced": 0, "warnings": []}

        h = _make_handler("/replace", {
            "input_pdf":  str(pdf),
            "output_pdf": str(tmp_path / "output.pdf"),
            # no "replacements" key
        })
        with patch("pdf_replace._apply_replacements", return_value=fake_result) as mock_fn:
            h.do_POST()

        _, _, passed = mock_fn.call_args[0]
        assert passed == []
        assert _status(h) == 200

    def test_internal_exception_returns_500(self, tmp_path):
        pdf = tmp_path / "input.pdf"
        pdf.write_bytes(b"%PDF-1.4 dummy")

        h = _make_handler("/replace", {
            "input_pdf":    str(pdf),
            "output_pdf":   str(tmp_path / "output.pdf"),
            "replacements": [],
        })
        with patch("pdf_replace._apply_replacements", side_effect=RuntimeError("boom")):
            h.do_POST()

        assert _status(h) == 500
        assert "boom" in _body(h)["error"]

    def test_warnings_from_apply_replacements_included_in_response(self, tmp_path):
        pdf = tmp_path / "input.pdf"
        pdf.write_bytes(b"%PDF-1.4 dummy")
        fake_result = {"replaced": 0, "warnings": ["Text not found in PDF: 'old'"]}

        h = _make_handler("/replace", {
            "input_pdf":    str(pdf),
            "output_pdf":   str(tmp_path / "output.pdf"),
            "replacements": [{"old": "old", "new": "new"}],
        })
        with patch("pdf_replace._apply_replacements", return_value=fake_result):
            h.do_POST()

        assert _status(h) == 200
        assert len(_body(h)["warnings"]) == 1


# ── _json_response wire format ────────────────────────────────────────────────

class TestJsonResponseWireFormat:
    """Verify _json_response writes correct HTTP bytes (real method, not mocked)."""

    def _make_real_handler(self) -> Handler:
        h = Handler.__new__(Handler)
        h.send_response = MagicMock()
        h.send_header   = MagicMock()
        h.end_headers   = MagicMock()
        h.wfile         = MagicMock()
        return h

    def test_correct_status_code_sent(self):
        h = self._make_real_handler()
        h._json_response(201, {"created": True})
        h.send_response.assert_called_once_with(201)

    def test_content_type_header_set(self):
        h = self._make_real_handler()
        h._json_response(200, {})
        header_calls = [(a[0], a[1]) for a, _ in h.send_header.call_args_list]
        assert ("Content-Type", "application/json") in header_calls

    def test_content_length_matches_body(self):
        h = self._make_real_handler()
        payload = {"key": "value"}
        h._json_response(200, payload)
        written: bytes = h.wfile.write.call_args[0][0]
        header_calls = {a[0]: a[1] for a, _ in h.send_header.call_args_list}
        assert int(header_calls["Content-Length"]) == len(written)

    def test_body_is_valid_json(self):
        h = self._make_real_handler()
        data = {"replaced": 3, "warnings": ["w1"]}
        h._json_response(200, data)
        written: bytes = h.wfile.write.call_args[0][0]
        parsed = json.loads(written)
        assert parsed == data

    def test_end_headers_called(self):
        h = self._make_real_handler()
        h._json_response(404, {"error": "Not found"})
        h.end_headers.assert_called_once()
