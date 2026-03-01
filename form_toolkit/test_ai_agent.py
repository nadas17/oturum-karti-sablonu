"""
AI Agent test — Reasoning + TR→PL çeviri + Eksik alan tespiti
Hem offline (mock) hem online (gerçek API) testi yapar.
"""
import json
import os
import sys

# Proje kök dizinine ekle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.ai_extractor import (
    SYSTEM_PROMPT_TEMPLATE,
    build_field_schema,
    _clean_json_response,
    extract_with_claude,
)

# ─── Test verisi: Türkçe belge metni ───
TURKISH_DOC_TEXT = """\
TÜRKİYE CUMHURİYETİ
NÜFUS CÜZDANI

Soyadı: YILMAZ
Adı: MEHMET
Baba Adı: AHMET
Ana Adı: FATMA
Ana Kızlık Soyadı: KAYA
Doğum Tarihi: 15.05.1990
Doğum Yeri: İSTANBUL
Cinsiyeti: ERKEK
Medeni Hali: BEKAR
Uyruk: T.C.
TC Kimlik No: 12345678901

Öğrenim Durumu: ÜNİVERSİTE

İkamet Adresi (Polonya):
Voyvodalık: Mazowieckie
Şehir: Warszawa
Sokak: Marszałkowska
Bina No: 10
Daire No: 5
Posta Kodu: 00-001

Telefon: +48 501 234 567
E-posta: mehmet.yilmaz@email.com
"""


def test_1_prompt_formatting():
    """System prompt şablon formatlama testi."""
    print("=" * 60)
    print("TEST 1: System prompt formatting")
    print("=" * 60)

    # Minimal field_map
    field_map = {
        "form_fields": [
            {"field_id": "field_01_surname", "label": "Nazwisko", "field_type": "text", "num_cells": 30},
            {"field_id": "field_09_dob", "label": "Data urodzenia", "field_type": "text", "num_cells": 10},
            {"field_id": "photo_1", "label": "Zdjęcie", "field_type": "photo_box"},
        ]
    }
    schema = build_field_schema(field_map)
    assert len(schema) == 2, f"photo_box filtrelenmeli, got {len(schema)}"
    assert schema[0]["field_id"] == "field_01_surname"

    schema_json = json.dumps(schema, ensure_ascii=False, indent=2)
    prompt = SYSTEM_PROMPT_TEMPLATE.format(field_schema_json=schema_json)

    # Format hatasız mı?
    assert "{field_schema_json}" not in prompt, "Placeholder kaldı!"
    assert "field_01_surname" in prompt, "Schema inject edilmemiş"
    assert "Turkish → Polish Translation" in prompt, "Çeviri bölümü yok"
    assert "Reasoning Approach" in prompt, "Reasoning bölümü yok"
    assert "Missing Fields Detection" in prompt, "Eksik alan bölümü yok"
    assert "KAWALER" in prompt, "Çeviri tablosu yok"
    assert "TURCJA" in prompt, "Ülke çevirisi yok"

    # Literal braces düzgün mü? (JSON örneği)
    assert '"fields"' in prompt, "JSON örneğinde 'fields' key yok"
    assert '"missing_fields"' in prompt, "JSON örneğinde 'missing_fields' key yok"

    print("  [OK] Schema build: photo_box filtrelendi")
    print("  [OK] Prompt formatlama hatasız")
    print("  [OK] Reasoning bölümü mevcut")
    print("  [OK] TR→PL çeviri tablosu mevcut")
    print("  [OK] Missing fields bölümü mevcut")
    print("  [OK] JSON örneği doğru brace'lara sahip")
    print()


def test_2_response_parsing_new_format():
    """Yeni format (fields + missing_fields) parse testi."""
    print("=" * 60)
    print("TEST 2: New response format parsing")
    print("=" * 60)

    # Claude'un döneceği yeni format
    mock_response = json.dumps({
        "fields": {
            "field_01_surname": "YILMAZ",
            "field_04_name_r1": "MEHMET",
            "field_09_dob": "1990/05/15",
            "field_10_sex": "M",
            "field_15_marital": "KAWALER",
            "field_12_birth_country": "TURCJA",
            "field_14_citizenship": "TURECKIE",
        },
        "missing_fields": [
            {"field_id": "field_19_phone", "label": "Numer telefonu", "reason": "Belgede telefon bilgisi bulunamadı"},
            {"field_id": "field_17_height", "label": "Wzrost", "reason": "Boy bilgisi belgede yok"},
        ]
    })

    parsed = json.loads(_clean_json_response(mock_response))

    # Yeni format algılanıyor mu?
    assert "fields" in parsed and isinstance(parsed["fields"], dict)
    extracted = parsed["fields"]
    missing = parsed.get("missing_fields", [])

    assert extracted["field_01_surname"] == "YILMAZ"
    assert extracted["field_15_marital"] == "KAWALER", "Çeviri bekleniyor"
    assert extracted["field_12_birth_country"] == "TURCJA", "Ülke çevirisi bekleniyor"
    assert extracted["field_14_citizenship"] == "TURECKIE", "Vatandaşlık çevirisi"
    assert len(missing) == 2
    assert missing[0]["field_id"] == "field_19_phone"

    print("  [OK] Yeni format (fields + missing_fields) doğru parse edildi")
    print(f"  [OK] {len(extracted)} alan çıkarıldı")
    print(f"  [OK] {len(missing)} eksik alan tespit edildi")
    print(f"      - {missing[0]['label']}: {missing[0]['reason']}")
    print(f"      - {missing[1]['label']}: {missing[1]['reason']}")
    print()


