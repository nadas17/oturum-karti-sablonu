# api/routes.py
"""
Flask Blueprint — PESEL formu HTTP katmanı.
"""
import json
import os
from io import BytesIO

from flask import Blueprint, current_app, jsonify, request, send_file, send_from_directory

from core.pdf_engine import generate_pdf
from core.validator import validate
from core.doc_parser import parse_document
from core.ai_extractor import extract_with_claude

bp = Blueprint("api", __name__, url_prefix="/api")

ALLOWED_DOC_EXTENSIONS = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".webp"}
MAX_DOC_SIZE = 20 * 1024 * 1024  # 20 MB


@bp.post("/parse-document")
def parse_document_endpoint():
    """
    POST /api/parse-document
    multipart/form-data ile "document" alanından dosya alır.
    LlamaParse + Claude AI ile parse edip eşleştirme döndürür.
    """
    if "document" not in request.files:
        return jsonify({"error": "Dosya bulunamadı. 'document' alanında dosya gönderin."}), 400

    file = request.files["document"]
    if not file.filename:
        return jsonify({"error": "Dosya adı boş."}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        return jsonify({
            "error": f"Desteklenmeyen dosya formatı: {ext}. "
                     f"Desteklenen: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}"
        }), 400

    file_bytes = file.read()
    if len(file_bytes) > MAX_DOC_SIZE:
        return jsonify({"error": "Dosya boyutu 20 MB'ı aşamaz."}), 400

    if len(file_bytes) == 0:
        return jsonify({"error": "Dosya boş."}), 400

    config = current_app.config["APP_CONFIG"]
    llama_api_key = config.LLAMAPARSE_API_KEY
    if not llama_api_key:
        return jsonify({"error": "LLAMAPARSE_API_KEY yapılandırılmamış."}), 500

    try:
        parse_result = parse_document(file_bytes, file.filename, llama_api_key)
    except Exception as exc:
        current_app.logger.error("Belge ayrıştırma hatası: %s", exc)
        return jsonify({"error": f"Belge ayrıştırılamadı: {str(exc)}"}), 500

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
        mappings = []

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
    Returns: PDF binary
    """
    user_data = request.get_json(silent=True)
    if not user_data:
        return jsonify({"error": "JSON verisi bulunamadı"}), 400

    field_map = current_app.config["FIELD_MAP"]
    errors = validate(user_data, field_map)
    if errors:
        return jsonify({"error": "Doğrulama hatası", "fields": errors}), 400

    config = current_app.config["APP_CONFIG"]
    try:
        pdf_bytes = generate_pdf(user_data, config.PDF_TEMPLATE_PATH, field_map)
    except Exception as exc:
        current_app.logger.error("PDF oluşturma hatası: %s", exc)
        return jsonify({"error": "PDF oluşturulamadı."}), 500

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        download_name="pesel_doldurulmus.pdf",
        as_attachment=True,
    )


@bp.get("/fields")
def get_fields():
    """GET /api/fields — alan listesi."""
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


@bp.get("/template-pdf")
def get_template_pdf():
    """GET /api/template-pdf — Boş form PDF şablonu."""
    config = current_app.config["APP_CONFIG"]
    if not os.path.isfile(config.PDF_TEMPLATE_PATH):
        return jsonify({"error": "Şablon PDF bulunamadı"}), 404
    folder = os.path.dirname(config.PDF_TEMPLATE_PATH)
    filename = os.path.basename(config.PDF_TEMPLATE_PATH)
    return send_from_directory(folder, filename, mimetype="application/pdf",
                               as_attachment=False, max_age=3600)


@bp.get("/field-map")
def get_field_map():
    """GET /api/field-map — Tüm field_map (bounding box dahil)."""
    return jsonify(current_app.config["FIELD_MAP"])
