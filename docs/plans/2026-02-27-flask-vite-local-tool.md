# Flask + Vite Local Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mevcut iki aşamalı iş akışını (React UI → JSON → CLI Python) tek komutla başlayan lokal bir Python web uygulamasına dönüştür.

**Architecture:** Flask backend (core/api katmanı), Vite ile build edilmiş React frontend, tek `python start.py` komutu. `fill_form.py` CLI olarak dokunulmadan çalışmaya devam eder; `core/pdf_engine.py` mantığı Flask API'dan bağımsız, test edilebilir bir modül olarak bulunur.

**Tech Stack:** Python 3.10+, Flask 3.x, ReportLab, pypdf, React 18, Vite 5, Tailwind CSS (CDN)

---

## Bağımlılık Haritası

```
Task 1 (yapı)
  → Task 2 (config)
    → Task 3 (pdf_engine)
      → Task 4 (pdf_engine testi)
    → Task 5 (validator)
      → Task 6 (validator testi)
    → Task 7 (routes.py) [Task 3 + 5 tamamlandıktan sonra]
      → Task 8 (app.py)
        → Task 9 (requirements.txt)
          → Task 10 (start.py)
Task 11 (frontend setup) [Task 1'den sonra, bağımsız]
  → Task 12 (api.js)
    → Task 13 (form_app.jsx değişikliği)
      → Task 14 (entegrasyon testi)
```

---

## Ön Bilgi — Mevcut Dosya Konumları

Tüm çalışma **`form_toolkit/`** klasörü içindedir:

```
form_toolkit/
├── fill_form.py              ← DOKUNMA (CLI çalışmaya devam etmeli)
├── form_field_map_v3.json    ← Task 1'de assets/'e taşınacak
├── wniosek-o-udzielenie-...pdf  ← Task 1'de assets/'e taşınacak
├── KULLANIM.md
└── form_app.jsx              ← Task 11'de frontend/src/'ye taşınacak
```

Tüm yeni dosya yolları `form_toolkit/` içindedir.

---

## Task 1: Dizin Yapısını Oluştur

**Files:**
- Create: `core/__init__.py`
- Create: `api/__init__.py`
- Create: `assets/` (dizin — dosyalar kopyalanacak)
- Create: `tests/__init__.py`
- Create: `frontend/src/` (dizin)

**Step 1: Dizinleri oluştur**

```bash
cd "form_toolkit"
mkdir -p core api assets tests frontend/src
touch core/__init__.py api/__init__.py tests/__init__.py
```

**Step 2: PDF ve field map'i assets/'e kopyala (orijinalleri silme — fill_form.py hâlâ kullanıyor)**

```bash
cp "wniosek-o-udzielenie-cudzoziemcowi-zezwolenia-na-pobyt-czasow.pdf" assets/
cp form_field_map_v3.json assets/
```

**Step 3: Yapıyı doğrula**

```bash
ls core/ api/ assets/ tests/ frontend/src/
```

Beklenen çıktı: Her dizin listelenır, `core/__init__.py` vs. görünür.

---

## Task 2: config.py Oluştur

**Files:**
- Create: `config.py`

**Step 1: config.py yaz**

```python
# config.py
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    PORT: int = 5000
    DEBUG: bool = False
    PDF_TEMPLATE_PATH: str = os.path.join(
        BASE_DIR, "assets",
        "wniosek-o-udzielenie-cudzoziemcowi-zezwolenia-na-pobyt-czasow.pdf"
    )
    FIELD_MAP_PATH: str = os.path.join(BASE_DIR, "assets", "form_field_map_v3.json")


class DevConfig(Config):
    DEBUG: bool = True


def get_config(env: str = "production") -> Config:
    return DevConfig() if env == "development" else Config()
```

**Step 2: Config'in doğru yollar verdiğini manuel doğrula**

```bash
python -c "
from config import get_config
c = get_config()
import os
print('PDF exists:', os.path.exists(c.PDF_TEMPLATE_PATH))
print('Map exists:', os.path.exists(c.FIELD_MAP_PATH))
"
```

Beklenen:
```
PDF exists: True
Map exists: True
```

---

## Task 3: core/pdf_engine.py Oluştur

fill_form.py mantığını Flask'tan bağımsız, bytes döndüren bir modüle çıkar.

