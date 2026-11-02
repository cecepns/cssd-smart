import { API_ENDPOINTS } from '@/utils/endpoints';

/**
 * Field remote-select untuk memilih Petugas CSSD dari master data petugas.
 *
 * @param {Object} options
 * @param {string} [options.name='officer'] - Nama key field pada data form
 * @param {string} [options.label='Petugas CSSD'] - Label UI
 * @param {boolean} [options.required=true] - Wajib diisi atau opsional
 * @param {string} [options.placeholder='Pilih petugas...']
 * @param {number} [options.span] - Lebar kolom modal (1 atau 2)
 * @param {string} [options.onSignatureField] - Nama field tanda tangan yang akan otomatis terisi saat petugas dipilih
 * @param {Function} [options.onChange] - Callback custom saat pilihan berubah
 * @param {any} [options.default] - Nilai awal
 * @param {string} [options.help] - Bantuan teks
 */
export const officerSelectField = ({
  name = 'officer',
  label = 'Petugas CSSD',
  required = true,
  placeholder = 'Pilih petugas...',
  span,
  onSignatureField,
  onChange,
  default: defaultValue,
  help,
} = {}) => ({
  type: 'remote-select',
  name,
  label,
  required,
  span,
  help,
  default: defaultValue,
  placeholder,
  optionsEndpoint: API_ENDPOINTS.OFFICERS.LIST,
  optionsParams: { is_active: 1, sort_by: 'name', order: 'asc' },
  optionValue: (r) => r.name,
  optionLabel: (r) => `${r.name}${r.role ? ` — ${r.role}` : ''}${r.nip ? ` (${r.nip})` : ''}`,
  autoFillOnMatch: true,
  onChange: (val, ctx) => {
    if (onSignatureField) {
      ctx.setValues({ [onSignatureField]: ctx.option?.signature || '' });
    }
    onChange?.(val, ctx);
  },
});

