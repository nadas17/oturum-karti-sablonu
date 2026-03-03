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
            font_name = _FONT_NAME if _FONT_REGISTERED else "Helvetica"
            override_fs = fld.get("font_size", None)
            if override_fs:
                fs = float(override_fs)
            else:
                fs = min(8, usable_h * 0.55)
            # Metin kutuya sığmazsa küçült
            if text:
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


def _get_flat_template(input_pdf_path: str) -> str:
    """
    Form şablonunu bir kez düzleştir (annotation appearance'larını sayfa
    content stream'ine göm, sonra annotation ve AcroForm'u kaldır).
    Düzleştirilmiş dosyayı önbelleğe al.
    """
    flat_path = input_pdf_path.replace(".pdf", "_flat.pdf")
    if os.path.isfile(flat_path):
        return flat_path

    reader = PdfReader(input_pdf_path)
    writer = PdfWriter()
    writer.append_pages_from_reader(reader)

    from pypdf.generic import (
        NameObject, ArrayObject, DictionaryObject,
        StreamObject, NumberObject,
    )

    for page_idx, page in enumerate(writer.pages):
        annots_ref = page.get("/Annots")
        if not annots_ref:
            continue
        annots = annots_ref.get_object() if hasattr(annots_ref, "get_object") else annots_ref
        if not annots:
            continue

        extra_ops = []
        for idx, annot_ref in enumerate(annots):
            try:
                annot = annot_ref.get_object() if hasattr(annot_ref, "get_object") else annot_ref
                ap = annot.get("/AP")
                if not ap:
                    continue
                ap_obj = ap.get_object() if hasattr(ap, "get_object") else ap
                normal_ref = ap_obj.get("/N")
                if not normal_ref:
                    continue
                normal = normal_ref.get_object() if hasattr(normal_ref, "get_object") else normal_ref
                rect = annot.get("/Rect")
                if not rect:
                    continue
                rect_vals = [float(v) for v in (rect.get_object() if hasattr(rect, "get_object") else rect)]
                x0, y0, x1, y1 = rect_vals
                w, h = x1 - x0, y1 - y0
                if w <= 0 or h <= 0:
                    continue

                # Checkbox widget: /AP/N bir dict (/Off, /Tak vs.)
                # Boş kutu görünümü için /Off stream'ini kullan
                if isinstance(normal, dict) and not hasattr(normal, "get_data"):
                    off_ref = normal.get("/Off")
                    if not off_ref:
                        continue
                    off_stream = off_ref.get_object() if hasattr(off_ref, "get_object") else off_ref
                    if not hasattr(off_stream, "get_data"):
                        continue
                    appearance_ref = off_ref
                    appearance_obj = off_stream
                elif hasattr(normal, "get_data"):
                    appearance_ref = normal_ref
                    appearance_obj = normal
                else:
                    continue

                xobj_name = f"/FA{page_idx}_{idx}"

                # XObject'i sayfanın Resources'ına ekle
                resources = page.get("/Resources")
                if resources and hasattr(resources, "get_object"):
                    resources = resources.get_object()
                if not resources:
                    resources = DictionaryObject()
                    page[NameObject("/Resources")] = resources

                xobjects = resources.get("/XObject")
                if xobjects and hasattr(xobjects, "get_object"):
                    xobjects = xobjects.get_object()
                if not xobjects:
                    xobjects = DictionaryObject()
                    resources[NameObject("/XObject")] = xobjects

                xobjects[NameObject(xobj_name)] = appearance_ref

                # BBox'a göre ölçekle
                bbox = appearance_obj.get("/BBox", [0, 0, w, h])
                if hasattr(bbox, "get_object"):
                    bbox = bbox.get_object()
                bw = float(bbox[2]) - float(bbox[0])
                bh = float(bbox[3]) - float(bbox[1])
                sx = w / bw if bw > 0 else 1
                sy = h / bh if bh > 0 else 1

                extra_ops.append(f"q {sx:.6f} 0 0 {sy:.6f} {x0:.2f} {y0:.2f} cm {xobj_name} Do Q\n")
            except Exception:
                continue

        if extra_ops:
            stream_content = "".join(extra_ops).encode("latin-1")
            new_stream = StreamObject()
            new_stream[NameObject("/Length")] = NumberObject(len(stream_content))
            new_stream._data = stream_content
            stream_ref = writer._add_object(new_stream)

            existing = page.get("/Contents")
            if existing:
                obj = existing.get_object() if hasattr(existing, "get_object") else existing
                if isinstance(obj, ArrayObject):
                    contents = ArrayObject(list(obj) + [stream_ref])
                elif isinstance(obj, list):
                    contents = ArrayObject(list(obj) + [stream_ref])
                else:
                    contents = ArrayObject([existing, stream_ref])
                page[NameObject("/Contents")] = contents
            else:
                page[NameObject("/Contents")] = stream_ref

        # Annotation'ları kaldır
        if "/Annots" in page:
            del page["/Annots"]

    # AcroForm'u kaldır
    if "/AcroForm" in writer._root_object:
        del writer._root_object["/AcroForm"]

    with open(flat_path, "wb") as f:
        writer.write(f)

    return flat_path


def _merge_to_bytes(input_pdf_path: str, overlay_buf: BytesIO) -> bytes:
    """Orijinal PDF + overlay → bytes."""
    flat_path = _get_flat_template(input_pdf_path)
    base = PdfReader(flat_path)
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
