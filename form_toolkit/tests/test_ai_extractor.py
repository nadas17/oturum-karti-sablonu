# tests/test_ai_extractor.py
import json
import os
from unittest.mock import MagicMock, patch

import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture
def field_map():
    path = os.path.join(BASE_DIR, "assets", "form_field_map_v3.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def test_build_field_schema_excludes_photo_box(field_map):
    from core.ai_extractor import build_field_schema
    schema = build_field_schema(field_map)
    types = {s["type"] for s in schema}
    assert "photo_box" not in types
    assert "info_box" not in types
    assert len(schema) > 0


def test_system_prompt_formatting(field_map):
    from core.ai_extractor import build_field_schema, SYSTEM_PROMPT_TEMPLATE
    schema = build_field_schema(field_map)
    schema_json = json.dumps(schema, ensure_ascii=False, indent=2)
    # format() placeholder injection hatasız çalışmalı
    prompt = SYSTEM_PROMPT_TEMPLATE.format(field_schema_json=schema_json)
    assert "field_01_surname" in prompt


def test_system_prompt_contains_translation_rules():
    from core.ai_extractor import SYSTEM_PROMPT_TEMPLATE
    assert "KAWALER" in SYSTEM_PROMPT_TEMPLATE
    assert "TURCJA" in SYSTEM_PROMPT_TEMPLATE
    assert "PANNA" in SYSTEM_PROMPT_TEMPLATE


def test_clean_json_response_strips_code_fence():
    from core.ai_extractor import _clean_json_response
    raw = '```json\n{"fields": {"a": "b"}}\n```'
    cleaned = _clean_json_response(raw)
    parsed = json.loads(cleaned)
    assert parsed == {"fields": {"a": "b"}}


def test_parse_new_format_fields_and_missing(field_map):
    """Yeni format: {"fields": {...}, "missing_fields": [...]} parse edilmeli."""
    from core.ai_extractor import _clean_json_response
    response_text = json.dumps({
        "fields": {"field_01_surname": "YILMAZ", "field_04_name_r1": "MEHMET"},
        "missing_fields": [
            {"field_id": "field_19_phone", "label": "Telefon", "reason": "Belgede yok"}
        ],
    })
    cleaned = _clean_json_response(response_text)
    parsed = json.loads(cleaned)
    assert "fields" in parsed
    assert parsed["fields"]["field_01_surname"] == "YILMAZ"
    assert len(parsed["missing_fields"]) == 1


def test_parse_old_format_backward_compat():
    """Düz {"field_id": "value"} formatı hâlâ çalışmalı."""
    from core.ai_extractor import _clean_json_response
    old_format = json.dumps({"field_01_surname": "YILMAZ"})
    cleaned = _clean_json_response(old_format)
    parsed = json.loads(cleaned)
    # "fields" key yok — eski format
    assert "fields" not in parsed
    assert parsed["field_01_surname"] == "YILMAZ"


def test_extract_with_claude_mock(field_map):
    """API çağrısı mock'lanarak extract_with_claude tuple döndürmeli."""
    from core.ai_extractor import extract_with_claude

    mock_response = MagicMock()
    mock_response.content = [MagicMock()]
    mock_response.content[0].text = json.dumps({
        "fields": {"field_01_surname": "KOWALSKI"},
        "missing_fields": [
            {"field_id": "field_19_phone", "label": "Telefon", "reason": "Yok"}
        ],
    })

    with patch("core.ai_extractor.anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = mock_response
        mappings, missing = extract_with_claude("raw text", field_map, "test-key")

    assert isinstance(mappings, list)
    assert isinstance(missing, list)
    assert len(mappings) == 1
    assert mappings[0]["matched_field_id"] == "field_01_surname"
    assert mappings[0]["extracted_value"] == "KOWALSKI"
    assert len(missing) == 1


def test_extract_with_claude_retries_on_timeout(field_map):
    """APITimeoutError ilk denemede olursa retry yapılmalı."""
    from core.ai_extractor import extract_with_claude

    import anthropic as _anthropic

    mock_response = MagicMock()
    mock_response.content = [MagicMock()]
    mock_response.content[0].text = json.dumps({
        "fields": {"field_01_surname": "RETRY"},
        "missing_fields": [],
    })

    timeout_exc = _anthropic.APITimeoutError(request=MagicMock())

    with patch("core.ai_extractor.anthropic.Anthropic") as MockClient, \
         patch("core.ai_extractor.time.sleep") as mock_sleep:
        mock_create = MockClient.return_value.messages.create
        mock_create.side_effect = [timeout_exc, mock_response]
        mappings, missing = extract_with_claude("raw text", field_map, "test-key")

    assert mock_create.call_count == 2
    mock_sleep.assert_called_once()
    assert mappings[0]["extracted_value"] == "RETRY"
