import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import PdfPreview from "./PdfPreview.jsx";
import DocImport from "./DocImport.jsx";
import { generatePdf } from "./api.js";

/* ─────────────────── TR → PL ÇEVİRİ ─────────────────── */
const TR_PL_COUNTRIES = {
  "TURKIYE": "TURCJA", "TÜRKİYE": "TURCJA", "TURCJA": "TURCJA",
  "ALMANYA": "NIEMCY", "FRANSA": "FRANCJA", "INGILTERE": "WIELKA BRYTANIA",
  "İNGİLTERE": "WIELKA BRYTANIA", "ITALYA": "WŁOCHY", "İTALYA": "WŁOCHY",
  "ISPANYA": "HISZPANIA", "İSPANYA": "HISZPANIA", "HOLLANDA": "HOLANDIA",
  "BELCIKA": "BELGIA", "BELÇİKA": "BELGIA", "AVUSTURYA": "AUSTRIA",
  "ISVICRE": "SZWAJCARIA", "İSVİÇRE": "SZWAJCARIA", "YUNANISTAN": "GRECJA",
  "BULGARISTAN": "BUŁGARIA", "ROMANYA": "RUMUNIA", "UKRAYNA": "UKRAINA",
  "RUSYA": "ROSJA", "IRAN": "IRAN", "İRAN": "IRAN", "IRAK": "IRAK",
  "SURIYE": "SYRIA", "SURİYE": "SYRIA", "MISIR": "EGIPT",
  "ABD": "USA", "AMERIKA": "USA", "KANADA": "KANADA",
  "CIN": "CHINY", "ÇİN": "CHINY", "JAPONYA": "JAPONIA",
  "PAKISTAN": "PAKISTAN", "PAKİSTAN": "PAKISTAN",
  "HINDISTAN": "INDIE", "HİNDİSTAN": "INDIE",
  "GURCISTAN": "GRUZJA", "GÜRCÜSTAN": "GRUZJA",
  "AZERBAYCAN": "AZERBEJDŻAN", "POLONYA": "POLSKA", "POLSKA": "POLSKA",
};

function translateToPolish(text) {
  if (!text) return text;
  let result = text;
  for (const [tr, pl] of Object.entries(TR_PL_COUNTRIES)) {
    result = result.replace(new RegExp(`\\b${tr}\\b`, "gi"), pl);
  }
  return result;
}

/* ─────────────────── TABS ─────────────────── */
const TABS = [
  { id: "applicant",  label: "Başvuran",           pages: "S.1" },
  { id: "personal",   label: "Kişisel Bilgiler",   pages: "S.1-2" },
  { id: "parents",    label: "Ebeveynler & Belge",  pages: "S.2" },
  { id: "marital",    label: "Medeni Durum",        pages: "S.3" },
  { id: "address",    label: "Adres & Bildirim",   pages: "S.3" },
  { id: "docimport",  label: "Belge Aktar",         pages: "" },
  { id: "export",     label: "Dışa Aktar",          pages: "" },
];

/* ─────────────────── ALAN TANIMLARı ─────────────────── */
const APPLICANT_FIELDS = [
  { id: "s1_name",     label: "İsim (Imię)",       placeholder: "MEHMET",   max: 50 },
  { id: "s1_surname",  label: "Soyad (Nazwisko)",   placeholder: "YILMAZ",   max: 50 },
];

const APPLICANT_ADDR_FIELDS = [
  { id: "s1_street",   label: "Sokak (Ulica)",          placeholder: "MARSZAŁKOWSKA", max: 50 },
  { id: "s1_house_no", label: "Bina No (Numer domu)",   placeholder: "10",           max: 10 },
  { id: "s1_flat_no",  label: "Daire No (Numer lokalu)",placeholder: "5",            max: 10 },
  { id: "s1_postal_1", label: "Posta Kodu (ilk 2)",     placeholder: "00",           max: 2 },
  { id: "s1_postal_2", label: "Posta Kodu (son 3)",     placeholder: "001",          max: 3 },
  { id: "s1_city",     label: "Şehir (Miejscowość)",   placeholder: "WARSZAWA",     max: 50 },
];

