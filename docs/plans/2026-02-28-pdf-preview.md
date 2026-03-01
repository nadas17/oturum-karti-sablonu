# PDF Önizleme (Split-View) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Form_app.jsx'e sağ panel olarak PDF.js tabanlı canlı önizleme ekle; kullanıcı bir alana yazınca sağ panelde PDF sayfasında değer anında görünsün.

**Architecture:** Flask'a 2 yeni endpoint (`/api/template-pdf`, `/api/field-map`), frontend'e `pdfjs-dist` paketi + yeni `PdfPreview.jsx` bileşeni, `form_app.jsx` split-view layout'a dönüşür.

**Tech Stack:** Flask 3.x (mevcut), React 18 (mevcut), Vite 5 (mevcut), pdfjs-dist ^4.x (yeni)

---

## Bağımlılık Haritası

```
Task 1 (routes.py → 2 endpoint)
  → Task 4 (PdfPreview.jsx geliştirme, endpoint'leri kullanır)

Task 2 (api.js → 2 fonksiyon)
  → Task 4 (PdfPreview.jsx bu fonksiyonları import eder)

Task 3 (pdfjs-dist yükle)
  → Task 4 (PdfPreview.jsx PDF.js'i import eder)

Task 4 (PdfPreview.jsx)
  → Task 5 (form_app.jsx split-view + Preview kullanımı)
    → Task 6 (build & uçtan uca test)
```

---

## Ön Bilgi

### Mevcut Dosyalar

| Dosya | Yol | Dikkat |
|---|---|---|
| Flask routes | `form_toolkit/api/routes.py` | Mevcut blueprint'e ekle |
| API client | `form_toolkit/frontend/src/api.js` | Mevcut fonksiyonlara ekle |
| Ana bileşen | `form_toolkit/frontend/src/form_app.jsx` | Layout değiştirilecek |
| Paket dosyası | `form_toolkit/frontend/package.json` | pdfjs-dist eklenecek |

### Field Map Koordinat Sistemi

`form_field_map_v3.json` içindeki bounding box'lar **sol-üst orijinli** (y aşağı artar):
- `meta.pdf_width_pt` / `meta.pdf_height_pt` — sayfa boyutu (nokta cinsinden, A4 ≈ 595×842)
- `field.bbox: [x0, y0, x1, y1]` — sol, üst, sağ, alt (PDF noktası)
- `field.cell_bboxes: [[x0,y0,x1,y1], ...]` — char_boxes için her karakter hücresi

### PDF.js Koordinat Ölçeği

```
scale = containerWidthPx / pdf_width_pt   # PDF noktası → piksel oranı
pixelLeft   = x0 * scale
pixelTop    = y0 * scale
pixelWidth  = (x1 - x0) * scale
pixelHeight = (y1 - y0) * scale
```

PDF.js canvas'ı bu scale ile render edilir. Overlay div, canvas'ın üstüne mutlak konumlandırılır.

### routes.py Config Kullanımı

`routes.py` şu anda `current_app.config["FIELD_MAP"]` ve `current_app.config["APP_CONFIG"]` kullanıyor. `APP_CONFIG.PDF_TEMPLATE_PATH` boş form PDF'inin yolunu verir.

---

## Task 1: Flask — 2 Yeni Endpoint Ekle

**Files:**
- Modify: `form_toolkit/api/routes.py`

Mevcut `@bp.get("/sample")` fonksiyonundan SONRA 2 yeni route ekle. Başka hiçbir şeye dokunma.

**Step 1: `routes.py`'deki mevcut import satırına `send_from_directory` ekle**

Dosyanın 8. satırındaki import satırı şu an:
```python
from flask import Blueprint, current_app, jsonify, request, send_file
```

Şu şekilde değiştir:
```python
from flask import Blueprint, current_app, jsonify, request, send_file, send_from_directory
```

**Step 2: Dosyanın sonuna 2 yeni endpoint ekle**

`get_sample()` fonksiyonundan sonra, dosyanın en sonuna:

