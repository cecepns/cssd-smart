import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';

const ALIGN = { right: 'text-right', center: 'text-center', left: 'text-left' };

function SortIcon({ active, order }) {
  if (!active) return <ChevronsUpDown size={13} className="text-slate-300" />;
  return order === 'asc' ? <ArrowUp size={13} className="text-brand-700" /> : <ArrowDown size={13} className="text-brand-700" />;
}

const renderCell = (col, row, index) => {
  if (col.render) return col.render(row, index);
  const value = row[col.key];
  return value === null || value === undefined || value === '' ? <span className="text-slate-300">-</span> : value;
};

/**
 * Tabel responsif: tabel pada layar >= md, daftar kartu pada layar mobile.
 * columns: [{ key, label, sortable, sortKey, render(row), align, className }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  sort,
  onSort,
  actions,
  offset = 0,
  empty = {},
}) {
  if (error && rows.length === 0) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && rows.length === 0) return <TableSkeleton columns={Math.min(columns.length, 6)} rows={6} />;
  if (rows.length === 0) return <EmptyState {...empty} />;

  const [primary, ...others] = columns;
  const busy = loading ? 'opacity-60' : '';

  return (
    <>
      {/* Desktop / tablet */}
      <div className={`hidden overflow-x-auto scrollbar-thin md:block ${busy}`}>
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3">No</th>
              {columns.map((col) => {
                const sortKey = col.sortKey || col.key;
                const active = sort?.by === sortKey;
                return (
                  <th key={col.key} className={`px-4 py-3 ${ALIGN[col.align] || ''} ${col.className || ''}`}>
                    {col.sortable ? (
                      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 uppercase hover:text-slate-800">
                        {col.label}
                        <SortIcon active={active} order={sort?.order} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
              {actions && <th className="px-4 py-3 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.id} className="transition hover:bg-slate-50/70">
                <td className="px-4 py-3 text-slate-400">{offset + index + 1}</td>
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-slate-700 ${ALIGN[col.align] || ''} ${col.className || ''}`}>
                    {renderCell(col, row, index)}
                  </td>
                ))}
                {actions && <td className="px-4 py-2 text-right"><div className="flex justify-end gap-0.5">{actions(row)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className={`divide-y divide-slate-100 md:hidden ${busy}`}>
        {rows.map((row, index) => (
          <li key={row.id} className="space-y-2.5 px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 break-words text-sm font-bold text-slate-900">{renderCell(primary, row, index)}</div>
              {actions && <div className="flex shrink-0 gap-0.5">{actions(row)}</div>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {others.map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="text-slate-400">{col.label}</dt>
                  <dd className="break-words font-medium text-slate-700">{renderCell(col, row, index)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
