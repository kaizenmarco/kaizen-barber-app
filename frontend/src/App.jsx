import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import ClientePublico from './pages/ClientePublico';
import AdminLogin from './pages/AdminLogin';

// Site público e Admin dividem o mesmo domínio/index.html, então por padrão
// teriam o mesmo "ícone instalável" — quem adicionasse o Admin à tela de
// início acabaria abrindo o site do cliente. Este componente troca o
// manifest.json e o ícone/título do iPhone conforme a rota, pra cada um
// virar um ícone independente que abre direto no lugar certo.
function AtualizarManifestPWA() {
  const location = useLocation();

  useEffect(() => {
    const ehAdmin = location.pathname.startsWith('/admin');

    const linkManifest = document.querySelector('link[rel="manifest"]');
    if (linkManifest) {
      linkManifest.setAttribute('href', ehAdmin ? '/admin-manifest.json' : '/manifest.json');
    }

    const linkAppleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (linkAppleIcon) {
      linkAppleIcon.setAttribute('href', ehAdmin ? '/admin-apple-touch-icon.png' : '/apple-touch-icon.png');
    }

    const metaTitulo = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (metaTitulo) {
      metaTitulo.setAttribute('content', ehAdmin ? 'Kaizen Admin' : 'Kaizen');
    }
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <AtualizarManifestPWA />
      <Routes>
        <Route path="/" element={<ClientePublico />} />
        <Route path="/admin" element={<AdminLogin />} />
      </Routes>
    </Router>
  );
}

export default App;