```python
@bp.get("/template-pdf")
def get_template_pdf():
    """
    GET /api/template-pdf
    Boş form PDF şablonunu döndürür — PDF.js önizleme için.
    """
    config = current_app.config["APP_CONFIG"]
    import os
    folder = os.path.dirname(config.PDF_TEMPLATE_PATH)
    filename = os.path.basename(config.PDF_TEMPLATE_PATH)
    return send_from_directory(
        folder,
        filename,
        mimetype="application/pdf",
        as_attachment=False,
        max_age=3600,
    )


@bp.get("/field-map")
def get_field_map():
    """
    GET /api/field-map
    Tüm field_map'i döndürür (bounding box'lar dahil) — önizleme overlay için.
    """
    return jsonify(current_app.config["FIELD_MAP"])
```

**Step 3: Flask'ı başlatıp endpoint'leri test et**

```bash
cd "form_toolkit"
python app.py
```

Başka terminalde:
```bash
# template-pdf endpoint test
curl -I http://localhost:5000/api/template-pdf
```

Beklenen:
```
HTTP/1.1 200 OK
Content-Type: application/pdf
```

```bash
# field-map endpoint test
curl http://localhost:5000/api/field-map | python -m json.tool | head -20
```

Beklenen: `{"form_fields": [...], "meta": {...}}` şeklinde JSON.

Flask'ı durdur (Ctrl+C).

**Step 4: Commit**

```bash
git add api/routes.py
git commit -m "feat: add /api/template-pdf and /api/field-map endpoints"
```

---

## Task 2: api.js — 2 Yeni Fonksiyon Ekle

**Files:**
- Modify: `form_toolkit/frontend/src/api.js`

Dosyanın sonuna ekle, mevcut fonksiyonlara dokunma.

**Step 1: `api.js` dosyasının sonuna ekle**

```javascript
/**
 * Boş form PDF şablonunu ArrayBuffer olarak getirir.
 * PDF.js'in getDocument() beklediği formattır.
 * @returns {Promise<ArrayBuffer>}
 */
export async function getTemplatePdf() {
  const res = await fetch(`${API_BASE}/template-pdf`);
  if (!res.ok) throw new Error("PDF şablonu yüklenemedi");
  return res.arrayBuffer();
}

/**
 * Tüm field_map'i getirir (bounding box'lar dahil).
 * @returns {Promise<Object>} field_map nesnesi
 */
export async function getFieldMap() {
  const res = await fetch(`${API_BASE}/field-map`);
  if (!res.ok) throw new Error("Alan haritası yüklenemedi");
  return res.json();
}
```

**Step 2: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat: add getTemplatePdf and getFieldMap API functions"
```

---

## Task 3: pdfjs-dist Paketi Kur

**Files:**
- Modify: `form_toolkit/frontend/package.json` (npm tarafından güncellenir)

**Step 1: Paketi yükle**

```bash
cd "form_toolkit/frontend"
npm install pdfjs-dist@^4
```

**Step 2: Kurulumu doğrula**

```bash
ls node_modules/pdfjs-dist/build/pdf.worker.min.mjs
```

Beklenen: Dosya var (hata vermemeli).

**Step 3: Commit**

```bash
cd ..
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add pdfjs-dist dependency"
```

---

## Task 4: PdfPreview.jsx Bileşeni Oluştur

**Files:**
- Create: `form_toolkit/frontend/src/PdfPreview.jsx`

Bu bileşen tamamen yeni; hiçbir mevcut dosyaya dokunmaz.

**Step 1: `form_toolkit/frontend/src/PdfPreview.jsx` dosyasını oluştur**

```jsx
// frontend/src/PdfPreview.jsx
/**
 * PDF önizleme bileşeni.
 * - Boş form PDF'ini PDF.js ile canvas'a render eder
 * - Field_map bounding box'larını kullanarak girilen değerleri bindirme olarak gösterir
 * - Sayfa navigasyonu: ← / → butonları
 */
import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjs from "pdfjs-dist";
import { getTemplatePdf, getFieldMap } from "./api.js";

// Vite ile PDF.js worker kurulumu
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

/* ─── Overlay hesaplama ─── */

/**
 * field_map + kullanıcı verisi → overlay öğelerinin listesi
 * Her öğe: { key, left, top, width, height, text, type, fontSize }
 */