const PERSONAL_FIELDS = [
  { id: "s2_first_name",    label: "1. Ad (Imię pierwsze)",       placeholder: "MEHMET",   max: 50 },
  { id: "s2_second_name",   label: "2. İkinci Ad (Imię drugie)",  placeholder: "",         max: 50 },
  { id: "s2_other_names",   label: "3. Diğer Adlar (Imiona kolejne)", placeholder: "",     max: 50 },
  { id: "s2_surname",       label: "4. Soyad (Nazwisko)",         placeholder: "YILMAZ",   max: 50 },
];

const PERSONAL_DOB_FIELDS = [
  { id: "s2_dob_day",   label: "Gün (DD)",  placeholder: "15", max: 2, group: "dob" },
  { id: "s2_dob_month", label: "Ay (MM)",   placeholder: "05", max: 2, group: "dob" },
  { id: "s2_dob_year",  label: "Yıl (YYYY)",placeholder: "1990",max: 4, group: "dob" },
];

const PERSONAL_EXTRA_FIELDS = [
  { id: "s2_birth_country",     label: "Doğum Ülkesi (Kraj urodzenia)",       placeholder: "TURCJA",  max: 50 },
  { id: "s2_residence_country", label: "İkamet Ülkesi (Kraj zamieszkania)", placeholder: "POLSKA", max: 50 },
];

const SEX_OPTIONS = [
  { id: "s2_sex_female", label: "Kadın (kobieta)" },
  { id: "s2_sex_male",   label: "Erkek (mężczyzna)" },
];

const CITIZENSHIP_OPTIONS = [
  { id: "s2_citizenship_polish",    label: "Polonyalı (polskie)" },
  { id: "s2_citizenship_stateless", label: "Vatansız (bezpaństwowiec)" },
  { id: "s2_citizenship_other",     label: "Diğer (inne)" },
];

/* Page 2 - Documents */
const PASSPORT_FIELDS = [
  { id: "s2_passport_series",    label: "Pasaport Seri ve No",  placeholder: "U12345678", max: 20 },
  { id: "s2_passport_exp_day",   label: "Son Kullanma — Gün",   placeholder: "01", max: 2, group: "pass_exp" },
  { id: "s2_passport_exp_month", label: "Son Kullanma — Ay",    placeholder: "06", max: 2, group: "pass_exp" },
  { id: "s2_passport_exp_year",  label: "Son Kullanma — Yıl",   placeholder: "2030", max: 4, group: "pass_exp" },
];

const TRAVEL_DOC_FIELDS = [
  { id: "s2_travel_doc_series",    label: "Seyahat Belgesi Seri ve No", placeholder: "",   max: 20 },
  { id: "s2_travel_doc_exp_day",   label: "Son Kullanma — Gün",   placeholder: "", max: 2, group: "tdoc_exp" },
  { id: "s2_travel_doc_exp_month", label: "Son Kullanma — Ay",    placeholder: "", max: 2, group: "tdoc_exp" },
  { id: "s2_travel_doc_exp_year",  label: "Son Kullanma — Yıl",   placeholder: "", max: 4, group: "tdoc_exp" },
];

/* Section 3 - Parents & Documents */
const PARENTS_FIELDS = [
  { id: "s3_maiden_name",    label: "Kızlık Soyadı (Nazwisko rodowe)", placeholder: "", max: 50 },
  { id: "s3_birthplace",     label: "Doğum Yeri (Miejsce urodzenia)",  placeholder: "STAMBUŁ", max: 50 },
  { id: "s3_birth_cert_ref", label: "Doğum Belgesi Referansı",         placeholder: "", max: 80 },
  { id: "s3_birth_registry", label: "Nüfus Müdürlüğü",               placeholder: "", max: 80 },
];

const FATHER_FIELDS = [
  { id: "s3_father_name",        label: "Baba Adı (Imię ojca)",             placeholder: "AHMET",  max: 50 },
  { id: "s3_father_maiden_name", label: "Baba Kızlık Soyadı (Nazwisko rodowe ojca)", placeholder: "", max: 50 },
];

const MOTHER_FIELDS = [
  { id: "s3_mother_name",        label: "Anne Adı (Imię matki)",              placeholder: "FATMA", max: 50 },
  { id: "s3_mother_maiden_name", label: "Anne Kızlık Soyadı (Nazwisko rodowe matki)", placeholder: "KAYA", max: 50 },
];

