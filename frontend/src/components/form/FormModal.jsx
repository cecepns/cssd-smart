import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { FormField } from '@/components/form/FormFields';
import { useAuth } from '@/context/AuthContext';
import { wibDateTimeNow } from '@/utils/format';
import { buildInitialValues, fieldsForMode, preparePayload, validateValues } from '@/utils/form';
import { getErrorMessage, getFieldErrors } from '@/utils/request';

const PREVIEW_STYLES = {
  ok: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
  fail: { box: 'border-rose-200 bg-rose-50 text-rose-800', icon: AlertTriangle },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-800', icon: Info },
};

const FORM_ID = 'resource-form';

/**
 * Modal form generik untuk Create / Edit.
 * - fields: konfigurasi field (lihat FormFields)
 * - onSubmit(payload): wajib mengembalikan Promise
 * - preview(values): { tone, text } hasil otomatis yang tampil sebelum disimpan
 */
export default function FormModal({ open, mode = 'create', title, subtitle, fields, row, size = 'md', preview, onClose, onSubmit }) {
  const { user } = useAuth();
  const visibleFields = useMemo(() => fieldsForMode(fields, mode), [fields, mode]);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [startedLabel, setStartedLabel] = useState('');
  const openedAtRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setValues(buildInitialValues(visibleFields, { row, user }));
    setErrors({});
    if (mode === 'create') {
      openedAtRef.current = new Date().toISOString();
      setStartedLabel(wibDateTimeNow().slice(11, 19));
    } else {
      openedAtRef.current = null;
      setStartedLabel('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row, mode]);

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }, []);

  const mergeValues = useCallback((partial) => setValues((prev) => ({ ...prev, ...partial })), []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const found = validateValues(visibleFields, values, mode);
    if (Object.keys(found).length) {
      setErrors(found);
      toast.error('Periksa kembali isian yang belum sesuai');
      return;
    }

    setSubmitting(true);
    try {
      const payload = await preparePayload(visibleFields, values, { mode });
      if (mode === 'create' && openedAtRef.current) {
        payload.started_at = openedAtRef.current;
      }
      await onSubmit(payload);
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const previewResult = open && preview ? preview(values) : null;
  const PreviewIcon = previewResult ? PREVIEW_STYLES[previewResult.tone || 'info'].icon : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      size={size}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form={FORM_ID} loading={submitting}>
            {mode === 'edit' ? 'Simpan Perubahan' : 'Simpan'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'create' && startedLabel && (
          <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs font-semibold text-sky-900 sm:col-span-2">
            <Clock size={14} className="shrink-0 text-sky-600" />
            <span>
              Jam mulai proses tercatat otomatis: <strong className="font-mono">{startedLabel} WIB</strong> (jam selesai tercatat saat klik Simpan).
            </span>
          </div>
        )}
        {visibleFields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name]}
            error={errors[field.name]}
            values={values}
            setValue={setValue}
            setValues={mergeValues}
            disabled={submitting || (field.disabledOnEdit && mode === 'edit')}
          />
        ))}

        {previewResult && (
          <div
            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-semibold sm:col-span-2 ${PREVIEW_STYLES[previewResult.tone || 'info'].box}`}
            role="status"
          >
            <PreviewIcon size={18} className="mt-0.5 shrink-0" />
            <span>{previewResult.text}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
