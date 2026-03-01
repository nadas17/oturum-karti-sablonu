import { useState, useCallback, useEffect, useRef } from "react";

/* ─────────────────── ALAN TANIMLARı ─────────────────── */
const TABS = [
  { id: "personal",  label: "Kişisel Bilgiler",  icon: "👤", pages: "S.1-2" },
  { id: "address",   label: "Adres & Amaç",      icon: "🏠", pages: "S.3" },
  { id: "family",    label: "Aile Üyeleri",       icon: "👨‍👩‍👧‍👦", pages: "S.4" },
  { id: "legal",     label: "Hukuki & İmza",      icon: "⚖️", pages: "S.5-8" },
  { id: "export",    label: "Dışa Aktar",         icon: "📤", pages: "" },
];

const PERSONAL_FIELDS = [
  { id: "date_year",  label: "Başvuru Yılı",  placeholder: "2026", max: 4, group: "date" },
  { id: "date_month", label: "Başvuru Ayı",   placeholder: "03",   max: 2, group: "date" },
  { id: "date_day",   label: "Başvuru Günü",  placeholder: "15",   max: 2, group: "date" },
  { id: "field_01_surname",       label: "1. Soyadı (Nazwisko)",               placeholder: "YILMAZ",   max: 20 },
  { id: "field_02_prev_surname_r1", label: "2. Önceki Soyadı — satır 1",       placeholder: "",         max: 20 },
  { id: "field_02_prev_surname_r2", label: "2. Önceki Soyadı — satır 2",       placeholder: "",         max: 20 },
  { id: "field_03_family_name",    label: "3. Aile Soyadı (Rodowe)",           placeholder: "YILMAZ",   max: 20 },
  { id: "field_04_name_r1",       label: "4. Adı — satır 1",                   placeholder: "MEHMET",   max: 20 },
  { id: "field_04_name_r2",       label: "4. Adı — satır 2",                   placeholder: "",         max: 20 },
  { id: "field_05_prev_name_r1",  label: "5. Önceki Adı — satır 1",            placeholder: "",         max: 20 },
  { id: "field_05_prev_name_r2",  label: "5. Önceki Adı — satır 2",            placeholder: "",         max: 20 },
  { id: "field_06_fathers_name",  label: "6. Baba Adı (Imię ojca)",            placeholder: "AHMET",    max: 20 },
  { id: "field_07_mothers_name",  label: "7. Anne Adı (Imię matki)",           placeholder: "FATMA",    max: 20 },
  { id: "field_08_mothers_maiden",label: "8. Anne Kızlık Soyadı",              placeholder: "KAYA",     max: 20 },
  { id: "field_09_dob",           label: "9. Doğum Tarihi (YYYY/AA/GG)",       placeholder: "1990/05/15", max: 10 },
  { id: "field_10_sex",           label: "10. Cinsiyet (M / K)",               placeholder: "M",        max: 1 },
  { id: "field_11_birthplace",    label: "11. Doğum Yeri (Miejsce urodzenia)", placeholder: "ISTANBUL", max: 20 },
  { id: "field_12_birth_country", label: "12. Doğum Ülkesi",                   placeholder: "TURKEY",   max: 20 },
  { id: "field_13_nationality",   label: "13. Milliyet (Narodowość)",          placeholder: "TURKISH",  max: 20 },
  { id: "field_14_citizenship",   label: "14. Vatandaşlık (Obywatelstwo)",     placeholder: "TURKISH",  max: 20 },
  { id: "field_15_marital",       label: "15. Medeni Durum (Stan cywilny)",    placeholder: "SINGLE",   max: 20 },
  { id: "field_16_education",     label: "16. Eğitim (Wykształcenie)",         placeholder: "UNIVERSITY", max: 20 },
  { id: "field_17_height",        label: "17. Boy — cm (Wzrost)",              placeholder: "175",      max: 3 },
  { id: "field_17_eye_color",     label: "17. Göz Rengi (Kolor oczu)",        placeholder: "BROWN",    max: 20 },
  { id: "field_17_special_marks", label: "17. Özel İşaretler (Znaki)",        placeholder: "NONE",     max: 20 },
  { id: "field_18_pesel",         label: "18. PESEL Numarası",                 placeholder: "",         max: 20 },
  { id: "field_19_phone",         label: "19. Telefon Numarası",               placeholder: "+48501234567", max: 20 },
  { id: "field_20_email",         label: "20. E-posta Adresi",                 placeholder: "EMAIL@EXAMPLE.COM", max: 20 },
  { id: "p2_checkbox",            label: "Aile üyesi Polonya dışında ikamet ediyorsa işaretleyin",   type: "checkbox" },
];