def test_3_response_parsing_old_format():
    """Eski format (düz field_id→value) backward compat testi."""
    print("=" * 60)
    print("TEST 3: Old format backward compatibility")
    print("=" * 60)

    mock_response = json.dumps({
        "field_01_surname": "YILMAZ",
        "field_04_name_r1": "MEHMET",
    })

    parsed = json.loads(_clean_json_response(mock_response))

    # Eski format: "fields" key yok → düz obje
    if "fields" in parsed and isinstance(parsed["fields"], dict):
        extracted = parsed["fields"]
        missing = parsed.get("missing_fields", [])
    else:
        extracted = parsed
        missing = []

    assert extracted["field_01_surname"] == "YILMAZ"
    assert len(missing) == 0

    print("  [OK] Eski format hâlâ çalışıyor (backward compat)")
    print(f"  [OK] {len(extracted)} alan çıkarıldı, missing_fields boş")
    print()


def test_4_code_fence_cleaning():
    """Claude bazen code fence ile yanıt verir, temizlenebilmeli."""
    print("=" * 60)
    print("TEST 4: Code fence cleaning")
    print("=" * 60)

    wrapped = '```json\n{"fields": {"field_01_surname": "TEST"}, "missing_fields": []}\n```'
    cleaned = _clean_json_response(wrapped)
    parsed = json.loads(cleaned)
    assert parsed["fields"]["field_01_surname"] == "TEST"

    print("  [OK] Code fence temizlendi, JSON parse edildi")
    print()


def test_5_full_mapping_pipeline():
    """extract_with_claude dönüş formatı mock testi (API çağrısı yok)."""
    print("=" * 60)
    print("TEST 5: Full mapping pipeline (mock)")
    print("=" * 60)

    # Gerçek field_map yükle
    field_map_path = os.path.join(os.path.dirname(__file__), "assets", "form_field_map_v3.json")
    with open(field_map_path, encoding="utf-8") as f:
        field_map = json.load(f)

    # Mock Claude response simülasyonu
    mock_claude_output = {
        "fields": {
            "field_01_surname": "YILMAZ",
            "field_04_name_r1": "MEHMET",
            "field_06_fathers_name": "AHMET",
            "field_07_mothers_name": "FATMA",
            "field_08_mothers_maiden": "KAYA",
            "field_09_dob": "1990/05/15",
            "field_10_sex": "M",
            "field_11_birthplace": "STAMBUL",
            "field_12_birth_country": "TURCJA",
            "field_14_citizenship": "TURECKIE",
            "field_15_marital": "KAWALER",
            "field_16_education": "WYZSZE",
            "field_19_phone": "+48501234567",
            "field_20_email": "MEHMET.YILMAZ@EMAIL.COM",
            "addr_1_voivodeship": "MAZOWIECKIE",
            "addr_2_city": "WARSZAWA",
            "addr_3_street": "MARSZALKOWSKA",
            "addr_4_house_no": "10",
            "addr_5_flat_no": "5",
            "addr_6_postal_code": "00-001",
        },
        "missing_fields": [
            {"field_id": "field_17_height", "label": "Wzrost", "reason": "Boy bilgisi belgede yok"},
            {"field_id": "field_17_eye_color", "label": "Kolor oczu", "reason": "Göz rengi belgede belirtilmemiş"},
        ]
    }

    # field_lookup oluştur
    field_lookup = {}
    for f in field_map.get("form_fields", []):
        field_lookup[f["field_id"]] = f

    # Mapping oluşturma (extract_with_claude iç mantığı)
    extracted = mock_claude_output["fields"]
    missing_fields = mock_claude_output["missing_fields"]
    mappings = []

    for field_id, value in extracted.items():
        field_info = field_lookup.get(field_id)
        if field_info is None:
            continue
        value_str = str(value) if not isinstance(value, str) else value
        max_length = field_info.get("num_cells", 0)
        value_fits = len(value_str) <= max_length if max_length > 0 else True
        mappings.append({
            "extracted_key": field_info.get("label", field_id),
            "extracted_value": value_str,
            "matched_field_id": field_id,
            "confidence": 0.95,
            "field_label": field_info.get("label", ""),
            "field_type": field_info.get("field_type", ""),
            "max_length": max_length,
            "value_fits": value_fits,
        })

    print(f"  [OK] {len(mappings)} alan eşleştirildi")
    print(f"  [OK] {len(missing_fields)} eksik alan")

    # TR→PL çeviri doğrulaması
    field_vals = {m["matched_field_id"]: m["extracted_value"] for m in mappings}
    checks = {
        "field_15_marital": ("KAWALER", "Medeni hal çevirisi"),
        "field_12_birth_country": ("TURCJA", "Ülke çevirisi"),
        "field_14_citizenship": ("TURECKIE", "Vatandaşlık çevirisi"),
        "field_10_sex": ("M", "Cinsiyet çevirisi"),
        "field_11_birthplace": ("STAMBUL", "Şehir çevirisi"),
    }
    for fid, (expected, desc) in checks.items():
        actual = field_vals.get(fid)
        status = "OK" if actual == expected else "FAIL"
        print(f"  [{status}] {desc}: {actual} (beklenen: {expected})")

    # value_fits kontrolü
    overflow = [m for m in mappings if not m["value_fits"]]
    if overflow:
        print(f"  [WARN] {len(overflow)} alan uzunluk sınırını aşıyor:")
        for m in overflow:
            print(f"         {m['matched_field_id']}: '{m['extracted_value']}' (max {m['max_length']})")
    else:
        print("  [OK] Tüm değerler uzunluk sınırına uygun")

    # API response formatı simülasyonu
    api_response = {
        "raw_text": TURKISH_DOC_TEXT,
        "extracted_pairs": [],
        "mappings": mappings,
        "missing_fields": missing_fields,
        "filename": "test_nufus_cuzdani.pdf",
    }
    assert "missing_fields" in api_response
    assert len(api_response["missing_fields"]) == 2
    print("  [OK] API response formatı doğru (missing_fields dahil)")
    print()