**Files:**
- Create: `core/pdf_engine.py`

**Step 1: core/pdf_engine.py yaz**

```python
# core/pdf_engine.py
"""
PDF doldurma motoru — HTTP katmanından bağımsız.
generate_pdf(user_data, pdf_path, field_map) → bytes
"""
import json
from io import BytesIO

from reportlab.pdfgen import canvas as rl_canvas
from pypdf import PdfReader, PdfWriter


def generate_pdf(user_data: dict, pdf_path: str, field_map: dict) -> bytes:
    """
    Kullanıcı verisini forma uygular, doldurulmuş PDF'i bytes olarak döndürür.

    Args:
        user_data:  { field_id: value, ... }
        pdf_path:   Boş form PDF yolu
        field_map:  form_field_map_v3.json içeriği (dict)

    Returns:
        PDF dosyasının byte içeriği
    """
    meta = field_map["meta"]
    pdf_w = meta["pdf_width_pt"]
    pdf_h = meta["pdf_height_pt"]
    total_pages = meta["total_pages"]

    ops = _collect_draw_ops(field_map, user_data)
    overlay_buf = _create_overlay_pdf(ops, total_pages, pdf_w, pdf_h)
    return _merge_to_bytes(pdf_path, overlay_buf)


def _collect_draw_ops(field_map: dict, user_data: dict) -> list:
    """Alan haritası + kullanıcı verisi → sayfa bazlı çizim komutları."""
    meta = field_map["meta"]
    pdf_h = meta["pdf_height_pt"]
    ops = []

    for fld in field_map["form_fields"]:
        fid = fld["field_id"]
        if fid not in user_data:
            continue

        value = user_data[fid]
        ftype = fld["field_type"]
        x0, y0, x1, y1 = fld["bbox"]
        page = fld["page"]
        num_cells = fld.get("num_cells", 0)
        cell_bboxes = fld.get("cell_bboxes", None)

        if ftype == "checkbox":
            if value is True or str(value).lower() in ("true", "x", "1", "yes", "tak"):
                cx = (x0 + x1) / 2
                cy = (y0 + y1) / 2
                box_h = y1 - y0
                fs = min(14, box_h * 0.7)
                rl_y = pdf_h - cy - fs * 0.35
                ops.append((page, "text", {
                    "x": cx, "y": rl_y, "text": "X",
                    "font_size": fs, "center": True
                }))

        elif ftype in ("char_boxes", "date_boxes", "card_boxes") and num_cells > 0:
            text = str(value).upper()
            if cell_bboxes:
                for i, ch in enumerate(text[:len(cell_bboxes)]):
                    if ch == " ":
                        continue
                    cx0, cy0, cx1, cy1 = cell_bboxes[i]
                    cell_w = cx1 - cx0
                    cell_h = cy1 - cy0
                    fs = min(10, cell_h * 0.65, cell_w * 0.85)
                    center_x = (cx0 + cx1) / 2
                    center_y = (cy0 + cy1) / 2
                    rl_y = pdf_h - center_y - fs * 0.35
                    ops.append((page, "text", {
                        "x": center_x, "y": rl_y, "text": ch,
                        "font_size": fs, "center": True
                    }))
            else:
                cell_width = (x1 - x0) / num_cells
                cell_h = y1 - y0
                for i, ch in enumerate(text[:num_cells]):
                    if ch == " ":
                        continue
                    cx0 = x0 + i * cell_width
                    cx1 = cx0 + cell_width
                    fs = min(10, cell_h * 0.65, cell_width * 0.85)
                    center_x = (cx0 + cx1) / 2
                    center_y = (y0 + y1) / 2
                    rl_y = pdf_h - center_y - fs * 0.35
                    ops.append((page, "text", {
                        "x": center_x, "y": rl_y, "text": ch,
                        "font_size": fs, "center": True
                    }))

        elif ftype in ("table_cell", "signature_box"):
            text = str(value)
            if not text:
                continue
            box_w = x1 - x0
            box_h = y1 - y0
            usable_w = box_w - 3
            usable_h = box_h - 2
            CHAR_W_RATIO = 0.52
            max_font_h = min(8, usable_h * 0.55)
            max_font_w = usable_w / (len(text) * CHAR_W_RATIO) if len(text) > 0 else 8
            fs = max(3.5, min(max_font_h, max_font_w, 8))
            tx = x0 + 1.5
            center_y = (y0 + y1) / 2
            rl_y = pdf_h - center_y - fs * 0.35
            ops.append((page, "text", {
                "x": tx, "y": rl_y, "text": text,
                "font_size": fs, "center": False
            }))

    return ops


def _create_overlay_pdf(ops: list, total_pages: int, pdf_w: float, pdf_h: float) -> BytesIO:
    """ReportLab ile şeffaf overlay PDF oluştur."""
    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(pdf_w, pdf_h))

    for pg in range(1, total_pages + 1):
        for _, draw_type, params in [op for op in ops if op[0] == pg]:
            if draw_type == "text":
                fs = params["font_size"]
                c.setFont("Helvetica", fs)
                c.setFillColorRGB(0, 0, 0)
                if params.get("center"):
                    c.drawCentredString(params["x"], params["y"], params["text"])
                else:
                    c.drawString(params["x"], params["y"], params["text"])
        c.showPage()

    c.save()
    buf.seek(0)
    return buf


def _merge_to_bytes(input_pdf_path: str, overlay_buf: BytesIO) -> bytes:
    """Orijinal PDF + overlay → bytes."""
    base = PdfReader(input_pdf_path)
    overlay = PdfReader(overlay_buf)
    writer = PdfWriter()

    for i, page in enumerate(base.pages):
        if i < len(overlay.pages):
            page.merge_page(overlay.pages[i])
        writer.add_page(page)

    output_buf = BytesIO()
    writer.write(output_buf)
    output_buf.seek(0)
    return output_buf.read()
```

