# tests/test_pdf_engine.py
import json
import os
import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture
def field_map():
    path = os.path.join(BASE_DIR, "assets", "form_field_map_v3.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def pdf_path():
    return os.path.join(
        BASE_DIR, "assets",
        "wniosek-o-udzielenie-cudzoziemcowi-zezwolenia-na-pobyt-czasow.pdf"
    )


@pytest.fixture
def minimal_data():
    return {
        "date_year": "2026",
        "date_month": "03",
        "date_day": "15",
        "field_01_surname": "YILMAZ",
        "field_04_name_r1": "MEHMET",
    }


def test_generate_pdf_returns_bytes(field_map, pdf_path, minimal_data):
    from core.pdf_engine import generate_pdf
    result = generate_pdf(minimal_data, pdf_path, field_map)
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_generate_pdf_is_valid_pdf(field_map, pdf_path, minimal_data):
    """Ciktinin gecerli PDF formatinda basladigini dogrula."""
    from core.pdf_engine import generate_pdf
    result = generate_pdf(minimal_data, pdf_path, field_map)
    assert result[:4] == b"%PDF"


def test_generate_pdf_with_checkbox(field_map, pdf_path):
    from core.pdf_engine import generate_pdf
    data = {"purpose_checkbox_4": True}
    result = generate_pdf(data, pdf_path, field_map)
    assert isinstance(result, bytes)
    assert result[:4] == b"%PDF"


def test_generate_pdf_empty_data(field_map, pdf_path):
    """Bos veri ile orijinal PDF dondurulmeli (hata vermemeli)."""
    from core.pdf_engine import generate_pdf
    result = generate_pdf({}, pdf_path, field_map)
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_collect_draw_ops_unknown_field(field_map):
    """Bilinmeyen field_id sessizce atlanmali."""
    from core.pdf_engine import _collect_draw_ops
    data = {"nonexistent_field_xyz": "value"}
    ops = _collect_draw_ops(field_map, data)
    assert ops == []
