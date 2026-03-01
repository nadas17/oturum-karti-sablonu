# Polonya Form Doldurma Aracı — Lokal Python Tool Tasarımı

**Tarih:** 2026-02-27
**Durum:** Onaylandı

---

## Özet

Mevcut iki aşamalı iş akışını (React UI → JSON export → CLI Python) tek bir lokal Python aracına dönüştür.
Kullanıcı `python start.py` çalıştırır, tarayıcıda formu doldurur veya JSON import eder, "PDF Oluştur" butonuna basar.

---

## Mimari

```
KULLANICI
    │
    ▼
tarayıcı: http://localhost:5000
    │
    ├── GET /          → Flask → static/index.html (React UI)
    │
    └── POST /api/generate-pdf
            │   { form verisi JSON }
            ▼
         Flask api/routes.py
            │
            └── core/pdf_engine.py → generate_pdf(data) → bytes
                    └── form_field_map_v3.json
                    └── wniosek...pdf
            ▼
         PDF bytes → tarayıcıya stream → otomatik indirir
```

---

## Proje Yapısı

```
form_toolkit/
│
├── start.py                ← TEK KOMUT: build + Flask başlat
├── config.py               ← Config (port, paths, debug flag)
├── requirements.txt        ← flask, reportlab, pypdf
│
├── core/                   ← Saf Python — Flask'tan bağımsız
│   ├── pdf_engine.py       ← generate_pdf(user_data, config) → bytes
│   └── validator.py        ← validate(user_data, field_map) → errors list
│
├── api/                    ← İnce Flask katmanı
│   └── routes.py           ← Blueprint: /api/generate-pdf, /api/fields, /api/sample
│
├── assets/                 ← Form kaynak dosyaları
│   ├── wniosek-o-udzielenie-...pdf
│   └── form_field_map_v3.json
│
├── frontend/               ← Vite + React
│   ├── package.json        ← React, Vite bağımlılıkları
│   ├── vite.config.js      ← Dev: /api/* → localhost:5000 proxy
│   └── src/
│       ├── main.jsx        ← React root
│       ├── api.js          ← generatePdf(data), getFields() fetch wrappers
│       └── form_app.jsx    ← Mevcut JSX + "PDF Oluştur" butonu eklenir
│
└── static/                 ← Vite build çıktısı (gitignore)
```

---

## Startup Modları

| Komut | Davranış |
|---|---|
| `python start.py` | static/ yoksa build et, Flask başlat |
| `python start.py --dev` | Vite dev server (HMR) + Flask paralel başlat |
| `python start.py --no-build` | Build atla, sadece Flask başlat |
| `python fill_form.py veriler.json` | CLI hâlâ çalışır (değişmez) |

---

## API Endpoints

```
POST /api/generate-pdf
  Body:    { field_id: value, ... }
  Returns: application/pdf binary (Content-Disposition: attachment)
  Errors:  400 { "error": "...", "fields": ["..."] }

GET /api/fields
  Returns: form field listesi + type + max_length
  → AI agent / script entegrasyonu için

GET /api/sample
  Returns: örnek JSON verisi (fill_form.py --ornek ile aynı)
```

---

## Core Katmanı (Flask'tan bağımsız)

```python
# core/pdf_engine.py
def generate_pdf(user_data: dict, config: Config) -> bytes:
    """Saf fonksiyon: veri → PDF bytes. HTTP bilmez."""

# core/validator.py
def validate(user_data: dict, field_map: dict) -> list[str]:
    """Hataları döndürür, exception atmaz."""
```

---

## React Değişiklikleri (form_app.jsx)

- Export sekmesine "PDF Oluştur & İndir" butonu eklenir
- `api.js` ile `POST /api/generate-pdf` çağrısı yapılır
- Response PDF blob olarak indirilir
- Mevcut JSON import/export korunur
- Loading state + hata mesajı gösterimi eklenir

---

## Tasarım Prensipleri

1. **Tek komutla başlat** — `python start.py`
2. **Core/API ayrımı** — pdf_engine Flask'tan bağımsız, test edilebilir
3. **CLI geriye dönük uyumluluk** — `fill_form.py` değişmez
4. **AI-agent ready** — `/api/fields` endpoint ile dışarıdan kullanılabilir
5. **Validation** — Server-side alan doğrulama, anlamlı hata mesajları