const ID_CARD_FIELDS = [
  { id: "s3_id_series",    label: "Kimlik Kartı Seri ve No",     placeholder: "",  max: 20 },
  { id: "s3_id_exp_day",   label: "Son Kullanma — Gün",   placeholder: "", max: 2, group: "id_exp" },
  { id: "s3_id_exp_month", label: "Son Kullanma — Ay",    placeholder: "", max: 2, group: "id_exp" },
  { id: "s3_id_exp_year",  label: "Son Kullanma — Yıl",   placeholder: "", max: 4, group: "id_exp" },
  { id: "s3_id_issuer",    label: "Kimlik Kartını Veren Makam",  placeholder: "",  max: 80 },
];

/* Section 4 - Marital Status */
const MARITAL_STATUS_OPTIONS = [
  { id: "s4_status_single",   label: "Bekar (kawaler / panna)" },
  { id: "s4_status_married",  label: "Evli (żonaty / zamężna)" },
  { id: "s4_status_divorced", label: "Boşanmış (rozwiedziony / rozwiedziona)" },
  { id: "s4_status_widowed",  label: "Dul (wdowiec / wdowa)" },
];

const SPOUSE_FIELDS = [
  { id: "s4_spouse_name",        label: "Eş Adı (Imię małżonka)",                placeholder: "", max: 50 },
  { id: "s4_spouse_maiden_name", label: "Eş Kızlık Soyadı (Nazwisko rodowe)",    placeholder: "", max: 50 },
  { id: "s4_spouse_pesel",       label: "Eş PESEL Numarası",                     placeholder: "", max: 11 },
];

/* Section 5 - Marriage Event */
const EVENT_OPTIONS = [
  { id: "s5_event_marriage",          label: "Evlilik (zawarcie związku małżeńskiego)" },
  { id: "s5_event_divorce",           label: "Boşanma (rozwiązanie związku)" },
  { id: "s5_event_annulment",         label: "İptal (unieważnienie związku)" },
  { id: "s5_event_spouse_death",      label: "Eşin Vefatı (zgon małżonka)" },
  { id: "s5_event_spouse_death_found", label: "Eşin Vefatı — ceset bulunması" },
];

const EVENT_DATE_FIELDS = [
  { id: "s5_event_date_day",   label: "Gün",  placeholder: "", max: 2, group: "evt_date" },
  { id: "s5_event_date_month", label: "Ay",   placeholder: "", max: 2, group: "evt_date" },
  { id: "s5_event_date_year",  label: "Yıl",  placeholder: "", max: 4, group: "evt_date" },
];

const EVENT_REF_FIELDS = [
  { id: "s5_marriage_cert_ref", label: "Evlilik/Vefat Belge Referansı",  placeholder: "", max: 80 },
  { id: "s5_marriage_registry", label: "Nüfus Müdürlüğü / Mahkeme",    placeholder: "", max: 80 },
];

/* Section 6 - Notification */
const NOTIFY_OPTIONS = [
  { id: "s6_notify_paper",      label: "Kağıt (papierowa)" },
  { id: "s6_notify_electronic", label: "Elektronik (elektroniczna)" },
];

/* Section 7-8 - Legal & Signature */
const LEGAL_FIELDS = [
  { id: "s7_legal_basis", label: "Yasal Dayanak (Podstawa prawna)", placeholder: "Art. 7 ust. 2 ustawy o ewidencji ludności", max: 200 },
];

const SIGNATURE_FIELDS = [
  { id: "s8_city",       label: "İmza Yeri (Miejscowość)", placeholder: "WARSZAWA", max: 50 },
  { id: "s8_date_day",   label: "Gün",  placeholder: "02", max: 2, group: "sig_date" },
  { id: "s8_date_month", label: "Ay",   placeholder: "03", max: 2, group: "sig_date" },
  { id: "s8_date_year",  label: "Yıl",  placeholder: "2026", max: 4, group: "sig_date" },
];

