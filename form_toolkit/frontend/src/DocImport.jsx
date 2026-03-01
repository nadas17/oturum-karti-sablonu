import { useState, useRef, useCallback } from "react";
import { parseDocument } from "./api.js";

/**
 * DocImport — Belge ayrıştırma ve alan eşleştirme bileşeni.
 * Üç fazlı: Upload → Loading → Mapping UI
 *
 * Props:
 *   fieldList: [{field_id, label}] — tüm form alanları
 *   onImport: (data) => void — eşleştirilen verileri forma aktarır
 *   showToast: (msg, type) => void
 */
export default function DocImport({ fieldList, onImport, showToast, onNavigateToField }) {
  const [phase, setPhase] = useState("upload"); // "upload" | "loading" | "mapping"
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);    // API yanıtı
  const [mappings, setMappings] = useState([]);   // düzenlenebilir eşleştirmeler
  const [rawOpen, setRawOpen] = useState(false);  // ham metin önizleme açık/kapalı
  const [missingOpen, setMissingOpen] = useState(true); // eksik alanlar paneli açık/kapalı
  const fileRef = useRef(null);

  const ACCEPT = ".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp";

  const handleFile = useCallback(async (file) => {
    if (!file) return;

    setPhase("loading");
    try {
      const data = await parseDocument(file);
      setResult(data);
      // API'den gelen mappings'i düzenlenebilir hale getir
      setMappings(
        data.mappings.map((m) => ({
          ...m,
          // Kullanıcı düzenleyebilsin diye kopya
          selected_field_id: m.matched_field_id || "",
          edited_value: m.extracted_value,
        }))
      );
      setPhase("mapping");
    } catch (err) {
      showToast(err.message || "Belge ayrıştırılamadı", "error");
      setPhase("upload");
    }
  }, [showToast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const handleFieldChange = useCallback((idx, fieldId) => {
    setMappings((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], selected_field_id: fieldId };
      return next;
    });
  }, []);

  const handleValueChange = useCallback((idx, value) => {
    setMappings((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], edited_value: value };
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    const importData = {};
    let count = 0;
    for (const m of mappings) {
      if (m.selected_field_id && m.edited_value) {
        importData[m.selected_field_id] = m.edited_value.toUpperCase();
        count++;
      }
    }
    if (count === 0) {
      showToast("Aktarılacak eşleştirilmiş alan yok", "error");
      return;
    }
    onImport(importData, result?.missing_fields || []);
    showToast(`${count} alan forma aktarıldı`);
    setPhase("upload");
    setResult(null);
    setMappings([]);
  }, [mappings, onImport, showToast]);

  const handleCancel = useCallback(() => {
    setPhase("upload");
    setResult(null);
    setMappings([]);
  }, []);

  const selectedCount = mappings.filter((m) => m.selected_field_id && m.edited_value).length;

  // Hangi field_id'ler zaten seçilmiş (duplikasyon engeli)
  const usedFieldIds = new Set(
    mappings.filter((m) => m.selected_field_id).map((m) => m.selected_field_id)
  );

  /* ───── UPLOAD FAZI ───── */
  if (phase === "upload") {
    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer
                      transition-colors duration-200
                      ${dragOver
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-white/10 hover:border-white/20 bg-white/[0.02]"}`}
        >
          <div className="text-3xl mb-3 text-zinc-600">&#128196;</div>
          <p className="text-sm text-zinc-400 mb-1">
            Belgeyi buraya <strong className="text-zinc-200">sürükleyin</strong> veya tıklayarak seçin
          </p>
          <p className="text-xs text-zinc-600">
            PDF, DOCX, JPG, PNG (maks. 20 MB)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
        <div className="glass rounded p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">Nasıl Çalışır?</p>
          <div className="text-sm text-zinc-400 space-y-1 leading-relaxed">
            <p>1. Belgenizi (pasaport, DOCX, tarama) yükleyin.</p>
            <p>2. LlamaParse AI belgeyi ayrıştırır ve verileri çıkarır.</p>
            <p>3. Çıkarılan veriler otomatik olarak form alanlarıyla eşleştirilir.</p>
            <p>4. Eşleştirmeleri kontrol edip onaylayın.</p>
          </div>
        </div>
      </div>
    );
  }

  /* ───── LOADING FAZI ───── */
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Belge ayrıştırılıyor...</p>
        <p className="text-xs text-zinc-600">Bu işlem birkaç saniye sürebilir</p>
      </div>
    );
  }

  /* ───── MAPPING FAZI ───── */
  return (
    <div className="space-y-4">
      {/* Üst bilgi */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Alan Eşleştirme
          </span>
          <span className="ml-2 text-xs text-zinc-600">
            {result?.filename}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {selectedCount} / {mappings.length} alan seçili
        </span>
      </div>

      {/* Eksik alanlar uyarı paneli */}
      {result?.missing_fields?.length > 0 && (
        <div className="border border-amber-500/30 rounded overflow-hidden bg-amber-500/5">
          <button
            onClick={() => setMissingOpen(!missingOpen)}
            className="w-full px-3 py-2 flex items-center justify-between
                       hover:bg-amber-500/10 transition-colors text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Eksik Alanlar ({result.missing_fields.length})
            </span>
            <span className="text-xs text-amber-600">{missingOpen ? "Daralt" : "Genişlet"}</span>
          </button>
          {missingOpen && (
            <ul className="px-3 pb-2 space-y-1">
              {result.missing_fields.map((mf, i) => (
                <li
                  key={i}
                  onClick={() => onNavigateToField?.(mf.field_id)}
                  className={`text-xs text-amber-300/80 flex gap-2 rounded px-1 py-0.5
                              ${onNavigateToField
                                ? "cursor-pointer hover:bg-amber-900/30 transition-colors"
                                : ""}`}
                >
                  <span className="text-amber-500 font-medium shrink-0">{mf.label || mf.field_id}:</span>
                  <span className="text-zinc-400">{mf.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Eşleştirme tablosu */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 w-40">
                Çıkarılan Veri
              </th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 w-44">
                Değer
              </th>
              <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Form Alanı
              </th>
              <th className="px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 w-16">
                Güven
              </th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, i) => {
              const conf = m.confidence;
              const confColor = conf >= 0.8
                ? "text-emerald-400"
                : conf >= 0.5
                  ? "text-amber-400"
                  : "text-red-400";
              const confBg = conf >= 0.8
                ? "bg-emerald-950/30"
                : conf >= 0.5
                  ? "bg-amber-950/20"
                  : "";

              return (
                <tr key={i} className={`border-b border-white/[0.06] hover:bg-white/[0.03] ${confBg}`}>
                  {/* Çıkarılan key */}
                  <td className="px-2 py-1.5 text-xs text-zinc-400 font-mono truncate" title={m.extracted_key}>
                    {m.extracted_key}
                  </td>

                  {/* Düzenlenebilir değer */}
                  <td className="px-1 py-0.5">
                    <input
                      type="text"
                      value={m.edited_value}
                      onChange={(e) => handleValueChange(i, e.target.value)}
                      className="w-full px-1.5 py-1 text-xs font-mono bg-transparent text-zinc-50
                                 outline-none focus:bg-white/[0.06] rounded transition-colors
                                 border border-transparent focus:border-white/10"
                    />
                    {!m.value_fits && m.selected_field_id && (
                      <span className="text-[10px] text-amber-500 block px-1">
                        Uzunluk sınırını aşıyor (maks {m.max_length})
                      </span>
                    )}
                  </td>

                  {/* Alan seçici dropdown */}
                  <td className="px-1 py-0.5">
                    <select
                      value={m.selected_field_id}
                      onChange={(e) => handleFieldChange(i, e.target.value)}
                      className="w-full px-1.5 py-1 text-xs bg-zinc-900 text-zinc-300
                                 border border-white/10 rounded outline-none
                                 focus:border-emerald-500 transition-colors cursor-pointer"
                    >
                      <option value="">-- Seçiniz --</option>
                      {fieldList.map((f) => (
                        <option
                          key={f.field_id}
                          value={f.field_id}
                          disabled={usedFieldIds.has(f.field_id) && m.selected_field_id !== f.field_id}
                        >
                          {f.label || f.field_id}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Güven skoru */}
                  <td className={`px-2 py-1.5 text-right text-xs font-mono font-medium ${confColor}`}>
                    {Math.round(conf * 100)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ham metin önizleme — daraltılabilir */}
      <div className="border border-white/[0.06] rounded overflow-hidden">
        <button
          onClick={() => setRawOpen(!rawOpen)}
          className="w-full px-3 py-2 flex items-center justify-between bg-white/[0.03]
                     hover:bg-white/[0.06] transition-colors text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Ham Metin Önizleme
          </span>
          <span className="text-xs text-zinc-600">{rawOpen ? "Daralt" : "Genişlet"}</span>
        </button>
        {rawOpen && (
          <pre className="px-3 py-2 text-xs font-mono text-zinc-500 max-h-48 overflow-y-auto
                          whitespace-pre-wrap leading-relaxed bg-zinc-950">
            {result?.raw_text || "(Metin çıkarılamadı)"}
          </pre>
        )}
      </div>

      {/* Aksiyon butonları */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleImport}
          disabled={selectedCount === 0}
          className="bg-emerald-500 text-white px-4 py-2 rounded text-sm font-medium
                     hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Seçili Alanları İçe Aktar ({selectedCount} alan)
        </button>
        <button
          onClick={handleCancel}
          className="text-zinc-400 border border-white/10 px-4 py-2 rounded text-sm font-medium
                     hover:bg-white/[0.06] transition-colors"
        >
          İptal
        </button>
      </div>
    </div>
  );
}
