import { uploadImage, uploadSignature } from '@/utils/request';

export const isEmptyValue = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

/** Field hanya tampil pada mode tertentu: `only: 'create' | 'edit'`. */
export const fieldsForMode = (fields, mode) => fields.filter((f) => !f.only || f.only === mode);

const defaultValueOf = (field, ctx) => {
  const raw = typeof field.default === 'function' ? field.default(ctx) : field.default;
  if (raw !== undefined) return raw;
  if (field.type === 'checkbox') return false;
  if (field.type === 'multicheck') return [];
  return '';
};

/** Nilai awal form: dari data (edit) atau default field (create). */
export function buildInitialValues(fields, { row, user } = {}) {
  const values = {};
  fields.forEach((field) => {
    const fromRow = row?.[field.name];
    if (row && fromRow !== undefined && fromRow !== null) {
      values[field.name] = field.type === 'checkbox' ? Boolean(fromRow) : fromRow;
    } else {
      values[field.name] = defaultValueOf(field, { user });
    }
  });
  return values;
}

/** Validasi sisi client. Mengembalikan object { namaField: pesanError }. */
export function validateValues(fields, values, mode) {
  const errors = {};

  fields.forEach((field) => {
    if (field.type === 'hidden') return;
    const value = values[field.name];
    const required = field.required || (field.requiredOnCreate && mode === 'create');

    if (required && field.type !== 'checkbox' && isEmptyValue(value)) {
      errors[field.name] = `${field.label} wajib diisi`;
      return;
    }
    if (isEmptyValue(value)) return;

    if (field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) errors[field.name] = `${field.label} harus berupa angka`;
      else if (field.min !== undefined && n < field.min) errors[field.name] = `${field.label} minimal ${field.min}`;
      else if (field.max !== undefined && n > field.max) errors[field.name] = `${field.label} maksimal ${field.max}`;
      return;
    }
    if (typeof value === 'string' && field.minLength && value.trim().length < field.minLength) {
      errors[field.name] = `${field.label} minimal ${field.minLength} karakter`;
      return;
    }
    const custom = field.validate?.(value, values, mode);
    if (custom) errors[field.name] = custom;
  });

  return errors;
}

/**
 * Menyiapkan payload ke API: upload tanda tangan / gambar lebih dulu,
 * lalu mengganti nilainya dengan path file hasil upload.
 */
export async function preparePayload(fields, values, { mode }) {
  const payload = {};

  for (const field of fields) {
    if (field.noSubmit || field.type === 'hidden') continue;
    let value = values[field.name];

    if (field.type === 'signature' && typeof value === 'string' && value.startsWith('data:')) {
      value = await uploadSignature(value);
    }
    if (field.type === 'image' && value instanceof File) {
      value = await uploadImage(value);
    }
    if (field.skipEmptyOnEdit && mode === 'edit' && isEmptyValue(value)) continue;
    if (field.type === 'multicheck') value = (value || []).map(Number);

    payload[field.name] = typeof value === 'string' ? value.trim() : value;
  }

  return payload;
}