/* ─────────────────── YARDIMCI BİLEŞENLER ─────────────────── */
function TextInput({ id, label, placeholder, max, value, onChange }) {
  const len = (value || "").length;
  const pct = max ? len / max : 0;
  return (
    <div className="flex items-baseline gap-3 py-1 border-b border-white/[0.06]
                    last:border-b-0 focus-within:border-emerald-500/50 transition-colors group">
      <label htmlFor={id}
        className="w-48 flex-shrink-0 text-xs font-medium uppercase tracking-wide
                   text-zinc-500 group-focus-within:text-emerald-400 transition-colors
                   leading-none pt-2 truncate" title={label}>
        {label}
      </label>
      <div className="flex-1 flex items-center">
        <input id={id} type="text" maxLength={max} placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange(id, e.target.value.toUpperCase())}
          onBlur={(e) => onChange(id, translateToPolish(e.target.value.toUpperCase()))}
          className="flex-1 bg-transparent text-sm font-mono text-zinc-50
                     placeholder:text-zinc-700 outline-none py-1.5 transition-all" />
        {max && len > 0 && (
          <span className={`text-[10px] font-mono flex-shrink-0 ml-1 tabular-nums
                            ${pct > 0.9 ? "text-red-400" : pct > 0.6 ? "text-amber-400" : "text-zinc-600"}`}>
            {len}/{max}
          </span>
        )}
      </div>
    </div>
  );
}

function CheckboxInput({ id, label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 py-1 cursor-pointer group">
      <input type="checkbox" id={id} checked={!!checked}
        onChange={(e) => onChange(id, e.target.checked)}
        className="w-3.5 h-3.5 rounded-sm border border-zinc-600 accent-emerald-500
                   flex-shrink-0 cursor-pointer" />
      <span className="text-sm text-zinc-500 group-hover:text-zinc-200
                       leading-tight transition-colors select-none">{label}</span>
    </label>
  );
}

