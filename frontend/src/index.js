import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker só serve pra Web Push do App Admin (ver public/service-worker.js
// — não faz cache de nada). Registrado sempre, mas só é efetivamente usado
// quando alguém ativa notificações em Mais > Notificações no celular.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Sem service worker, só não dá pra ativar push — resto do app segue normal.
    });
  });
}