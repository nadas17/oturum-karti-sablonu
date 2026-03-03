// frontend/src/PdfPreview.jsx
/**
 * PDF önizleme bileşeni.
 * - Boş form PDF'ini PDF.js ile canvas'a render eder
 * - Field_map bounding box'larını kullanarak girilen değerleri bindirme olarak gösterir
 * - Sayfa navigasyonu: ← / → butonları
 */
import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getTemplatePdf, getFieldMap } from "./api.js";

// Vite ile PDF.js worker kurulumu
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

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

  // p3a / p5b: period + basis ayrı saklanıyor, field_map birleşik bekliyor
  for (const [prefix, rows] of [["p3a", 6], ["p5b", 4]]) {
    for (let i = 1; i <= rows; i++) {
      const period = (flatData[`${prefix}_r${i}_period`] || "").trim();
      const basis  = (flatData[`${prefix}_r${i}_basis`]  || "").trim();
      if (period || basis) {
        flatData[`${prefix}_r${i}`] = period && basis ? `${period}  ${basis}` : (period || basis);
      }
    }
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
  const [totalPages, setTotal]    = useState(4);
  const [scale, setScale]         = useState(1);
  const [overlayItems, setOverlay] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const scrollRef    = useRef(null);
  const renderTask   = useRef(null);

  /* ── İlk yükleme: PDF + field_map paralel ── */
  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    setLoading(true);
    setError(null);

    Promise.all([getTemplatePdf(), getFieldMap()])
      .then(([arrayBuffer, fm]) => {
        if (cancelled) return;
        setFieldMap(fm);
        setTotal(fm.meta?.total_pages ?? 8);
        loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        return loadingTask.promise;
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

    return () => {
      cancelled = true;
      if (loadingTask) loadingTask.destroy();
    };
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
      if (!canvasRef.current || !containerRef.current) return;

      const containerW = scrollRef.current
        ? Math.max(200, scrollRef.current.clientWidth - 32)
        : 400;
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

    return () => {
      cancelled = true;
      if (renderTask.current) {
        renderTask.current.cancel();
        renderTask.current = null;
      }
    };
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

      {/* Canvas alanı */}
      <div ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto pdf-scroll flex flex-col items-center
                   bg-transparent py-4 gap-4">
        {loading && (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
            PDF yükleniyor…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-40 text-sm text-red-400 px-4 text-center">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div ref={containerRef} className="relative shadow-2xl shadow-black/60 flex-shrink-0">
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

      {/* Alt nav bar */}
      <div className="flex-shrink-0 h-8 glass border-t border-white/[0.06]
                      flex items-center justify-between px-3">
        <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
          Önizleme
        </span>
        <div className="flex items-center gap-2">
          <button onClick={prevPage} disabled={currentPage <= 1}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-400
                       hover:text-zinc-200 hover:bg-white/[0.06]
                       disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-sm">
            ‹
          </button>
          <span className="text-[11px] text-zinc-400 tabular-nums font-mono">
            {currentPage} / {totalPages}
          </span>
          <button onClick={nextPage} disabled={currentPage >= totalPages}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-400
                       hover:text-zinc-200 hover:bg-white/[0.06]
                       disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-sm">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