function RadioGroup({ options, value, onChange }) {
  return (
    <div className="space-y-0">
      {options.map((opt) => (
        <label key={opt.id} className="flex items-center gap-2.5 py-1 cursor-pointer group">
          <input type="radio" name={options[0].id.replace(/_[^_]+$/, '')}
            checked={!!value[opt.id]}
            onChange={() => {
              options.forEach((o) => onChange(o.id, false));
              onChange(opt.id, true);
            }}
            className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer" />
          <span className="text-sm text-zinc-500 group-hover:text-zinc-200
                         leading-tight transition-colors select-none">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="pt-5 pb-1 first:pt-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {title}
        </span>
        {subtitle && <span className="text-xs text-zinc-600">{subtitle}</span>}
      </div>
      <div className="mt-1.5 h-px bg-white/[0.06]" />
    </div>
  );
}

/* ─────────────────── ANA BİLEŞEN ─────────────────── */
export default function FormApp() {
  const [tab, setTab] = useState("applicant");
  const [data, setData] = useState(() => {
    try { const s = sessionStorage.getItem("pesel_data"); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });
  const [missingFields, setMissingFields] = useState(() => {
    try { const s = sessionStorage.getItem("pesel_missing"); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [toast, setToast] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [missingPanelOpen, setMissingPanelOpen] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => { sessionStorage.setItem("pesel_data", JSON.stringify(data)); }, [data]);
  useEffect(() => { sessionStorage.setItem("pesel_missing", JSON.stringify(missingFields)); }, [missingFields]);

  const handleChange = useCallback((id, value) => {
    setData((prev) => ({ ...prev, [id]: value }));
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ——— Dışa aktarma ——— */
  const buildExport = useCallback(() => {
    const result = { ...data };
    Object.keys(result).forEach((k) => {
      if (result[k] === "" || result[k] === false) delete result[k];
    });
    return result;
  }, [data]);

  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(buildExport(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pesel_verileri.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("JSON dosyası indirildi");
  }, [buildExport, showToast]);

  const handleImportJSON = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        setData(imported);
        showToast(`${Object.keys(imported).length} alan yüklendi`);
      } catch {
        showToast("JSON dosyası okunamadı", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [showToast]);

  const handleClear = useCallback(() => {
    if (window.confirm("Tüm veriler silinecek. Emin misiniz?")) {
      setData({});
      setMissingFields([]);
      sessionStorage.removeItem("pesel_data");
      sessionStorage.removeItem("pesel_missing");
      showToast("Form temizlendi");
    }
  }, [showToast]);

  const handleGeneratePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      await generatePdf(buildExport());
      showToast("PDF oluşturuldu ve indirildi");
    } catch (err) {
      showToast(err.message || "PDF oluşturulamadı", "error");
    } finally {
      setPdfLoading(false);
    }
  }, [buildExport, showToast]);

  /* ——— Belge Aktar ——— */
  const fieldList = useMemo(() => {
    const list = [];
    const addFields = (fields) => {
      for (const f of fields) list.push({ field_id: f.id, label: f.label });
    };
    addFields(APPLICANT_FIELDS);
    addFields(APPLICANT_ADDR_FIELDS);
    addFields(PERSONAL_FIELDS);
    addFields(PERSONAL_DOB_FIELDS);
    addFields(PERSONAL_EXTRA_FIELDS);
    addFields(PASSPORT_FIELDS);
    addFields(TRAVEL_DOC_FIELDS);
    addFields(PARENTS_FIELDS);
    addFields(FATHER_FIELDS);
    addFields(MOTHER_FIELDS);
    addFields(ID_CARD_FIELDS);
    addFields(SPOUSE_FIELDS);
    addFields(EVENT_REF_FIELDS);
    addFields(LEGAL_FIELDS);
    addFields(SIGNATURE_FIELDS);
    // Also add checkbox/radio options
    for (const opt of [...SEX_OPTIONS, ...CITIZENSHIP_OPTIONS, ...MARITAL_STATUS_OPTIONS, ...EVENT_OPTIONS, ...NOTIFY_OPTIONS]) {
      list.push({ field_id: opt.id, label: opt.label });
    }
    return list;
  }, []);

  const handleDocImport = useCallback((importedData, missing) => {
    setData((prev) => ({ ...prev, ...importedData }));
    setMissingFields(missing || []);
    setTab("personal");
  }, []);

  const handleNavigateToField = useCallback((fieldId) => {
    if (!fieldId) return;
    if (fieldId.startsWith("s1_")) setTab("applicant");
    else if (fieldId.startsWith("s2_")) setTab("personal");
    else if (fieldId.startsWith("s3_")) setTab("parents");
    else if (fieldId.startsWith("s4_") || fieldId.startsWith("s5_")) setTab("marital");
    else if (fieldId.startsWith("s6_")) setTab("address");
    else if (fieldId.startsWith("s7_") || fieldId.startsWith("s8_")) setTab("address");
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) el.focus();
    }, 100);
  }, []);

  const activeMissing = missingFields.filter(mf => !data[mf.field_id]);

  const filledCount = Object.values(data).filter((v) => v && v !== false && v !== "").length;
  const totalFields = 70;
  const progressPct = Math.round((filledCount / totalFields) * 100);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950">

      {/* Header */}
      <header className="flex-shrink-0 h-12 glass border-b border-white/[0.06] flex items-center px-4 gap-3 z-30">
        <span className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center
                         text-white text-xs font-bold leading-none flex-shrink-0">P</span>
        <span className="text-sm font-semibold text-zinc-50">PESEL Başvuru Formu</span>
        <span className="text-xs text-zinc-500">— Wniosek o nadanie numeru PESEL</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-20 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                 style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-mono text-zinc-500 tabular-nums w-14 text-right">
            {filledCount} / {totalFields}
          </span>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="flex-shrink-0 h-10 glass border-b border-white/[0.06] flex items-center px-4 gap-1 z-20">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap
                        transition-colors duration-150
                        ${tab === t.id
                          ? "text-blue-300 bg-blue-500/15"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"}`}>
            {t.label}
            {t.pages && (
              <span className={`ml-1 text-[10px] font-mono
                                ${tab === t.id ? "text-blue-500/60" : "text-zinc-600"}`}>
                {t.pages}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main className="flex flex-1 min-h-0">
        {/* Sol — form */}
        <div className="w-1/2 flex flex-col min-h-0 bg-transparent border-r border-white/[0.06]">
          <div className="flex-1 overflow-y-auto form-scroll">
            <div className="px-5 py-3">

              {/* Eksik alanlar */}
              {activeMissing.length > 0 && tab !== "docimport" && (
                <div className="border border-amber-500/30 rounded-xl overflow-hidden bg-amber-500/5 mb-3">
                  <button onClick={() => setMissingPanelOpen(!missingPanelOpen)}
                    className="w-full px-4 py-2.5 flex items-center justify-between
                               hover:bg-amber-500/10 transition-colors text-left">
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      Eksik Alanlar ({activeMissing.length})
                    </span>
                    <span className="text-xs text-amber-600">{missingPanelOpen ? "Daralt" : "Genişlet"}</span>
                  </button>
                  {missingPanelOpen && (
                    <ul className="px-4 pb-3 space-y-1">
                      {activeMissing.map((mf, i) => (
                        <li key={i} onClick={() => handleNavigateToField(mf.field_id)}
                          className="text-xs text-amber-300/80 flex gap-2 rounded px-2 py-1
                                     cursor-pointer hover:bg-amber-900/30 transition-colors">
                          <span className="text-amber-500 font-medium shrink-0">{mf.label || mf.field_id}:</span>
                          <span className="text-zinc-400">{mf.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ═══ BAŞVURAN ═══ */}
              {tab === "applicant" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="1. Wnioskodawca (Başvuran)" subtitle="Sayfa 1" />
                  <div className="space-y-0">
                    {APPLICANT_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Yazışma Adresi" subtitle="Adres do korespondencji" />
                  <div className="space-y-0">
                    {APPLICANT_ADDR_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
              </>)}

              {/* ═══ KİŞİSEL BİLGİLER ═══ */}
              {tab === "personal" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="2. Kişisel Bilgiler" subtitle="Dane osoby — Sayfa 1" />
                  <div className="space-y-0">
                    {PERSONAL_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/[0.06]">
                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Cinsiyet (Płeć)</span>
                    <RadioGroup options={SEX_OPTIONS} value={data} onChange={handleChange} />
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/[0.06]">
                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Doğum Tarihi (Data urodzenia)</span>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {PERSONAL_DOB_FIELDS.map(f =>
                        <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Ülke & Vatandaşlık" subtitle="Sayfa 1" />
                  <div className="space-y-0">
                    {PERSONAL_EXTRA_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/[0.06]">
                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Vatandaşlık (Obywatelstwo)</span>
                    <RadioGroup options={CITIZENSHIP_OPTIONS} value={data} onChange={handleChange} />
                    {data.s2_citizenship_other && (
                      <TextInput id="s2_citizenship_other_text" label="Vatandaşlık Adı"
                        placeholder="TURECKIE" max={50} value={data.s2_citizenship_other_text}
                        onChange={handleChange} />
                    )}
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Pasaport Bilgileri" subtitle="Ostatnio wydany paszport — Sayfa 2" />
                  <div className="space-y-0">
                    {PASSPORT_FIELDS.filter(f => !f.group).map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-zinc-500">Son Kullanma Tarihi:</span>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {PASSPORT_FIELDS.filter(f => f.group).map(f =>
                        <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Seyahat Belgesi" subtitle="Dokument podróży — Sayfa 2" />
                  <div className="space-y-0">
                    {TRAVEL_DOC_FIELDS.filter(f => !f.group).map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-zinc-500">Son Kullanma Tarihi:</span>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {TRAVEL_DOC_FIELDS.filter(f => f.group).map(f =>
                        <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                  </div>
                </div>
              </>)}

              {/* ═══ EBEVEYNLER & BELGE ═══ */}
              {tab === "parents" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="3. Ek Kişisel Bilgiler" subtitle="Dodatkowe dane — Sayfa 2" />
                  <div className="space-y-0">
                    {PARENTS_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Baba Bilgileri" subtitle="Dane ojca" />
                  <div className="space-y-0">
                    {FATHER_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Anne Bilgileri" subtitle="Dane matki" />
                  <div className="space-y-0">
                    {MOTHER_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Kimlik Kartı Bilgileri" subtitle="Dowód osobisty — Sayfa 2" />
                  <div className="space-y-0">
                    {ID_CARD_FIELDS.filter(f => !f.group).map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-xs text-zinc-500">Son Kullanma Tarihi:</span>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {ID_CARD_FIELDS.filter(f => f.group).map(f =>
                        <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                  </div>
                </div>
              </>)}

              {/* ═══ MEDENİ DURUM ═══ */}
              {tab === "marital" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="4. Medeni Durum" subtitle="Stan cywilny — Sayfa 3" />
                  <RadioGroup options={MARITAL_STATUS_OPTIONS} value={data} onChange={handleChange} />
                </div>
                {data.s4_status_married && (
                  <div className="glass rounded-xl p-4 mb-3">
                    <SectionHeading title="Eş Bilgileri" subtitle="Dane małżonka" />
                    <div className="space-y-0">
                      {SPOUSE_FIELDS.map(f =>
                        <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                  </div>
                )}
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="5. Son Evlilik Olayı" subtitle="Ostatnie zdarzenie — Sayfa 3" />
                  <RadioGroup options={EVENT_OPTIONS} value={data} onChange={handleChange} />
                  <div className="mt-3 pt-2 border-t border-white/[0.06]">
                    <span className="text-xs text-zinc-500">Olay Tarihi:</span>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {EVENT_DATE_FIELDS.map(f =>
                        <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-0">
                    {EVENT_REF_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
              </>)}

              {/* ═══ ADRES & BİLDİRİM ═══ */}
              {tab === "address" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="6. Bildirim Şekli" subtitle="Forma powiadomienia — Sayfa 3" />
                  <RadioGroup options={NOTIFY_OPTIONS} value={data} onChange={handleChange} />
                  {data.s6_notify_electronic && (
                    <div className="mt-2">
                      <TextInput id="s6_epuap_address" label="ePUAP Adresi"
                        placeholder="/isim/skrytka" max={80} value={data.s6_epuap_address}
                        onChange={handleChange} />
                    </div>
                  )}
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="7. Yasal Dayanak" subtitle="Podstawa prawna — Sayfa 4" />
                  <div className="space-y-0">
                    {LEGAL_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="8. İmza" subtitle="Podpisy — Sayfa 4" />
                  <TextInput id="s8_city" label="İmza Yeri (Miejscowość)"
                    placeholder="WARSZAWA" max={50} value={data.s8_city} onChange={handleChange} />
                  <div className="mt-2">
                    <span className="text-xs text-zinc-500">İmza Tarihi:</span>
                    <div className="grid grid-cols-3 gap-3 mt-1">
                      {SIGNATURE_FIELDS.filter(f => f.group).map(f =>
                        <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                  </div>
                </div>
              </>)}

              {/* ═══ BELGE AKTAR ═══ */}
              {tab === "docimport" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Belge Aktar" subtitle="Otomatik doldurma" />
                  <DocImport
                    fieldList={fieldList}
                    onImport={handleDocImport}
                    showToast={showToast}
                    onNavigateToField={handleNavigateToField}
                  />
                </div>
              </>)}

              {/* ═══ DIŞA AKTAR ═══ */}
              {tab === "export" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Dışa Aktar & İçe Aktar" subtitle="JSON & PDF" />
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleExportJSON}
                        className="bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-600 transition-colors">
                        JSON İndir
                      </button>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="glass text-zinc-300 px-4 py-2 rounded text-sm font-medium hover:bg-white/[0.06] transition-colors">
                        JSON Yükle
                      </button>
                      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                      <button onClick={handleGeneratePDF} disabled={pdfLoading}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {pdfLoading ? "Oluşturuluyor…" : "PDF Oluştur"}
                      </button>
                      <button onClick={handleClear}
                        className="text-red-400 border border-red-900 px-4 py-2 rounded text-sm font-medium hover:bg-red-950 transition-colors">
                        Formu Temizle
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Veri Önizleme</span>
                        <span className="text-xs text-zinc-500">{Object.keys(buildExport()).length} alan</span>
                      </div>
                      <pre className="bg-zinc-950 rounded p-3 text-xs font-mono text-blue-400
                                      max-h-64 overflow-y-auto whitespace-pre leading-relaxed">
                        {JSON.stringify(buildExport(), null, 2)}
                      </pre>
                    </div>

                    <div className="glass rounded p-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">Kullanım</p>
                      <div className="text-sm text-zinc-400 space-y-1 leading-relaxed">
                        <p>1. Formu doldurun veya <strong className="text-zinc-200">JSON Yükle</strong> ile veri import edin.</p>
                        <p>2. <strong className="text-zinc-200">PDF Oluştur</strong> butonuna tıklayın.</p>
                        <p>3. PDF otomatik indirilir.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>)}

            </div>
          </div>
        </div>

        {/* Sağ — PDF */}
        <div className="w-1/2 flex flex-col min-h-0 bg-zinc-900/50 overflow-hidden">
          <PdfPreview data={data} familyData={null} />
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{ animation: "slideUp 0.2s ease-out" }}
          className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded text-xs font-medium shadow-lg
                      ${toast.type === "error" ? "bg-red-600 text-white" : "glass-elevated text-zinc-50"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
