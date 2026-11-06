import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from '@/App';
import { AuthProvider } from '@/context/AuthContext';
import '@/index.css';

// Tangkap event PWA sebelum render agar prompt instalasi langsung siap
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__pwaPromptEvent = e;
    window.dispatchEvent(new Event('pwa:ready'));
  });
  window.addEventListener('appinstalled', () => {
    window.__pwaPromptEvent = null;
    window.dispatchEvent(new Event('pwa:installed'));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: { borderRadius: '12px', fontSize: '14px', fontWeight: 500 },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
