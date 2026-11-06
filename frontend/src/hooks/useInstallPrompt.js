import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

/** Mengelola prompt "Install Aplikasi" (PWA 1-Click Native Install). */
export default function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(() => (typeof window !== 'undefined' ? window.__pwaPromptEvent : null));
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true
    )
  );

  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      window.__pwaPromptEvent = event;
      setPromptEvent(event);
    };
    const onReady = () => {
      if (window.__pwaPromptEvent) setPromptEvent(window.__pwaPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      window.__pwaPromptEvent = null;
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('pwa:ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('pwa:installed', onInstalled);

    if (window.__pwaPromptEvent && !promptEvent) {
      setPromptEvent(window.__pwaPromptEvent);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('pwa:ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('pwa:installed', onInstalled);
    };
  }, [promptEvent]);

  const install = useCallback(async () => {
    if (installed) {
      toast.success('Aplikasi CSSD SMART sudah terpasang di perangkat ini');
      return true;
    }

    const event = promptEvent || window.__pwaPromptEvent;
    if (event) {
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted') {
          toast.success('Pemasangan aplikasi CSSD SMART berhasil disetujui');
          setPromptEvent(null);
          window.__pwaPromptEvent = null;
          return true;
        }
        return false;
      } catch (err) {
        console.error('Install prompt error:', err);
      }
    }

    if (isIOS) {
      toast(
        'Untuk memasang di iPhone/iPad: Ketuk tombol Bagikan (Share ⎋) di Safari lalu pilih "Tambah ke Layar Utama" (Add to Home Screen).',
        { icon: '📱', duration: 6000 }
      );
      return false;
    }

    toast('Klik ikon install pada address bar browser Anda (Chrome/Edge) untuk memasang aplikasi.', {
      icon: '💡',
      duration: 5000,
    });
    return false;
  }, [promptEvent, installed, isIOS]);

  return { canInstall: Boolean(promptEvent || window.__pwaPromptEvent), installed, isIOS, install };
}
