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
import AgendamentoPublico from './pages/public/AgendamentoPublico';

// O subdomínio admin.kaizenbarbershop.com é dedicado só ao painel — nele,
// a própria raiz "/" já deve abrir o Admin (não o site do cliente).
// Isso existe porque instalar dois "ícones de app" a partir do MESMO
// domínio (app.kaizenbarbershop.com e app.kaizenbarbershop.com/admin)
// confundia o iPhone, que às vezes reaproveitava o ícone/sessão errada.
// Com domínios diferentes, cada um vira um site totalmente separado pro
// celular, sem essa ambiguidade.
function ehSubdominioAdmin() {
  // Domínio completo, não só o prefixo — "admin." só conta se for
  // exatamente admin.kaizenbarbershop.com, nunca um subdomínio parecido
  // criado por engano em outro domínio (ex: kaizenflowaplicativo.com).
  return window.location.hostname === 'admin.kaizenbarbershop.com';
}

// kaizenflowaplicativo.com é o domínio da página de vendas (Lovable). Os
// subdomínios cadastro. e painel. apontam pra este mesmo app e abrem direto
// a tela certa na raiz "/", sem precisar digitar o caminho completo.
//
// Checagem por domínio COMPLETO (não só prefixo) — evita que um subdomínio
// "cadastro."/"painel." criado por engano em kaizenbarbershop.com (ou um
// "admin." criado em kaizenflowaplicativo.com) acabe abrindo a tela errada
// na raiz. As rotas explícitas /admin, /cadastro e /painel continuam
// funcionando em qualquer domínio, sem essa restrição — isso aqui só afeta
// o atalho da raiz "/".
function ehSubdominioCadastro() {
  return window.location.hostname === 'cadastro.kaizenflowaplicativo.com';
}

function ehSubdominioPainel() {
  return window.location.hostname === 'painel.kaizenflowaplicativo.com';
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
  const raiz = ehSubdominioAdmin()
    ? <AdminLogin />
    : ehSubdominioCadastro()
    ? <Cadastro />
    : ehSubdominioPainel()
    ? <PainelEmpresa />
    : <ClientePublico />;

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
        <Route path="/b/:slug" element={<AgendamentoPublico />} />
      </Routes>
    </Router>
  );
}

export default App;