# api/routes.py
"""
Flask Blueprint — HTTP katmanı. Core modüllerini çağırır.
"""
import json
import os
from io import BytesIO

from flask import Blueprint, current_app, jsonify, request, send_file, send_from_directory

from core.pdf_engine import generate_pdf
from core.validator import validate
from core.doc_parser import parse_document
from core.ai_extractor import extract_with_claude
from core.field_matcher import match_fields

bp = Blueprint("api", __name__, url_prefix="/api")


ALLOWED_DOC_EXTENSIONS = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".webp"}
MAX_DOC_SIZE = 20 * 1024 * 1024  # 20 MB


@bp.post("/parse-document")
def parse_document_endpoint():
    """
    POST /api/parse-document
    multipart/form-data ile "document" alanından dosya alır.
    LlamaParse ile parse edip, field_matcher ile eşleştirip sonucu döndürür.
    Returns: { raw_text, extracted_pairs, mappings, filename }
    """
    if "document" not in request.files:
        return jsonify({"error": "Dosya bulunamadı. 'document' alanında dosya gönderin."}), 400

    file = request.files["document"]
    if not file.filename:
        return jsonify({"error": "Dosya adı boş."}), 400

    # Dosya uzantısı kontrolü
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        return jsonify({
            "error": f"Desteklenmeyen dosya formatı: {ext}. "
                     f"Desteklenen: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}"
        }), 400

    # Dosya boyutu kontrolü
    file_bytes = file.read()
    if len(file_bytes) > MAX_DOC_SIZE:
        return jsonify({"error": "Dosya boyutu 20 MB'ı aşamaz."}), 400

    if len(file_bytes) == 0:
        return jsonify({"error": "Dosya boş."}), 400

    # API key kontrolü
    config = current_app.config["APP_CONFIG"]
    llama_api_key = config.LLAMAPARSE_API_KEY
    if not llama_api_key:
        return jsonify({"error": "LLAMAPARSE_API_KEY yapılandırılmamış. Ortam değişkenini ayarlayın."}), 500

    # LlamaParse ile parse et
    try:
        parse_result = parse_document(file_bytes, file.filename, llama_api_key)
    except Exception as exc:
        current_app.logger.error("Belge ayrıştırma hatası: %s", exc)
        return jsonify({"error": f"Belge ayrıştırılamadı: {str(exc)}"}), 500

    # Claude AI ile akıllı eşleştirme (fallback: eski field_matcher)
    field_map = current_app.config["FIELD_MAP"]
    anthropic_key = config.ANTHROPIC_API_KEY

    missing_fields = []

    if anthropic_key:
        try:
            mappings, missing_fields = extract_with_claude(
                parse_result["raw_text"], field_map, anthropic_key
            )
        except Exception as exc:
            current_app.logger.error("Claude AI eşleştirme hatası: %s", exc)
            return jsonify({"error": f"AI eşleştirme hatası: {str(exc)}"}), 500
    else:
        current_app.logger.warning("ANTHROPIC_API_KEY yok, eski field_matcher kullanılıyor")
        try:
            extracted_pairs = parse_result.get("extracted_pairs", [])
            mappings = match_fields(extracted_pairs, field_map)
        except Exception as exc:
            current_app.logger.error("Alan eşleştirme hatası: %s", exc)
            return jsonify({"error": f"Alan eşleştirme hatası: {str(exc)}"}), 500

    return jsonify({
        "raw_text": parse_result["raw_text"],
        "extracted_pairs": [],
        "mappings": mappings,
        "missing_fields": missing_fields,
        "filename": parse_result["filename"],
    })


@bp.post("/generate-pdf")
def generate_pdf_endpoint():
    """
    POST /api/generate-pdf
    Body: { field_id: value, ... }
    Returns: PDF binary (Content-Disposition: attachment)
    """
    user_data = request.get_json(silent=True)
    if not user_data:
        return jsonify({"error": "JSON verisi bulunamadı"}), 400

    # p3a/p5b: period + basis ayrı alanları tek satır metnine birleştir
    for prefix, rows in [("p3a", 6), ("p5b", 4)]:
        for i in range(1, rows + 1):
            pk = f"{prefix}_r{i}_period"
            bk = f"{prefix}_r{i}_basis"
            period = user_data.pop(pk, "").strip()
            basis  = user_data.pop(bk, "").strip()
            combined = f"{period}  {basis}" if period and basis else (period or basis)
            if combined:
                user_data[f"{prefix}_r{i}"] = combined

    field_map = current_app.config["FIELD_MAP"]
    errors = validate(user_data, field_map)
    if errors:
        return jsonify({"error": "Doğrulama hatası", "fields": errors}), 400

    config = current_app.config["APP_CONFIG"]
    try:
        pdf_bytes = generate_pdf(user_data, config.PDF_TEMPLATE_PATH, field_map)
    except Exception as exc:
        current_app.logger.error("PDF oluşturma hatası: %s", exc)
        return jsonify({"error": "PDF oluşturulamadı. Sunucu loglarına bakın."}), 500

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        download_name="doldurulmus_form.pdf",
        as_attachment=True,
    )