---

## Task 4: pdf_engine Testi

**Files:**
- Create: `tests/test_pdf_engine.py`

**Step 1: Test yaz**

```python
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
    """Çıktının geçerli PDF formatında başladığını doğrula."""
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
    """Boş veri ile orijinal PDF döndürülmeli (hata vermemeli)."""
    from core.pdf_engine import generate_pdf
    result = generate_pdf({}, pdf_path, field_map)
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_collect_draw_ops_unknown_field(field_map):
    """Bilinmeyen field_id sessizce atlanmalı."""
    from core.pdf_engine import _collect_draw_ops
    data = {"nonexistent_field_xyz": "value"}
    ops = _collect_draw_ops(field_map, data)
    assert ops == []
```

**Step 2: Testleri çalıştır**

```bash
cd form_toolkit
pip install pytest
pytest tests/test_pdf_engine.py -v
```

Beklenen: 5 test PASS.

**Step 3: Commit**

```bash
git add core/ assets/ tests/test_pdf_engine.py config.py
git commit -m "feat: add core/pdf_engine.py with tests"
```

---

## Task 5: core/validator.py Oluştur

**Files:**
- Create: `core/validator.py`

**Step 1: validator.py yaz**

```python
# core/validator.py
"""
Form alanı doğrulama — Flask bağımsız.
validate(user_data, field_map) → list[str]  (hata mesajları)
"""


def validate(user_data: dict, field_map: dict) -> list[str]:
    """
    Kullanıcı verisini alan haritasına göre doğrular.

    Returns:
        Hata mesajları listesi. Boş liste = geçerli veri.
    """
    if not isinstance(user_data, dict):
        return ["Veri dict formatında olmalıdır"]

    errors = []
    field_lookup = {f["field_id"]: f for f in field_map["form_fields"]}

    for field_id, value in user_data.items():
        if field_id.startswith("_"):  # _yorum gibi meta alanlar
            continue

        if field_id not in field_lookup:
            errors.append(f"Bilinmeyen alan: {field_id}")
            continue

        field = field_lookup[field_id]
        ftype = field["field_type"]
        num_cells = field.get("num_cells", 0)

        # Karakter kutuları için uzunluk kontrolü
        if ftype in ("char_boxes", "date_boxes", "card_boxes") and num_cells > 0:
            if isinstance(value, str) and len(value) > num_cells:
                errors.append(
                    f"{field_id}: '{value}' değeri maksimum {num_cells} karakteri aşıyor"
                )

        # Checkbox boolean kontrolü
        if ftype == "checkbox":
            if not isinstance(value, (bool, int)) and str(value).lower() not in (
                "true", "false", "x", "1", "0", "yes", "no", "tak", "nie"
            ):
                errors.append(f"{field_id}: checkbox değeri boolean olmalı")

    return errors
```

