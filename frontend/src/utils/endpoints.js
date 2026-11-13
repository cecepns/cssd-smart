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
    VERIFY_REPORT: '/auth/verify-report-access',
  },

  DASHBOARD: '/dashboard',
  TRACEABILITY: '/traceability',
  PUBLIC_UNIT_STATUS: (id) => `/public/unit-status/${id}`,
  REPORTS_MONTHLY: '/reports/monthly-summary',
  MONITORING_PROCESS_TIMINGS: '/monitoring/process-timings',

  // Notifikasi Aktivitas Admin CSSD
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: (id) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
  },

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
  PACKAGING_MATERIALS: crud('/packaging-materials'),
  ITEM_UNITS: crud('/item-units'),

  // Lookup operasional read-only (dipakai form transaksi tanpa akses Master Data)
  LOOKUPS: {
    UNITS: '/lookups/units',
    ITEMS: '/lookups/items',
    OFFICERS: '/lookups/officers',
    MACHINES: '/lookups/machines',
    PACKAGING_MATERIALS: '/lookups/packaging-materials',
  },

  // DTT (Reuse) - Penggunaan Ulang Alat Medis
  DTT_RECEIPTS: {
    ...crud('/dtt-receipts'),
    READY: '/dtt-receipts/ready',
  },
  DTT_DISTRIBUTIONS: crud('/dtt-distributions'),

  // Set Instrumen & Monitoring
  INSTRUMENT_SETS: {
    ...crud('/instrument-sets'),
    COMPLETENESS: (id) => `/instrument-sets/${id}/completeness`,
    MOVEMENTS: '/instrument-sets/movements',
    DISCREPANCIES: '/instrument-sets/discrepancies',
    DISCREPANCY_DETAIL: (id) => `/instrument-sets/discrepancies/${id}`,
    DISCREPANCY_RESOLVE: (id) => `/instrument-sets/discrepancies/${id}/resolve`,
  },

  // Proses CSSD
  RECEIPTS: crud('/dirty-receipts'),
  WASHINGS: crud('/washings'),
  DRYINGS: crud('/dryings'),
  PACKAGINGS: crud('/packagings'),
  STERILIZATIONS: crud('/sterilizations'),
  VERIFICATIONS: crud('/verifications'),
  STERILE_STOCK: {
    ...crud('/sterile-stock'),
    LOOKUP: '/sterile-stock/lookup',
    READY: '/sterile-stock/ready',
  },
  QUARANTINES: crud('/quarantines'),
  DISTRIBUTIONS: crud('/distributions'),

  // BMHP
  BMHP_ITEMS: {
    ...crud('/bmhp-items'),
    SUMMARY: '/bmhp-summary',
  },
  BMHP_TRANSACTIONS: crud('/bmhp-transactions'),

  // Log Penggunaan Mesin Washer & Steam
  MACHINE_LOGS: crud('/machine-logs'),

  // Kebutuhan Alat/Set Unit & Pengajuan Alat Baru
  UNIT_REQUISITIONS: {
    ...crud('/unit-requisitions'),
    UPDATE_STATUS: (id) => `/unit-requisitions/${id}/status`,
  },
  ITEM_PROPOSALS: {
    ...crud('/item-proposals'),
    APPROVE: (id) => `/item-proposals/${id}/approve`,
    REJECT: (id) => `/item-proposals/${id}/reject`,
  },
};
