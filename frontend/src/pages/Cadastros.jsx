import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';
import { VENDAS_PACOTES_MOCK } from '../data/cadastrosMockData';

// ============================================================================
// Módulo de Cadastros — Menu principal (Serviços / Produtos / Pacotes) que
// navega pra telas de listagem (padrão CRUD: pesquisar, criar, editar,
// remover). Navegação em pilha simples via useState (mesmo padrão de
// subView já usado em Agendamentos.jsx), sem depender de rotas.
//
// Os dados vêm de data/cadastrosMockData.js — propositalmente mockados e
// separados da UI. Pra conectar no Supabase de verdade depois, troca só
// os useState(...MOCK) por um useEffect com supabase.from(...).select(...),
// sem precisar mexer no resto do componente.
// ============================================================================

// ---- Sub-componentes de apresentação (recebem tudo via props) ----

function ItemMenuCadastro({ icone, cor, titulo, subtitulo, onClick }) {
  return (
    <div className="cadastros-menu-item" onClick={onClick} role="button" tabIndex={0}>
      <div className="cadastros-menu-icone-circulo" style={{ background: cor }}>{icone}</div>
      <div className="cadastros-menu-corpo">
        <div className="cadastros-menu-titulo">{titulo}</div>
        <div className="cadastros-menu-subtitulo">{subtitulo}</div>
      </div>
      <div className="cadastros-menu-chevron">›</div>
    </div>
  );
}

function CabecalhoLista({ titulo, aoVoltar, aoAdicionar, labelAdicionar }) {
  return (
    <div className="cadastros-lista-header">
      <button type="button" className="cadastros-header-btn-voltar" onClick={aoVoltar} aria-label="Voltar">‹</button>
      <h2 className="cadastros-lista-header-titulo">{titulo}</h2>
      {aoAdicionar ? (
        <button type="button" className="cadastros-header-btn-add" onClick={aoAdicionar} aria-label={labelAdicionar} title={labelAdicionar}>+</button>
      ) : (
        <span className="cadastros-header-espaco" />
      )}
    </div>
  );
}