const ADDRESS_FIELDS = [
  { id: "addr_1_voivodeship", label: "1. İl (Województwo)",       placeholder: "MAZOWIECKIE",  max: 20 },
  { id: "addr_2_city",        label: "2. Şehir (Miejscowość)",    placeholder: "WARSZAWA",     max: 20 },
  { id: "addr_3_street",      label: "3. Sokak (Ulica)",          placeholder: "MARSZALKOWSKA",max: 20 },
  { id: "addr_4_house_no",    label: "4. Bina No (Numer domu)",   placeholder: "10",           max: 7 },
  { id: "addr_5_flat_no",     label: "5. Daire No (Mieszkanie)",  placeholder: "5",            max: 7 },
  { id: "addr_6_postal_code", label: "6. Posta Kodu (Kod pocztowy)", placeholder: "00-001",    max: 6 },
];

const PURPOSE_OPTIONS = [
  { id: "purpose_checkbox_1",  label: "Nitelikli çalışma (praca wymagająca wysokich kwalifikacji)" },
  { id: "purpose_checkbox_2",  label: "Mevsimlik çalışma (praca sezonowa)" },
  { id: "purpose_checkbox_3",  label: "Şirket içi transfer (przeniesienie wewnątrz przedsiębiorstwa)" },
  { id: "purpose_checkbox_4",  label: "Diğer çalışma (wykonywanie pracy innej)" },
  { id: "purpose_checkbox_5",  label: "Ticari faaliyet (prowadzenie działalności gospodarczej)" },
  { id: "purpose_checkbox_6",  label: "Yönetim kurulu üyeliği (pełnienie funkcji w zarządzie)" },
  { id: "purpose_checkbox_7",  label: "Bilimsel araştırma (prowadzenie badań naukowych)" },
  { id: "purpose_checkbox_8",  label: "Yüksek öğrenim (odbywanie studiów)" },
  { id: "purpose_checkbox_9",  label: "Dil kursu (szkolenie językowe)" },
  { id: "purpose_checkbox_10", label: "Mesleki eğitim (szkolenie zawodowe)" },
  { id: "purpose_checkbox_11", label: "Au pair" },
  { id: "purpose_checkbox_12", label: "Gönüllü çalışma (wolontariat)" },
  { id: "purpose_checkbox_13", label: "Aile birleşimi (połączenie z rodziną)" },
  { id: "purpose_checkbox_14", label: "Uzun süreli oturum (pobyt rezydenta długoterminowego)" },
  { id: "purpose_checkbox_15", label: "AB içi mobilite (mobilność wewnątrzunijna)" },
];

const STAY_FIELDS = [
  { id: "p4_staying_yes", label: "Evet — Polonya'da bulunuyorum (Tak)", type: "checkbox" },
  { id: "p4_staying_no",  label: "Hayır — Polonya'da bulunmuyorum (Nie)", type: "checkbox" },
  { id: "p4_date", label: "Son giriş / İkamet başlangıç tarihi (YYYY/AA/GG)", placeholder: "2025/12/01", max: 10 },
];

const LEGAL_SECTION_1 = [
  { id: "p5_basis_1", label: "Vizesiz giriş (ruch bezwizowy)" },
  { id: "p5_basis_2", label: "Vize (wiza)" },
  { id: "p5_basis_3", label: "Oturum izni (zezwolenie na pobyt)" },
  { id: "p5_basis_4", label: "Diğer belge (inny dokument)" },
];

