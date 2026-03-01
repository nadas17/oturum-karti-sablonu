# core/pdf_engine.py
"""
PDF doldurma motoru — HTTP katmanından bağımsız.
generate_pdf(user_data, pdf_path, field_map) → bytes
"""
import os
from io import BytesIO

from reportlab.pdfgen import canvas as rl_canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter

# Lehçe/Türkçe karakterleri destekleyen TTF font kaydı
# Windows: Arial, Linux/Mac: DejaVuSans fallback
_FONT_NAME = "ArialUnicode"
_FONT_REGISTERED = False


def _register_font():
    """Lehçe karakterleri destekleyen TTF fontu bir kez kaydeder."""
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return

    candidates = [
        os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "arial.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if os.path.isfile(path):
            pdfmetrics.registerFont(TTFont(_FONT_NAME, path))
            _FONT_REGISTERED = True
            return

    # Hiçbir TTF bulunamazsa Helvetica'ya geri dön (bazı karakterler kaybolur)
    _FONT_REGISTERED = True  # tekrar denemeyi önle


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

            # Hücre sayısını aşan değerler: serbest metin olarak bbox'a sığdır
            if len(text) > num_cells:
                box_w = x1 - x0
                box_h = y1 - y0
                usable_w = box_w - 3
                font_name = _FONT_NAME if _FONT_REGISTERED else "Helvetica"
                max_font_h = min(10, box_h * 0.65)
                fs = max_font_h
                actual_w = stringWidth(text, font_name, fs)
                if actual_w > usable_w:
                    fs = fs * usable_w / actual_w
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

        elif ftype in ("table_cell", "signature_box"):
            text = str(value)
            if not text:
                continue
            box_w = x1 - x0
            box_h = y1 - y0
            usable_w = box_w - 3
            usable_h = box_h - 2
            override_fs = fld.get("font_size", None)
            if override_fs:
                fs = float(override_fs)
            else:
                max_font_h = min(8, usable_h * 0.55)
                fs = max_font_h
                if text:
                    actual_w = stringWidth(text, _FONT_NAME if _FONT_REGISTERED else "Helvetica", fs)
                    if actual_w > usable_w:
                        fs = fs * usable_w / actual_w
                fs = max(3.5, fs)
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
    _register_font()
    font_name = _FONT_NAME if _FONT_REGISTERED else "Helvetica"

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(pdf_w, pdf_h))

    for pg in range(1, total_pages + 1):
        for _, draw_type, params in [op for op in ops if op[0] == pg]:
            if draw_type == "text":
                fs = params["font_size"]
                c.setFont(font_name, fs)
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
