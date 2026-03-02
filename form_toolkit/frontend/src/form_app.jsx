import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import PdfPreview from "./PdfPreview.jsx";
import DocImport from "./DocImport.jsx";
import { generatePdf } from "./api.js";

/* ─────────────────── TR → PL ÇEVİRİ ─────────────────── */
const TR_PL_MONTHS = {
  "OCAK": "STYCZEŃ", "SUBAT": "LUTY", "ŞUBAT": "LUTY", "MART": "MARZEC",
  "NISAN": "KWIECIEŃ", "NİSAN": "KWIECIEŃ", "MAYIS": "MAJ",
  "HAZIRAN": "CZERWIEC", "HAZİRAN": "CZERWIEC", "TEMMUZ": "LIPIEC",
  "AGUSTOS": "SIERPIEŃ", "AĞUSTOS": "SIERPIEŃ", "EYLUL": "WRZESIEŃ",
  "EYLÜL": "WRZESIEŃ", "EKIM": "PAŹDZIERNIK", "KASIM": "LISTOPAD",
  "ARALIK": "GRUDZIEŃ",
};
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
  "BANGLADES": "BANGLADESZ", "BANGLADEŞ": "BANGLADESZ",
  "HINDISTAN": "INDIE", "HİNDİSTAN": "INDIE",
  "GURCISTAN": "GRUZJA", "GÜRCÜSTAN": "GRUZJA",
  "AZERBAYCAN": "AZERBEJDŻAN", "OZBEKISTAN": "UZBEKISTAN",
  "ÖZBEKİSTAN": "UZBEKISTAN", "TURKMENISTAN": "TURKMENISTAN",
  "TÜRKMENİSTAN": "TURKMENISTAN", "KAZAKISTAN": "KAZACHSTAN",
  "KIRGIZISTAN": "KIRGISTAN", "TACIKISTAN": "TADŻYKISTAN",
  "TAYİKİSTAN": "TADŻYKISTAN", "NEPAL": "NEPAL", "SRI LANKA": "SRI LANKA",
  "POLONYA": "POLSKA", "POLSKA": "POLSKA",
};

/** Metin içindeki Türkçe ay ve ülke adlarını Lehçeye çevirir */
function translateToPolish(text) {
  if (!text) return text;
  let result = text;
  // Ay adları
  for (const [tr, pl] of Object.entries(TR_PL_MONTHS)) {
    result = result.replace(new RegExp(`\\b${tr}\\b`, "gi"), pl);
  }
  // Ülke adları
  for (const [tr, pl] of Object.entries(TR_PL_COUNTRIES)) {
    result = result.replace(new RegExp(`\\b${tr}\\b`, "gi"), pl);
  }
  return result;
}

/* ─────────────────── ALAN TANIMLARı ─────────────────── */
const TABS = [
  { id: "personal", label: "Kişisel Bilgiler", pages: "S.1-2" },
  { id: "address",  label: "Adres & Amaç",     pages: "S.3-4" },
  { id: "family",   label: "Aile Üyeleri",      pages: "S.4" },
  { id: "legal",    label: "Hukuki & İmza",     pages: "S.5-8" },
  { id: "docimport", label: "Belge Aktar",        pages: "" },
  { id: "export",   label: "Dışa Aktar",        pages: "" },
];

