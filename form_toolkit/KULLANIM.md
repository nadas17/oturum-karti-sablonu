# Polonya Geçici Oturum İzni Formu — Otomatik Doldurma Aracı

## Dosya Yapısı

```
form_toolkit/
├── fill_form.py              ← Ana doldurma scripti (ReportLab)
├── form_field_map_v3.json    ← 131 alan koordinat haritası (V3 — hücre bazlı)
├── form_panel.jsx            ← React veri giriş paneli
├── mock_data.json            ← Kısa test verisi örneği
├── full_test_data.json       ← Tüm 131 alanı dolduran kapsamlı test verisi
├── wniosek-o-udzielenie-...pdf  ← Orijinal boş form (A4, 13 sayfa)
└── KULLANIM.md               ← Bu dosya
```

## Gereksinimler

```bash
pip install reportlab pypdf
```

## Hızlı Başlangıç

### 1. Veri dosyası hazırla

JSON formatında bir dosya oluştur. Anahtar adları `form_field_map_v3.json` içindeki `field_id` değerleriyle eşleşmeli:

```json
{
  "date_year": "2026",
  "date_month": "04",
  "date_day": "10",
  "field_01_surname": "YILMAZ",
  "field_04_name_r1": "MEHMET",
  "field_09_dob": "1990/05/15",
  "field_10_sex": "M",
  "purpose_checkbox_4": true,
  "p4_staying_yes": true
}
```

### 2. Formu doldur

```bash
cd form_toolkit
python fill_form.py veriler.json doldurulmus.pdf
```

### 3. Örnek veri oluştur

```bash
python fill_form.py --ornek
# → ornek_veriler.json oluşturulur
```

## Alan Türleri ve Formatlar

| Tür | Format | Örnek |
|-----|--------|-------|
| `char_boxes` | Büyük harf metin | `"MEHMET"` |
| `date_boxes` | YYYY/MM/DD | `"1990/05/15"` |
| `checkbox` | true/false | `true` |
| `table_cell` | Serbest metin | `"NOWAK PIOTR"` |

## Tüm Alan Listesi (131 alan)

### Sayfa 1 — Başvuru Tarihi + Kişisel (15 alan)
- `date_year` / `date_month` / `date_day` — Başvuru tarihi
- `field_01_surname` — Soyadı (20 hücre)
- `field_02_prev_surname_r1` / `r2` — Önceki soyadı (2 satır × 20)
- `field_03_family_name` — Aile soyadı (20)
- `field_04_name_r1` / `r2` — Ad (2 satır × 20)
- `field_05_prev_name_r1` / `r2` — Önceki ad (2 satır × 20)
- `field_06_fathers_name` — Baba adı (20)

### Sayfa 2 — Kişisel Devam (16 alan)
- `field_07_mothers_name` — Anne adı (20)
- `field_08_mothers_maiden` — Anne kızlık soyadı (20)
- `field_09_dob` — Doğum tarihi (10: YYYY/MM/DD)
- `field_10_sex` — Cinsiyet: M veya K (1)
- `field_11_birthplace` — Doğum yeri (20)
- `field_12_birth_country` — Doğum ülkesi (20)
- `field_13_nationality` — Milliyet (20)
- `field_14_citizenship` — Vatandaşlık (20)
- `field_15_marital` — Medeni durum (20)
- `field_16_education` — Eğitim (20)
- `field_17_height` — Boy cm (3)
- `field_17_eye_color` — Göz rengi (20)
- `field_17_special_marks` — Özel işaretler (20)
- `field_18_pesel` — PESEL (20)
- `field_19_phone` — Telefon (20)
- `field_20_email` — E-posta (20)

### Sayfa 3 — Adres + Kalış Amacı (21 alan)
- `addr_1_voivodeship` — İl (20)
- `addr_2_city` — Şehir (20)
- `addr_3_street` — Sokak (20)
- `addr_4_house_no` — Bina no (7)
- `addr_5_flat_no` — Daire no (7)
- `addr_6_postal_code` — Posta kodu: XX-XXX (6)
- `purpose_checkbox_1` … `purpose_checkbox_15` — 15 amaç checkbox

### Sayfa 4 — Aile + Polonya'da Kalış (51 alan)
- `family_N_name` / `sex` / `dob` / `kinship` / `citizenship` / `residence` / `temp_permit` / `dependent` — N=1..6, her biri tablo hücresi
- `p4_staying_yes` / `p4_staying_no` — Polonya'da kalıyor mu checkbox
- `p4_date` — Son giriş tarihi (10: YYYY/MM/DD)

### Sayfa 5 — Hukuki Dayanak (5 alan)
- `p5_basis_1` … `p5_basis_4` — 4 checkbox
- `p5_conviction_checkbox` — Mahkumiyet checkbox

### Sayfa 6 — Hukuki Durum (5 alan)
- `p6_checkbox_1` … `p6_checkbox_5` — 5 checkbox

### Sayfa 8 — İmza (1 alan)
- `p8_date` — İmza tarihi (10)

### Sayfa 11 — Resmi Notlar (2 alan)
- `p11_official_date` — Kabul tarihi (10)
- `p11_fingerprint_date` — Parmak izi tarihi (10)

### Sayfa 12 — Oturma Kartı (9 alan)
- `p12_card_series` (3) / `p12_card_number_r1` (10) / `p12_card_number_r2` (10)
- `p12_decision_date` (10) / `p12_address` (20) / `p12_address_2` (10)
- `p12_postal_code` (6) / `p12_validity_date` (10) / `p12_collection_date` (10)

### Sayfa 13 — İkinci Kart (3 alan)
- `p13_card_series` (2) / `p13_card_number` (7) / `p13_collection_date` (10)

## Teknik Detaylar

- **Koordinat sistemi**: PDF noktaları, y=0 üstte (pdfplumber standardı)
- **PDF boyutu**: 595.32 × 841.92 pt (A4)
- **Hücre hassasiyeti**: 49/50 karakter alanı bireysel `cell_bboxes` ile piksel-hassas
- **Metin motoru**: ReportLab Canvas (Helvetica fontu, drawCentredString)
- **Birleştirme**: pypdf merge_page ile orijinal PDF üzerine overlay