function buildOverlayItems(fieldMap, data, familyData, scale) {
  if (!fieldMap || !data || scale <= 0) return [];

  // familyData'yı flat key-value'ye çevir
  const FAMILY_COLS = ["name", "sex", "dob", "kinship", "citizenship", "residence", "temp_permit", "dependent"];
  const flatData = { ...data };
  if (familyData) {
    familyData.forEach((row, i) => {
      FAMILY_COLS.forEach((col) => {
        if (row[col]) flatData[`family_${i + 1}_${col}`] = row[col];
      });
    });
  }

  const items = [];

  for (const field of fieldMap.form_fields) {
    const fid = field.field_id;
    const value = flatData[fid];
    if (value === undefined || value === null || value === "" || value === false) continue;

    const ftype = field.field_type;
    const [x0, y0, x1, y1] = field.bbox;

    if (ftype === "checkbox") {
      if (value === true || String(value).toLowerCase() === "true" || value === "X" || value === "1") {
        const cx = ((x0 + x1) / 2) * scale;
        const cy = ((y0 + y1) / 2) * scale;
        const size = Math.min((y1 - y0), (x1 - x0)) * scale;
        const fs = Math.max(6, size * 0.65);
        items.push({
          key: fid,
          left: cx - fs * 0.3,
          top: cy - fs * 0.7,
          text: "X",
          fontSize: fs,
          color: "#1e3a8a",
          type: "checkbox",
        });
      }

    } else if ((ftype === "char_boxes" || ftype === "date_boxes" || ftype === "card_boxes")) {
      const text = String(value).toUpperCase();
      const cellBboxes = field.cell_bboxes;

      if (cellBboxes && cellBboxes.length > 0) {
        // Her karakter kendi cell_bbox'ına girer
        for (let i = 0; i < Math.min(text.length, cellBboxes.length); i++) {
          const ch = text[i];
          if (ch === " ") continue;
          const [cx0, cy0, cx1, cy1] = cellBboxes[i];
          const cellW = (cx1 - cx0) * scale;
          const cellH = (cy1 - cy0) * scale;
          const fs = Math.max(4, Math.min(10, cellH * 0.65, cellW * 0.85));
          items.push({
            key: `${fid}_${i}`,
            left: ((cx0 + cx1) / 2) * scale - fs * 0.3,
            top: ((cy0 + cy1) / 2) * scale - fs * 0.8,
            text: ch,
            fontSize: fs,
            color: "#1e3a8a",
            type: "char",
          });
        }
      } else if (field.num_cells > 0) {
        // Eşit hücre genişliği hesapla
        const numCells = field.num_cells;
        const cellW = (x1 - x0) / numCells;
        for (let i = 0; i < Math.min(text.length, numCells); i++) {
          const ch = text[i];
          if (ch === " ") continue;
          const cx = (x0 + i * cellW + cellW / 2) * scale;
          const cy = ((y0 + y1) / 2) * scale;
          const cellH = (y1 - y0) * scale;
          const cellWpx = cellW * scale;
          const fs = Math.max(4, Math.min(10, cellH * 0.65, cellWpx * 0.85));
          items.push({
            key: `${fid}_${i}`,
            left: cx - fs * 0.3,
            top: cy - fs * 0.8,
            text: ch,
            fontSize: fs,
            color: "#1e3a8a",
            type: "char",
          });
        }
      }

    } else if (ftype === "table_cell" || ftype === "signature_box") {
      const text = String(value);
      if (!text) continue;
      const boxW = (x1 - x0) * scale;
      const boxH = (y1 - y0) * scale;
      const fs = Math.max(3.5, Math.min(8, boxH * 0.55, boxW / (text.length * 0.52 || 1)));
      items.push({
        key: fid,
        left: x0 * scale + 1,
        top: ((y0 + y1) / 2) * scale - fs * 0.8,
        text: text,
        fontSize: fs,
        color: "#1e40af",
        type: "table",
      });
    }
  }

  return items;
}

/* ─── Ana bileşen ─── */

