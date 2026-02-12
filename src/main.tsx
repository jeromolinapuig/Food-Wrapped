import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './lib/i18n';

import App from './App.tsx';
import { Analytics } from '@vercel/analytics/react';
import { PreferencesProvider } from './context/PreferencesContext';

const heartAvatarEnabled = String(import.meta.env.VITE_HEART_AVATAR ?? '').toLowerCase() === 'true';
if (heartAvatarEnabled) {
  document.documentElement.dataset.avatarShape = 'heart';
} else {
  delete document.documentElement.dataset.avatarShape;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PreferencesProvider>
        <App />
        <Analytics />
      </PreferencesProvider>
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