---

## Task 6: validator Testi

**Files:**
- Create: `tests/test_validator.py`

**Step 1: Test yaz**

```python
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


def test_text_too_long_returns_error(field_map):
    from core.validator import validate
    # field_01_surname max 20 karakter
    data = {"field_01_surname": "A" * 25}
    errors = validate(data, field_map)
    assert any("field_01_surname" in e for e in errors)


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
```

**Step 2: Testleri çalıştır**

```bash
pytest tests/test_validator.py -v
```

Beklenen: 6 test PASS.

**Step 3: Commit**

```bash
git add core/validator.py tests/test_validator.py
git commit -m "feat: add core/validator.py with tests"
```

---

## Task 7: api/routes.py Oluştur

**Files:**
- Create: `api/routes.py`

**Step 1: routes.py yaz**

```python
# api/routes.py
"""
Flask Blueprint — HTTP katmanı. Core modüllerini çağırır.
"""
import json
from io import BytesIO

from flask import Blueprint, current_app, jsonify, request, send_file

from core.pdf_engine import generate_pdf
from core.validator import validate

bp = Blueprint("api", __name__, url_prefix="/api")


def _load_field_map() -> dict:
    config = current_app.config["APP_CONFIG"]
    with open(config.FIELD_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)


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

    field_map = _load_field_map()
    errors = validate(user_data, field_map)
    if errors:
        return jsonify({"error": "Doğrulama hatası", "fields": errors}), 400

    config = current_app.config["APP_CONFIG"]
    try:
        pdf_bytes = generate_pdf(user_data, config.PDF_TEMPLATE_PATH, field_map)
    except Exception as exc:
        current_app.logger.error("PDF oluşturma hatası: %s", exc)
        return jsonify({"error": f"PDF oluşturulamadı: {exc}"}), 500

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
    field_map = _load_field_map()
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
        "p4_staying_yes": True,
        "p4_date": "2025/12/01",
        "p8_date": "2026/03/15",
    }
    return jsonify(sample)
```

---

## Task 8: app.py — Flask App Factory

**Files:**
- Create: `app.py`

**Step 1: app.py yaz**

```python
# app.py
"""
Flask uygulama factory.
Kullanım: python app.py  veya  python start.py
"""
import os

from flask import Flask

from api.routes import bp as api_bp
from config import get_config


def create_app(env: str = None) -> Flask:
    if env is None:
        env = os.environ.get("FLASK_ENV", "production")

    config = get_config(env)
    app = Flask(__name__, static_folder="static", static_url_path="/")
    app.config["APP_CONFIG"] = config

    app.register_blueprint(api_bp)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_react(path):
        """React SPA — tüm rotaları index.html'e yönlendir."""
        static_index = os.path.join(app.static_folder, "index.html")
        if os.path.exists(static_index):
            return app.send_static_file("index.html")
        return (
            "<h2>Frontend build edilmedi.</h2>"
            "<p>Çalıştır: <code>cd frontend && npm run build</code></p>",
            503,
        )

    return app


if __name__ == "__main__":
    env = os.environ.get("FLASK_ENV", "production")
    config = get_config(env)
    app = create_app(env)
    print(f"  Polonya Form Aracı çalışıyor: http://localhost:{config.PORT}")
    app.run(host="0.0.0.0", port=config.PORT, debug=config.DEBUG)
```

**Step 2: Uygulamayı test et (frontend olmadan)**

```bash
cd form_toolkit
FLASK_ENV=development python app.py
```

Başka terminal:
```bash
curl http://localhost:5000/api/sample
```

Beklenen: JSON sample verisi.

```bash
curl http://localhost:5000/api/fields | python -m json.tool | head -20
```

Beklenen: Alan listesi JSON.

---

## Task 9: requirements.txt

**Files:**
- Create: `requirements.txt`

**Step 1: requirements.txt yaz**

```
flask>=3.0.0
reportlab>=4.0.0
pypdf>=4.0.0
```

**Step 2: Temiz ortamda test**

```bash
pip install -r requirements.txt
python -c "import flask, reportlab, pypdf; print('OK')"
```

Beklenen: `OK`

**Step 3: Commit**

```bash
git add app.py api/routes.py requirements.txt
git commit -m "feat: add Flask app with API endpoints"
```

