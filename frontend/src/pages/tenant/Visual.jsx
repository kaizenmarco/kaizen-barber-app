import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { enviarImagemTenant } from '../../config/uploadImagemTenant';

// Personalização visual da empresa: logo, fotos do salão e dados de
// contato (endereço/WhatsApp/Instagram/TikTok). Antes era pensado como
// exclusivo do plano Completo (ver migration
// 009_personalizacao_visual_plano_completo), mas foi liberado pra todos os
// planos. Os arquivos vão pro bucket compartilhado "empresas-imagens",
// sempre dentro da pasta da própria empresa; e como empresas.status/plano
// não podem ser alterados pelo tenant (só o Super Admin/Stripe), salvar
// logo_url/imagens_local/endereco/contatos passa pela function
// public.atualizar_visual_empresa em vez de um update direto na tabela.

function Visual({ empresaId }) {
  const [logoUrl, setLogoUrl] = useState('');
  const [fotos, setFotos] = useState([]);
  const [endereco, setEndereco] = useState('');
  const [whatsappNumero, setWhatsappNumero] = useState('');
  const [instagramUsuario, setInstagramUsuario] = useState('');
  const [tiktokUsuario, setTiktokUsuario] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
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
        .select('logo_url, imagens_local, endereco, whatsapp_numero, instagram_usuario, tiktok_usuario')
        .eq('id', empresaId)
        .maybeSingle();
      if (error) throw error;
      setLogoUrl(data?.logo_url || '');
      setFotos(data?.imagens_local || []);
      setEndereco(data?.endereco || '');
      setWhatsappNumero(data?.whatsapp_numero || '');
      setInstagramUsuario(data?.instagram_usuario || '');
      setTiktokUsuario(data?.tiktok_usuario || '');
    } catch (e) {
      setErro(`Não consegui carregar a personalização visual: ${e.message}`);
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
    });
    if (error) throw error;
  };

  const handleTrocarLogo = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoLogo(true);
    setErro('');
    try {
      const url = await enviarImagemTenant(empresaId, arquivo, 'logo');
      await salvar({ logoUrl: url, fotos, endereco, whatsappNumero, instagramUsuario, tiktokUsuario });
      setLogoUrl(url);
    } catch (e2) {
      setErro(`Não consegui enviar o logo: ${e2.message}`);
    } finally {
      setEnviandoLogo(false);
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
      await salvar({ logoUrl, fotos: novasFotos, endereco, whatsappNumero, instagramUsuario, tiktokUsuario });
      setFotos(novasFotos);
    } catch (e2) {
      setErro(`Não consegui enviar a foto: ${e2.message}`);
    } finally {
      setEnviandoFoto(false);
      e.target.value = '';
    }
  };

  const handleRemoverFoto = async (url) => {
    if (!window.confirm('Remover esta foto?')) return;
    const novasFotos = fotos.filter((f) => f !== url);
    try {
      await salvar({ logoUrl, fotos: novasFotos, endereco, whatsappNumero, instagramUsuario, tiktokUsuario });
      setFotos(novasFotos);
    } catch (e) {
      setErro(`Não consegui remover: ${e.message}`);
    }
  };

  const handleSalvarContato = async (e) => {
    e.preventDefault();
    setSalvandoContato(true);
    setErroContato('');
    setSucessoContato(false);
    try {
      await salvar({ logoUrl, fotos, endereco, whatsappNumero, instagramUsuario, tiktokUsuario });
      setSucessoContato(true);
      setTimeout(() => setSucessoContato(false), 3000);
    } catch (e2) {
      setErroContato(`Não consegui salvar: ${e2.message}`);
    } finally {
      setSalvandoContato(false);
    }
  };

  if (carregando) {
    return (
      <div className="page-container">
        <p style={{ textAlign: 'center', color: '#d4af37' }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2>Identidade visual</h2>

      <section className="form-section">
        <h3>Logo da barbearia</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          Aparece no seu painel e no site público de agendamento.
        </p>
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo atual"
            style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #333', marginBottom: '12px', display: 'block' }}
          />
        )}
        <input type="file" accept="image/*" onChange={handleTrocarLogo} disabled={enviandoLogo} />
        {enviandoLogo && <p style={{ color: '#d4af37', fontSize: '13px', marginTop: '8px' }}>Enviando...</p>}
      </section>

      <section className="list-section">
        <h3>Fotos do salão</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          Fotos do ambiente, usadas no site público de agendamento (aba Endereço/Sobre).
        </p>
        <input type="file" accept="image/*" onChange={handleAdicionarFoto} disabled={enviandoFoto} />
        {enviandoFoto && <p style={{ color: '#d4af37', fontSize: '13px', marginTop: '8px' }}>Enviando...</p>}

        {fotos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', marginTop: '14px' }}>Nenhuma foto adicionada ainda.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginTop: '14px' }}>
            {fotos.map((url) => (
              <div key={url} style={{ position: 'relative' }}>
                <img
                  src={url}
                  alt="Foto do salão"
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
        <h3>Endereço e contato</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          Aparecem na aba "Endereço/Sobre" do site público de agendamento.
        </p>
        <form onSubmit={handleSalvarContato}>
          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            Endereço
          </label>
          <textarea
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro, cidade..."
            rows={2}
            style={{ width: '100%', resize: 'vertical', marginBottom: '10px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            WhatsApp (só números, com código do país. Ex: 5511999999999)
          </label>
          <input
            type="text"
            value={whatsappNumero}
            onChange={(e) => setWhatsappNumero(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="5511999999999"
            style={{ marginBottom: '10px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            Instagram (usuário, sem @)
          </label>
          <input
            type="text"
            value={instagramUsuario}
            onChange={(e) => setInstagramUsuario(e.target.value.replace(/^@/, ''))}
            placeholder="minhabarbearia"
            style={{ marginBottom: '10px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            TikTok (usuário, sem @)
          </label>
          <input
            type="text"
            value={tiktokUsuario}
            onChange={(e) => setTiktokUsuario(e.target.value.replace(/^@/, ''))}
            placeholder="minhabarbearia"
            style={{ marginBottom: '14px' }}
          />

          <button type="submit" className="btn-primary" disabled={salvandoContato}>
            {salvandoContato ? 'Salvando...' : 'Salvar'}
          </button>
          {sucessoContato && <p style={{ color: '#4ade80', fontSize: '13px', marginTop: '8px' }}>Salvo!</p>}
          {erroContato && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '8px' }}>{erroContato}</p>}
        </form>
      </section>
    </div>
  );
}

export default Visual;
