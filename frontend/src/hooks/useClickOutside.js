import { useEffect } from 'react';

/** Memanggil handler saat klik / sentuh terjadi di luar elemen ref (mis. menutup dropdown). */
export default function useClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handler(event);
    };
    const onKey = (event) => event.key === 'Escape' && handler(event);
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, handler, enabled]);
}