---

## Task 10: start.py — Tek Komut Başlatıcı

**Files:**
- Create: `start.py`

**Step 1: start.py yaz**

```python
#!/usr/bin/env python3
"""
Polonya Form Aracı — Tek Komut Başlatıcı

Kullanım:
    python start.py            # Production: build + serve
    python start.py --dev      # Dev: Vite HMR (port 5173) + Flask
    python start.py --no-build # Build atla, direkt Flask başlat
"""
import argparse
import os
import subprocess
import sys


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
STATIC_DIR = os.path.join(BASE_DIR, "static")


def build_frontend():
    print("Frontend build ediliyor...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=FRONTEND_DIR,
        check=False,
    )
    if result.returncode != 0:
        print("HATA: Frontend build başarısız.")
        sys.exit(1)
    print("Frontend build tamamlandı.")


def start_flask(dev: bool = False):
    env = os.environ.copy()
    env["FLASK_ENV"] = "development" if dev else "production"
    os.execve(
        sys.executable,
        [sys.executable, os.path.join(BASE_DIR, "app.py")],
        env,
    )


def main():
    parser = argparse.ArgumentParser(description="Polonya Form Aracı")
    parser.add_argument("--dev", action="store_true", help="Development modu")
    parser.add_argument("--no-build", action="store_true", help="Frontend build atla")
    args = parser.parse_args()

    static_index = os.path.join(STATIC_DIR, "index.html")
    needs_build = not os.path.exists(static_index)

    if args.dev:
        print("Dev modu: Vite + Flask başlatılıyor...")
        # Arka planda Vite dev server
        vite_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=FRONTEND_DIR,
        )
        try:
            start_flask(dev=True)
        except KeyboardInterrupt:
            vite_proc.terminate()
    else:
        if not args.no_build and needs_build:
            build_frontend()
        elif not args.no_build and not needs_build:
            print("static/index.html mevcut, build atlanıyor. Rebuild için: python start.py --rebuild")
        start_flask(dev=False)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add start.py
git commit -m "feat: add start.py single-command launcher"
```

---

## Task 11: Frontend Vite Projesi Kurulumu

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Move: `form_app.jsx` → `frontend/src/form_app.jsx`

**Step 1: package.json yaz**

```json
{
  "name": "polonya-form-ui",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

**Step 2: vite.config.js yaz**

```javascript
// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "../static"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
```

**Step 3: frontend/index.html yaz**

```html
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Polonya Oturum İzni Formu</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 4: frontend/src/main.jsx yaz**

```jsx
// frontend/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FormApp from "./form_app.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FormApp />
  </StrictMode>
);
```

**Step 5: form_app.jsx'i frontend/src/'ye kopyala**

```bash
cp form_app.jsx frontend/src/form_app.jsx
```

**Step 6: Bağımlılıkları yükle**

```bash
cd frontend
npm install
```

**Step 7: Temel build testi**

```bash
npm run build
ls ../static/
```

Beklenen: `index.html`, `assets/` dizini görünür.

---

## Task 12: frontend/src/api.js — API Client

**Files:**
- Create: `frontend/src/api.js`

**Step 1: api.js yaz**

```javascript
// frontend/src/api.js
/**
 * Flask API client.
 * generatePdf(data) → void (tarayıcı otomatik indirir)
 * getFields()       → Promise<{ fields, total }>
 */

const API_BASE = "/api";

/**
 * Form verisini Flask'a gönderir, PDF olarak indirir.
 * @param {Object} data  - { field_id: value, ... }
 * @throws {Error}       - Hata durumunda mesaj içerir
 */
export async function generatePdf(data) {
  const response = await fetch(`${API_BASE}/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Sunucu hatası: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "doldurulmus_form.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Mevcut form alanlarını döndürür.
 * @returns {Promise<{ fields: Array, total: number }>}
 */