const LEGAL_SECTION_2 = [
  { id: "p5_conviction_checkbox", label: "Mahkûmiyet var — Evet (skazanie)" },
  { id: "p6_checkbox_1",          label: "VIII — Hayır, mahkûmiyet yok (nie)" },
  { id: "p6_checkbox_2",          label: "IX — Evet, ceza kovuşturması var (tak)" },
  { id: "p6_checkbox_3",          label: "IX — Hayır, kovuşturma yok (nie)" },
  { id: "p6_checkbox_4",          label: "X — Evet, mali yükümlülük var (tak)" },
  { id: "p6_checkbox_5",          label: "X — Hayır, yükümlülük yok (nie)" },
];

const SIGNATURE_FIELDS = [
  { id: "signature_specimen", label: "İmza Örneği (Wzór podpisu)", placeholder: "İmza", max: 40 },
  { id: "p8_date", label: "İmza Tarihi (YYYY/AA/GG)", placeholder: "2026/03/15", max: 10 },
];

const FAMILY_COLS = ["name","sex","dob","kinship","citizenship","residence","temp_permit","dependent"];
const FAMILY_HEADERS = ["Ad Soyad","Cinsiyet","Doğum Tar.","Akrabalık","Vatandaşlık","İkamet Yeri","Geçici İzin","Bağımlı"];
const FAMILY_PLACEHOLDERS = ["NOWAK ANNA","K","1985/03/20","SPOUSE","POLISH","WARSZAWA","TAK","TAK"];

