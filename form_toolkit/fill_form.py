#!/usr/bin/env python3
"""
Polonya Geçici Oturum İzni Formu — Otomatik Doldurma Scripti (V4 — ReportLab)
form_field_map_v3.json ile bireysel hücre koordinatlarını kullanarak
her harfi kutuya piksel-hassasiyetinde yerleştirir.

ReportLab ile doğrudan PDF üzerine metin çizer (FreeText annotation yerine).

Kullanım:
    python fill_form.py veriler.json [cikti.pdf]

veriler.json formatı:
{
    "field_01_surname": "KOWALSKI",
    "field_04_name_r1": "JAN",
    "field_09_dob": "1990/05/15",
    "purpose_checkbox_8": true,
    "p4_staying_yes": true,
    ...
}
"""
import json, sys, os
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.units import mm
from pypdf import PdfReader, PdfWriter


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def collect_draw_ops(field_map, user_data):
    """V3 haritası + kullanıcı verisi → sayfa bazlı çizim komutları listesi.
    Her komut: (page, draw_type, params) şeklinde."""
    meta = field_map["meta"]
    pdf_h = meta["pdf_height_pt"]
    ops = []  # [(page_num, draw_type, params), ...]

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

        # ─── Checkbox: "X" işareti koy ───
        if ftype == "checkbox":
            if value is True or str(value).lower() in ("true", "x", "1", "yes", "tak"):
                cx = (x0 + x1) / 2
                cy = (y0 + y1) / 2
                box_h = y1 - y0
                fs = min(14, box_h * 0.7)
                # pdfplumber y=0 top → ReportLab y=0 bottom
                rl_y = pdf_h - cy - fs * 0.35
                ops.append((page, "text", {
                    "x": cx, "y": rl_y, "text": "X",
                    "font_size": fs, "center": True
                }))

        # ─── Karakter kutuları (her harf ayrı kutuya) ───
        elif ftype in ("char_boxes", "date_boxes", "card_boxes") and num_cells > 0:
            text = str(value).upper()

            # E-posta gibi uzun değerler: hücre sayısını aşarsa serbest metin olarak yaz
            if len(text) > num_cells:
                box_w = x1 - x0
                box_h = y1 - y0
                usable_w = box_w - 3
                CHAR_W_RATIO = 0.52
                max_font_h = min(10, box_h * 0.65)
                max_font_w = usable_w / (len(text) * CHAR_W_RATIO)
                fs = min(max_font_h, max_font_w, 10)
                fs = max(3.5, fs)
                tx = x0 + 1.5
                center_y = (y0 + y1) / 2
                rl_y = pdf_h - center_y - fs * 0.35
                ops.append((page, "text", {
                    "x": tx, "y": rl_y, "text": text,
                    "font_size": fs, "center": False
                }))
            elif cell_bboxes:
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

        # ─── Tablo hücresi veya imza kutusu — serbest metin ───
        elif ftype in ("table_cell", "signature_box"):
            text = str(value)
            if not text:
                continue
            box_w = x1 - x0
            box_h = y1 - y0
            usable_w = box_w - 3  # 1.5pt margin each side
            usable_h = box_h - 2

            # Font boyutunu hem yükseklik hem genişlik kısıtına göre hesapla
            # Helvetica avg char width ≈ font_size * 0.52
            CHAR_W_RATIO = 0.52
            max_font_h = min(8, usable_h * 0.55)
            max_font_w = usable_w / (len(text) * CHAR_W_RATIO) if len(text) > 0 else 8
            fs = min(max_font_h, max_font_w, 8)
            fs = max(3.5, fs)

            # Sol hizalı, dikey ortada
            tx = x0 + 1.5
            center_y = (y0 + y1) / 2
            rl_y = pdf_h - center_y - fs * 0.35
            ops.append((page, "text", {
                "x": tx, "y": rl_y, "text": text,
                "font_size": fs, "center": False
            }))

    return ops


def create_overlay_pdf(ops, total_pages, pdf_w, pdf_h):
    """ReportLab ile şeffaf overlay PDF oluştur."""
    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(pdf_w, pdf_h))

    for pg in range(1, total_pages + 1):
        page_ops = [op for op in ops if op[0] == pg]
        for _, draw_type, params in page_ops:
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


def merge_overlay(input_pdf_path, overlay_buf, output_pdf_path):
    """Orijinal PDF + overlay PDF → birleştirilmiş çıktı."""
    base = PdfReader(input_pdf_path)
    overlay = PdfReader(overlay_buf)
    writer = PdfWriter()

    for i, page in enumerate(base.pages):
        if i < len(overlay.pages):
            page.merge_page(overlay.pages[i])
        writer.add_page(page)

    with open(output_pdf_path, "wb") as f:
        writer.write(f)


def main():
    if len(sys.argv) < 2:
        print("Kullanım: python fill_form.py veriler.json [cikti.pdf]")
        print("\nÖrnek veri dosyası oluşturmak için: python fill_form.py --ornek")
        sys.exit(1)

    if sys.argv[1] == "--ornek":
        create_sample_data()
        return

    data_path = sys.argv[1]
    output_pdf = sys.argv[2] if len(sys.argv) > 2 else "doldurulmus_form.pdf"

    # Dosya yollarını belirle
    work_dir = os.getcwd()
    map_v3 = os.path.join(work_dir, "form_field_map_v3.json")
    map_v2 = os.path.join(work_dir, "form_field_map_v2.json")
    map_path = map_v3 if os.path.exists(map_v3) else map_v2
    input_pdf = os.path.join(work_dir, "wniosek-o-udzielenie-cudzoziemcowi-zezwolenia-na-pobyt-czasow.pdf")

    # Yükle
    field_map = load_json(map_path)
    user_data = load_json(data_path)
    meta = field_map["meta"]
    version = meta.get("version", "v2")
    print(f"Harita sürümü: {version} ({os.path.basename(map_path)})")

    # Çizim komutlarını topla
    ops = collect_draw_ops(field_map, user_data)
    print(f"Toplam {len(ops)} metin girişi oluşturuldu.")

    # Overlay PDF oluştur
    pdf_w = meta["pdf_width_pt"]
    pdf_h = meta["pdf_height_pt"]
    total_pages = meta["total_pages"]
    overlay_buf = create_overlay_pdf(ops, total_pages, pdf_w, pdf_h)

    # Birleştir
    print("Dolduruluyor...")
    merge_overlay(input_pdf, overlay_buf, output_pdf)
    print(f"\n✓ Çıktı: {output_pdf}")


def create_sample_data():
    """Örnek veri dosyası oluşturur"""
    sample = {
        "_yorum": "Bu örnek veri dosyasıdır. Değerleri kendi bilgilerinizle değiştirin.",
        "date_year": "2026",
        "date_month": "03",
        "date_day": "15",
        "field_01_surname": "YILMAZ",
        "field_02_prev_surname_r1": "",
        "field_03_family_name": "YILMAZ",
        "field_04_name_r1": "MEHMET",
        "field_05_prev_name_r1": "",
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
        "field_18_pesel": "",
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
        "p8_date": "2026/03/15"
    }
    out_path = "ornek_veriler.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sample, f, ensure_ascii=False, indent=2)
    print(f"✓ Örnek veri dosyası oluşturuldu: {out_path}")
    print("  Değerleri düzenledikten sonra: python fill_form.py ornek_veriler.json")


if __name__ == "__main__":
    main()
