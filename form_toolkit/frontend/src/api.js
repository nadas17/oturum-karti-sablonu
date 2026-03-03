// frontend/src/api.js
/**
 * Flask API client — unified for both Oturum and PESEL forms.
 * All functions accept a `formType` parameter ("oturum" | "pesel")
 * which determines the API base path.
 */

function getApiBase(formType) {
  return formType === "pesel" ? "/api/pesel" : "/api/oturum";
}

/**
 * Form verisini Flask'a gönderir, PDF olarak indirir.
 * @param {Object} data      - { field_id: value, ... }
 * @param {string} formType  - "oturum" | "pesel"
 * @throws {Error}
 */
export async function generatePdf(data, formType) {
  const response = await fetch(`${getApiBase(formType)}/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Sunucu hatası: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const today = new Date().toISOString().slice(0, 10);
  if (formType === "pesel") {
    const surname = data.s2_surname;
    const name = data.s2_first_name;
    a.download = surname && name
      ? `PESEL_${surname}_${name}_${today}.pdf`
      : `PESEL_${today}.pdf`;
  } else {
    const surname = data.field_01_surname;
    const name = data.field_04_name_r1;
    a.download = surname && name
      ? `${surname}_${name}_${today}.pdf`
      : `form_${today}.pdf`;
  }

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Belgeyi sunucuya gönderir, parse edip alan eşleştirmesini döndürür.
 * @param {File}   file     - Yüklenecek dosya
 * @param {string} formType - "oturum" | "pesel"
 */
export async function parseDocument(file, formType) {
  const formData = new FormData();
  formData.append("document", file);
  const response = await fetch(`${getApiBase(formType)}/parse-document`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Sunucu hatası: ${response.status}`);
  }
  return response.json();
}

/**
 * Mevcut form alanlarını döndürür.
 * @param {string} formType - "oturum" | "pesel"
 */
export async function getFields(formType) {
  const response = await fetch(`${getApiBase(formType)}/fields`);
  if (!response.ok) throw new Error("Alan listesi alinamadi");
  return response.json();
}

/**
 * Boş form PDF şablonunu ArrayBuffer olarak getirir.
 * @param {string} formType - "oturum" | "pesel"
 */
export async function getTemplatePdf(formType) {
  const res = await fetch(`${getApiBase(formType)}/template-pdf`);
  if (!res.ok) throw new Error("PDF şablonu yüklenemedi");
  return res.arrayBuffer();
}

/**
 * Tüm field_map'i getirir (bounding box'lar dahil).
 * @param {string} formType - "oturum" | "pesel"
 */
export async function getFieldMap(formType) {
  const res = await fetch(`${getApiBase(formType)}/field-map`);
  if (!res.ok) throw new Error("Alan haritası yüklenemedi");
  return res.json();
}
