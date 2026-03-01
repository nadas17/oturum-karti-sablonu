# core/field_matcher.py
"""
Çıkarılan key-value çiftlerini form alanlarıyla fuzzy-matching ile eşleştirir.
difflib.SequenceMatcher + field_synonyms.json sözlüğü kullanır.
"""
import json
import logging
import os
from difflib import SequenceMatcher
from functools import lru_cache

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNONYMS_PATH = os.path.join(BASE_DIR, "assets", "field_synonyms.json")

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_synonyms():
    """field_synonyms.json dosyasını yükler (sonuç önbelleğe alınır)."""
    if not os.path.isfile(SYNONYMS_PATH):
        logger.warning("field_synonyms.json bulunamadı: %s", SYNONYMS_PATH)
        return {}
    try:
        with open(SYNONYMS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("field_synonyms.json okunamadı: %s", exc)
        return {}


def _similarity(a, b):
    """İki string arasındaki benzerlik skoru (0-1)."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _best_match_score(extracted_key, field_id, field_label, field_desc, synonyms_list):
    """
    Bir extracted_key ile bir form alanı arasındaki en iyi eşleşme skorunu hesaplar.
    Eşleşme kaynakları: field_id, field_label, field_description, synonym sözlüğü.
    """
    key_lower = extracted_key.lower().strip()
    scores = []

    # field_id ile karşılaştır (alt çizgileri boşluğa çevir)
    scores.append(_similarity(key_lower, field_id.replace("_", " ")))

    # label ile karşılaştır
    if field_label:
        scores.append(_similarity(key_lower, field_label))
        # Label'ın parantez içindeki kısmı ile de karşılaştır
        if "(" in field_label and ")" in field_label:
            inner = field_label.split("(")[1].split(")")[0]
            scores.append(_similarity(key_lower, inner))

    # description ile karşılaştır
    if field_desc:
        scores.append(_similarity(key_lower, field_desc))

    # synonym sözlüğü ile karşılaştır
    for synonym in synonyms_list:
        scores.append(_similarity(key_lower, synonym))

    return max(scores) if scores else 0.0


def match_fields(extracted_pairs, field_map):
    """
    Çıkarılan key-value çiftlerini form alanlarıyla eşleştirir.

    Args:
        extracted_pairs: [{"key": str, "value": str}, ...]
        field_map: form_field_map_v3.json içeriği

    Returns:
        [{
            "extracted_key": str,
            "extracted_value": str,
            "matched_field_id": str | None,
            "confidence": float,
            "field_label": str,
            "field_type": str,
            "max_length": int,
            "value_fits": bool
        }, ...]
    """
    synonyms = _load_synonyms()
    form_fields = field_map.get("form_fields", [])

    # Fillable alanları filtrele (photo_box, info_box hariç)
    fillable = [
        f for f in form_fields
        if f.get("field_type") not in ("photo_box", "info_box")
    ]

    # Her alan için {field_id, label, description, num_cells, field_type} hazırla
    field_info = []
    for f in fillable:
        field_info.append({
            "field_id": f["field_id"],
            "label": f.get("label", ""),
            "description": f.get("description", ""),
            "field_type": f.get("field_type", ""),
            "num_cells": f.get("num_cells", 0),
        })

    # Claim edilen alanları takip et (aynı alan iki kez eşleşmesin)
    claimed = set()
    results = []

    # Önce tüm çiftler için skorları hesapla
    scored = []
    for pair in extracted_pairs:
        pair_scores = []
        for fi in field_info:
            syn_list = synonyms.get(fi["field_id"], [])
            score = _best_match_score(
                pair["key"], fi["field_id"], fi["label"], fi["description"], syn_list
            )
            pair_scores.append((score, fi))
        # En yüksek skorlu eşleşmeyi bul
        pair_scores.sort(key=lambda x: x[0], reverse=True)
        scored.append((pair, pair_scores))

    # Yüksek güvenli eşleşmeleri önce claim et (>= 0.6)
    scored.sort(key=lambda x: x[1][0][0] if x[1] else 0, reverse=True)

    for pair, pair_scores in scored:
        best_score = 0.0
        best_field = None

        for score, fi in pair_scores:
            if score < 0.4:
                break  # Sıralı olduğu için daha düşük skorlara bakmaya gerek yok
            if fi["field_id"] not in claimed:
                best_score = score
                best_field = fi
                break

        matched_id = None
        field_label = ""
        field_type = ""
        max_length = 0
        value_fits = True

        if best_field and best_score >= 0.4:
            matched_id = best_field["field_id"]
            field_label = best_field["label"]
            field_type = best_field["field_type"]
            max_length = best_field["num_cells"]

            # Değer sığıyor mu kontrol et
            if max_length > 0:
                value_fits = len(pair["value"]) <= max_length

            # >= 0.6 olan eşleşmeleri claim et
            if best_score >= 0.6:
                claimed.add(matched_id)

        results.append({
            "extracted_key": pair["key"],
            "extracted_value": pair["value"],
            "matched_field_id": matched_id,
            "confidence": round(best_score, 2),
            "field_label": field_label,
            "field_type": field_type,
            "max_length": max_length,
            "value_fits": value_fits,
        })

    return results
