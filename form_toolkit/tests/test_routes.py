# tests/test_routes.py
import json
from io import BytesIO
from unittest.mock import patch

import pytest

from app import create_app


@pytest.fixture
def client():
    app = create_app("development")
    app.config["TESTING"] = True
    # API key'ler set edilmeli ki doğru dallara girsin
    app.config["APP_CONFIG"].LLAMAPARSE_API_KEY = "test-llama-key"
    app.config["APP_CONFIG"].ANTHROPIC_API_KEY = "test-anthropic-key"
    with app.test_client() as c:
        yield c


def test_parse_document_no_file(client):
    """POST /api/parse-document dosya olmadan 400 döndürmeli."""
    resp = client.post("/api/parse-document")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "error" in data


def test_parse_document_returns_missing_fields(client):
    """Mock extract_with_claude → (mappings, missing_fields) tuple döner."""
    mock_mappings = [
        {
            "extracted_key": "Soyadı",
            "extracted_value": "YILMAZ",
            "matched_field_id": "field_01_surname",
            "confidence": 0.95,
            "field_label": "Soyadı",
            "field_type": "char_boxes",
            "max_length": 20,
            "value_fits": True,
        }
    ]
    mock_missing = [
        {"field_id": "field_19_phone", "label": "Telefon", "reason": "Belgede yok"}
    ]

    with patch("api.routes.parse_document") as mock_parse, \
         patch("api.routes.extract_with_claude") as mock_extract:
        mock_parse.return_value = {
            "raw_text": "Soyadı: YILMAZ",
            "extracted_pairs": [],
            "filename": "test.pdf",
        }
        mock_extract.return_value = (mock_mappings, mock_missing)

        data = BytesIO(b"%PDF-1.4 fake pdf content")
        resp = client.post(
            "/api/parse-document",
            data={"document": (data, "test.pdf")},
            content_type="multipart/form-data",
        )

    assert resp.status_code == 200
    result = resp.get_json()
    assert "missing_fields" in result
    assert len(result["missing_fields"]) == 1
    assert result["mappings"][0]["matched_field_id"] == "field_01_surname"


def test_generate_pdf_returns_pdf(client):
    """POST /api/generate-pdf geçerli veri ile PDF döndürmeli."""
    payload = {
        "field_01_surname": "YILMAZ",
        "field_04_name_r1": "MEHMET",
    }
    resp = client.post(
        "/api/generate-pdf",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.content_type == "application/pdf"
    assert resp.data[:4] == b"%PDF"