@bp.get("/fields")
def get_fields():
    """
    GET /api/fields
    Returns: alan listesi (AI agent / script entegrasyonu için)
    """
    field_map = current_app.config["FIELD_MAP"]
    fields = [
        {
            "field_id": f["field_id"],
            "field_type": f["field_type"],
            "page": f["page"],
            "num_cells": f.get("num_cells", 0),
            "label": f.get("label", ""),
        }
        for f in field_map["form_fields"]
    ]
    return jsonify({"fields": fields, "total": len(fields)})


@bp.get("/sample")
def get_sample():
    """GET /api/sample — Örnek JSON verisi döndürür."""
    sample = {
        "_yorum": "Örnek veri. Değerleri kendi bilgilerinizle değiştirin.",
        "do_authority": "MAZOVYA VOYVODALIGI",
        "date_year": "2026", "date_month": "03", "date_day": "15",
        "field_01_surname": "YILMAZ",
        "field_02_prev_surname_r1": "",
        "field_03_family_name": "YILMAZ",
        "field_04_name_r1": "MEHMET",
        "field_06_fathers_name": "AHMET",
        "field_07_mothers_name": "FATMA",
        "field_08_mothers_maiden": "KAYA",
        "field_09_dob": "1990/05/15",
        "field_10_sex": "M",
        "field_11_birthplace": "ISTANBUL",
        "field_12_birth_country": "TURKEY",
        "field_13_nationality": "TURKISH",
        "field_14_citizenship": "TURKISH",
        "field_15_marital": "SINGLE",
        "field_16_education": "UNIVERSITY",
        "field_17_height": "175",
        "field_17_eye_color": "BROWN",
        "field_17_special_marks": "NONE",
        "field_19_phone": "+48501234567",
        "field_20_email": "MEHMET@EMAIL.COM",
        "addr_1_voivodeship": "MAZOWIECKIE",
        "addr_2_city": "WARSZAWA",
        "addr_3_street": "MARSZALKOWSKA",
        "addr_4_house_no": "10",
        "addr_5_flat_no": "5",
        "addr_6_postal_code": "00-001",
        "purpose_checkbox_4": True,
        "family_1_name": "KOWALSKA ANNA", "family_1_sex": "K", "family_1_dob": "1992/03/20",
        "family_1_kinship": "MALZONKA", "family_1_citizenship": "TURECKA",
        "family_1_residence": "WARSZAWA", "family_1_temp_permit": "TAK", "family_1_dependent": "NIE",
        "family_2_name": "KOWALSKI PIOTR", "family_2_sex": "M", "family_2_dob": "2015/08/10",
        "family_2_kinship": "SYN", "family_2_citizenship": "TURECKA",
        "family_2_residence": "WARSZAWA", "family_2_temp_permit": "TAK", "family_2_dependent": "TAK",
        "family_3_name": "KOWALSKA EWA", "family_3_sex": "K", "family_3_dob": "2018/11/05",
        "family_3_kinship": "CORKA", "family_3_citizenship": "TURECKA",
        "family_3_residence": "WARSZAWA", "family_3_temp_permit": "TAK", "family_3_dependent": "TAK",
        "p3a_r1_period": "2023/01-2023/06", "p3a_r1_basis": "WIZA",
        "p3a_r2_period": "2023/07-2024/01", "p3a_r2_basis": "ZEZWOLENIE",
        "p3a_r3_period": "2024/02-2025/12", "p3a_r3_basis": "ZEZWOLENIE NA POBYT CZASOWY",
        "p5b_r1_period": "2022/06-2022/12", "p5b_r1_basis": "TURKEY",
        "p5b_r2_period": "2023/06-2023/07", "p5b_r2_basis": "GERMANY",
        "p4_staying_yes": True,
        "p4_date": "2025/12/01",
        "p8_date": "2026/03/15",
    }
    return jsonify(sample)


@bp.get("/template-pdf")
def get_template_pdf():
    """
    GET /api/template-pdf
    Boş form PDF şablonunu döndürür — PDF.js önizleme için.
    """
    config = current_app.config["APP_CONFIG"]
    if not os.path.isfile(config.PDF_TEMPLATE_PATH):
        current_app.logger.error("Sablon PDF bulunamadi: %s", config.PDF_TEMPLATE_PATH)
        return jsonify({"error": "Sablon PDF sunucuda bulunamadi"}), 404
    folder = os.path.dirname(config.PDF_TEMPLATE_PATH)
    filename = os.path.basename(config.PDF_TEMPLATE_PATH)
    return send_from_directory(
        folder,
        filename,
        mimetype="application/pdf",
        as_attachment=False,
        max_age=3600,
    )


@bp.get("/field-map")
def get_field_map():
    """
    GET /api/field-map
    Tüm field_map'i döndürür (bounding box'lar dahil) — önizleme overlay için.
    """
    return jsonify(current_app.config["FIELD_MAP"])
