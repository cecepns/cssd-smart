const TIME_ZONE = 'Asia/Jakarta';

export const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE }).format(new Date());

/** 2026-10-30 -> 30/10/2026 */
export const formatDate = (value) => {
  if (!value) return '-';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(value);
};

/** 2026-10-30 09:47:00 -> 30/10/2026 09:47 */
export const formatDateTime = (value) => {
  if (!value) return '-';
  const [date, time = ''] = String(value).split(/[ T]/);
  return `${formatDate(date)} ${time.slice(0, 5)}`.trim();
};

export const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

/** Kamis, 30 Oktober 2026 09.47 WIB */
export const formatClock = (date = new Date()) => {
  const text = new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(' pukul', '')
    .replace(/(\d{2}):(\d{2})$/, '$1.$2');
  return `${text} WIB`;
};

export const fileUrl = (path) => (path ? `${import.meta.env.VITE_FILE_URL || 'https://api.kingcreativestudio.my.id/cssd-smart/uploads-cssd-smart'}/${path}` : '');
