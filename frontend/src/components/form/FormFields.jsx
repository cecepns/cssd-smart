import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import useFetch from '@/hooks/useFetch';
import BarcodeInput from '@/components/form/BarcodeInput';
import SignaturePad from '@/components/form/SignaturePad';
import ImageInput from '@/components/form/ImageInput';

const defaultLabel = (row) => row.name;
const defaultValue = (row) => row.id;

/** Select dengan opsi dari API (maks 100 data terbaru). */
function RemoteSelect({ field, value, onChange, disabled, hasError }) {
  const { data, loading, error } = useFetch(field.optionsEndpoint, { limit: 100, sort_by: 'id', order: 'desc', ...(field.optionsParams || {}) });
  const rows = data || [];
  const getLabel = field.optionLabel || defaultLabel;
  const getValue = field.optionValue || defaultValue;
  const autoFilledRef = useRef(false);

  useEffect(() => {
    if (field.autoFillOnMatch && !autoFilledRef.current && value && rows.length) {
      const match = rows.find((r) => String(getValue(r)) === String(value));
      if (match) {
        autoFilledRef.current = true;
        onChange(value, match);
      }
    }
  }, [field.autoFillOnMatch, getValue, onChange, rows, value]);

  return (
    <select
      value={value ?? ''}
      disabled={disabled || loading}
      onChange={(e) => onChange(e.target.value, rows.find((r) => String(getValue(r)) === e.target.value))}
      className={`input-base ${hasError ? 'input-error' : ''}`}
    >
      <option value="">{loading ? 'Memuat...' : error ? 'Gagal memuat opsi' : field.placeholder || 'Pilih...'}</option>
      {rows.map((row) => (
        <option key={getValue(row)} value={getValue(row)}>
          {getLabel(row)}
        </option>
      ))}
    </select>
  );
}

/** Daftar checkbox dengan opsi dari API (mis. pilih paket yang akan disterilkan). */
function RemoteMultiCheck({ field, value = [], onChange, disabled }) {
  const { data, loading, error } = useFetch(field.optionsEndpoint, { limit: 100, sort_by: 'id', order: 'asc', ...(field.optionsParams || {}) });
  const rows = data || [];
  const getLabel = field.optionLabel || defaultLabel;
  const getValue = field.optionValue || defaultValue;

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!rows.length) return <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">{field.emptyText || 'Tidak ada data yang tersedia'}</p>;

  return (
    <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 scrollbar-thin">
      {rows.map((row) => {
        const id = getValue(row);
        return (
          <label key={id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.includes(id)}
              onChange={() => toggle(id)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-300"
            />
            <span className="text-slate-700">{getLabel(row)}</span>
          </label>
        );
      })}
    </div>
  );
}

function FieldInput({ field, value, error, values, setValue, setValues, disabled }) {
  const [hint, setHint] = useState('');
  const hasError = Boolean(error);
  const common = { disabled, className: `input-base ${hasError ? 'input-error' : ''}` };
  const handleChange = (next, extra) => {
    setValue(field.name, next);
    field.onChange?.(next, { setValue, setValues, values, option: extra });
  };

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          {...common}
          rows={3}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => handleChange(e.target.value)}
          className={`input-base h-auto py-2 ${hasError ? 'input-error' : ''}`}
        />
      );
    case 'select':
      return (
        <select {...common} value={value ?? ''} onChange={(e) => handleChange(e.target.value)}>
          {!field.required && <option value="">{field.placeholder || 'Pilih...'}</option>}
          {field.options.map((opt) => {
            const item = typeof opt === 'string' ? { value: opt, label: opt } : opt;
            return (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            );
          })}
        </select>
      );
    case 'remote-select':
      return <RemoteSelect field={field} value={value} disabled={disabled} hasError={hasError} onChange={handleChange} />;
    case 'multicheck':
      return <RemoteMultiCheck field={field} value={value} disabled={disabled} onChange={handleChange} />;
    case 'checkbox':
      return (
        <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            disabled={disabled}
            checked={Boolean(value)}
            onChange={(e) => handleChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-300"
          />
          {field.checkboxLabel || field.label}
        </label>
      );
    case 'barcode':
      return (
        <>
          <BarcodeInput
            value={value ?? ''}
            disabled={disabled}
            hasError={hasError}
            placeholder={field.placeholder}
            onChange={(next) => setValue(field.name, next)}
            onCommit={async (code) => {
              if (!field.onScan || !code) return;
              const result = await field.onScan(code, { setValue, setValues, values });
              setHint(result?.hint || '');
              if (result?.error) toast.error(result.error);
            }}
          />
          {hint && <p className="mt-1 text-xs font-medium text-brand-700">{hint}</p>}
        </>
      );
    case 'signature':
      return <SignaturePad value={value} disabled={disabled} onChange={(next) => setValue(field.name, next)} />;
    case 'image':
      return <ImageInput value={value} disabled={disabled} onChange={(next) => setValue(field.name, next)} onError={(msg) => toast.error(msg)} />;
    case 'custom':
      return field.render ? field.render({ value, error, values, setValue, setValues, disabled, hasError }) : null;
    default:
      return (
        <input
          {...common}
          type={field.type || 'text'}
          value={value ?? ''}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
          onChange={(e) => handleChange(e.target.value)}
        />
      );
  }
}

export function FormField({ field, ...props }) {
  if (field.type === 'hidden') return null;
  const fullWidth = field.span === 2 || ['textarea', 'signature', 'multicheck', 'image', 'custom'].includes(field.type);

  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      {field.label && field.type !== 'checkbox' && (
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
          {field.label}
          {field.required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      <FieldInput field={field} {...props} />
      {field.help && !props.error && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
      {props.error && <p className="mt-1 text-xs font-medium text-rose-600">{props.error}</p>}
    </div>
  );
}
