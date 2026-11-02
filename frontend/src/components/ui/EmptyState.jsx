import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Belum ada data', hint = 'Data akan tampil di sini setelah ditambahkan.', icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={26} />
      </span>
      <p className="mt-4 text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
