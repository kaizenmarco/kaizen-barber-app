import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import ClientePublico from './pages/ClientePublico';
import AdminLogin from './pages/AdminLogin';
import SuperAdmin from './pages/SuperAdmin';
import Cadastro from './pages/Cadastro';
import CadastroSucesso from './pages/CadastroSucesso';
import CadastroCancelado from './pages/CadastroCancelado';
import PainelEmpresa from './pages/PainelEmpresa';

// O subdomínio admin.kaizenbarbershop.com é dedicado só ao painel — nele,
// a própria raiz "/" já deve abrir o Admin (não o site do cliente).
// Isso existe porque instalar dois "ícones de app" a partir do MESMO
// domínio (app.kaizenbarbershop.com e app.kaizenbarbershop.com/admin)
// confundia o iPhone, que às vezes reaproveitava o ícone/sessão errada.
// Com domínios diferentes, cada um vira um site totalmente separado pro
// celular, sem essa ambiguidade.
function ehSubdominioAdmin() {
  return window.location.hostname.startsWith('admin.');
}

// Site público e Admin dividem o mesmo index.html, então por padrão
// teriam o mesmo "ícone instalável". Este componente troca o
// manifest.json e o ícone/título do iPhone conforme a rota/domínio, pra
// cada um virar um ícone independente que abre direto no lugar certo.
function AtualizarManifestPWA() {
  const location = useLocation();

  useEffect(() => {
    const ehAdmin = ehSubdominioAdmin() || location.pathname.startsWith('/admin');

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
  const raiz = ehSubdominioAdmin() ? <AdminLogin /> : <ClientePublico />;

  return (
    <Router>
      <AtualizarManifestPWA />
      <Routes>
        <Route path="/" element={raiz} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/cadastro/sucesso" element={<CadastroSucesso />} />
        <Route path="/cadastro/cancelado" element={<CadastroCancelado />} />
        <Route path="/painel" element={<PainelEmpresa />} />
      </Routes>
    </Router>
  );
}

export default App;