const PERSONAL_FIELDS = [
  { id: "do_authority", label: "Do / To — Voyvodalık Adı", placeholder: "MAZOVYA VOYVODALIGI", max: 60 },
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
  { id: "field_20_email",         label: "20. E-posta Adresi",                 placeholder: "EMAIL@EXAMPLE.COM", max: 50, shrink: true },
  { id: "p2_checkbox",            label: "Aile üyesi Polonya dışında ikamet ediyorsa işaretleyin", type: "checkbox" },
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

const FINANCE_ROWS = 4;
const INSURANCE_ROWS = 4;

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

const PREV_STAY_PL_ROWS  = 6;
const PREV_STAY_OUT_ROWS = 4;

/* ─────────────────── YARDIMCI BİLEŞENLER ─────────────────── */
function TextInput({ id, label, placeholder, max, value, onChange, shrink }) {
  const len = (value || "").length;
  const pct = max ? len / max : 0;
  const fontSize = shrink && len > 30 ? "text-[10px]" : shrink && len > 20 ? "text-xs" : "text-sm";
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
          className={`flex-1 bg-transparent ${fontSize} font-mono text-zinc-50
                     placeholder:text-zinc-700 outline-none py-1.5 transition-all`} />
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
  const [tab, setTab] = useState("personal");
  const [data, setData] = useState(() => {
    try { const s = sessionStorage.getItem("form_data"); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });
  const [familyData, setFamilyData] = useState(() => {
    try { const s = sessionStorage.getItem("form_familyData"); return s ? JSON.parse(s) : Array.from({ length: 6 }, () => ({})); }
    catch { return Array.from({ length: 6 }, () => ({})); }
  });
  const [missingFields, setMissingFields] = useState(() => {
    try { const s = sessionStorage.getItem("form_missingFields"); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [toast, setToast] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [missingPanelOpen, setMissingPanelOpen] = useState(true);
  const fileInputRef = useRef(null);

  // sessionStorage senkronizasyonu
  useEffect(() => { sessionStorage.setItem("form_data", JSON.stringify(data)); }, [data]);
  useEffect(() => { sessionStorage.setItem("form_familyData", JSON.stringify(familyData)); }, [familyData]);
  useEffect(() => { sessionStorage.setItem("form_missingFields", JSON.stringify(missingFields)); }, [missingFields]);

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

  const buildPdfPayload = useCallback(() => {
    const result = { ...data };
    familyData.forEach((row, i) => {
      FAMILY_COLS.forEach((col) => {
        if (row[col]) result[`family_${i + 1}_${col}`] = row[col];
      });
    });
    Object.keys(result).forEach((k) => {
      if (result[k] === "") delete result[k];
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

  const handleClear = useCallback(() => {
    if (window.confirm("Tüm veriler silinecek. Emin misiniz?")) {
      setData({});
      setFamilyData(Array.from({ length: 6 }, () => ({})));
      setMissingFields([]);
      sessionStorage.removeItem("form_data");
      sessionStorage.removeItem("form_familyData");
      sessionStorage.removeItem("form_missingFields");
      showToast("Form temizlendi");
    }
  }, [showToast]);

  const handleGeneratePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      await generatePdf(buildPdfPayload());
      showToast("PDF oluşturuldu ve indirildi");
    } catch (err) {
      showToast(err.message || "PDF oluşturulamadı", "error");
    } finally {
      setPdfLoading(false);
    }
  }, [buildPdfPayload, showToast]);

  /* ——— Belge Aktar: fieldList + import handler ——— */
  const fieldList = useMemo(() => {
    const list = [];
    const addFields = (fields) => {
      for (const f of fields) {
        list.push({ field_id: f.id, label: f.label });
      }
    };
    addFields(PERSONAL_FIELDS);
    addFields(ADDRESS_FIELDS);
    addFields(STAY_FIELDS);
    addFields(SIGNATURE_FIELDS);
    return list;
  }, []);

  const handleDocImport = useCallback((importedData, missing) => {
    console.log("[FormApp] handleDocImport called, keys:", Object.keys(importedData).length, "missing:", missing?.length);
    const newData = {};
    const newFamily = Array.from({ length: 6 }, () => ({}));
    // Mevcut veriyi koru, üzerine yaz
    Object.entries({ ...data, ...importedData }).forEach(([k, v]) => {
      const familyMatch = k.match(/^family_(\d+)_(.+)$/);
      if (familyMatch) {
        const idx = parseInt(familyMatch[1]) - 1;
        if (idx >= 0 && idx < 6) newFamily[idx][familyMatch[2]] = v;
      } else {
        newData[k] = v;
      }
    });
    // Mevcut family veriyi koru
    familyData.forEach((row, i) => {
      Object.entries(row).forEach(([col, val]) => {
        if (val && !newFamily[i][col]) newFamily[i][col] = val;
      });
    });
    setData(newData);
    setFamilyData(newFamily);
    setMissingFields(missing || []);
    // Import sonrası kişisel bilgiler sekmesine geç
    setTab("personal");
  }, [data, familyData]);

  /* ——— Eksik alan navigasyonu ——— */
  const handleNavigateToField = useCallback((fieldId) => {
    if (!fieldId) return;
    if (fieldId.startsWith("addr_") || fieldId.startsWith("purpose_") ||
        fieldId.startsWith("p3a_") || fieldId.startsWith("p5b_") ||
        fieldId.startsWith("p4_")) {
      setTab("address");
    } else if (fieldId.startsWith("family_")) {
      setTab("family");
    } else if (fieldId.startsWith("p5_") || fieldId.startsWith("p6_") ||
               fieldId.startsWith("signature_") || fieldId.startsWith("p8_")) {
      setTab("legal");
    } else {
      setTab("personal");
    }
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) el.focus();
    }, 100);
  }, []);

  /* ——— Eksik alanlar — doldurulanları filtrele ——— */
  const activeMissing = missingFields.filter(mf => !data[mf.field_id]);

  /* ——— İstatistikler ——— */
  const filledCount = Object.values(data).filter((v) => v && v !== false && v !== "").length
    + familyData.reduce((acc, row) => acc + Object.values(row).filter((v) => v).length, 0);

  const totalFields = 113;
  const progressPct = Math.round((filledCount / totalFields) * 100);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950">

      {/* Header — 40px */}
      <header className="flex-shrink-0 h-12 glass border-b border-white/[0.06] flex items-center px-4 gap-3 z-30">
        <span className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center
                         text-white text-xs font-bold leading-none flex-shrink-0">P</span>
        <span className="text-sm font-semibold text-zinc-50">Polonya Oturum İzni</span>
        <span className="text-xs text-zinc-500">— Wniosek o pobyt czasowy</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-20 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                 style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-mono text-zinc-500 tabular-nums w-14 text-right">
            {filledCount} / {totalFields}
          </span>
        </div>
      </header>

      {/* Tab nav — 36px, underline stili */}
      <nav className="flex-shrink-0 h-10 glass border-b border-white/[0.06] flex items-center px-4 gap-1 z-20">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap
                        transition-colors duration-150
                        ${tab === t.id
                          ? "text-emerald-300 bg-emerald-500/15"
                          : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.04]"}`}>
            {t.label}
            {t.pages && (
              <span className={`ml-1 text-[10px] font-mono
                                ${tab === t.id ? "text-emerald-500/60" : "text-zinc-600"}`}>
                {t.pages}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Main — gerçek 50/50 split */}
      <main className="flex flex-1 min-h-0">

        {/* Sol — form */}
        <div className="w-1/2 flex flex-col min-h-0 bg-transparent border-r border-white/[0.06]">
          <div className="flex-1 overflow-y-auto form-scroll">
            <div className="px-5 py-3">

              {/* ───── EKSİK ALANLAR PANELİ ───── */}
              {activeMissing.length > 0 && tab !== "docimport" && (
                <div className="border border-amber-500/30 rounded-xl overflow-hidden bg-amber-500/5 mb-3">
                  <button
                    onClick={() => setMissingPanelOpen(!missingPanelOpen)}
                    className="w-full px-4 py-2.5 flex items-center justify-between
                               hover:bg-amber-500/10 transition-colors text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      Eksik Alanlar ({activeMissing.length})
                    </span>
                    <span className="text-xs text-amber-600">{missingPanelOpen ? "Daralt" : "Genişlet"}</span>
                  </button>
                  {missingPanelOpen && (
                    <ul className="px-4 pb-3 space-y-1">
                      {activeMissing.map((mf, i) => (
                        <li
                          key={i}
                          onClick={() => handleNavigateToField(mf.field_id)}
                          className="text-xs text-amber-300/80 flex gap-2 rounded px-2 py-1
                                     cursor-pointer hover:bg-amber-900/30 transition-colors"
                        >
                          <span className="text-amber-500 font-medium shrink-0">{mf.label || mf.field_id}:</span>
                          <span className="text-zinc-400">{mf.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ───── KİŞİSEL BİLGİLER ───── */}
              {tab === "personal" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Başvuru Tarihi" subtitle="Sayfa 1 — Üst kısım" />
                  <div className="grid grid-cols-3 gap-4 pb-1">
                    {PERSONAL_FIELDS.filter(f => f.group === "date").map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="I. Kimlik Bilgileri" subtitle="Sayfa 1-2 — Soru 1-20" />
                  <div className="space-y-0">
                    {PERSONAL_FIELDS.filter(f => !f.group && f.type !== "checkbox").map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/[0.06] space-y-0">
                    {PERSONAL_FIELDS.filter(f => f.type === "checkbox").map(f =>
                      <CheckboxInput key={f.id} {...f} checked={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
              </>)}

              {/* ───── ADRES & AMAÇ ───── */}
              {tab === "address" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Polonya'daki Adres" subtitle="Sayfa 3 — Bölüm B" />
                  <div className="space-y-0">
                    {ADDRESS_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Kalış Amacı (Cel pobytu)" subtitle="Sayfa 3 — Uygun olanları işaretleyin" />
                  <div className="space-y-0">
                    {PURPOSE_OPTIONS.map(opt =>
                      <CheckboxInput key={opt.id} {...opt} checked={data[opt.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Polonya'da Bulunma Durumu" subtitle="Sayfa 4 — Bölüm III" />
                  <div className="space-y-1">
                    <div className="flex gap-4">
                      {STAY_FIELDS.filter(f => f.type === "checkbox").map(f =>
                        <CheckboxInput key={f.id} {...f} checked={data[f.id]} onChange={handleChange} />
                      )}
                    </div>
                    {STAY_FIELDS.filter(f => !f.type).map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="III.a Polonya'daki Önceki Kalışlar" subtitle="Sayfa 4" />
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr>
                        <th className="px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Dönem (YYYY/MM-YYYY/MM)</th>
                        <th className="px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Hukuki Dayanak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: PREV_STAY_PL_ROWS }, (_, i) => (
                        <tr key={i} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                          <td className="px-0 py-0">
                            <input type="text" placeholder="2024/01-2024/06"
                              value={data[`p3a_r${i+1}_period`] || ""}
                              onChange={e => handleChange(`p3a_r${i+1}_period`, e.target.value.toUpperCase())}
                              onBlur={e => handleChange(`p3a_r${i+1}_period`, translateToPolish(e.target.value.toUpperCase()))}
                              className="w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent
                                         outline-none focus:bg-white/[0.06] rounded transition-colors
                                         placeholder:text-zinc-700 text-zinc-50 text-sm py-1" />
                          </td>
                          <td className="px-0 py-0">
                            <input type="text" placeholder="WIZA / ZEZWOLENIE"
                              value={data[`p3a_r${i+1}_basis`] || ""}
                              onChange={e => handleChange(`p3a_r${i+1}_basis`, e.target.value.toUpperCase())}
                              onBlur={e => handleChange(`p3a_r${i+1}_basis`, translateToPolish(e.target.value.toUpperCase()))}
                              className="w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent
                                         outline-none focus:bg-white/[0.06] rounded transition-colors
                                         placeholder:text-zinc-700 text-zinc-50 text-sm py-1" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Polonya Dışı Kalışlar (Son 12 Ay)" subtitle="Sayfa 5" />
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr>
                        <th className="px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Dönem (YYYY/MM-YYYY/MM)</th>
                        <th className="px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Ülke / Dayanak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: PREV_STAY_OUT_ROWS }, (_, i) => (
                        <tr key={i} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                          <td className="px-0 py-0">
                            <input type="text" placeholder="PAŹDZIERNIK 2024 – LUTY 2025"
                              value={data[`p5b_r${i+1}_period`] || ""}
                              onChange={e => handleChange(`p5b_r${i+1}_period`, e.target.value.toUpperCase())}
                              onBlur={e => handleChange(`p5b_r${i+1}_period`, translateToPolish(e.target.value.toUpperCase()))}
                              className="w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent
                                         outline-none focus:bg-white/[0.06] rounded transition-colors
                                         placeholder:text-zinc-700 text-zinc-50 text-sm py-1" />
                          </td>
                          <td className="px-0 py-0">
                            <input type="text" placeholder="TURCJA / NIEMCY"
                              value={data[`p5b_r${i+1}_basis`] || ""}
                              onChange={e => handleChange(`p5b_r${i+1}_basis`, e.target.value.toUpperCase())}
                              onBlur={e => handleChange(`p5b_r${i+1}_basis`, translateToPolish(e.target.value.toUpperCase()))}
                              className="w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent
                                         outline-none focus:bg-white/[0.06] rounded transition-colors
                                         placeholder:text-zinc-700 text-zinc-50 text-sm py-1" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>)}

              {/* ───── AİLE ÜYELERİ ───── */}
              {tab === "family" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="II. Aile Üyeleri" subtitle="Sayfa 4 — 6 satıra kadar" />
                  <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-[11px] border-collapse min-w-[700px]">
                      <thead>
                        <tr>
                          <th className="px-1.5 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500 w-6">#</th>
                          {FAMILY_HEADERS.map((h, i) => (
                            <th key={i} className="px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {familyData.map((row, ri) => (
                          <tr key={ri} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                            <td className="px-1.5 py-1 text-zinc-600 font-mono text-center text-sm">{ri + 1}</td>
                            {FAMILY_COLS.map((col, ci) => (
                              <td key={col} className="px-0 py-0">
                                <input
                                  type="text"
                                  value={row[col] || ""}
                                  placeholder={FAMILY_PLACEHOLDERS[ci]}
                                  onChange={(e) => handleFamilyChange(ri, col, e.target.value.toUpperCase())}
                                  className="w-full px-1.5 py-0.5 text-[11px] font-mono bg-transparent
                                             outline-none focus:bg-emerald-500/10 rounded transition-colors
                                             placeholder:text-zinc-600"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Tüm alanları BÜYÜK HARF ile doldurun. Tarih formatı: YYYY/AA/GG
                  </p>
                </div>
              </>)}

              {/* ───── HUKUKİ DURUM ───── */}
              {tab === "legal" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="V. Yasal Dayanak (Podstawa pobytu)" subtitle="Sayfa 5" />
                  <div className="space-y-0">
                    {LEGAL_SECTION_1.map(opt =>
                      <CheckboxInput key={opt.id} {...opt} checked={data[opt.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="V. Mali Kaynaklar (Środki finansowe)" subtitle="Sayfa 5 — Geçim masraflarını karşılama bilgisi" />
                  <div className="space-y-1">
                    {Array.from({ length: FINANCE_ROWS }, (_, i) => (
                      <input key={i} type="text"
                        id={`p5_finance_r${i+1}`}
                        placeholder={i === 0 ? "Ör: UMOWA O PRACĘ, WYNAGRODZENIE 5000 PLN MIESIĘCZNIE" : ""}
                        value={data[`p5_finance_r${i+1}`] || ""}
                        onChange={e => handleChange(`p5_finance_r${i+1}`, e.target.value.toUpperCase())}
                        onBlur={e => handleChange(`p5_finance_r${i+1}`, translateToPolish(e.target.value.toUpperCase()))}
                        className="w-full px-2 py-1 text-xs font-mono bg-transparent
                                   outline-none focus:bg-white/[0.06] rounded transition-colors
                                   border border-white/[0.06] focus:border-white/15
                                   placeholder:text-zinc-700 text-zinc-50" />
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="VI. Sağlık Sigortası (Ubezpieczenie zdrowotne)" subtitle="Sayfa 5 — Sağlık sigortası bilgisi" />
                  <div className="space-y-1">
                    {Array.from({ length: INSURANCE_ROWS }, (_, i) => (
                      <input key={i} type="text"
                        id={`p5_insurance_r${i+1}`}
                        placeholder={i === 0 ? "Ör: ZUS / NFZ, NR POLISY: 123456789" : ""}
                        value={data[`p5_insurance_r${i+1}`] || ""}
                        onChange={e => handleChange(`p5_insurance_r${i+1}`, e.target.value.toUpperCase())}
                        onBlur={e => handleChange(`p5_insurance_r${i+1}`, translateToPolish(e.target.value.toUpperCase()))}
                        className="w-full px-2 py-1 text-xs font-mono bg-transparent
                                   outline-none focus:bg-white/[0.06] rounded transition-colors
                                   border border-white/[0.06] focus:border-white/15
                                   placeholder:text-zinc-700 text-zinc-50" />
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="VIII-X. Beyanlar (Oświadczenia)" subtitle="Sayfa 5-6" />
                  <div className="space-y-0">
                    {LEGAL_SECTION_2.map(opt =>
                      <CheckboxInput key={opt.id} {...opt} checked={data[opt.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="D. İmza ve Tarih" subtitle="Sayfa 6-8 — Başvuranın imzası" />
                  <div className="space-y-0">
                    {SIGNATURE_FIELDS.map(f =>
                      <TextInput key={f.id} {...f} value={data[f.id]} onChange={handleChange} />
                    )}
                  </div>
                </div>
              </>)}

              {/* ───── BELGE AKTAR ───── */}
              {tab === "docimport" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Belge Aktar" subtitle="PDF, DOCX veya tarama dosyasından otomatik doldurma" />
                  <DocImport
                    fieldList={fieldList}
                    onImport={handleDocImport}
                    showToast={showToast}
                    onNavigateToField={handleNavigateToField}
                  />
                </div>
              </>)}

              {/* ───── DIŞA AKTAR ───── */}
              {tab === "export" && (<>
                <div className="glass rounded-xl p-4 mb-3">
                  <SectionHeading title="Dışa Aktar & İçe Aktar" subtitle="JSON formatında veri yönetimi" />
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleExportJSON}
                        className="bg-emerald-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-600 transition-colors">
                        JSON İndir
                      </button>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="glass text-zinc-300 px-4 py-2 rounded text-sm font-medium hover:bg-white/[0.06] transition-colors">
                        JSON Yükle
                      </button>
                      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                      <button
                        onClick={handleGeneratePDF}
                        disabled={pdfLoading}
                        className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
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
                      <pre className="bg-zinc-950 rounded p-3 text-xs font-mono text-emerald-400
                                      max-h-64 overflow-y-auto whitespace-pre leading-relaxed">
                        {JSON.stringify(buildExport(), null, 2)}
                      </pre>
                    </div>

                    <div className="glass rounded p-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">Kullanım</p>
                      <div className="text-sm text-zinc-400 space-y-1 leading-relaxed">
                        <p>1. Formu doldurun veya <strong className="text-zinc-200">JSON Yükle</strong> ile önceki veriyi import edin.</p>
                        <p>2. <strong className="text-zinc-200">PDF Oluştur</strong> butonuna tıklayın.</p>
                        <p>3. PDF otomatik indirilir.</p>
                        <p className="text-[10px] text-zinc-600 mt-1">
                          İpucu: <strong>JSON İndir</strong> ile verilerinizi kaydedebilirsiniz.
                        </p>
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
          <PdfPreview data={data} familyData={familyData} />
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
