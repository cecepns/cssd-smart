/**
 * Daftar endpoint API terpusat.
 * Semua pemanggilan API wajib memakai konstanta di file ini (tanpa hardcode di komponen).
 */
const crud = (base) => ({
  LIST: base,
  DETAIL: (id) => `${base}/${id}`,
  EXPORT: `${base}/export`,
});

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PROFILE: '/auth/profile',
    PASSWORD: '/auth/password',
  },

  DASHBOARD: '/dashboard',
  TRACEABILITY: '/traceability',

  UPLOADS: {
    IMAGE: '/uploads/image',
    SIGNATURE: '/uploads/signature',
  },

  // Master data
  USERS: crud('/users'),
  UNITS: crud('/units'),
  ITEMS: crud('/items'),
  MACHINES: crud('/machines'),
  OFFICERS: crud('/officers'),

  // Set Instrumen
  INSTRUMENT_SETS: {
    ...crud('/instrument-sets'),
    COMPLETENESS: (id) => `/instrument-sets/${id}/completeness`,
  },

  // Proses CSSD
  RECEIPTS: crud('/dirty-receipts'),
  WASHINGS: crud('/washings'),
  DRYINGS: crud('/dryings'),
  PACKAGINGS: crud('/packagings'),
  STERILIZATIONS: crud('/sterilizations'),
  VERIFICATIONS: crud('/verifications'),
  STERILE_STOCK: crud('/sterile-stock'),
  QUARANTINES: crud('/quarantines'),
  DISTRIBUTIONS: crud('/distributions'),

  // BMHP
  BMHP_ITEMS: crud('/bmhp-items'),
  BMHP_TRANSACTIONS: crud('/bmhp-transactions'),
};
