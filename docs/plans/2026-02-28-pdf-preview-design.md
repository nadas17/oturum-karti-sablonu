# PDF Önizleme (Split-View) — Tasarım Dokümanı

**Tarih:** 2026-02-28
**Durum:** Onaylandı
**Yaklaşım:** A — PDF.js + React overlay

---

## Özet

Mevcut tek sütunlu form görünümüne yan panel olarak PDF önizleme eklenir. Sol panel mevcut form sekmelerini korur; sağ panel PDF.js ile boş formu render eder ve kullanıcının girdiği değerleri field_map bounding box'larına göre üst üste bindirerek canlı önizleme sağlar.

---

## Mimari

```
form_toolkit/
├── api/routes.py          ← +2 endpoint eklenir
└── frontend/
    ├── package.json       ← pdfjs-dist eklenir
    └── src/
        ├── form_app.jsx   ← layout split-view'a dönüşür
        ├── PdfPreview.jsx ← YENİ bileşen
        └── api.js         ← +getTemplatePdf(), +getFieldMap()
```

---

## Backend Eklemeleri

`api/routes.py`'ye 2 yeni endpoint:

### GET /api/template-pdf
- `assets/wniosek-o-udzielenie-...pdf` dosyasını binary olarak döndürür
- `Content-Type: application/pdf`
- `Cache-Control: max-age=3600` (tarayıcı önbellekleme)

### GET /api/field-map
- `assets/form_field_map_v3.json`'u olduğu gibi döndürür
- Frontend'in bounding box koordinatlarına erişmesi için

---

## Frontend Layout

### Split-View Düzeni

```
┌──────────────────────────── header (tam genişlik) ──────────────────────────────┐
├──────────────────────────── tab nav (tam genişlik) ─────────────────────────────┤
│                                                                                  │
│   Sol Panel (55%, overflow-y-auto)      Sağ Panel (45%, sticky)                 │
│   ┌────────────────────────────────┐    ┌────────────────────────────────────┐   │
│   │  Mevcut form alanları          │    │  Sayfa 2 / 8    [←] [→]           │   │
│   │  (değişmez)                    │    │  ┌──────────────────────────────┐  │   │
│   │                                │    │  │  PDF.js Canvas               │  │   │
│   │                                │    │  │  + overlay div               │  │   │
│   │                                │    │  └──────────────────────────────┘  │   │
│   └────────────────────────────────┘    └────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Header ve tab navigasyonu tam genişlikte kalır
- İçerik alanı `flex flex-row gap-4` olur
- Sol panel: `w-[55%] overflow-y-auto`
- Sağ panel: `w-[45%] sticky top-[...px] h-screen overflow-y-auto`

---

## PdfPreview.jsx Bileşeni

### Props
```jsx
<PdfPreview data={data} familyData={familyData} />
```

### State
- `pdfDoc` — PDF.js document nesnesi (bir kez yüklenir)
- `fieldMap` — field_map.json (bir kez yüklenir)
- `currentPage` — aktif sayfa numarası (1-8)
- `canvasRef` — PDF.js canvas referansı
- `overlayRef` — değer overlay div referansı
- `scale` — PDF.js viewport scale (otomatik hesaplanır)

### Yaşam Döngüsü

1. **Mount:** `getFieldMap()` + `getTemplatePdf()` paralel yükle
2. **Sayfa değişince:** PDF.js ile seçili sayfayı canvas'a render et, scale değerini kaydet
3. **data değişince:** overlay div içeriğini yeniden hesapla ve render et

### Koordinat Dönüşümü

```
field_map bounding box: [x0, y0, x1, y1]
→ PDF nokta koordinatları, origin sol-üst (y aşağı artar)

PDF.js viewport.scale = panelWidth / pdf_width_pt

pixelX = x0 * scale
pixelY = y0 * scale
pixelW = (x1 - x0) * scale
pixelH = (y1 - y0) * scale
```

### Overlay Mantığı

Her alan için field_map'e bakılır:
- `field_type === "checkbox"`: `value === true` → `✓` işareti, ortalanmış, küçük font
- `field_type === "char_boxes"` / `"date_boxes"`: her karakter kendi cell_bbox'ına konumlandırılır
- `field_type === "table_cell"` / `"signature_box"`: tek blok metin, sol hizalı, küçük font

---

## api.js Eklemeleri

```javascript
export async function getTemplatePdf() {
  const res = await fetch("/api/template-pdf");
  if (!res.ok) throw new Error("PDF şablonu yüklenemedi");
  return res.arrayBuffer();
}

export async function getFieldMap() {
  const res = await fetch("/api/field-map");
  if (!res.ok) throw new Error("Alan haritası yüklenemedi");
  return res.json();
}
```

---

## Kapsam Dışı (YAGNI)

- Mobil responsive
- Zoom / pan
- Tüm sayfaları aynı anda gösterme
- Annotation / işaret ekleme

---

## Bağımlılıklar

| Paket | Versiyon | Amaç |
|---|---|---|
| `pdfjs-dist` | `^4.x` | PDF parse + canvas render |

pdfjs-dist, kendi worker'ını gerektirir. Vite'da worker URL'i `import.meta.url` ile dinamik ayarlanır:

```javascript
import { GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerSrc;
```
