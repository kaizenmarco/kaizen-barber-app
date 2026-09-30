import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { enviarImagemTenant } from '../../config/uploadImagemTenant';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../../config/traducoesAdmin';

// Personalização visual da empresa: foto de capa (cabeçalho), logo pequena
// (canto da capa, estilo Facebook), fotos do ambiente/fachada, imagem de
// fundo da aba Agendar, e dados de contato (endereço/WhatsApp/Instagram/
// TikTok). Antes era pensado como exclusivo do plano Completo (ver
// migration 009_personalizacao_visual_plano_completo), mas foi liberado
// pra todos os planos. Os arquivos vão pro bucket compartilhado
// "empresas-imagens", sempre dentro da pasta da própria empresa; e como
// empresas.status/plano não podem ser alterados pelo tenant (só o Super
// Admin/Stripe), salvar essas colunas passa pela function
// public.atualizar_visual_empresa em vez de um update direto na tabela.

function Visual({ t: tProp, idioma: idiomaProp, empresaId }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  const [logoUrl, setLogoUrl] = useState('');
  const [logoPequenoUrl, setLogoPequenoUrl] = useState('');
  const [imagemAgendarUrl, setImagemAgendarUrl] = useState('');
  const [fotos, setFotos] = useState([]);
  const [endereco, setEndereco] = useState('');
  const [whatsappNumero, setWhatsappNumero] = useState('');
  const [instagramUsuario, setInstagramUsuario] = useState('');
  const [tiktokUsuario, setTiktokUsuario] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [enviandoLogoPequeno, setEnviandoLogoPequeno] = useState(false);
  const [enviandoImagemAgendar, setEnviandoImagemAgendar] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [erro, setErro] = useState('');
  const [erroContato, setErroContato] = useState('');
  const [sucessoContato, setSucessoContato] = useState(false);

  useEffect(() => {
    buscarVisual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarVisual = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('logo_url, logo_pequeno_url, imagem_agendar_url, imagens_local, endereco, whatsapp_numero, instagram_usuario, tiktok_usuario')
        .eq('id', empresaId)
        .maybeSingle();
      if (error) throw error;
      setLogoUrl(data?.logo_url || '');
      setLogoPequenoUrl(data?.logo_pequeno_url || '');
      setImagemAgendarUrl(data?.imagem_agendar_url || '');
      setFotos(data?.imagens_local || []);
      setEndereco(data?.endereco || '');
      setWhatsappNumero(data?.whatsapp_numero || '');
      setInstagramUsuario(data?.instagram_usuario || '');
      setTiktokUsuario(data?.tiktok_usuario || '');
    } catch (e) {
      setErro(`${t('visualEmpresa.erroCarregar')}${e.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Sempre manda todos os campos juntos — a function substitui a linha
  // inteira, então quem chama precisa passar o valor atual de tudo que não
  // está mudando agora (senão salvar uma foto nova apagaria o endereço, e
  // vice-versa).
  const salvar = async (dados) => {
    const { error } = await supabase.rpc('atualizar_visual_empresa', {
      p_logo_url: dados.logoUrl,
      p_imagens_local: dados.fotos,
      p_endereco: dados.endereco || null,
      p_whatsapp_numero: dados.whatsappNumero || null,
      p_instagram_usuario: dados.instagramUsuario || null,
      p_tiktok_usuario: dados.tiktokUsuario || null,
      p_logo_pequeno_url: dados.logoPequenoUrl || null,
      p_imagem_agendar_url: dados.imagemAgendarUrl || null,
    });
    if (error) throw error;
  };

  const dadosAtuais = (sobrescrever = {}) => ({
    logoUrl, logoPequenoUrl, imagemAgendarUrl, fotos, endereco, whatsappNumero, instagramUsuario, tiktokUsuario,
    ...sobrescrever,
  });

  const handleTrocarLogo = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoLogo(true);
    setErro('');
    try {
      const url = await enviarImagemTenant(empresaId, arquivo, 'capa');
      await salvar(dadosAtuais({ logoUrl: url }));
      setLogoUrl(url);
    } catch (e2) {
      setErro(`${t('visualEmpresa.erroCapa')}${e2.message}`);
    } finally {
      setEnviandoLogo(false);
    }
  };

  const handleTrocarLogoPequeno = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoLogoPequeno(true);
    setErro('');
    try {
      const url = await enviarImagemTenant(empresaId, arquivo, 'logo');
      await salvar(dadosAtuais({ logoPequenoUrl: url }));
      setLogoPequenoUrl(url);
    } catch (e2) {
      setErro(`${t('visualEmpresa.erroLogo')}${e2.message}`);
    } finally {
      setEnviandoLogoPequeno(false);
    }
  };

  const handleTrocarImagemAgendar = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoImagemAgendar(true);
    setErro('');
    try {
      const url = await enviarImagemTenant(empresaId, arquivo, 'agendar');
      await salvar(dadosAtuais({ imagemAgendarUrl: url }));
      setImagemAgendarUrl(url);
    } catch (e2) {
      setErro(`${t('visualEmpresa.erroImagemAgendar')}${e2.message}`);
    } finally {
      setEnviandoImagemAgendar(false);
    }
  };

  const handleAdicionarFoto = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoFoto(true);
    setErro('');
    try {
      const url = await enviarImagemTenant(empresaId, arquivo, 'salao');
      const novasFotos = [...fotos, url];
      await salvar(dadosAtuais({ fotos: novasFotos }));
      setFotos(novasFotos);
    } catch (e2) {
      setErro(`${t('visualEmpresa.erroFoto')}${e2.message}`);
    } finally {
      setEnviandoFoto(false);
      e.target.value = '';
    }
  };

  const handleRemoverFoto = async (url) => {
    if (!window.confirm(t('visualEmpresa.confirmarRemoverFoto'))) return;
    const novasFotos = fotos.filter((f) => f !== url);
    try {
      await salvar(dadosAtuais({ fotos: novasFotos }));
      setFotos(novasFotos);
    } catch (e) {
      setErro(`${t('visualEmpresa.erroRemoverFoto')}${e.message}`);
    }
  };

  const handleSalvarContato = async (e) => {
    e.preventDefault();
    setSalvandoContato(true);
    setErroContato('');
    setSucessoContato(false);
    try {
      await salvar(dadosAtuais());
      setSucessoContato(true);
      setTimeout(() => setSucessoContato(false), 3000);
    } catch (e2) {
      setErroContato(`${t('visualEmpresa.erroSalvarContato')}${e2.message}`);
    } finally {
      setSalvandoContato(false);
    }
  };

  if (carregando) {
    return (
      <div className="page-container">
        <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2>{t('visualEmpresa.titulo')}</h2>

      <section className="form-section">
        <h3>{t('visualEmpresa.capaTitulo')}</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          {t('visualEmpresa.capaDesc')}
        </p>
        {logoUrl && (
          <img
            src={logoUrl}
            alt={t('visualEmpresa.capaAlt')}
            style={{ width: '100%', maxWidth: '360px', aspectRatio: '16 / 7', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333', marginBottom: '12px', display: 'block' }}
          />
        )}
        <input type="file" accept="image/*" onChange={handleTrocarLogo} disabled={enviandoLogo} />
        {enviandoLogo && <p style={{ color: '#d4af37', fontSize: '13px', marginTop: '8px' }}>{t('comum.enviando')}</p>}
      </section>

      <section className="form-section">
        <h3>{t('visualEmpresa.logoTitulo')}</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          {t('visualEmpresa.logoDesc')}
        </p>
        {logoPequenoUrl && (
          <img
            src={logoPequenoUrl}
            alt={t('visualEmpresa.logoAlt')}
            style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #d4af37', marginBottom: '12px', display: 'block' }}
          />
        )}
        <input type="file" accept="image/*" onChange={handleTrocarLogoPequeno} disabled={enviandoLogoPequeno} />
        {enviandoLogoPequeno && <p style={{ color: '#d4af37', fontSize: '13px', marginTop: '8px' }}>{t('comum.enviando')}</p>}
      </section>

      <section className="list-section">
        <h3>{t('visualEmpresa.fotosTitulo')}</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          {t('visualEmpresa.fotosDesc')}
        </p>
        <input type="file" accept="image/*" onChange={handleAdicionarFoto} disabled={enviandoFoto} />
        {enviandoFoto && <p style={{ color: '#d4af37', fontSize: '13px', marginTop: '8px' }}>{t('comum.enviando')}</p>}

        {fotos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', marginTop: '14px' }}>{t('visualEmpresa.nenhumaFoto')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginTop: '14px' }}>
            {fotos.map((url) => (
              <div key={url} style={{ position: 'relative' }}>
                <img
                  src={url}
                  alt={t('visualEmpresa.fotoAmbienteAlt')}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333' }}
                />
                <button
                  onClick={() => handleRemoverFoto(url)}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: '#1a1a1a', border: '1px solid #f87171', color: '#f87171', borderRadius: '6px', fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        {erro && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '10px' }}>{erro}</p>}
      </section>

      <section className="form-section">
        <h3>{t('visualEmpresa.imagemAgendarTitulo')}</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          {t('visualEmpresa.imagemAgendarDesc')}
        </p>
        {imagemAgendarUrl && (
          <img
            src={imagemAgendarUrl}
            alt={t('visualEmpresa.imagemAgendarAlt')}
            style={{ width: '100%', maxWidth: '360px', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333', marginBottom: '12px', display: 'block' }}
          />
        )}
        <input type="file" accept="image/*" onChange={handleTrocarImagemAgendar} disabled={enviandoImagemAgendar} />
        {enviandoImagemAgendar && <p style={{ color: '#d4af37', fontSize: '13px', marginTop: '8px' }}>{t('comum.enviando')}</p>}
      </section>

      <section className="form-section">
        <h3>{t('visualEmpresa.enderecoContatoTitulo')}</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          {t('visualEmpresa.enderecoContatoDesc')}
        </p>
        <form onSubmit={handleSalvarContato}>
          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            {t('visualEmpresa.enderecoLabel')}
          </label>
          <textarea
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder={t('visualEmpresa.enderecoPlaceholder')}
            rows={2}
            style={{ width: '100%', resize: 'vertical', marginBottom: '10px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            {t('visualEmpresa.whatsappLabel')}
          </label>
          <input
            type="text"
            value={whatsappNumero}
            onChange={(e) => setWhatsappNumero(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="5511999999999"
            style={{ marginBottom: '10px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            {t('visualEmpresa.instagramLabel')}
          </label>
          <input
            type="text"
            value={instagramUsuario}
            onChange={(e) => setInstagramUsuario(e.target.value.replace(/^@/, ''))}
            placeholder="minhabarbearia"
            style={{ marginBottom: '10px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            {t('visualEmpresa.tiktokLabel')}
          </label>
          <input
            type="text"
            value={tiktokUsuario}
            onChange={(e) => setTiktokUsuario(e.target.value.replace(/^@/, ''))}
            placeholder="minhabarbearia"
            style={{ marginBottom: '14px' }}
          />

          <button type="submit" className="btn-primary" disabled={salvandoContato}>
            {salvandoContato ? t('comum.salvando') : t('comum.salvar')}
          </button>
          {sucessoContato && <p style={{ color: '#4ade80', fontSize: '13px', marginTop: '8px' }}>{t('visualEmpresa.salvoMsg')}</p>}
          {erroContato && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '8px' }}>{erroContato}</p>}
        </form>
      </section>
    </div>
  );
}

export default Visual;
