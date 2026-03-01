# Polonya Oturum Kartı Form Doldurma Aracı

Polonya geçici oturum izni (Karta Pobytu) başvuru formunu otomatik dolduran web uygulaması. Türkçe belgeleri (nüfus cüzdanı, pasaport vb.) yapay zeka ile okuyup Lehçe forma çevirir.

## Özellikler

- **AI Belge Okuma** — Türkçe belgeleri yükle, Claude AI otomatik olarak form alanlarını çıkarsın
- **TR → PL Çeviri** — Medeni hal, cinsiyet, ülke gibi alanları Lehçeye çevirir
- **PDF Doldurma** — 131 alanı piksel hassasiyetiyle orijinal PDF üzerine yazar
- **Canlı Önizleme** — Doldururken PDF önizlemesini anlık görüntüle
- **Eksik Alan Tespiti** — Belgede bulunamayan alanları listeler

## Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Backend | Flask, Python 3.10+ |
| Frontend | React 18, Vite, Tailwind CSS |
| AI | Claude API (Anthropic), LlamaParse |
| PDF | ReportLab, pypdf, pdf.js |

## Kurulum

### 1. Backend

```bash
cd form_toolkit
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd form_toolkit/frontend
npm install
npm run build
```

### 3. API Anahtarları

```bash
cp form_toolkit/.env.example form_toolkit/.env
```

`.env` dosyasına kendi anahtarlarını ekle:

```
ANTHROPIC_API_KEY=sk-ant-...
LLAMAPARSE_API_KEY=llx-...
```

## Kullanım

### Web Arayüzü

```bash
cd form_toolkit
python app.py
# → http://localhost:5000
```

Tarayıcıda aç, belge yükle veya alanları elle doldur, PDF indir.

### Komut Satırı

```bash
cd form_toolkit

# Örnek veri dosyası oluştur
python fill_form.py --ornek

# Formu doldur
python fill_form.py veriler.json doldurulmus.pdf
```

## Proje Yapısı

```
form_toolkit/
├── app.py                  # Flask uygulama
├── config.py               # Yapılandırma
├── api/routes.py           # API endpoint'leri
├── core/
│   ├── ai_extractor.py     # Claude AI entegrasyonu
│   ├── doc_parser.py       # LlamaParse belge okuma
│   ├── pdf_engine.py       # ReportLab PDF yazma
│   ├── field_matcher.py    # Alan eşleştirme
│   └── validator.py        # Veri doğrulama
├── fill_form.py            # CLI form doldurma
├── assets/
│   ├── form_field_map_v3.json  # 131 alan koordinat haritası
│   └── wniosek-...pdf          # Orijinal boş form
└── frontend/
    ├── src/
    │   ├── form_app.jsx    # Ana form bileşeni
    │   ├── PdfPreview.jsx  # PDF önizleme
    │   └── DocImport.jsx   # Belge yükleme
    └── package.json
```

## API Endpoint'leri

| Yol | Metod | Açıklama |
|-----|-------|----------|
| `/api/fields` | GET | Form alan listesi |
| `/api/sample` | GET | Örnek doldurulmuş veri |
| `/api/generate-pdf` | POST | PDF oluştur ve indir |
| `/api/import-doc` | POST | Belge yükle, AI ile alanları çıkar |
| `/api/template-pdf` | GET | Boş form PDF |
| `/api/field-map` | GET | Alan koordinat haritası |

## Lisans

MIT
