const TIME_ZONE = 'Asia/Jakarta';

export const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE }).format(new Date());

export const wibDateTimeNow = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  const hh = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day} ${hh}:${map.minute}:${map.second}`;
};

/** 2026-10-30 08:15:30 -> 08:15:30 */
export const formatTime = (value, fallback = '-') => {
  if (!value) return fallback;
  const s = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s;
  const match = /[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(s);
  return match ? match[1] : fallback;
};

export const formatDuration = (sec) => {
  if (sec === null || sec === undefined || Number.isNaN(Number(sec))) return '-';
  const total = Math.max(0, Math.round(Number(sec)));
  if (total < 60) return `${total} dtk`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s > 0 ? `${m} mnt ${s} dtk` : `${m} mnt`;
  }
  if (total < 86400) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return m > 0 ? `${h} jam ${m} mnt` : `${h} jam`;
  }
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  return h > 0 ? `${d} hr ${h} jam` : `${d} hr`;
};

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
