# tests/test_validator.py
import json
import os
import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture
def field_map():
    path = os.path.join(BASE_DIR, "assets", "form_field_map_v3.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def test_valid_data_returns_no_errors(field_map):
    from core.validator import validate
    data = {
        "date_year": "2026",
        "field_01_surname": "YILMAZ",
        "purpose_checkbox_4": True,
    }
    errors = validate(data, field_map)
    assert errors == []


def test_unknown_field_returns_error(field_map):
    from core.validator import validate
    data = {"nonexistent_xyz": "value"}
    errors = validate(data, field_map)
    assert any("nonexistent_xyz" in e for e in errors)


def test_text_too_long_is_warning_not_error(field_map):
    from core.validator import validate
    # field_01_surname max 20 karakter — artık uyarı, hata değil
    data = {"field_01_surname": "A" * 25}
    errors = validate(data, field_map)
    assert errors == []


def test_text_at_max_length_is_valid(field_map):
    from core.validator import validate
    data = {"field_01_surname": "A" * 20}
    errors = validate(data, field_map)
    assert errors == []


def test_comment_field_is_ignored(field_map):
    from core.validator import validate
    data = {"_yorum": "Bu bir yorum"}
    errors = validate(data, field_map)
    assert errors == []


def test_empty_data_is_valid(field_map):
    from core.validator import validate
    errors = validate({}, field_map)
    assert errors == []