export async function getFields() {
  const response = await fetch(`${API_BASE}/fields`);
  if (!response.ok) throw new Error("Alan listesi alınamadı");
  return response.json();
}
```

---

## Task 13: form_app.jsx — PDF Butonu Ekle

Mevcut `frontend/src/form_app.jsx` dosyasında **sadece Export sekmesine** değişiklik yap.

**Files:**
- Modify: `frontend/src/form_app.jsx`

**Step 1: Import satırını dosyanın başına ekle**

Dosyanın en üstüne (mevcut `import` satırlarından sonra):
```jsx
import { generatePdf } from "./api.js";
```

**Step 2: FormApp bileşenine yeni state ekle**

`const [toast, setToast] = useState(null);` satırından hemen SONRA:
```jsx
const [pdfLoading, setPdfLoading] = useState(false);
```

**Step 3: handleGeneratePDF fonksiyonu ekle**

`handleClear` fonksiyonundan SONRA:
```jsx
const handleGeneratePDF = useCallback(async () => {
  setPdfLoading(true);
  try {
    await generatePdf(buildExport());
    showToast("PDF oluşturuldu ve indirildi");
  } catch (err) {
    showToast(err.message || "PDF oluşturulamadı", "error");
  } finally {
    setPdfLoading(false);
  }
}, [buildExport, showToast]);
```

**Step 4: Export sekmesindeki buton satırına PDF butonu ekle**

Mevcut `<button onClick={handleClear}` butonunun hemen ÖNCESINE:

```jsx
<button
  onClick={handleGeneratePDF}
  disabled={pdfLoading}
  className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg
             text-sm font-medium hover:bg-green-700 transition-colors shadow-md
             shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed">
  <span>{pdfLoading ? "⏳" : "📄"}</span>
  {pdfLoading ? "Oluşturuluyor..." : "PDF Oluştur & İndir"}
</button>
```

**Step 5: Export sekmesindeki kullanım kılavuzunu güncelle**

Mevcut sarı "Kullanım Adımları" kutusunu şununla değiştir:

```jsx
<div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
  <h4 className="text-sm font-semibold text-green-900 mb-2">Kullanım</h4>
  <div className="text-sm text-green-800 space-y-1.5 leading-relaxed">
    <p>1. Formu doldurun veya <strong>JSON Yükle</strong> ile önceki veriyi import edin.</p>
    <p>2. <strong>PDF Oluştur &amp; İndir</strong> butonuna tıklayın.</p>
    <p>3. PDF otomatik indirilir.</p>
    <p className="text-xs text-green-600 mt-2">
      İpucu: <strong>JSON İndir</strong> ile verilerinizi kaydedebilirsiniz.
    </p>
  </div>
</div>
```

**Step 6: Build ve test**

```bash
cd frontend
npm run build
```

Beklenen: Build hatasız tamamlanır.

---

## Task 14: Entegrasyon Testi — Uçtan Uca

**Step 1: Tüm testleri çalıştır**

```bash
cd form_toolkit
pytest tests/ -v
```

Beklenen: 11 test PASS.

**Step 2: Flask API'yı test et (frontend olmadan)**

```bash
python app.py &
sleep 2

# Sample endpoint
curl -s http://localhost:5000/api/sample | python -m json.tool | head -10

# PDF generation
curl -s -X POST http://localhost:5000/api/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"field_01_surname":"TEST","field_04_name_r1":"USER","purpose_checkbox_4":true}' \
  -o test_output.pdf

file test_output.pdf
```

Beklenen: `test_output.pdf: PDF document, version X.X`

**Step 3: Frontend ile uçtan uca test**

```bash
python start.py --no-build
```

Tarayıcıda `http://localhost:5000` aç:
- Form doldur
- Export sekmesine git
- "PDF Oluştur & İndir" butonuna tıkla
- PDF otomatik indirilmeli

**Step 4: Temizle ve son commit**

```bash
rm -f test_output.pdf
kill %1  # arka planda çalışan Flask'ı durdur

git add frontend/ static/ .gitignore 2>/dev/null || true
git commit -m "feat: complete Flask+Vite local tool implementation"
```

---

## .gitignore

Task 14 Step 4'ten önce oluştur:

```bash
cat > .gitignore << 'EOF'
static/
frontend/node_modules/
__pycache__/
*.pyc
*.pdf
!assets/*.pdf
.env
EOF
```

---

## Özet — Çalıştırma

```bash
# İlk kurulum (bir kez)
cd form_toolkit
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..

# Günlük kullanım
python start.py          # → http://localhost:5000

# Development (hot reload)
python start.py --dev    # → Vite: 5173, Flask: 5000

# CLI (değişmedi)
python fill_form.py veriler.json cikti.pdf
```
