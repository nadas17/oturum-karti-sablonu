# core/validator.py
"""
Form alanı doğrulama — Flask bağımsız.
validate(user_data, field_map) → list[str]  (hata mesajları)

Not: Karakter uzunluğu aşımları hata değil uyarıdır — pdf_engine otomatik truncate yapar.
"""
import logging

logger = logging.getLogger(__name__)


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

        # Karakter kutuları için uzunluk kontrolü — uyarı, hata değil
        # pdf_engine num_cells aşarsa font küçültüp serbest metin olarak yazar
        if ftype in ("char_boxes", "date_boxes", "card_boxes") and num_cells > 0:
            if isinstance(value, str) and len(value) > num_cells:
                logger.warning(
                    "%s: '%s' değeri %d hücreyi aşıyor, PDF'de küçük fontla yazılacak",
                    field_id, value, num_cells,
                )

        # Checkbox boolean kontrolü
        if ftype == "checkbox":
            if not isinstance(value, (bool, int)) and str(value).lower() not in (
                "true", "false", "x", "1", "0", "yes", "no", "tak", "nie"
            ):
                errors.append(f"{field_id}: checkbox değeri boolean olmalı")

    return errors