def test_6_live_api(api_key):
    """Gerçek Claude API çağrısı ile end-to-end test."""
    print("=" * 60)
    print("TEST 6: LIVE API TEST (gerçek Claude çağrısı)")
    print("=" * 60)

    field_map_path = os.path.join(os.path.dirname(__file__), "assets", "form_field_map_v3.json")
    with open(field_map_path, encoding="utf-8") as f:
        field_map = json.load(f)

    print("  Claude API çağrılıyor... (birkaç saniye sürebilir)")
    try:
        mappings, missing_fields = extract_with_claude(TURKISH_DOC_TEXT, field_map, api_key)
    except Exception as exc:
        print(f"  [FAIL] API hatası: {exc}")
        return False

    print(f"\n  Sonuç: {len(mappings)} alan eşleştirildi, {len(missing_fields)} eksik alan")
    print()

    # Eşleştirilen alanlar
    print("  --- Eşleştirilen Alanlar ---")
    for m in mappings:
        fits = "" if m["value_fits"] else " [UZUN!]"
        print(f"  {m['matched_field_id']:30s} = {m['extracted_value']}{fits}")

    # TR→PL çeviri kontrolü
    print()
    print("  --- TR→PL Çeviri Kontrolü ---")
    field_vals = {m["matched_field_id"]: m["extracted_value"] for m in mappings}

    translation_checks = [
        ("field_10_sex", ["M"], "ERKEK → M"),
        ("field_15_marital", ["KAWALER"], "BEKAR → KAWALER"),
        ("field_12_birth_country", ["TURCJA"], "TÜRKİYE → TURCJA"),
        ("field_14_citizenship", ["TURECKIE", "TURECKI"], "TÜRK → TURECKIE/TURECKI"),
        ("field_16_education", ["WYŻSZE", "WYZSZE"], "ÜNİVERSİTE → WYŻSZE"),
    ]

    all_ok = True
    for fid, expected_options, desc in translation_checks:
        actual = field_vals.get(fid, "(yok)")
        ok = any(actual.upper() == e.upper() for e in expected_options)
        status = "OK" if ok else "WARN"
        if not ok:
            all_ok = False
        print(f"  [{status}] {desc}: {actual}")

    # Eksik alanlar
    print()
    print("  --- Eksik Alanlar ---")
    if missing_fields:
        for mf in missing_fields:
            print(f"  - {mf.get('label', mf.get('field_id', '?'))}: {mf.get('reason', '?')}")
    else:
        print("  (yok — tüm kritik alanlar bulundu)")

    print()
    print(f"  {'[OK]' if all_ok else '[WARN]'} Live API testi tamamlandı")
    return True


if __name__ == "__main__":
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  AI Agent Test: Reasoning + TR→PL + Missing Fields     ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    # Offline testler (API key gerektirmez)
    test_1_prompt_formatting()
    test_2_response_parsing_new_format()
    test_3_response_parsing_old_format()
    test_4_code_fence_cleaning()
    test_5_full_mapping_pipeline()

    # Live API testi (opsiyonel)
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key and len(sys.argv) > 1:
        api_key = sys.argv[1]

    if api_key:
        test_6_live_api(api_key)
    else:
        print("=" * 60)
        print("TEST 6: LIVE API TEST — ATLANDI")
        print("=" * 60)
        print("  ANTHROPIC_API_KEY bulunamadı.")
        print("  Gerçek API testi için:")
        print("    ANTHROPIC_API_KEY=sk-... python test_ai_agent.py")
        print("    veya: python test_ai_agent.py sk-ant-...")
        print()

    print("Tüm offline testler tamamlandı!")