export default function PdfPreview({ data, familyData }) {
  const [pdfDoc, setPdfDoc]       = useState(null);
  const [fieldMap, setFieldMap]   = useState(null);
  const [currentPage, setPage]    = useState(1);
  const [totalPages, setTotal]    = useState(8);
  const [scale, setScale]         = useState(1);
  const [overlayItems, setOverlay] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const renderTask   = useRef(null);

  /* ── İlk yükleme: PDF + field_map paralel ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getTemplatePdf(), getFieldMap()])
      .then(([arrayBuffer, fm]) => {
        if (cancelled) return;
        setFieldMap(fm);
        setTotal(fm.meta?.total_pages ?? 8);
        return pdfjs.getDocument({ data: arrayBuffer }).promise;
      })
      .then((doc) => {
        if (cancelled || !doc) return;
        setPdfDoc(doc);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  /* ── Sayfa render ── */
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    // Önceki render'ı iptal et
    if (renderTask.current) {
      renderTask.current.cancel();
      renderTask.current = null;
    }

    let cancelled = false;

    pdfDoc.getPage(currentPage).then((page) => {
      if (cancelled) return;

      const containerW = containerRef.current.clientWidth || 400;
      const pdfW = page.getViewport({ scale: 1 }).width;
      const autoScale = containerW / pdfW;

      const viewport = page.getViewport({ scale: autoScale });
      const canvas = canvasRef.current;
      canvas.width  = viewport.width;
      canvas.height = viewport.height;

      setScale(autoScale);

      const ctx = canvas.getContext("2d");
      const task = page.render({ canvasContext: ctx, viewport });
      renderTask.current = task;

      task.promise
        .then(() => { renderTask.current = null; })
        .catch(() => {}); // iptal edilince sessizce çık
    });

    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  /* ── Overlay güncelle ── */
  useEffect(() => {
    if (!fieldMap || scale <= 0) return;

    // Sadece aktif sayfa alanlarını filtrele
    const pageFields = {
      ...fieldMap,
      form_fields: fieldMap.form_fields.filter((f) => f.page === currentPage),
    };
    setOverlay(buildOverlayItems(pageFields, data, familyData, scale));
  }, [data, familyData, fieldMap, currentPage, scale]);

  /* ── Sayfa navigasyonu ── */
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const nextPage = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages]);

  /* ── Render ── */
  return (
    <div className="flex flex-col h-full">
      {/* Başlık + navigasyon */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600">PDF Önizleme</span>
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="px-2 py-0.5 text-xs rounded border border-gray-200 hover:bg-gray-50
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >←</button>
          <span className="text-xs text-gray-500 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="px-2 py-0.5 text-xs rounded border border-gray-200 hover:bg-gray-50
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >→</button>
        </div>
      </div>

      {/* Canvas alanı */}
      <div className="flex-1 overflow-y-auto bg-gray-200 p-2">
        {loading && (
          <div className="flex items-center justify-center h-40 text-sm text-gray-500">
            PDF yükleniyor…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-40 text-sm text-red-600 px-4 text-center">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div ref={containerRef} className="relative inline-block shadow-lg">
            <canvas ref={canvasRef} className="block" />
            {/* Overlay */}
            <div className="absolute inset-0 pointer-events-none select-none">
              {overlayItems.map((item) => (
                <span
                  key={item.key}
                  style={{
                    position: "absolute",
                    left: item.left,
                    top: item.top,
                    fontSize: item.fontSize,
                    color: item.color,
                    fontFamily: "Helvetica, Arial, sans-serif",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}
                >
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Sözdizimi kontrolü — build ile doğrula**

```bash
cd "form_toolkit/frontend"
npm run build 2>&1 | tail -20
```

Beklenen: Build başarıyla tamamlanır, hata yoktur. (Uyarılar olabilir, sorun değil.)

**Step 3: Commit**

```bash
cd ..
git add frontend/src/PdfPreview.jsx
git commit -m "feat: add PdfPreview component with PDF.js and field overlay"
```

---

## Task 5: form_app.jsx — Split-View Layout

**Files:**
- Modify: `form_toolkit/frontend/src/form_app.jsx`

**ÖNEMLİ:** Bu dosyada sadece aşağıdaki 3 değişikliği yap. Başka hiçbir şeye dokunma.

---

### Değişiklik 1: PdfPreview import'u ekle

Dosyanın en üstüne, **mevcut `import { useState, ... }` satırından önce** değil, ondan SONRA (1. satırdan sonra) ekle:

Mevcut 1. satır:
```jsx
import { useState, useCallback, useEffect, useRef } from "react";
```

Bu satırdan hemen sonra, `generatePdf` importunu içeren satırdan ÖNCE:
```jsx
import PdfPreview from "./PdfPreview.jsx";
```

---

### Değişiklik 2: `<main>` içeriğini split-view'a dönüştür

Dosyada bu satırı bul (yaklaşık 334. satır):
```jsx
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
```

Bunu şununla değiştir:
```jsx
      <main className="max-w-7xl mx-auto px-4 py-4 flex gap-4 items-start">
```

---

### Değişiklik 3: Form içeriğini sol panele sar, sağ panel ekle

`<main>` açılış etiketinden sonra, **ilk `{tab === "personal" && ...}` bloğundan ÖNCE** şunu ekle:

```jsx
        {/* ─── Sol panel: form ─── */}
        <div className="flex-1 min-w-0 space-y-5">
```

Ve `</main>` kapanış etiketinden ÖNCE, mevcut son `{tab === "export" && ...}` bloğundan SONRA şunu ekle:

```jsx
        </div>{/* ─── Sol panel sonu ─── */}

        {/* ─── Sağ panel: PDF önizleme ─── */}
        <div className="w-[420px] flex-shrink-0 sticky top-[61px] h-[calc(100vh-61px)]
                        bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <PdfPreview data={data} familyData={familyData} />
        </div>
```

---

### Değişiklik 4: header ve tab nav max-w değerini güncelle

Dosyada iki adet `max-w-5xl` var (header ve tab nav içinde):

1. Header'daki:
```jsx
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
```
→
```jsx
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
```

2. Tab nav'daki:
```jsx
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
```
→
```jsx
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
```

---

**Step 1: Yukarıdaki 4 değişikliği yap**

**Step 2: Build ile doğrula**

```bash
cd "form_toolkit/frontend"
npm run build 2>&1 | tail -20
```

Beklenen: Hata yoktur.

**Step 3: Commit**

```bash
cd ..
git add frontend/src/form_app.jsx
git commit -m "feat: split-view layout with PDF preview panel"
```

---

## Task 6: Build & Uçtan Uca Test

**Step 1: Production build**

```bash
cd "form_toolkit/frontend"
npm run build
```

Beklenen: `../static/` dizininde `index.html` ve `assets/` oluşur.

**Step 2: Flask'ı başlat**

```bash
cd ..
python app.py
```

**Step 3: Tarayıcıda test**

Tarayıcıda `http://localhost:5000` aç:

1. Sağda beyaz panel görünüyor mu? → "PDF yükleniyor…" mesajı, ardından form PDF'i render olmalı
2. Sol paneldeki "1. Soyadı" alanına bir şey yaz → sağ panelde 1. sayfada ilgili kutu dolmalı
3. Sayfa navigasyonu (← →) çalışıyor mu? → farklı sayfalar render olmalı
4. "Kişisel Bilgiler" sekmesi dolu bir formla başka sekmeye geç → sağ panel önizleme korunuyor mu?

**Step 4: Temizle ve son commit**

```bash
# Flask'ı durdur (Ctrl+C)
git add frontend/ static/
git commit -m "feat: complete PDF preview split-view implementation"
```

---

## Olası Sorunlar

| Sorun | Çözüm |
|---|---|
| `pdf.worker.min.mjs` bulunamadı | `node_modules/pdfjs-dist/build/` içinde dosyanın adını kontrol et, sürüme göre `.mjs` yerine `.js` olabilir |
| CORS hatası | Flask ve frontend aynı port'ta (5000) çalışmalı; dev'de Vite proxy `/api` yönlendirmesi var |
| Overlay yanlış hizalanıyor | `scale` hesabını kontrol et: `containerRef.current.clientWidth / page.getViewport({scale:1}).width` |
| Build boyutu büyük | pdfjs-dist ~900KB normal, endişelenme |

---

## Özet

| Task | Dosya | İşlem |
|---|---|---|
| 1 | `api/routes.py` | 2 endpoint ekle |
| 2 | `frontend/src/api.js` | 2 fonksiyon ekle |
| 3 | `frontend/package.json` | pdfjs-dist yükle |
| 4 | `frontend/src/PdfPreview.jsx` | Yeni bileşen oluştur |
| 5 | `frontend/src/form_app.jsx` | Split-view layout |
| 6 | — | Build + test |