/* ─────────────────── YARDIMCI BİLEŞENLER ─────────────────── */
function TextInput({ id, label, placeholder, max, value, onChange, compact }) {
  const len = (value || "").length;
  const pct = max ? Math.min(100, (len / max) * 100) : 0;
  return (
    <div className={compact ? "flex flex-col gap-0.5" : "flex flex-col gap-1"}>
      <label className="text-xs font-medium text-gray-500 leading-tight">{label}</label>
      <div className="relative">
        <input
          type="text"
          maxLength={max}
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange(id, e.target.value.toUpperCase())}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono
                     bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400
                     outline-none transition-all placeholder:text-gray-300"
        />
        {max && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <div className="w-8 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${pct}%`, backgroundColor: pct > 90 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#6366f1' }} />
            </div>
            <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{len}/{max}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckboxInput({ id, label, checked, onChange }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer py-1.5 px-3 rounded-lg
                       hover:bg-indigo-50/50 transition-colors group">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(id, e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-indigo-600 rounded"
      />
      <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-snug">{label}</span>
    </label>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* ─────────────────── ANA BİLEŞEN ─────────────────── */
export default function FormApp() {
  const [tab, setTab] = useState("personal");
  const [data, setData] = useState({});
  const [familyData, setFamilyData] = useState(Array.from({ length: 6 }, () => ({})));
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const handleChange = useCallback((id, value) => {
    setData((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleFamilyChange = useCallback((rowIdx, col, value) => {
    setFamilyData((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [col]: value };
      return next;
    });
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ——— Dışa aktarma ——— */
  const buildExport = useCallback(() => {
    const result = { ...data };
    familyData.forEach((row, i) => {
      FAMILY_COLS.forEach((col) => {
        if (row[col]) result[`family_${i + 1}_${col}`] = row[col];
      });
    });
    Object.keys(result).forEach((k) => {
      if (result[k] === "" || result[k] === false) delete result[k];
    });
    return result;
  }, [data, familyData]);

  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(buildExport(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "form_verileri.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("JSON dosyası indirildi");
  }, [buildExport, showToast]);

  /* ——— İçe aktarma ——— */
  const handleImportJSON = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        const newData = {};
        const newFamily = Array.from({ length: 6 }, () => ({}));
        Object.entries(imported).forEach(([k, v]) => {
          const familyMatch = k.match(/^family_(\d+)_(.+)$/);
          if (familyMatch) {
            const idx = parseInt(familyMatch[1]) - 1;
            if (idx >= 0 && idx < 6) newFamily[idx][familyMatch[2]] = v;
          } else {
            newData[k] = v;
          }
        });
        setData(newData);
        setFamilyData(newFamily);
        showToast(`${Object.keys(imported).length} alan yüklendi`);
      } catch {
        showToast("JSON dosyası okunamadı", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [showToast]);

  /* ——— Temizle ——— */
  const handleClear = useCallback(() => {
    if (window.confirm("Tüm veriler silinecek. Emin misiniz?")) {
      setData({});
      setFamilyData(Array.from({ length: 6 }, () => ({})));
      showToast("Form temizlendi");
    }
  }, [showToast]);

  /* ——— İstatistikler ——— */
  const filledCount = Object.values(data).filter((v) => v && v !== false && v !== "").length
    + familyData.reduce((acc, row) => acc + Object.values(row).filter((v) => v).length, 0);

  const totalFields = 113;
  const progressPct = Math.round((filledCount / totalFields) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      {/* Üst Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600
                            flex items-center justify-center text-white text-lg font-bold shadow-md">P</div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Polonya Oturum İzni Formu</h1>
              <p className="text-[11px] text-gray-400">Wniosek o udzielenie zezwolenia na pobyt czasowy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">{filledCount} / {totalFields} alan</div>
              <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                     style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <span className="text-sm font-semibold text-indigo-600">%{progressPct}</span>
          </div>
        </div>
      </header>

      {/* Tab Navigasyonu */}
      <nav className="sticky top-[61px] z-20 bg-white/60 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg whitespace-nowrap transition-all
                ${tab === t.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "text-gray-600 hover:bg-gray-100"}`}>
              <span className="text-base">{t.icon}</span>
              <span className="font-medium">{t.label}</span>
              {t.pages && <span className={`text-[10px] ${tab === t.id ? "text-indigo-200" : "text-gray-400"}`}>{t.pages}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* İçerik */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ───── KİŞİSEL BİLGİLER ───── */}
        {tab === "personal" && (<>
          <SectionCard title="Başvuru Tarihi" subtitle="Sayfa 1 — Üst kısım">
            <div className="grid grid-cols-3 gap-4">
              {PERSONAL_FIELDS.filter(f => f.group === "date").map(f =>
                <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="I. Kimlik Bilgileri" subtitle="Sayfa 1-2 — Soru 1-20">
            <div className="space-y-3">
              {PERSONAL_FIELDS.filter(f => !f.group && f.type !== "checkbox").map(f =>
                <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              {PERSONAL_FIELDS.filter(f => f.type === "checkbox").map(f =>
                <CheckboxInput key={f.id} {...f} checked={data[f.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>
        </>)}

        {/* ───── ADRES & AMAÇ ───── */}
        {tab === "address" && (<>
          <SectionCard title="Polonya'daki Adres" subtitle="Sayfa 3 — Bölüm B">
            <div className="space-y-3">
              {ADDRESS_FIELDS.map(f =>
                <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Kalış Amacı (Cel pobytu)" subtitle="Sayfa 3 — Uygun olanları işaretleyin">
            <div className="space-y-0.5">
              {PURPOSE_OPTIONS.map(opt =>
                <CheckboxInput key={opt.id} {...opt} checked={data[opt.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Polonya'da Bulunma Durumu" subtitle="Sayfa 4 — Bölüm III">
            <div className="space-y-3">
              <div className="flex gap-6">
                {STAY_FIELDS.filter(f => f.type === "checkbox").map(f =>
                  <CheckboxInput key={f.id} {...f} checked={data[f.id]} onChange={handleChange} />
                )}
              </div>
              {STAY_FIELDS.filter(f => !f.type).map(f =>
                <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>
        </>)}

        {/* ───── AİLE ÜYELERİ ───── */}
        {tab === "family" && (
          <SectionCard title="II. Aile Üyeleri" subtitle="Sayfa 4 — 6 satıra kadar">
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                    <th className="px-2 py-2 border border-gray-200 text-left text-gray-600 font-semibold w-8">#</th>
                    {FAMILY_HEADERS.map((h, i) => (
                      <th key={i} className="px-2 py-2 border border-gray-200 text-left text-gray-600 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {familyData.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-2 py-1 border border-gray-200 text-gray-400 font-medium text-center">{ri + 1}</td>
                      {FAMILY_COLS.map((col, ci) => (
                        <td key={col} className="px-0 py-0 border border-gray-200">
                          <input
                            type="text"
                            value={row[col] || ""}
                            placeholder={FAMILY_PLACEHOLDERS[ci]}
                            onChange={(e) => handleFamilyChange(ri, col, e.target.value.toUpperCase())}
                            className="w-full px-2 py-1.5 text-xs font-mono border-0 outline-none
                                       focus:bg-indigo-50 transition-colors placeholder:text-gray-300"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Tüm alanları BÜYÜK HARF ile doldurun. Tarih formatı: YYYY/AA/GG
            </p>
          </SectionCard>
        )}

        {/* ───── HUKUKİ DURUM ───── */}
        {tab === "legal" && (<>
          <SectionCard title="V. Yasal Dayanak (Podstawa pobytu)" subtitle="Sayfa 5">
            <div className="space-y-0.5">
              {LEGAL_SECTION_1.map(opt =>
                <CheckboxInput key={opt.id} {...opt} checked={data[opt.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="VIII-X. Beyanlar (Oświadczenia)" subtitle="Sayfa 5-6">
            <div className="space-y-0.5">
              {LEGAL_SECTION_2.map(opt =>
                <CheckboxInput key={opt.id} {...opt} checked={data[opt.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>

          <SectionCard title="D. İmza ve Tarih" subtitle="Sayfa 6-8 — Başvuranın imzası">
            <div className="space-y-3">
              {SIGNATURE_FIELDS.map(f =>
                <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
              )}
            </div>
          </SectionCard>
        </>)}

        {/* ───── DIŞA AKTAR ───── */}
        {tab === "export" && (<>
          <SectionCard title="Dışa Aktar & İçe Aktar" subtitle="JSON formatında veri yönetimi">
            <div className="space-y-5">
              {/* Butonlar */}
              <div className="flex flex-wrap gap-3">
                <button onClick={handleExportJSON}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg
                             text-sm font-medium hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
                  <span>📥</span> JSON İndir
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200
                             px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
                  <span>📤</span> JSON Yükle
                </button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                <button onClick={handleClear}
                  className="flex items-center gap-2 bg-white text-red-600 border border-red-200
                             px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors shadow-sm">
                  <span>🗑️</span> Formu Temizle
                </button>
              </div>

              {/* Önizleme */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Veri Önizleme</span>
                  <span className="text-xs text-gray-400">{Object.keys(buildExport()).length} alan</span>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-xs font-mono text-green-400
                                max-h-80 overflow-y-auto whitespace-pre leading-relaxed shadow-inner">
                  {JSON.stringify(buildExport(), null, 2)}
                </div>
              </div>

              {/* Kullanım kılavuzu */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-2">Kullanım Adımları</h4>
                <div className="text-sm text-amber-800 space-y-1.5 leading-relaxed">
                  <p>1. Formu doldurun ve <strong>JSON İndir</strong> butonuna tıklayın.</p>
                  <p>2. İndirilen dosyayı <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">form_toolkit/</code> klasörüne koyun.</p>
                  <p>3. Terminal'de şu komutu çalıştırın:</p>
                  <div className="bg-gray-900 text-green-400 rounded-lg px-3 py-2 font-mono text-xs mt-1">
                    python fill_form.py form_verileri.json doldurulmus.pdf
                  </div>
                  <p className="mt-2">4. Doldurulmuş PDF hazır!</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </>)}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
                         transition-all animate-[slideUp_0.3s_ease-out]
                         ${toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
