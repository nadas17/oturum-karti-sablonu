// frontend/src/api.js
/**
 * Flask API client.
 * generatePdf(data) → void (tarayıcı otomatik indirir)
 * getFields()       → Promise<{ fields, total }>
 */

const API_BASE = "/api";

/**
 * Form verisini Flask'a gönderir, PDF olarak indirir.
 * @param {Object} data  - { field_id: value, ... }
 * @throws {Error}       - Hata durumunda mesaj içerir
 */
export async function generatePdf(data) {
  const response = await fetch(`${API_BASE}/generate-pdf`, {
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
  const surname = data.field_01_surname;
  const name = data.field_04_name_r1;
  a.download = surname && name
    ? `${surname}_${name}_${today}.pdf`
    : `form_${today}.pdf`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Belgeyi (PDF, DOCX, JPG vb.) sunucuya gönderir, parse edip alan eşleştirmesini döndürür.
 * @param {File} file - Yüklenecek dosya
 * @returns {Promise<{ raw_text, extracted_pairs, mappings, filename }>}
 */
export async function parseDocument(file) {
  const formData = new FormData();
  formData.append("document", file);
  const response = await fetch(`${API_BASE}/parse-document`, {
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
 * @returns {Promise<{ fields: Array, total: number }>}
 */
export async function getFields() {
  const response = await fetch(`${API_BASE}/fields`);
  if (!response.ok) throw new Error("Alan listesi alinamadi");
  return response.json();
}

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