function BarraBusca({ valor, onChange, placeholder }) {
  return (
    <div className="campo-busca-wrapper cadastros-busca-sticky">
      <span className="campo-busca-icone">🔍</span>
      <input
        type="text"
        className="campo-busca-input"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ItemLista({ titulo, linha2, badge, preco, imagemUrl, onEditar, onDeletar, iconeAcao }) {
  return (
    <div className="cadastros-item-linha">
      {imagemUrl && <img src={imagemUrl} alt="" className="cadastros-item-thumb" />}
      <div className="cadastros-item-corpo" onClick={onEditar}>
        <div className="cadastros-item-titulo">{titulo}</div>
        {linha2 && <div className="cadastros-item-subtitulo">{linha2}</div>}
        {badge}
      </div>
      <div className="cadastros-item-acoes">
        {preco != null && <span className="cadastros-item-preco">¥{Number(preco).toLocaleString('ja-JP')}</span>}
        <button type="button" className="btn-delete" onClick={(e) => { e.stopPropagation(); onDeletar(); }}>{iconeAcao || '🗑️'}</button>
      </div>
    </div>
  );
}

function Cadastros({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  // 'menu' | 'servicos' | 'produtos' | 'pacotesMenu' | 'meusPacotes' | 'vendaPacotes'
  const [tela, setTela] = useState('menu');
  const [busca, setBusca] = useState('');

  // Serviços, Produtos e Meus Pacotes são ligados de verdade ao Supabase.
  // Serviços e Pacotes moram na mesma tabela "servicos" (coluna eh_pacote),
  // que a Agenda e o site público também leem — criar, editar, desativar ou
  // trocar a imagem aqui reflete automaticamente nos dois (ver
  // config/servicos.js > buscarServicosCompletos / buscarPacotesAtivos).
  // Produtos tem sua própria tabela. Venda de Pacotes continua mockada/local
  // por enquanto (histórico de vendas, não catálogo).
  const [servicos, setServicos] = useState([]);
  const [carregandoServicos, setCarregandoServicos] = useState(true);
  const [salvandoServico, setSalvandoServico] = useState(false);

  const [produtos, setProdutos] = useState([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [salvandoProduto, setSalvandoProduto] = useState(false);

  const [meusPacotes, setMeusPacotes] = useState([]);
  const [carregandoMeusPacotes, setCarregandoMeusPacotes] = useState(true);
  const [salvandoPacote, setSalvandoPacote] = useState(false);

  const [vendasPacotes, setVendasPacotes] = useState(VENDAS_PACOTES_MOCK);

  const [modalAberto, setModalAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState(null); // null = criando novo
  const [formModal, setFormModal] = useState({});

  const buscarServicosAdmin = async () => {
    setCarregandoServicos(true);
    try {
      const { data, error } = await supabase
        .from('servicos')
        .select('id, nome, descricao, preco, duracao_minutos, imagem_url, ativo')
        .eq('eh_pacote', false)
        .order('nome');
      if (error) throw error;
      setServicos((data || []).map(row => ({
        id: row.id,
        nome: row.nome,
        descricao: row.descricao || '',
        preco: row.preco != null ? Number(row.preco) : 0,
        duracaoMinutos: row.duracao_minutos || 0,
        imagemUrl: row.imagem_url || '',
        ativo: row.ativo !== false
      })));
    } catch (error) {
      alert(t('cadastros.erroCarregarServicos', { msg: error.message }));
    } finally {
      setCarregandoServicos(false);
    }
  };

  const buscarProdutosAdmin = async () => {
    setCarregandoProdutos(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, descricao, preco, estoque, imagem_url, ativo')
        .order('nome');
      if (error) throw error;
      setProdutos((data || []).map(row => ({
        id: row.id,
        nome: row.nome,
        descricao: row.descricao || '',
        preco: row.preco != null ? Number(row.preco) : 0,
        estoque: row.estoque || 0,
        imagemUrl: row.imagem_url || '',
        ativo: row.ativo !== false
      })));
    } catch (error) {
      alert(t('cadastros.erroCarregarProdutos', { msg: error.message }));
    } finally {
      setCarregandoProdutos(false);
    }
  };

  const buscarMeusPacotesAdmin = async () => {
    setCarregandoMeusPacotes(true);
    try {
      const { data, error } = await supabase
        .from('servicos')
        .select('id, nome, descricao, preco, quantidade_sessoes, validade_dias, imagem_url, ativo')
        .eq('eh_pacote', true)
        .order('nome');
      if (error) throw error;
      setMeusPacotes((data || []).map(row => ({
        id: row.id,
        nome: row.nome,
        descricao: row.descricao || '',
        preco: row.preco != null ? Number(row.preco) : 0,
        quantidadeSessoes: row.quantidade_sessoes,
        validadeDias: row.validade_dias || 0,
        imagemUrl: row.imagem_url || '',
        ativo: row.ativo !== false
      })));
    } catch (error) {
      alert(t('cadastros.erroCarregarPacotes', { msg: error.message }));
    } finally {
      setCarregandoMeusPacotes(false);
    }
  };

  useEffect(() => {
    buscarServicosAdmin();
    buscarProdutosAdmin();
    buscarMeusPacotesAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irPara = (novaTela) => {
    setTela(novaTela);
    setBusca('');
  };

  const fecharModal = () => {
    setModalAberto(false);
    setItemEditando(null);
    setFormModal({});
  };

  const TELAS_COM_IMAGEM = ['servicos', 'produtos', 'meusPacotes'];

  const abrirNovo = () => {
    setItemEditando(null);
    if (tela === 'servicos') {
      setFormModal({ nome: '', descricao: '', preco: '', duracaoMinutos: '', ativo: true, imagemUrl: '', imagemArquivo: null, imagemPreview: '' });
    } else if (tela === 'produtos') {
      setFormModal({ nome: '', descricao: '', preco: '', estoque: '', ativo: true, imagemUrl: '', imagemArquivo: null, imagemPreview: '' });
    } else if (tela === 'meusPacotes') {
      setFormModal({ nome: '', descricao: '', preco: '', quantidadeSessoes: '', validadeDias: '', ativo: true, imagemUrl: '', imagemArquivo: null, imagemPreview: '' });
    } else if (tela === 'vendaPacotes') {
      setFormModal({ cliente: '', pacote: meusPacotes[0]?.nome || '', dataVenda: new Date().toISOString().split('T')[0], sessoesRestantes: '' });
    }
    setModalAberto(true);
  };

  const abrirEditar = (item) => {
    setItemEditando(item);
    if (TELAS_COM_IMAGEM.includes(tela)) {
      setFormModal({
        nome: item.nome,
        descricao: item.descricao || '',
        preco: item.preco != null ? String(item.preco) : '',
        duracaoMinutos: item.duracaoMinutos != null ? String(item.duracaoMinutos) : '',
        estoque: item.estoque != null ? String(item.estoque) : '',
        quantidadeSessoes: item.quantidadeSessoes == null ? '' : String(item.quantidadeSessoes),
        validadeDias: item.validadeDias != null ? String(item.validadeDias) : '',
        ativo: item.ativo !== false,
        imagemUrl: item.imagemUrl || '',
        imagemArquivo: null,
        imagemPreview: ''
      });
    } else {
      setFormModal({
        ...item,
        sessoesRestantes: item.sessoesRestantes == null ? '' : String(item.sessoesRestantes)
      });
    }
    setModalAberto(true);
  };

  const handleSelecionarImagem = (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setFormModal(prev => ({ ...prev, imagemArquivo: arquivo, imagemPreview: URL.createObjectURL(arquivo) }));
  };

  // Faz upload da imagem (se uma nova foi escolhida) pro bucket indicado e
  // devolve a URL pública a usar no registro — ou a URL que já existia, se
  // nenhuma imagem nova foi selecionada.
  const enviarImagemSeHouver = async (bucket, prefixo) => {
    if (!formModal.imagemArquivo) return formModal.imagemUrl || null;
    const extensao = formModal.imagemArquivo.name.split('.').pop();
    const caminho = `${prefixo}-${itemEditando?.id || 'novo'}-${Date.now()}.${extensao}`;
    const { error: erroUpload } = await supabase.storage
      .from(bucket)
      .upload(caminho, formModal.imagemArquivo, { upsert: true });
    if (erroUpload) throw erroUpload;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(caminho);
    return urlData.publicUrl;
  };

  const salvarModalServico = async () => {
    if (!formModal.nome?.trim()) {
      alert(t('cadastros.nomeObrigatorio'));
      return;
    }
    setSalvandoServico(true);
    try {
      const imagemUrl = await enviarImagemSeHouver('servicos-imagens', 'servico');
      const payload = {
        nome: formModal.nome.trim(),
        descricao: formModal.descricao || null,
        preco: Number(formModal.preco) || 0,
        duracao_minutos: Number(formModal.duracaoMinutos) || null,
        imagem_url: imagemUrl,
        ativo: formModal.ativo !== false
      };

      if (itemEditando) {
        const { error } = await supabase.from('servicos').update(payload).eq('id', itemEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('servicos').insert([{ ...payload, eh_pacote: false, preco_minimo: payload.preco }]);
        if (error) throw error;
      }

      alert(t('cadastros.servicoSalvo'));
      fecharModal();
      buscarServicosAdmin();
    } catch (error) {
      alert(t('cadastros.erroSalvarServico', { msg: error.message }));
    } finally {
      setSalvandoServico(false);
    }
  };

  const salvarModalProduto = async () => {
    if (!formModal.nome?.trim()) {
      alert(t('cadastros.nomeObrigatorio'));
      return;
    }
    setSalvandoProduto(true);
    try {
      const imagemUrl = await enviarImagemSeHouver('produtos-imagens', 'produto');
      const payload = {
        nome: formModal.nome.trim(),
        descricao: formModal.descricao || null,
        preco: Number(formModal.preco) || 0,
        estoque: Number(formModal.estoque) || 0,
        imagem_url: imagemUrl,
        ativo: formModal.ativo !== false
      };

      if (itemEditando) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', itemEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('produtos').insert([payload]);
        if (error) throw error;
      }

      alert(t('cadastros.produtoSalvo'));
      fecharModal();
      buscarProdutosAdmin();
    } catch (error) {
      alert(t('cadastros.erroSalvarProduto', { msg: error.message }));
    } finally {
      setSalvandoProduto(false);
    }
  };

  const salvarModalPacote = async () => {
    if (!formModal.nome?.trim()) {
      alert(t('cadastros.nomeObrigatorio'));
      return;
    }
    setSalvandoPacote(true);
    try {
      const imagemUrl = await enviarImagemSeHouver('servicos-imagens', 'pacote');
      const payload = {
        nome: formModal.nome.trim(),
        descricao: formModal.descricao || null,
        preco: Number(formModal.preco) || 0,
        quantidade_sessoes: formModal.quantidadeSessoes === '' ? null : Number(formModal.quantidadeSessoes),
        validade_dias: Number(formModal.validadeDias) || 0,
        imagem_url: imagemUrl,
        ativo: formModal.ativo !== false
      };

      if (itemEditando) {
        const { error } = await supabase.from('servicos').update(payload).eq('id', itemEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('servicos').insert([{ ...payload, eh_pacote: true, preco_minimo: payload.preco }]);
        if (error) throw error;
      }

      alert(t('cadastros.pacoteSalvo'));
      fecharModal();
      buscarMeusPacotesAdmin();
    } catch (error) {
      alert(t('cadastros.erroSalvarPacote', { msg: error.message }));
    } finally {
      setSalvandoPacote(false);
    }
  };

  const toggleAtivoServico = async (servico) => {
    const novoValor = !servico.ativo;
    if (!window.confirm(novoValor ? t('cadastros.confirmarReativarServico') : t('cadastros.confirmarDesativarServico'))) return;
    try {
      const { error } = await supabase.from('servicos').update({ ativo: novoValor }).eq('id', servico.id);
      if (error) throw error;
      buscarServicosAdmin();
    } catch (error) {
      alert(t('cadastros.erroSalvarServico', { msg: error.message }));
    }
  };

  const toggleAtivoProduto = async (produto) => {
    const novoValor = !produto.ativo;
    if (!window.confirm(novoValor ? t('cadastros.confirmarReativarProduto') : t('cadastros.confirmarDesativarProduto'))) return;
    try {
      const { error } = await supabase.from('produtos').update({ ativo: novoValor }).eq('id', produto.id);
      if (error) throw error;
      buscarProdutosAdmin();
    } catch (error) {
      alert(t('cadastros.erroSalvarProduto', { msg: error.message }));
    }
  };

  const toggleAtivoPacote = async (pacote) => {
    const novoValor = !pacote.ativo;
    if (!window.confirm(novoValor ? t('cadastros.confirmarReativarPacote') : t('cadastros.confirmarDesativarPacote'))) return;
    try {
      const { error } = await supabase.from('servicos').update({ ativo: novoValor }).eq('id', pacote.id);
      if (error) throw error;
      buscarMeusPacotesAdmin();
    } catch (error) {
      alert(t('cadastros.erroSalvarPacote', { msg: error.message }));
    }
  };

  const salvarModal = () => {
    if (tela === 'servicos') { salvarModalServico(); return; }
    if (tela === 'produtos') { salvarModalProduto(); return; }
    if (tela === 'meusPacotes') { salvarModalPacote(); return; }

    if (tela === 'vendaPacotes') {
      if (!formModal.cliente?.trim() || !formModal.pacote) {
        alert(t('cadastros.nomeObrigatorio'));
        return;
      }
      const item = {
        id: itemEditando?.id || `v${Date.now()}`,
        cliente: formModal.cliente.trim(),
        pacote: formModal.pacote,
        dataVenda: formModal.dataVenda || new Date().toISOString().split('T')[0],
        sessoesRestantes: formModal.sessoesRestantes === '' ? null : Number(formModal.sessoesRestantes)
      };
      setVendasPacotes(prev => itemEditando ? prev.map(v => (v.id === item.id ? item : v)) : [item, ...prev]);
      fecharModal();
    }
  };

  // Serviços, Produtos e Meus Pacotes não são removidos de verdade daqui
  // (ver toggleAtivoServico/Produto/Pacote) — isso só se aplica a Venda de
  // Pacotes, que ainda é mockada/local.
  const deletarItem = (id) => {
    if (!window.confirm(t('cadastros.confirmarRemover'))) return;
    if (tela === 'vendaPacotes') setVendasPacotes(prev => prev.filter(v => v.id !== id));
  };

  const buscaLower = busca.trim().toLowerCase();
  const servicosFiltrados = servicos.filter(s => s.nome.toLowerCase().includes(buscaLower));
  const produtosFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(buscaLower));
  const meusPacotesFiltrados = meusPacotes.filter(p => p.nome.toLowerCase().includes(buscaLower));
  const vendasPacotesFiltradas = vendasPacotes.filter(v =>
    v.cliente.toLowerCase().includes(buscaLower) || v.pacote.toLowerCase().includes(buscaLower)
  );

  return (
    <div className="page-container">
      {tela === 'menu' && (
        <>
          <h2>{t('cadastros.titulo')}</h2>
          <div className="cadastros-menu-lista">
            <ItemMenuCadastro
              icone="✂️" cor="#3b82f6"
              titulo={t('cadastros.servicos.titulo')} subtitulo={t('cadastros.servicos.subtitulo')}
              onClick={() => irPara('servicos')}
            />
            <ItemMenuCadastro
              icone="🧴" cor="#22c55e"
              titulo={t('cadastros.produtos.titulo')} subtitulo={t('cadastros.produtos.subtitulo')}
              onClick={() => irPara('produtos')}
            />
            <ItemMenuCadastro
              icone="🎁" cor="#a855f7"
              titulo={t('cadastros.pacotes.titulo')} subtitulo={t('cadastros.pacotes.subtitulo')}
              onClick={() => irPara('pacotesMenu')}
            />
          </div>
        </>
      )}

      {tela === 'pacotesMenu' && (
        <>
          <CabecalhoLista titulo={t('cadastros.pacotes.titulo')} aoVoltar={() => irPara('menu')} />
          <div className="cadastros-menu-lista">
            <ItemMenuCadastro
              icone="📦" cor="#a855f7"
              titulo={t('cadastros.pacotes.meusPacotes')} subtitulo={t('cadastros.pacotes.meusPacotesSubtitulo')}
              onClick={() => irPara('meusPacotes')}
            />
            <ItemMenuCadastro
              icone="🧾" cor="#f97316"
              titulo={t('cadastros.pacotes.vendaPacotes')} subtitulo={t('cadastros.pacotes.vendaPacotesSubtitulo')}
              onClick={() => irPara('vendaPacotes')}
            />
          </div>
        </>
      )}

      {tela === 'servicos' && (
        <>
          <CabecalhoLista titulo={t('cadastros.servicos.titulo')} aoVoltar={() => irPara('menu')} aoAdicionar={abrirNovo} labelAdicionar={t('cadastros.novoServico')} />
          <BarraBusca valor={busca} onChange={setBusca} placeholder={t('cadastros.buscarPlaceholder')} />
          <div className="cadastros-lista-corpo">
            {carregandoServicos ? (
              <p className="cadastros-vazio">{t('comum.carregando')}</p>
            ) : servicosFiltrados.length === 0 ? (
              <p className="cadastros-vazio">{t('cadastros.nenhumEncontrado')}</p>
            ) : servicosFiltrados.map(s => (
              <ItemLista
                key={s.id}
                titulo={s.nome}
                linha2={`${s.descricao}${s.descricao ? ' · ' : ''}${s.duracaoMinutos} min${!s.ativo ? ` · ${t('cadastros.inativo')}` : ''}`}
                preco={s.preco}
                imagemUrl={s.imagemUrl}
                onEditar={() => abrirEditar(s)}
                onDeletar={() => toggleAtivoServico(s)}
                iconeAcao={s.ativo ? '🚫' : '♻️'}
              />
            ))}
          </div>
        </>
      )}

      {tela === 'produtos' && (
        <>
          <CabecalhoLista titulo={t('cadastros.produtos.titulo')} aoVoltar={() => irPara('menu')} aoAdicionar={abrirNovo} labelAdicionar={t('cadastros.novoProduto')} />
          <BarraBusca valor={busca} onChange={setBusca} placeholder={t('cadastros.buscarPlaceholder')} />
          <div className="cadastros-lista-corpo">
            {carregandoProdutos ? (
              <p className="cadastros-vazio">{t('comum.carregando')}</p>
            ) : produtosFiltrados.length === 0 ? (
              <p className="cadastros-vazio">{t('cadastros.nenhumEncontrado')}</p>
            ) : produtosFiltrados.map(p => (
              <ItemLista
                key={p.id}
                titulo={p.nome}
                linha2={`${p.descricao}${!p.ativo ? `${p.descricao ? ' · ' : ''}${t('cadastros.inativo')}` : ''}`}
                badge={
                  <span className={`cadastros-badge-estoque${p.estoque === 0 ? ' zero' : ''}`}>
                    {p.estoque === 0 ? t('cadastros.semEstoque') : t('cadastros.estoqueUnidades', { n: p.estoque })}
                  </span>
                }
                preco={p.preco}
                imagemUrl={p.imagemUrl}
                onEditar={() => abrirEditar(p)}
                onDeletar={() => toggleAtivoProduto(p)}
                iconeAcao={p.ativo ? '🚫' : '♻️'}
              />
            ))}
          </div>
        </>
      )}

      {tela === 'meusPacotes' && (
        <>
          <CabecalhoLista titulo={t('cadastros.pacotes.meusPacotes')} aoVoltar={() => irPara('pacotesMenu')} aoAdicionar={abrirNovo} labelAdicionar={t('cadastros.novoPacote')} />
          <BarraBusca valor={busca} onChange={setBusca} placeholder={t('cadastros.buscarPlaceholder')} />
          <div className="cadastros-lista-corpo">
            {carregandoMeusPacotes ? (
              <p className="cadastros-vazio">{t('comum.carregando')}</p>
            ) : meusPacotesFiltrados.length === 0 ? (
              <p className="cadastros-vazio">{t('cadastros.nenhumEncontrado')}</p>
            ) : meusPacotesFiltrados.map(p => (
              <ItemLista
                key={p.id}
                titulo={p.nome}
                linha2={`${p.descricao}${p.descricao ? ' · ' : ''}${p.quantidadeSessoes == null ? t('cadastros.sessoesIlimitadas') : t('cadastros.sessoesRestantesLabel', { n: p.quantidadeSessoes })} · ${t('cadastros.validadeDiasLabel', { n: p.validadeDias })}${!p.ativo ? ` · ${t('cadastros.inativo')}` : ''}`}
                preco={p.preco}
                imagemUrl={p.imagemUrl}
                onEditar={() => abrirEditar(p)}
                onDeletar={() => toggleAtivoPacote(p)}
                iconeAcao={p.ativo ? '🚫' : '♻️'}
              />
            ))}
          </div>
        </>
      )}

      {tela === 'vendaPacotes' && (
        <>
          <CabecalhoLista titulo={t('cadastros.pacotes.vendaPacotes')} aoVoltar={() => irPara('pacotesMenu')} aoAdicionar={abrirNovo} labelAdicionar={t('cadastros.registrarVenda')} />
          <BarraBusca valor={busca} onChange={setBusca} placeholder={t('cadastros.buscarPlaceholder')} />
          <div className="cadastros-lista-corpo">
            {vendasPacotesFiltradas.length === 0 ? (
              <p className="cadastros-vazio">{t('cadastros.nenhumEncontrado')}</p>
            ) : vendasPacotesFiltradas.map(v => (
              <ItemLista
                key={v.id}
                titulo={v.cliente}
                linha2={`${v.pacote} · ${new Date(`${v.dataVenda}T00:00:00`).toLocaleDateString('pt-BR')}`}
                badge={
                  <span className="cadastros-badge-estoque">
                    {v.sessoesRestantes == null ? t('cadastros.sessoesIlimitadas') : t('cadastros.sessoesRestantesLabel', { n: v.sessoesRestantes })}
                  </span>
                }
                onEditar={() => abrirEditar(v)}
                onDeletar={() => deletarItem(v.id)}
              />
            ))}
          </div>
        </>
      )}

      {modalAberto && (
        <div
          onClick={fecharModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1000, padding: '20px', paddingTop: 'calc(20px + env(safe-area-inset-top))', overflowY: 'auto'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '10px',
              padding: '24px', maxWidth: '460px', width: '100%', maxHeight: '88vh', overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ color: '#d4af37', margin: 0 }}>
                {itemEditando ? t('cadastros.editarItem') : t('cadastros.novoItem')}
              </h3>
              <button
                onClick={fecharModal}
                style={{ background: 'transparent', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ {t('comum.cancelar')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tela === 'vendaPacotes' ? (
                <>
                  <input
                    type="text" placeholder={t('cadastros.clienteCampo')}
                    value={formModal.cliente || ''} onChange={(e) => setFormModal(prev => ({ ...prev, cliente: e.target.value }))}
                    style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <select
                    value={formModal.pacote || ''} onChange={(e) => setFormModal(prev => ({ ...prev, pacote: e.target.value }))}
                    style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                  >
                    {meusPacotes.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                  <div className="campo-data-wrapper">
                    <input
                      type="date" value={formModal.dataVenda || ''} onChange={(e) => setFormModal(prev => ({ ...prev, dataVenda: e.target.value }))}
                      style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px', paddingRight: '34px' }}
                    />
                  </div>
                  <input
                    type="number" placeholder={t('cadastros.sessoesRestantesCampo')}
                    value={formModal.sessoesRestantes ?? ''} onChange={(e) => setFormModal(prev => ({ ...prev, sessoesRestantes: e.target.value }))}
                    style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                  />
                </>
              ) : (
                <>
                  <input
                    type="text" placeholder={t('cadastros.nomeCampo')}
                    value={formModal.nome || ''} onChange={(e) => setFormModal(prev => ({ ...prev, nome: e.target.value }))}
                    style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <textarea
                    placeholder={t('cadastros.descricaoCampo')}
                    value={formModal.descricao || ''} onChange={(e) => setFormModal(prev => ({ ...prev, descricao: e.target.value }))}
                    style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px', minHeight: '60px', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                  {TELAS_COM_IMAGEM.includes(tela) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '6px' }}>
                        {t('cadastros.imagemCampo')}
                      </label>
                      {(formModal.imagemPreview || formModal.imagemUrl) && (
                        <img
                          src={formModal.imagemPreview || formModal.imagemUrl}
                          alt=""
                          style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }}
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSelecionarImagem}
                        style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '13px' }}
                      />
                    </div>
                  )}
                  <input
                    type="number" placeholder={t('cadastros.precoCampo')}
                    value={formModal.preco ?? ''} onChange={(e) => setFormModal(prev => ({ ...prev, preco: e.target.value }))}
                    style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                  />
                  {tela === 'servicos' && (
                    <input
                      type="number" placeholder={t('cadastros.duracaoCampo')}
                      value={formModal.duracaoMinutos ?? ''} onChange={(e) => setFormModal(prev => ({ ...prev, duracaoMinutos: e.target.value }))}
                      style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                    />
                  )}
                  {tela === 'produtos' && (
                    <input
                      type="number" placeholder={t('cadastros.estoqueCampo')}
                      value={formModal.estoque ?? ''} onChange={(e) => setFormModal(prev => ({ ...prev, estoque: e.target.value }))}
                      style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                    />
                  )}
                  {tela === 'meusPacotes' && (
                    <>
                      <input
                        type="number" placeholder={t('cadastros.sessoesCampo')}
                        value={formModal.quantidadeSessoes ?? ''} onChange={(e) => setFormModal(prev => ({ ...prev, quantidadeSessoes: e.target.value }))}
                        style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                      />
                      <input
                        type="number" placeholder={t('cadastros.validadeCampo')}
                        value={formModal.validadeDias ?? ''} onChange={(e) => setFormModal(prev => ({ ...prev, validadeDias: e.target.value }))}
                        style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                      />
                    </>
                  )}
                  {TELAS_COM_IMAGEM.includes(tela) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#999', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formModal.ativo !== false}
                        onChange={(e) => setFormModal(prev => ({ ...prev, ativo: e.target.checked }))}
                      />
                      {t('cadastros.ativoCampo')}
                    </label>
                  )}
                </>
              )}

              <button
                type="button" className="btn-primary" onClick={salvarModal} style={{ marginTop: '4px' }}
                disabled={salvandoServico || salvandoProduto || salvandoPacote}
              >
                {(salvandoServico || salvandoProduto || salvandoPacote) ? t('comum.salvando') : t('comum.salvar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cadastros;
