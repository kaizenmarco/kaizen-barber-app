import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FaWhatsapp, FaInstagram, FaTiktok } from 'react-icons/fa';
import { supabase } from '../../config/supabaseClientTenant';
import {
  paraMinutos,
  paraHHMM,
  getDiaSemana,
  getSlotsLivresNoDia,
  HORARIO_ESTENDIDO_PADRAO,
} from '../../config/horariosTenant';
import { encontrarPromocaoAplicavel, calcularPrecoComPromocao } from '../../config/promocoesTenant';
import { IDIOMAS, IDIOMA_PADRAO, DIAS_ABREV_POR_IDIOMA, DIAS_NOMES_POR_IDIOMA, LOCALE_POR_IDIOMA, traduzir } from '../../config/traducoes';

// ============================================================================
// Página pública de agendamento, MULTI-TENANT — cada empresa acessa a sua
// pela URL /b/:slug (ver App.jsx). Porte do ClientePublico.jsx original
// (single-tenant), com as adaptações que o modelo multi-tenant exige:
//
// - Todo o catálogo (serviços, pacotes, profissionais, promoções, horários)
//   é buscado ao vivo por empresa_id — não existe mais nada hardcoded de
//   uma barbearia específica.
// - Horário de funcionamento: não há mais um único horário fixo da loja —
//   cada profissional tem o seu (mesmo motor de horariosTenant.js usado na
//   Agenda). O calendário só desabilita um dia se NENHUM profissional
//   atender nele.
// - Fuso horário: o original travava tudo em horário do Japão (JST), pois
//   só existia uma barbearia, em Aichi. Como agora há empresas em BRL
//   também, usamos o horário local do navegador do cliente.
// - Resgate de pontos de fidelidade: o original dava ¥500 fixo a cada 10
//   pontos — não faz sentido em BRL, então aqui vale um desconto percentual
//   (ver PERCENTUAL_DESCONTO_PONTOS).
// - Especialidade do profissional: 1 campo só (sem tradução por enquanto).
// - Avaliações: no original já eram só enfeite — não gravavam no banco e
//   sumiam ao recarregar a página. Mantemos esse comportamento, começando
//   vazio (sem inventar depoimentos falsos para outras empresas).
// - Fotos de ambiente (fachada/interior/etc.) e a imagem de fundo da aba
//   Agendar não têm um mecanismo de upload por empresa ainda — ficaram de
//   fora por enquanto (mesma lista de pendências combinada).
// ============================================================================

const botaoContatoStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: '#d4af37',
  border: '1px solid #d4af37',
  borderRadius: '4px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 'bold',
  textDecoration: 'none',
};

const DIAS_CARROSSEL = 90; // até quantos dias à frente o cliente pode agendar
const OPCOES_LEMBRETE = [15, 20, 30, 60];
const CHAVE_IDIOMA_STORAGE = 'kaizen_idioma';
const LIMITE_CANCELAMENTO_MINUTOS = 120; // cliente só cancela sozinho com 2h+ de antecedência
const PONTOS_PARA_RESGATE = 10;
const PERCENTUAL_DESCONTO_PONTOS = 10; // resgate de pontos = 10% de desconto (em vez de valor fixo)

const paraDataStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const somarMinutos = (horaStr, minutos) => {
  const total = paraMinutos(horaStr) + minutos;
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
};

const gerarConteudoICS = ({ nomeEstabelecimento, endereco, servico, profissional, dataStr, horaInicio, horaFim, lembreteMinutos }) => {
  const dtStart = `${dataStr.replace(/-/g, '')}T${horaInicio.replace(':', '')}00`;
  const dtEnd = `${dataStr.replace(/-/g, '')}T${horaFim.replace(':', '')}00`;
  const agora = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `${dataStr}-${horaInicio}-${Math.random().toString(36).slice(2)}@kaizenflow`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kaizen Flow//Agendamento//PT',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${agora}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${servico} - ${nomeEstabelecimento}`,
    `DESCRIPTION:Profissional: ${profissional}`,
    `LOCATION:${endereco || ''}`,
    'BEGIN:VALARM',
    `TRIGGER:-PT${lembreteMinutos}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Lembrete: seu horário na ${nomeEstabelecimento} é em ${lembreteMinutos} minutos`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

const baixarArquivoICS = (conteudo, nomeArquivo) => {
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const linkGoogleCalendar = ({ nomeEstabelecimento, endereco, servico, profissional, dataStr, horaInicio, horaFim }) => {
  const inicio = `${dataStr.replace(/-/g, '')}T${horaInicio.replace(':', '')}00`;
  const fim = `${dataStr.replace(/-/g, '')}T${horaFim.replace(':', '')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${servico} - ${nomeEstabelecimento}`,
    dates: `${inicio}/${fim}`,
    details: `Profissional: ${profissional}`,
    location: endereco || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

function AgendamentoPublico() {
  const { slug } = useParams();

  const [idioma, setIdioma] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_IDIOMA_STORAGE);
      if (salvo) return salvo;
    } catch {
      // localStorage indisponível — segue sem preferência salva
    }
    return IDIOMA_PADRAO;
  });
  const t = (chave, valores) => traduzir(idioma, chave, valores);
  const localeAtual = LOCALE_POR_IDIOMA[idioma] || LOCALE_POR_IDIOMA[IDIOMA_PADRAO];
  const mudarIdioma = (novoIdioma) => {
    setIdioma(novoIdioma);
    try {
      localStorage.setItem(CHAVE_IDIOMA_STORAGE, novoIdioma);
    } catch {
      // localStorage indisponível (ex: modo privado) — segue sem persistir
    }
  };

  // ------------------------------------------------------------------------
  // Resolve a empresa pelo slug da URL. Tudo mais só começa a ser buscado
  // depois que empresaId existe.
  // ------------------------------------------------------------------------
  const [empresa, setEmpresa] = useState(null);
  const [empresaCarregando, setEmpresaCarregando] = useState(true);
  const [empresaNaoEncontrada, setEmpresaNaoEncontrada] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, slug, plano, status, moeda, logo_url, imagens_local, endereco, whatsapp_numero, instagram_usuario, tiktok_usuario')
        .eq('slug', slug)
        .maybeSingle();
      if (cancelado) return;
      if (error || !data) {
        setEmpresaNaoEncontrada(true);
      } else {
        setEmpresa(data);
      }
      setEmpresaCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [slug]);

  const empresaId = empresa?.id || null;
  const moeda = empresa?.moeda === 'jpy' ? 'jpy' : 'brl';
  const formatarPreco = (valor) => {
    const n = Number(valor) || 0;
    return moeda === 'jpy' ? `¥${n.toLocaleString('ja-JP')}` : `R$${n.toFixed(2).replace('.', ',')}`;
  };

  const ABAS_VALIDAS = ['servicos', 'pacotes', 'agendar', 'meusAgendamentos', 'endereco', 'profissionais', 'fidelidade', 'avaliacoes'];
  const [abaAtiva, setAbaAtiva] = useState(() => {
    if (typeof window === 'undefined') return 'servicos';
    const abaUrl = new URLSearchParams(window.location.search).get('aba');
    return ABAS_VALIDAS.includes(abaUrl) ? abaUrl : 'servicos';
  });

  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [horariosOcupados, setHorariosOcupados] = useState({});
  const [horarioEstendido, setHorarioEstendido] = useState(HORARIO_ESTENDIDO_PADRAO);
  const [horariosPorProfissional, setHorariosPorProfissional] = useState({});
  const [pontosCliente, setPontosCliente] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [atendimentosRealizados, setAtendimentosRealizados] = useState(0);
  const [pontosJaResgatados, setPontosJaResgatados] = useState(0);
  const [diaHorarioSelecionado, setDiaHorarioSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [observacoesCliente, setObservacoesCliente] = useState('');

  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [profissionalSelecionadoId, setProfissionalSelecionadoId] = useState(null);

  const [listaEsperaAberta, setListaEsperaAberta] = useState(false);
  const [listaEsperaDados, setListaEsperaDados] = useState({ nome: '', email: '', telefone: '' });
  const [listaEsperaEnviada, setListaEsperaEnviada] = useState(false);
  const [enviandoListaEspera, setEnviandoListaEspera] = useState(false);

  const [lembreteMinutos, setLembreteMinutos] = useState(30);
  const [presencaConfirmada, setPresencaConfirmada] = useState(false);

  const [telefoneConsultaPontos, setTelefoneConsultaPontos] = useState('');
  const [consultaPontosFeita, setConsultaPontosFeita] = useState(false);

  const [emailConsultaAgendamentos, setEmailConsultaAgendamentos] = useState('');
  const [telefoneConsultaAgendamentos, setTelefoneConsultaAgendamentos] = useState('');
  const [agendamentosDoCliente, setAgendamentosDoCliente] = useState([]);
  const [consultandoAgendamentos, setConsultandoAgendamentos] = useState(false);
  const [consultaAgendamentosFeita, setConsultaAgendamentosFeita] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);

  const [dadosAgendamento, setDadosAgendamento] = useState({
    nome: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    profissional: '',
    hora: '',
    servico: '',
    data: ''
  });

  // As "avaliações" já eram só enfeite no app original — não gravavam no
  // banco e sumiam ao recarregar a página. Mantemos o mesmo comportamento
  // aqui, começando vazio (nenhum depoimento inventado).
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [novaAvaliacao, setNovaAvaliacao] = useState({ nome: '', estrelas: 5, texto: '' });

  const [servicos, setServicos] = useState([]);
  const [pacotes, setPacotes] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [promocoes, setPromocoes] = useState([]);
  const [promocaoPopup, setPromocaoPopup] = useState(null);

  // Busca todo o catálogo assim que a empresa é resolvida pelo slug.
  useEffect(() => {
    if (!empresaId) return;

    supabase.from('servicos')
      .select('id, nome, descricao, preco_minimo, preco_maximo, duracao_minutos, requer_confirmacao_preco, imagem_url')
      .eq('empresa_id', empresaId)
      .eq('eh_pacote', false)
      .order('nome')
      .then(({ data }) => {
        setServicos((data || []).map(s => ({
          id: s.id,
          nome: s.nome,
          descricao: s.descricao || '',
          preco: Number(s.preco_minimo) || 0,
          precoMaximo: s.preco_maximo != null ? Number(s.preco_maximo) : null,
          duracaoMinutos: s.duracao_minutos || 60,
          duracao: `${s.duracao_minutos || 60} min`,
          imagem: s.imagem_url || '/images/servico_corte.jpg',
        })));
      });

    supabase.from('servicos')
      .select('id, nome, descricao, preco_minimo, quantidade_sessoes, validade_dias, imagem_url')
      .eq('empresa_id', empresaId)
      .eq('eh_pacote', true)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        setPacotes((data || []).map(p => ({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao || '',
          preco: Number(p.preco_minimo) || 0,
          quantidadeSessoes: p.quantidade_sessoes,
          validadeDias: p.validade_dias,
          imagem: p.imagem_url,
        })));
      });

    supabase.from('profissionais')
      .select('id, nome, especialidade, imagem_url')
      .eq('empresa_id', empresaId)
      .order('nome')
      .then(({ data }) => {
        setProfissionais((data || []).map(p => ({
          id: p.id,
          nome: p.nome,
          especialidade: p.especialidade || '',
          imagem: p.imagem_url || '/images/placeholder_profissional.jpg',
        })));
      });

    supabase.from('promocoes')
      .select('id, nome, descricao, servico_id, tipo_desconto, valor_desconto, dias_semana, hora_inicio, hora_fim, pontos_fidelidade, ativo, data_inicio, data_fim')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .then(({ data }) => {
        const lista = data || [];
        setPromocoes(lista);
        if (lista.length > 0) {
          try {
            const chaveVisto = `kaizen_promo_popup_${lista[0].id}`;
            const hojeStr = paraDataStr(new Date());
            if (localStorage.getItem(chaveVisto) !== hojeStr) {
              setPromocaoPopup(lista[0]);
              localStorage.setItem(chaveVisto, hojeStr);
            }
          } catch {
            // localStorage indisponível — só não mostra o popup
          }
        }
      });

    supabase.from('horarios_profissional')
      .select('profissional_id, dia_semana, horario_inicio, horario_fim')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        const mapa = {};
        (data || []).forEach((linha) => {
          const pid = linha.profissional_id;
          const dia = linha.dia_semana;
          if (!mapa[pid]) mapa[pid] = {};
          if (!mapa[pid][dia]) mapa[pid][dia] = [];
          mapa[pid][dia].push({
            inicioMin: paraMinutos(linha.horario_inicio.substring(0, 5)),
            fimMin: paraMinutos(linha.horario_fim.substring(0, 5)),
          });
        });
        Object.values(mapa).forEach((porDia) => {
          Object.values(porDia).forEach((blocos) => blocos.sort((a, b) => a.inicioMin - b.inicioMin));
        });
        setHorariosPorProfissional(mapa);
      });

    supabase.from('configuracoes_horario')
      .select('ativo, abertura, data_inicio, data_fim')
      .eq('empresa_id', empresaId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setHorarioEstendido(HORARIO_ESTENDIDO_PADRAO);
          return;
        }
        setHorarioEstendido({
          ativo: !!data.ativo,
          abertura: data.abertura || HORARIO_ESTENDIDO_PADRAO.abertura,
          dataInicio: data.data_inicio,
          dataFim: data.data_fim,
        });
      });
  }, [empresaId]);

  const servicoSelecionadoInfo = servicos.find(s => s.nome === dadosAgendamento.servico);
  const duracaoSelecionada = servicoSelecionadoInfo ? servicoSelecionadoInfo.duracaoMinutos : 60;
  // Sem restrição de profissional por serviço — simplificação multi-tenant
  // (todo profissional cadastrado atende todos os serviços da empresa).
  const profissionaisAptos = profissionais;
  const profissionalSelecionado = profissionaisAptos.find(p => p.id === profissionalSelecionadoId) || profissionaisAptos[0] || null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limiteDataMax = new Date(hoje);
  limiteDataMax.setDate(hoje.getDate() + DIAS_CARROSSEL - 1);
  const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const podeVoltarMes = mesCalendario.getFullYear() > inicioMesAtual.getFullYear() ||
    (mesCalendario.getFullYear() === inicioMesAtual.getFullYear() && mesCalendario.getMonth() > inicioMesAtual.getMonth());
  const proximoMesRef = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1);
  const podeAvancarMes = proximoMesRef <= limiteDataMax;

  useEffect(() => {
    if (!empresaId) return;
    buscarHorariosOcupados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, servicos]);

  useEffect(() => {
    if (dadosAgendamento.email && dadosAgendamento.email.includes('@')) {
      buscarPontosCliente();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosAgendamento.email]);

  // Sempre que o serviço (ou a lista de profissionais) muda, garante que o
  // profissional selecionado continua sendo um válido.
  useEffect(() => {
    if (profissionaisAptos.length > 0 && !profissionaisAptos.some(p => p.id === profissionalSelecionadoId)) {
      setProfissionalSelecionadoId(profissionaisAptos[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosAgendamento.servico, profissionais]);

  // Mantém o calendário sempre mostrando o mês da data selecionada.
  useEffect(() => {
    const novoMes = new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), 1);
    setMesCalendario(prev => (
      prev.getFullYear() === novoMes.getFullYear() && prev.getMonth() === novoMes.getMonth()
    ) ? prev : novoMes);
  }, [dataSelecionada]);

  // Calcula e grava no estado o saldo de pontos de fidelidade de um cliente
  // já identificado (por e-mail, na tela de agendamento, ou por telefone, na
  // consulta pública de pontos) — a partir daqui a lógica é a mesma pros dois.
  const calcularESetarPontosDoCliente = async (clienteId) => {
    const { data: realizados, error: erroRealizados } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('cliente_id', clienteId)
      .eq('status', 'REALIZADO')
      .eq('conta_pontos_fidelidade', true);

    if (erroRealizados) throw erroRealizados;

    const { data: resgates, error: erroResgates } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('cliente_id', clienteId)
      .ilike('observacoes', '%Desconto de pontos%');

    if (erroResgates) throw erroResgates;

    const totalGanho = (realizados?.length || 0) * 2;
    const totalResgatado = (resgates?.length || 0) * PONTOS_PARA_RESGATE;
    const saldo = Math.max(0, totalGanho - totalResgatado);

    setAtendimentosRealizados(realizados?.length || 0);
    setPontosJaResgatados(totalResgatado);
    setPontosCliente(saldo);
  };

  const buscarPontosCliente = async (emailParam) => {
    const email = emailParam || dadosAgendamento.email;
    if (!email || !empresaId) return;
    setCarregandoPontos(true);
    try {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('email', email);

      if (!clientes || clientes.length === 0) {
        setPontosCliente(0);
        setAtendimentosRealizados(0);
        setPontosJaResgatados(0);
        return;
      }

      await calcularESetarPontosDoCliente(clientes[0].id);
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
      setPontosCliente(0);
    } finally {
      setCarregandoPontos(false);
    }
  };

  const normalizarTelefoneParaComparar = (str) => (str || '').replace(/\D/g, '').slice(-9);

  const buscarPontosClientePorTelefone = async (telefoneParam) => {
    const alvo = normalizarTelefoneParaComparar(telefoneParam);
    if (!alvo || !empresaId) return;
    setCarregandoPontos(true);
    try {
      const { data: clientes, error } = await supabase
        .from('clientes')
        .select('id, telefone')
        .eq('empresa_id', empresaId)
        .not('telefone', 'is', null);

      if (error) throw error;

      const encontrado = (clientes || []).find(c => normalizarTelefoneParaComparar(c.telefone) === alvo);

      if (!encontrado) {
        setPontosCliente(0);
        setAtendimentosRealizados(0);
        setPontosJaResgatados(0);
        return;
      }

      await calcularESetarPontosDoCliente(encontrado.id);
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
      setPontosCliente(0);
    } finally {
      setCarregandoPontos(false);
    }
  };

  const buscarAgendamentosCliente = async (emailParam, telefoneParam) => {
    const email = emailParam || emailConsultaAgendamentos;
    const telefoneAlvo = normalizarTelefoneParaComparar(telefoneParam || telefoneConsultaAgendamentos);
    if (!email || !telefoneAlvo || !empresaId) return;
    setConsultandoAgendamentos(true);
    try {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, telefone')
        .eq('empresa_id', empresaId)
        .eq('email', email);

      const clienteEncontrado = (clientes || []).find(c => normalizarTelefoneParaComparar(c.telefone) === telefoneAlvo);

      if (!clienteEncontrado) {
        setAgendamentosDoCliente([]);
        return;
      }

      const clienteId = clienteEncontrado.id;
      const agoraMs = Date.now();

      const { data, error } = await supabase
        .from('agendamentos')
        .select('id, data_hora, status, observacoes, servicos(nome), profissionais(nome)')
        .eq('empresa_id', empresaId)
        .eq('cliente_id', clienteId)
        .order('data_hora', { ascending: false });

      if (error) throw error;

      const todos = (data || []).map(a => {
        const minutosRestantes = (new Date(a.data_hora).getTime() - agoraMs) / 60000;
        const futuro = minutosRestantes > 0;
        return {
          id: a.id,
          data: a.data_hora.split('T')[0],
          hora: a.data_hora.split('T')[1]?.substring(0, 5) || '',
          status: a.status,
          observacoes: a.observacoes,
          servico: a.servicos?.nome || '-',
          profissional: a.profissionais?.nome || '-',
          futuro,
          podeCancelar: futuro && a.status !== 'CANCELADO' && minutosRestantes >= LIMITE_CANCELAMENTO_MINUTOS,
        };
      });

      setAgendamentosDoCliente(todos);
    } catch (error) {
      console.error('Erro ao buscar agendamentos do cliente:', error);
      setAgendamentosDoCliente([]);
    } finally {
      setConsultandoAgendamentos(false);
    }
  };

  const handleCancelarAgendamento = async (agendamento) => {
    if (!window.confirm(t('meusAgendamentos_confirmarCancelamento'))) return;

    setCancelandoId(agendamento.id);
    try {
      const novaObs = agendamento.observacoes
        ? `${agendamento.observacoes} [CANCELADO PELO CLIENTE]`
        : '[CANCELADO PELO CLIENTE]';

      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'CANCELADO', observacoes: novaObs })
        .eq('id', agendamento.id)
        .eq('empresa_id', empresaId);

      if (error) throw error;

      alert(t('meusAgendamentos_cancelado_sucesso'));
      setAgendamentosDoCliente(prev => prev.map(a => (a.id === agendamento.id ? { ...a, status: 'CANCELADO', podeCancelar: false } : a)));
    } catch (error) {
      alert(t('meusAgendamentos_erro_cancelar') + error.message);
    } finally {
      setCancelandoId(null);
    }
  };

  const buscarHorariosOcupados = async () => {
    if (!empresaId) return;
    try {
      const hojeD = new Date();
      hojeD.setHours(0, 0, 0, 0);
      const fimJanela = new Date(hojeD);
      fimJanela.setDate(hojeD.getDate() + DIAS_CARROSSEL);

      const dataInicio = paraDataStr(hojeD);
      const dataFim = paraDataStr(fimJanela);

      const { data, error } = await supabase
        .from('agendamentos')
        .select('profissional_id, data_hora, servico_id, status')
        .eq('empresa_id', empresaId)
        .gte('data_hora', `${dataInicio}T00:00:00`)
        .lte('data_hora', `${dataFim}T23:59:59`)
        .neq('status', 'CANCELADO');

      if (error) throw error;

      const ocupados = {};
      (data || []).forEach(agendamento => {
        const profId = agendamento.profissional_id;
        const [dataStr, horaCompleta] = agendamento.data_hora.split('T');
        const [hh, mm] = horaCompleta.split(':').map(Number);
        const inicioMin = hh * 60 + mm;
        const servicoInfo = servicos.find(s => s.id === agendamento.servico_id);
        const duracaoMin = servicoInfo ? servicoInfo.duracaoMinutos : 60;

        if (!ocupados[profId]) ocupados[profId] = [];
        ocupados[profId].push({ data: dataStr, inicioMin, fimMin: inicioMin + duracaoMin });
      });

      const { data: bloqueios, error: erroBloqueios } = await supabase
        .from('bloqueios_horario')
        .select('profissional_id, data, horario_inicio, horario_fim')
        .eq('empresa_id', empresaId)
        .gte('data', dataInicio)
        .lte('data', dataFim);

      if (erroBloqueios) throw erroBloqueios;

      (bloqueios || []).forEach(bloqueio => {
        const profId = bloqueio.profissional_id;
        const inicioMin = paraMinutos(bloqueio.horario_inicio.substring(0, 5));
        const fimMin = paraMinutos(bloqueio.horario_fim.substring(0, 5));

        if (!ocupados[profId]) ocupados[profId] = [];
        ocupados[profId].push({ data: bloqueio.data, inicioMin, fimMin });
      });

      setHorariosOcupados(ocupados);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    }
  };

  const getHorariosProfissional = (prof, data, duracaoMinutos) => {
    if (!prof) return [];
    const duracao = duracaoMinutos || 60;
    const dataStr = paraDataStr(data);
    const intervalosOcupados = (horariosOcupados[prof.id] || []).filter(o => o.data === dataStr);
    const slots = getSlotsLivresNoDia(prof.id, data, duracao, intervalosOcupados, horariosPorProfissional, horarioEstendido);

    // Esconde horários que já passaram, se o dia selecionado é hoje — no
    // horário local de quem está acessando o site (ver nota sobre fuso no
    // topo do arquivo).
    const agora = new Date();
    if (dataStr === paraDataStr(agora)) {
      const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
      return slots.filter(h => paraMinutos(h) > minutosAgora);
    }
    return slots;
  };

  const promocaoDoAgendamentoAtual = () => {
    if (!dadosAgendamento.servico || !dadosAgendamento.data || !dadosAgendamento.hora) return null;
    const servico = servicos.find(s => s.nome === dadosAgendamento.servico);
    if (!servico) return null;
    return encontrarPromocaoAplicavel(promocoes, {
      servicoId: servico.id,
      dataStr: dadosAgendamento.data,
      horaInicio: dadosAgendamento.hora,
      duracaoMinutos: servico.duracaoMinutos,
    });
  };

  const calcularPrecoFinal = () => {
    if (!dadosAgendamento.servico) return 0;
    const servico = servicos.find(s => s.nome === dadosAgendamento.servico);
    if (!servico) return 0;
    let preco = servico.preco;
    const promo = promocaoDoAgendamentoAtual();
    if (promo) {
      // Preço promocional prevalece — não combina com resgate de pontos.
      return calcularPrecoComPromocao(preco, promo);
    }
    if (usarPontos && pontosCliente >= PONTOS_PARA_RESGATE) {
      preco = preco * (1 - PERCENTUAL_DESCONTO_PONTOS / 100);
    }
    return Math.max(0, Math.round(preco));
  };

  const abrirAgendamentoParaServico = (servico) => {
    setDadosAgendamento({ ...dadosAgendamento, servico: servico.nome });
    setDiaHorarioSelecionado(null);
    setDataSelecionada(new Date());
    setAbaAtiva('agendar');
  };

  const handleSelecionarHorario = (hora) => {
    if (!profissionalSelecionado) return;
    setDiaHorarioSelecionado({ data: dataSelecionada, prof: profissionalSelecionado, hora });
    setDadosAgendamento({
      ...dadosAgendamento,
      data: paraDataStr(dataSelecionada),
      profissional: profissionalSelecionado.nome,
      hora
    });
    setModalAberto(true);
  };

  const handleConfirmarAgendamento = async () => {
    if (!dadosAgendamento.nome || !dadosAgendamento.email) {
      alert('⚠️ ' + t('alerta_preencha_nome_email'));
      return;
    }

    if (!dadosAgendamento.servico) {
      alert('⚠️ ' + t('alerta_selecione_servico'));
      return;
    }

    if (usarPontos && pontosCliente < PONTOS_PARA_RESGATE) {
      alert('⚠️ ' + t('alerta_pontos_insuficientes'));
      return;
    }

    setCarregando(true);

    try {
      let clienteId = null;

      const { data: clientesExistentes } = await supabase
        .from('clientes')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('email', dadosAgendamento.email);

      if (clientesExistentes && clientesExistentes.length > 0) {
        clienteId = clientesExistentes[0].id;
        await supabase
          .from('clientes')
          .update({
            telefone: dadosAgendamento.telefone || undefined,
            data_nascimento: dadosAgendamento.dataNascimento || undefined
          })
          .eq('id', clienteId)
          .eq('empresa_id', empresaId)
          .or('telefone.is.null,data_nascimento.is.null');
      } else {
        const { data: novoCliente, error: erroClienteInsert } = await supabase
          .from('clientes')
          .insert([
            {
              empresa_id: empresaId,
              nome: dadosAgendamento.nome,
              email: dadosAgendamento.email,
              telefone: dadosAgendamento.telefone || null,
              data_nascimento: dadosAgendamento.dataNascimento || null
            }
          ])
          .select('id')
          .single();

        if (erroClienteInsert) throw erroClienteInsert;
        clienteId = novoCliente.id;
      }

      // Trava de segurança: evita o mesmo cliente ficar marcado duas vezes ao
      // mesmo tempo com profissionais diferentes.
      const inicioNovoMin = paraMinutos(dadosAgendamento.hora);
      const fimNovoMin = inicioNovoMin + duracaoSelecionada;

      const { data: agendamentosDoDiaCliente, error: erroConflito } = await supabase
        .from('agendamentos')
        .select('data_hora, servico_id')
        .eq('empresa_id', empresaId)
        .eq('cliente_id', clienteId)
        .neq('status', 'CANCELADO')
        .gte('data_hora', `${dadosAgendamento.data}T00:00:00`)
        .lte('data_hora', `${dadosAgendamento.data}T23:59:59`);

      if (erroConflito) throw erroConflito;

      const temConflito = (agendamentosDoDiaCliente || []).some(a => {
        const horaExistente = a.data_hora.split('T')[1]?.substring(0, 5);
        const inicioExistenteMin = paraMinutos(horaExistente);
        const servicoExistente = servicos.find(s => s.id === a.servico_id);
        const duracaoExistente = servicoExistente ? servicoExistente.duracaoMinutos : 60;
        const fimExistenteMin = inicioExistenteMin + duracaoExistente;
        return inicioNovoMin < fimExistenteMin && fimNovoMin > inicioExistenteMin;
      });

      if (temConflito) {
        alert('⚠️ ' + t('alerta_cliente_ja_tem_horario'));
        setCarregando(false);
        return;
      }

      const profissionalId = diaHorarioSelecionado.prof.id;
      const servicoSelecionado = servicos.find(s => s.nome === dadosAgendamento.servico);
      const servicoId = servicoSelecionado.id;
      const precoFinal = calcularPrecoFinal();
      const promoAplicada = promocaoDoAgendamentoAtual();
      const contaPontos = promoAplicada ? (promoAplicada.pontos_fidelidade !== false) : true;

      const notas = [
        promoAplicada ? `Promoção aplicada: ${promoAplicada.nome}` : null,
        (!promoAplicada && usarPontos) ? `Desconto de pontos de fidelidade aplicado (-${PERCENTUAL_DESCONTO_PONTOS}%)` : null,
        observacoesCliente ? `Observação do cliente: ${observacoesCliente}` : null,
      ].filter(Boolean).join(' | ') || null;

      const { data: novoAgendamento, error } = await supabase
        .from('agendamentos')
        .insert([
          {
            empresa_id: empresaId,
            cliente_id: clienteId,
            profissional_id: profissionalId,
            servico_id: servicoId,
            data_hora: `${dadosAgendamento.data}T${dadosAgendamento.hora}:00`,
            status: 'CONFIRMADO',
            preco_final: precoFinal,
            observacoes: notas,
            conta_pontos_fidelidade: contaPontos,
          }
        ])
        .select('id')
        .single();

      if (error) throw error;

      await buscarHorariosOcupados();

      setAgendamentoConfirmado({
        id: novoAgendamento?.id,
        numero: Math.floor(Math.random() * 100000),
        profissional: dadosAgendamento.profissional,
        servico: dadosAgendamento.servico,
        servicoExibicao: servicoSelecionado.nome,
        dataStr: dadosAgendamento.data,
        data: new Date(`${dadosAgendamento.data}T00:00:00`).toLocaleDateString(localeAtual),
        hora: dadosAgendamento.hora,
        horaFim: somarMinutos(dadosAgendamento.hora, duracaoSelecionada),
        duracaoMinutos: duracaoSelecionada,
        precoOriginal: servicoSelecionado.preco,
        precoFinal: precoFinal,
        desconto: Math.max(0, servicoSelecionado.preco - precoFinal),
        promocaoNome: promoAplicada ? promoAplicada.nome : null
      });

      setPresencaConfirmada(false);
      setModalAberto(false);
      setDadosAgendamento({ nome: '', email: '', telefone: '', dataNascimento: '', profissional: '', hora: '', servico: '', data: '' });
      setUsarPontos(false);
      setObservacoesCliente('');
      setPontosCliente(0);
      setDiaHorarioSelecionado(null);

    } catch (error) {
      alert('❌ ' + t('alerta_erro_agendar') + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleConfirmarPresenca = async () => {
    if (!agendamentoConfirmado?.id) {
      setPresencaConfirmada(true);
      return;
    }
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ presenca_confirmada: true })
        .eq('id', agendamentoConfirmado.id)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      setPresencaConfirmada(true);
    } catch (error) {
      alert('❌ ' + t('alerta_erro_presenca') + error.message);
    }
  };

  const handleAdicionarAoCalendario = () => {
    const conteudo = gerarConteudoICS({
      nomeEstabelecimento: empresa?.nome || '',
      endereco: empresa?.endereco || '',
      servico: agendamentoConfirmado.servicoExibicao || agendamentoConfirmado.servico,
      profissional: agendamentoConfirmado.profissional,
      dataStr: agendamentoConfirmado.dataStr,
      horaInicio: agendamentoConfirmado.hora,
      horaFim: agendamentoConfirmado.horaFim,
      lembreteMinutos,
    });
    baixarArquivoICS(conteudo, `agendamento-${agendamentoConfirmado.dataStr}.ics`);
  };

  const handleEnviarListaEspera = async (e) => {
    e.preventDefault();
    if (!listaEsperaDados.nome || !listaEsperaDados.email) return;
    setEnviandoListaEspera(true);
    try {
      const { error } = await supabase.from('lista_espera').insert([{
        empresa_id: empresaId,
        nome: listaEsperaDados.nome,
        email: listaEsperaDados.email,
        telefone: listaEsperaDados.telefone || null,
        servico: dadosAgendamento.servico || null,
        profissional: profissionalSelecionado?.nome || null,
        data_desejada: paraDataStr(dataSelecionada),
      }]);
      if (error) throw error;
      setListaEsperaEnviada(true);
    } catch (error) {
      alert('❌ ' + t('alerta_erro_lista_espera') + error.message);
    } finally {
      setEnviandoListaEspera(false);
    }
  };

  const handleAdicionarAvaliacao = (e) => {
    e.preventDefault();
    if (novaAvaliacao.nome && novaAvaliacao.texto) {
      const hojeStr = new Date().toISOString().split('T')[0];
      setAvaliacoes([...avaliacoes, {
        id: avaliacoes.length + 1,
        ...novaAvaliacao,
        data: hojeStr
      }]);
      setNovaAvaliacao({ nome: '', estrelas: 5, texto: '' });
      alert('✅ ' + t('alerta_avaliacao_enviada'));
    }
  };

  const renderizarEstrelas = (num) => '★'.repeat(num);

  const gerarGradeMes = (mesRef) => {
    const ano = mesRef.getFullYear();
    const mes = mesRef.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias = [];
    for (let i = 0; i < primeiroDia.getDay(); i++) dias.push(null);
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(ano, mes, d));
    while (dias.length % 7 !== 0) dias.push(null);
    return dias;
  };

  const irMesAnterior = () => {
    if (!podeVoltarMes) return;
    setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1));
  };

  const irProximoMes = () => {
    if (!podeAvancarMes) return;
    setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1));
  };

  // Resumo do horário de um dia da semana, calculado como a UNIÃO dos
  // horários de todos os profissionais (não existe mais 1 horário fixo da
  // loja — ver nota no topo do arquivo). Usado no calendário (dia
  // fechado/aberto) e na aba Endereço.
  const horarioResumoDoDia = (diaSemana) => {
    let abertura = null;
    let fechamento = null;
    profissionais.forEach(p => {
      const blocos = horariosPorProfissional[p.id]?.[diaSemana] || [];
      if (blocos.length === 0) return;
      const inicioMin = blocos[0].inicioMin;
      const fimMin = blocos[blocos.length - 1].fimMin;
      if (abertura === null || inicioMin < abertura) abertura = inicioMin;
      if (fechamento === null || fimMin > fechamento) fechamento = fimMin;
    });
    if (abertura === null) return { aberto: false };
    return { aberto: true, abertura: paraHHMM(abertura), fechamento: paraHHMM(fechamento) };
  };

  if (empresaCarregando) {
    return (
      <div style={{ background: '#1a1a1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#d4af37' }}>...</p>
      </div>
    );
  }

  if (empresaNaoEncontrada || !empresa) {
    return (
      <div style={{ background: '#1a1a1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#e8e8e8' }}>Página não encontrada. Verifique o link do estabelecimento.</p>
      </div>
    );
  }

  if (agendamentoConfirmado) {
    const horariosDisponiveisLembrete = OPCOES_LEMBRETE;
    return (
      <div style={{ background: '#1a1a1a', minHeight: '100vh', paddingBottom: '40px' }}>
        <div style={{ background: '#166534', padding: '18px 20px', textAlign: 'center' }}>
          <p style={{ color: '#fff', fontWeight: 'bold', fontSize: '17px', margin: 0 }}>✅ {t('conf_titulo')}</p>
        </div>

        <div style={{ maxWidth: '480px', margin: '30px auto', padding: '0 20px' }}>
          <div style={{ background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '25px', marginBottom: '20px' }}>
            <p style={{ color: '#999', fontSize: '12px', margin: '0 0 4px 0' }}>#{agendamentoConfirmado.numero} · {empresa.nome}</p>
            <h2 style={{ color: '#d4af37', margin: '0 0 15px 0' }}>{agendamentoConfirmado.servicoExibicao || agendamentoConfirmado.servico}</h2>
            <div style={{ color: '#e8e8e8', fontSize: '15px', lineHeight: '1.9' }}>
              <p style={{ margin: 0 }}>💈 {t('conf_profissional')} <strong>{agendamentoConfirmado.profissional}</strong></p>
              <p style={{ margin: 0 }}>📅 {t('conf_data')} <strong>{agendamentoConfirmado.data}</strong></p>
              <p style={{ margin: 0 }}>🕐 {t('conf_horario')} <strong>{agendamentoConfirmado.hora} - {agendamentoConfirmado.horaFim} ({agendamentoConfirmado.duracaoMinutos} min)</strong></p>
              <p style={{ margin: 0 }}>
                💰 {t('conf_valor')} <strong>{formatarPreco(agendamentoConfirmado.precoFinal)}</strong>
                {agendamentoConfirmado.desconto > 0 && (
                  <span style={{ color: '#4ade80' }}> {t('conf_desconto_aplicado', { valor: formatarPreco(agendamentoConfirmado.desconto) })}</span>
                )}
              </p>
            </div>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '15px' }}>⭐ {t('conf_pontos_fidelidade')}</p>
          </div>

          <div style={{ background: '#2d2d2d', border: '1px solid #404040', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
            <h3 style={{ color: '#d4af37', marginTop: 0, fontSize: '16px' }}>⏰ {t('conf_criar_lembrete')}</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {horariosDisponiveisLembrete.map(min => (
                <button
                  key={min}
                  onClick={() => setLembreteMinutos(min)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: '1px solid #d4af37',
                    background: lembreteMinutos === min ? '#d4af37' : 'transparent',
                    color: lembreteMinutos === min ? '#1a1a1a' : '#d4af37',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {t('conf_min_antes', { min })}
                </button>
              ))}
            </div>
            <button onClick={handleAdicionarAoCalendario} style={{ width: '100%', padding: '12px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
              📲 {t('conf_add_calendario')}
            </button>
            <a
              href={linkGoogleCalendar({
                nomeEstabelecimento: empresa.nome,
                endereco: empresa.endereco || '',
                servico: agendamentoConfirmado.servicoExibicao || agendamentoConfirmado.servico,
                profissional: agendamentoConfirmado.profissional,
                dataStr: agendamentoConfirmado.dataStr,
                horaInicio: agendamentoConfirmado.hora,
                horaFim: agendamentoConfirmado.horaFim,
              })}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', color: '#999', fontSize: '13px', textDecoration: 'underline' }}
            >
              {t('conf_google_agenda')}
            </a>
          </div>

          <button
            onClick={handleConfirmarPresenca}
            disabled={presencaConfirmada}
            style={{
              width: '100%',
              padding: '14px',
              background: presencaConfirmada ? '#166534' : 'transparent',
              color: presencaConfirmada ? '#fff' : '#4ade80',
              border: '1px solid #4ade80',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: presencaConfirmada ? 'default' : 'pointer',
              marginBottom: '20px'
            }}
          >
            {presencaConfirmada ? `✓ ${t('conf_presenca_confirmada')}` : t('conf_confirmar_presenca')}
          </button>

          <button
            onClick={() => { setAgendamentoConfirmado(null); setAbaAtiva('servicos'); }}
            style={{ width: '100%', padding: '12px', background: 'transparent', color: '#999', border: '1px solid #404040', borderRadius: '6px', cursor: 'pointer' }}
          >
            {t('conf_voltar_site')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#1a1a1a', color: '#e8e8e8', minHeight: '100vh' }}>
      {promocaoPopup && (
        <div
          onClick={() => setPromocaoPopup(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px',
              padding: '26px', maxWidth: '380px', width: '100%', textAlign: 'center', position: 'relative'
            }}
          >
            <button
              onClick={() => setPromocaoPopup(null)}
              aria-label="Fechar"
              style={{
                position: 'absolute', top: '10px', right: '10px', background: 'transparent',
                border: 'none', color: '#999', fontSize: '20px', cursor: 'pointer', lineHeight: 1
              }}
            >
              ✕
            </button>
            <div style={{ fontSize: '38px', marginBottom: '8px' }}>🏷️</div>
            <h3 style={{ color: '#d4af37', margin: '0 0 10px 0' }}>{promocaoPopup.nome}</h3>
            <p style={{ color: '#e8e8e8', fontSize: '14px', margin: '0 0 18px 0', lineHeight: 1.5 }}>{promocaoPopup.descricao}</p>
            <button
              onClick={() => { setPromocaoPopup(null); setAbaAtiva('agendar'); }}
              style={{ width: '100%', background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
            >
              {t('modal_promocao_agendarAgora')}
            </button>
          </div>
        </div>
      )}
      <header style={{ borderBottom: '3px solid #d4af37', position: 'relative' }}>
        {empresa.logo_url && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '18px' }}>
            <img
              src={empresa.logo_url}
              alt={empresa.nome}
              style={{ width: '92px', height: '92px', objectFit: 'cover', borderRadius: '12px', border: '2px solid #d4af37', display: 'block' }}
            />
          </div>
        )}
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {IDIOMAS.map((op) => (
              <button
                key={op.codigo}
                onClick={() => mudarIdioma(op.codigo)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '20px',
                  border: '1px solid #d4af37',
                  background: idioma === op.codigo ? '#d4af37' : 'transparent',
                  color: idioma === op.codigo ? '#1a1a1a' : '#d4af37',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {op.bandeira} {op.rotulo}
              </button>
            ))}
          </div>
          <h1 style={{ color: '#d4af37', fontSize: '32px', margin: '0' }}>{empresa.nome}</h1>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '10px', padding: '20px', borderBottom: '1px solid #404040', overflowX: 'auto' }}>
        {[
          { id: 'servicos', label: `💈 ${t('nav_servicos')}` },
          { id: 'pacotes', label: `🎁 ${t('nav_pacotes')}` },
          { id: 'agendar', label: `📅 ${t('nav_agendar')}` },
          { id: 'meusAgendamentos', label: `📋 ${t('nav_meusAgendamentos')}` },
          { id: 'endereco', label: `📍 ${t('nav_endereco')}` },
          { id: 'profissionais', label: `👥 ${t('nav_profissionais')}` },
          { id: 'fidelidade', label: `🎁 ${t('nav_fidelidade')}` },
          { id: 'avaliacoes', label: `★ ${t('nav_avaliacoes')}` },
        ].map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            style={{
              padding: '10px 15px',
              background: abaAtiva === aba.id ? '#d4af37' : 'transparent',
              color: abaAtiva === aba.id ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            {aba.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>

        {abaAtiva === 'servicos' && (
          <section>
            <h2 style={{ color: '#d4af37', marginBottom: '30px' }}>💈 {t('servicos_titulo')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {servicos.map((servico, idx) => (
                <div
                  key={servico.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    border: '1px solid #d4af37',
                    borderRadius: '10px',
                    background: '#2d2d2d',
                    padding: '14px',
                    flexWrap: 'wrap'
                  }}
                >
                  <img
                    src={servico.imagem}
                    alt={servico.nome}
                    style={{ width: '92px', height: '92px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                  />

                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <h3 style={{ color: '#d4af37', margin: '0 0 6px 0', fontSize: '16px', letterSpacing: '0.3px' }}>
                      {idx + 1}. {servico.nome.toUpperCase()}
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '16px' }}>
                        {servico.precoMaximo && servico.precoMaximo > servico.preco
                          ? `${formatarPreco(servico.preco)} - ${formatarPreco(servico.precoMaximo)}`
                          : formatarPreco(servico.preco)}
                      </span>
                      <span style={{ color: '#999', fontSize: '13px' }}>⏱️ {servico.duracao}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => abrirAgendamentoParaServico(servico)}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 22px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {t('servicos_agendar')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === 'pacotes' && (
          <section>
            <h2 style={{ color: '#d4af37', marginBottom: '30px' }}>🎁 {t('pacotes_titulo')}</h2>
            {pacotes.length === 0 ? (
              <p style={{ color: '#999' }}>{t('pacotes_nenhum')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pacotes.map((pacote) => (
                  <div
                    key={pacote.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      border: '1px solid #d4af37',
                      borderRadius: '10px',
                      background: '#2d2d2d',
                      padding: '14px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <img
                      src={pacote.imagem || '/images/servico_corte.jpg'}
                      alt={pacote.nome}
                      style={{ width: '92px', height: '92px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                    />

                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <h3 style={{ color: '#d4af37', margin: '0 0 6px 0', fontSize: '16px', letterSpacing: '0.3px' }}>
                        {pacote.nome.toUpperCase()}
                      </h3>
                      {pacote.descricao && (
                        <p style={{ color: '#ccc', fontSize: '13px', margin: '0 0 6px 0' }}>{pacote.descricao}</p>
                      )}
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '16px' }}>{formatarPreco(pacote.preco)}</span>
                        <span style={{ color: '#999', fontSize: '13px' }}>
                          {pacote.quantidadeSessoes == null
                            ? `♾️ ${t('pacotes_sessoesIlimitadas')}`
                            : `🔁 ${t('pacotes_sessoes', { n: pacote.quantidadeSessoes })}`}
                        </span>
                        {pacote.validadeDias != null && (
                          <span style={{ color: '#999', fontSize: '13px' }}>⏳ {t('pacotes_validade', { n: pacote.validadeDias })}</span>
                        )}
                      </div>
                    </div>

                    {empresa.whatsapp_numero && (
                      <a
                        href={`https://wa.me/${empresa.whatsapp_numero}?text=${encodeURIComponent(t('pacotes_mensagemWhatsapp', { nome: pacote.nome }))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#25D366',
                          color: '#fff',
                          border: 'none',
                          padding: '12px 22px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          flexShrink: 0,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <FaWhatsapp /> {t('pacotes_tenhoInteresse')}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {abaAtiva === 'agendar' && (
          <section style={{
            background: '#2d2d2d',
            border: '1px solid #d4af37',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '30px' }}>
              <h2 style={{ color: '#d4af37', marginBottom: '20px' }}>📅 {t('agendar_titulo')}</h2>

              {profissionais.length === 0 || servicos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>...</p>
              ) : (
              <>
              <div style={{ maxWidth: '500px', margin: '0 auto 25px' }}>
                <label style={{ color: '#d4af37', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>{t('agendar_servico_label')}</label>
                <select
                  value={dadosAgendamento.servico}
                  onChange={(e) => { setDadosAgendamento({ ...dadosAgendamento, servico: e.target.value }); setDiaHorarioSelecionado(null); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                >
                  <option value="">{t('agendar_servico_placeholder')}</option>
                  {servicos.map(s => (<option key={s.id} value={s.nome}>{s.nome} ({s.duracao})</option>))}
                </select>
              </div>

              {!dadosAgendamento.servico ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>👆 {t('agendar_escolha_servico')}</p>
              ) : (
                <div style={{ maxWidth: '560px', margin: '0 auto' }}>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <button
                      onClick={irMesAnterior}
                      disabled={!podeVoltarMes}
                      aria-label={t('agendar_mes_anterior')}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        border: '1px solid #d4af37',
                        background: 'transparent',
                        color: podeVoltarMes ? '#d4af37' : '#555',
                        fontSize: '18px',
                        cursor: podeVoltarMes ? 'pointer' : 'not-allowed',
                        opacity: podeVoltarMes ? 1 : 0.4
                      }}
                    >
                      ‹
                    </button>
                    <p style={{ color: '#d4af37', fontWeight: 'bold', margin: 0, fontSize: '17px', textTransform: 'capitalize' }}>
                      {mesCalendario.toLocaleDateString(localeAtual, { month: 'long', year: 'numeric' })}
                    </p>
                    <button
                      onClick={irProximoMes}
                      disabled={!podeAvancarMes}
                      aria-label={t('agendar_proximo_mes')}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        border: '1px solid #d4af37',
                        background: 'transparent',
                        color: podeAvancarMes ? '#d4af37' : '#555',
                        fontSize: '18px',
                        cursor: podeAvancarMes ? 'pointer' : 'not-allowed',
                        opacity: podeAvancarMes ? 1 : 0.4
                      }}
                    >
                      ›
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
                    {(DIAS_ABREV_POR_IDIOMA[idioma] || DIAS_ABREV_POR_IDIOMA[IDIOMA_PADRAO]).map(dia => (
                      <div key={dia} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999' }}>
                        {dia}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '20px' }}>
                    {gerarGradeMes(mesCalendario).map((data, idx) => {
                      if (!data) return <div key={`vazio-${idx}`} />;
                      const diaSemana = getDiaSemana(data);
                      const fechado = !horarioResumoDoDia(diaSemana).aberto;
                      const foraDoIntervalo = data < hoje || data > limiteDataMax;
                      const desabilitado = fechado || foraDoIntervalo;
                      const selecionado = data.toDateString() === dataSelecionada.toDateString();
                      return (
                        <button
                          key={data.toISOString()}
                          disabled={desabilitado}
                          onClick={() => { setDataSelecionada(data); setListaEsperaAberta(false); setListaEsperaEnviada(false); }}
                          title={fechado ? t('endereco_fechado') : (foraDoIntervalo ? t('agendar_fora_periodo') : undefined)}
                          style={{
                            aspectRatio: '1',
                            width: '100%',
                            borderRadius: '8px',
                            border: selecionado ? '2px solid #d4af37' : '1px solid #404040',
                            background: selecionado ? '#d4af37' : 'rgba(45, 45, 45, 0.85)',
                            color: desabilitado ? '#666' : (selecionado ? '#1a1a1a' : '#e8e8e8'),
                            cursor: desabilitado ? 'not-allowed' : 'pointer',
                            opacity: desabilitado ? 0.45 : 1,
                            fontWeight: selecionado ? 'bold' : 'normal',
                            fontSize: '14px'
                          }}
                        >
                          {data.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '10px' }}>{t('agendar_profissional_label')}</p>
                  <div style={{ display: 'flex', gap: '18px', marginBottom: '25px', flexWrap: 'wrap' }}>
                    {profissionaisAptos.map((prof) => {
                      const selecionado = profissionalSelecionado?.id === prof.id;
                      return (
                        <button
                          key={prof.id}
                          onClick={() => { setProfissionalSelecionadoId(prof.id); setListaEsperaAberta(false); setListaEsperaEnviada(false); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}
                        >
                          <img
                            src={prof.imagem}
                            alt={prof.nome}
                            style={{
                              width: '64px',
                              height: '64px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: selecionado ? '3px solid #d4af37' : '3px solid transparent',
                              display: 'block',
                              margin: '0 auto 6px'
                            }}
                          />
                          <span style={{ fontSize: '12px', color: selecionado ? '#d4af37' : '#e8e8e8', fontWeight: selecionado ? 'bold' : 'normal' }}>
                            {prof.nome}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {(() => {
                    const horarios = getHorariosProfissional(profissionalSelecionado, dataSelecionada, duracaoSelecionada);
                    const limiteManha = 12 * 60;
                    const manha = horarios.filter(h => paraMinutos(h) < limiteManha);
                    const tarde = horarios.filter(h => paraMinutos(h) >= limiteManha);

                    if (horarios.length === 0) {
                      return (
                        <div style={{ background: 'rgba(45, 45, 45, 0.9)', border: '1px solid #404040', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                          <p style={{ color: '#e8e8e8', marginBottom: '15px' }}>😕 {t('agendar_sem_horario', { prof: profissionalSelecionado?.nome || t('agendar_este_profissional') })}</p>
                          {!listaEsperaAberta && !listaEsperaEnviada && (
                            <button
                              onClick={() => setListaEsperaAberta(true)}
                              style={{ background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              {t('agendar_lista_espera')}
                            </button>
                          )}
                          {listaEsperaEnviada && (
                            <p style={{ color: '#4ade80', fontWeight: 'bold', margin: 0 }}>✅ {t('agendar_anotado')}</p>
                          )}
                          {listaEsperaAberta && !listaEsperaEnviada && (
                            <form onSubmit={handleEnviarListaEspera} style={{ marginTop: '15px', textAlign: 'left' }}>
                              <input type="text" placeholder={t('agendar_le_nome')} value={listaEsperaDados.nome} onChange={(e) => setListaEsperaDados({ ...listaEsperaDados, nome: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} required />
                              <input type="email" placeholder={t('agendar_le_email')} value={listaEsperaDados.email} onChange={(e) => setListaEsperaDados({ ...listaEsperaDados, email: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} required />
                              <input type="tel" placeholder={t('agendar_le_telefone')} value={listaEsperaDados.telefone} onChange={(e) => setListaEsperaDados({ ...listaEsperaDados, telefone: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
                              <button type="submit" disabled={enviandoListaEspera} style={{ width: '100%', padding: '10px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                                {enviandoListaEspera ? `⏳ ${t('agendar_le_enviando')}` : t('agendar_le_enviar')}
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    }

                    return (
                      <>
                        {manha.length > 0 && (
                          <div style={{ marginBottom: '20px' }}>
                            <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '10px' }}>☀️ {t('agendar_manha', { n: manha.length })}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {manha.map(h => (
                                <button
                                  key={h}
                                  onClick={() => handleSelecionarHorario(h)}
                                  style={{ background: '#4ade80', color: '#1a1a1a', border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {tarde.length > 0 && (
                          <div>
                            <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '10px' }}>🌆 {t('agendar_tarde', { n: tarde.length })}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {tarde.map(h => (
                                <button
                                  key={h}
                                  onClick={() => handleSelecionarHorario(h)}
                                  style={{ background: '#4ade80', color: '#1a1a1a', border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              </>
              )}
            </div>
          </section>
        )}

        {abaAtiva === 'meusAgendamentos' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>📋 {t('meusAgendamentos_titulo')}</h2>

            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '600px', marginBottom: '20px' }}>
              <p style={{ color: '#999', fontSize: '12px', margin: '0 0 10px' }}>{t('meusAgendamentos_identificacaoAviso')}</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder={t('fidelidade_email_placeholder')}
                  value={emailConsultaAgendamentos}
                  onChange={(e) => setEmailConsultaAgendamentos(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                />
                <input
                  type="tel"
                  placeholder={t('fidelidade_telefone_placeholder')}
                  value={telefoneConsultaAgendamentos}
                  onChange={(e) => setTelefoneConsultaAgendamentos(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                />
                <button
                  onClick={async () => { await buscarAgendamentosCliente(emailConsultaAgendamentos, telefoneConsultaAgendamentos); setConsultaAgendamentosFeita(true); }}
                  disabled={!emailConsultaAgendamentos.includes('@') || telefoneConsultaAgendamentos.replace(/\D/g, '').length < 8 || consultandoAgendamentos}
                  style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: consultandoAgendamentos ? 'wait' : 'pointer' }}
                >
                  {consultandoAgendamentos ? '⏳' : t('fidelidade_consultar_botao')}
                </button>
              </div>
            </div>

            {consultaAgendamentosFeita && !consultandoAgendamentos && (
              agendamentosDoCliente.length === 0 ? (
                <p style={{ color: '#999', maxWidth: '600px' }}>{t('meusAgendamentos_nenhum')}</p>
              ) : (() => {
                const ativo = (a) => a.futuro && a.status !== 'CANCELADO';
                const proximos = agendamentosDoCliente.filter(ativo).sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
                const historico = agendamentosDoCliente.filter(a => !ativo(a));

                const rotuloStatus = (status) => {
                  if (status === 'REALIZADO') return t('meusAgendamentos_statusRealizado');
                  if (status === 'CANCELADO') return t('meusAgendamentos_statusCancelado');
                  if (status === 'NÃO_COMPARECEU') return t('meusAgendamentos_statusNaoCompareceu');
                  if (status === 'CONFIRMADO') return t('meusAgendamentos_statusConfirmado');
                  return t('meusAgendamentos_statusAgendado');
                };
                const corStatus = (status) => {
                  if (status === 'REALIZADO') return '#4ade80';
                  if (status === 'CANCELADO') return '#f87171';
                  if (status === 'NÃO_COMPARECEU') return '#fb923c';
                  return '#d4af37';
                };

                const Card = (a) => (
                  <div
                    key={a.id}
                    style={{ background: '#2d2d2d', border: '1px solid #404040', borderRadius: '8px', padding: '16px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '16px' }}>
                        <strong style={{ color: '#d4af37' }}>{new Date(`${a.data}T00:00:00`).toLocaleDateString(localeAtual)}</strong>
                        {' · '}
                        <strong style={{ color: '#d4af37' }}>{a.hora}</strong>
                      </p>
                      <span style={{ color: corStatus(a.status), fontSize: '11px', fontWeight: 'bold', border: `1px solid ${corStatus(a.status)}`, borderRadius: '4px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                        {rotuloStatus(a.status)}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 4px', color: '#e8e8e8' }}>{a.servico} — {a.profissional}</p>

                    {a.podeCancelar && (
                      <button
                        onClick={() => handleCancelarAgendamento(a)}
                        disabled={cancelandoId === a.id}
                        style={{
                          marginTop: '10px',
                          background: 'transparent',
                          color: '#f87171',
                          border: '1px solid #f87171',
                          padding: '8px 16px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          cursor: cancelandoId === a.id ? 'wait' : 'pointer'
                        }}
                      >
                        {cancelandoId === a.id ? t('meusAgendamentos_cancelando') : t('meusAgendamentos_cancelar_botao')}
                      </button>
                    )}
                    {ativo(a) && !a.podeCancelar && (
                      <div style={{ marginTop: '10px', background: 'rgba(249, 115, 22, 0.12)', border: '1px solid #f97316', borderRadius: '6px', padding: '10px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#f97316' }}>{t('meusAgendamentos_menosDe2h')}</p>
                        {empresa.whatsapp_numero && (
                          <a
                            href={`https://wa.me/${empresa.whatsapp_numero}?text=${encodeURIComponent(t('contato_whatsapp_mensagem'))}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ ...botaoContatoStyle, color: '#25D366', border: '1px solid #25D366', display: 'inline-flex' }}
                          >
                            <FaWhatsapp size={16} /> WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );

                return (
                  <div style={{ maxWidth: '600px' }}>
                    {proximos.length > 0 && (
                      <div style={{ marginBottom: '26px' }}>
                        <h3 style={{ color: '#d4af37', fontSize: '15px', marginBottom: '10px' }}>{t('meusAgendamentos_proximos')}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {proximos.map(Card)}
                        </div>
                      </div>
                    )}
                    <div>
                      <h3 style={{ color: '#d4af37', fontSize: '15px', marginBottom: '10px' }}>{t('meusAgendamentos_historico')}</h3>
                      {historico.length === 0 ? (
                        <p style={{ color: '#999', fontSize: '13px' }}>{t('meusAgendamentos_semHistorico')}</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {historico.map(Card)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </section>
        )}

        {abaAtiva === 'endereco' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>📍 {t('endereco_titulo')}</h2>
            <div style={{ maxWidth: '600px' }}>
              <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
                <h3 style={{ color: '#d4af37', marginTop: 0, marginBottom: '12px' }}>{empresa.nome}</h3>
                {empresa.endereco ? (
                  <p style={{ margin: '0 0 16px 0', lineHeight: '1.6', color: '#e8e8e8' }}>{empresa.endereco}</p>
                ) : (
                  <p style={{ margin: '0 0 16px 0', color: '#999', fontSize: '13px' }}>{t('endereco_titulo')}: —</p>
                )}
                <p style={{ margin: '0 0 8px 0', color: '#999', fontSize: '12px' }}>{t('contato_titulo')}</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {empresa.endereco && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(empresa.endereco)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={botaoContatoStyle}
                    >
                      🗺️ {t('endereco_ver_mapa')}
                    </a>
                  )}
                  {empresa.whatsapp_numero && (
                    <a
                      href={`https://wa.me/${empresa.whatsapp_numero}?text=${encodeURIComponent(t('contato_whatsapp_mensagem'))}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...botaoContatoStyle, color: '#25D366', border: '1px solid #25D366' }}
                    >
                      <FaWhatsapp size={16} /> WhatsApp
                    </a>
                  )}
                  {empresa.instagram_usuario && (
                    <a
                      href={`https://instagram.com/${empresa.instagram_usuario}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...botaoContatoStyle, color: '#E4405F', border: '1px solid #E4405F' }}
                    >
                      <FaInstagram size={16} /> Instagram
                    </a>
                  )}
                  {empresa.tiktok_usuario && (
                    <a
                      href={`https://www.tiktok.com/@${empresa.tiktok_usuario}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...botaoContatoStyle, color: '#e8e8e8', border: '1px solid #e8e8e8' }}
                    >
                      <FaTiktok size={16} /> TikTok
                    </a>
                  )}
                </div>
              </div>

              <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
                <h3 style={{ color: '#d4af37', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🕒 {t('endereco_horario_titulo')}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].map((dia) => {
                      const h = horarioResumoDoDia(dia);
                      const ehHoje = dia === getDiaSemana(new Date());
                      const nomesDias = DIAS_NOMES_POR_IDIOMA[idioma] || DIAS_NOMES_POR_IDIOMA[IDIOMA_PADRAO];
                      return (
                        <tr
                          key={dia}
                          style={{
                            borderBottom: '1px solid #404040',
                            background: ehHoje ? 'rgba(212, 175, 55, 0.14)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px 8px', color: ehHoje ? '#d4af37' : '#e8e8e8', fontWeight: ehHoje ? 'bold' : 'normal' }}>
                            {ehHoje && '▶ '}{nomesDias[dia]}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: ehHoje ? 'bold' : 'normal' }}>
                            {h.aberto ? (
                              <span style={{ color: '#4ade80' }}>{h.abertura} - {h.fechamento}</span>
                            ) : (
                              <span style={{ color: '#f87171' }}>{t('endereco_fechado')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {empresa.imagens_local && empresa.imagens_local.length > 0 && (
                <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
                  <h3 style={{ color: '#d4af37', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📷 {t('endereco_fotos_titulo')}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                    {empresa.imagens_local.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt={empresa.nome}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', border: '1px solid #404040' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {abaAtiva === 'profissionais' && (
          <section>
            <h2 style={{ color: '#d4af37', marginBottom: '30px' }}>👥 {t('profissionais_titulo')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
              {profissionais.map((prof) => (
                <div key={prof.id} style={{ border: '1px solid #d4af37', borderRadius: '8px', overflow: 'hidden', background: '#2d2d2d' }}>
                  <img src={prof.imagem} alt={prof.nome} style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', objectPosition: 'center top' }} />
                  <div style={{ padding: '15px' }}>
                    <h3 style={{ color: '#d4af37' }}>{prof.nome}</h3>
                    {prof.especialidade && (
                      <p style={{ color: '#999', fontSize: '14px' }}>{prof.especialidade}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === 'fidelidade' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>🎁 {t('fidelidade_titulo')}</h2>
            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '600px', marginBottom: '20px' }}>
              <p>✅ {t('fidelidade_regra1')}</p>
              <p>✅ {t('fidelidade_regra2')}</p>
            </div>

            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '600px' }}>
              <h3 style={{ color: '#d4af37', marginTop: 0 }}>{t('fidelidade_consultar_titulo')}</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="tel"
                  placeholder={t('fidelidade_telefone_placeholder')}
                  value={telefoneConsultaPontos}
                  onChange={(e) => setTelefoneConsultaPontos(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                />
                <button
                  onClick={async () => { await buscarPontosClientePorTelefone(telefoneConsultaPontos); setConsultaPontosFeita(true); }}
                  disabled={telefoneConsultaPontos.replace(/\D/g, '').length < 8 || carregandoPontos}
                  style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: carregandoPontos ? 'wait' : 'pointer' }}
                >
                  {carregandoPontos ? '⏳' : t('fidelidade_consultar_botao')}
                </button>
              </div>

              {consultaPontosFeita && !carregandoPontos && (
                <div style={{ marginTop: '20px', color: '#e8e8e8', lineHeight: '1.8' }}>
                  <p>{t('fidelidade_atendimentos')} <strong style={{ color: '#d4af37' }}>{atendimentosRealizados}</strong></p>
                  <p>{t('fidelidade_resgatados')} <strong style={{ color: '#60a5fa' }}>{pontosJaResgatados}</strong></p>
                  <p style={{ fontSize: '18px' }}>{t('fidelidade_saldo')} <strong style={{ color: '#4ade80' }}>{pontosCliente} {t('fidelidade_pontos')}</strong></p>
                  {pontosCliente >= PONTOS_PARA_RESGATE ? (
                    <p style={{ color: '#4ade80', fontWeight: 'bold' }}>🎉 {t('fidelidade_pode_resgatar')}</p>
                  ) : (
                    <p style={{ color: '#999' }}>{t('fidelidade_faltam', { n: PONTOS_PARA_RESGATE - pontosCliente })}</p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {abaAtiva === 'avaliacoes' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>★ {t('avaliacoes_titulo')}</h2>
            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '30px', maxWidth: '600px' }}>
              <h3 style={{ color: '#d4af37' }}>{t('avaliacoes_deixe')}</h3>
              <form onSubmit={handleAdicionarAvaliacao}>
                <input type="text" placeholder={t('avaliacoes_nome_placeholder')} value={novaAvaliacao.nome} onChange={(e) => setNovaAvaliacao({...novaAvaliacao, nome: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} required />
                <textarea placeholder={t('avaliacoes_texto_placeholder')} value={novaAvaliacao.texto} onChange={(e) => setNovaAvaliacao({...novaAvaliacao, texto: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box', minHeight: '80px' }} required />
                <button type="submit" style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>{t('avaliacoes_enviar')}</button>
              </form>
            </div>
            {avaliacoes.map((av) => (
              <div key={av.id} style={{ border: '1px solid #404040', borderRadius: '6px', padding: '15px', marginBottom: '15px', background: '#2d2d2d' }}>
                <h4 style={{ color: '#e8e8e8', margin: '0' }}>{av.nome}</h4>
                <span style={{ color: '#d4af37' }}>{renderizarEstrelas(av.estrelas)}</span>
                <p style={{ color: '#e8e8e8' }}>{av.texto}</p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #404040', padding: '20px', textAlign: 'center', color: '#999' }}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          {empresa.whatsapp_numero && (
            <a
              href={`https://wa.me/${empresa.whatsapp_numero}?text=${encodeURIComponent(t('contato_whatsapp_mensagem'))}`}
              target="_blank"
              rel="noreferrer"
              style={{ ...botaoContatoStyle, color: '#25D366', border: '1px solid #25D366' }}
            >
              <FaWhatsapp size={16} /> WhatsApp
            </a>
          )}
          {empresa.instagram_usuario && (
            <a
              href={`https://instagram.com/${empresa.instagram_usuario}`}
              target="_blank"
              rel="noreferrer"
              style={{ ...botaoContatoStyle, color: '#E4405F', border: '1px solid #E4405F' }}
            >
              <FaInstagram size={16} /> Instagram
            </a>
          )}
          {empresa.tiktok_usuario && (
            <a
              href={`https://www.tiktok.com/@${empresa.tiktok_usuario}`}
              target="_blank"
              rel="noreferrer"
              style={{ ...botaoContatoStyle, color: '#e8e8e8', border: '1px solid #e8e8e8' }}
            >
              <FaTiktok size={16} /> TikTok
            </a>
          )}
        </div>
        <p>&copy; {new Date().getFullYear()} {empresa.nome}. {t('footer_direitos')}</p>
      </footer>

      {modalAberto && diaHorarioSelecionado && (
        <div
          className="kaizen-modal-overlay"
          onClick={() => setModalAberto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="kaizen-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2d2d2d',
              borderTop: '2px solid #d4af37',
              borderRadius: '16px 16px 0 0',
              padding: '20px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '88vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#555' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <img src={diaHorarioSelecionado.prof.imagem} alt={diaHorarioSelecionado.prof.nome} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>{empresa.nome}</p>
                <p style={{ margin: 0, color: '#d4af37', fontWeight: 'bold' }}>{diaHorarioSelecionado.prof.nome}</p>
              </div>
            </div>

            <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid #404040', borderRadius: '8px', padding: '14px', marginBottom: '15px' }}>
              <p style={{ margin: '0 0 6px 0', color: '#e8e8e8', fontWeight: 'bold' }}>{servicoSelecionadoInfo ? servicoSelecionadoInfo.nome : dadosAgendamento.servico}</p>
              <p style={{ margin: '0 0 6px 0', color: '#999', fontSize: '13px' }}>
                📅 {diaHorarioSelecionado.data.toLocaleDateString(localeAtual)} · 🕐 {diaHorarioSelecionado.hora} - {somarMinutos(diaHorarioSelecionado.hora, duracaoSelecionada)} ({duracaoSelecionada} min)
              </p>
              <p style={{ margin: 0 }}>
                {(promocaoDoAgendamentoAtual() || (usarPontos && pontosCliente >= PONTOS_PARA_RESGATE)) ? (
                  <>
                    <span style={{ textDecoration: 'line-through', color: '#999', marginRight: '8px' }}>{formatarPreco(servicoSelecionadoInfo?.preco || 0)}</span>
                    <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '18px' }}>{formatarPreco(calcularPrecoFinal())}</span>
                  </>
                ) : (
                  <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '18px' }}>{formatarPreco(calcularPrecoFinal())}</span>
                )}
              </p>
              {promocaoDoAgendamentoAtual() && (
                <p style={{ margin: '6px 0 0 0', color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>
                  🏷️ {t('modal_promocao_aplicada', { nome: promocaoDoAgendamentoAtual().nome })}
                </p>
              )}
            </div>

            <input type="text" placeholder={t('modal_nome_placeholder')} value={dadosAgendamento.nome} onChange={(e) => setDadosAgendamento({...dadosAgendamento, nome: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
            <input type="email" placeholder={t('modal_email_placeholder')} value={dadosAgendamento.email} onChange={(e) => setDadosAgendamento({...dadosAgendamento, email: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
            <input type="tel" placeholder={t('modal_telefone_placeholder')} value={dadosAgendamento.telefone} onChange={(e) => setDadosAgendamento({...dadosAgendamento, telefone: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
            <label style={{ display: 'block', fontSize: '12px', color: '#d4af37', marginBottom: '4px' }}>
              {t('modal_data_nascimento_placeholder')}
            </label>
            <input type="date" value={dadosAgendamento.dataNascimento} onChange={(e) => setDadosAgendamento({...dadosAgendamento, dataNascimento: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
            <textarea
              placeholder={t('modal_obs_placeholder')}
              value={observacoesCliente}
              onChange={(e) => setObservacoesCliente(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box', minHeight: '60px' }}
            />

            {dadosAgendamento.email && dadosAgendamento.email.includes('@') && !promocaoDoAgendamentoAtual() && (
              <div style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid #d4af37', borderRadius: '4px', padding: '12px', marginBottom: '15px', fontSize: '13px' }}>
                {carregandoPontos ? (
                  <p style={{ margin: 0, color: '#999' }}>⏳ {t('modal_consultando_pontos')}</p>
                ) : (
                  <>
                    <p style={{ margin: '0 0 8px 0', color: '#d4af37' }}>🎁 {t('modal_pontos_disponiveis', { n: pontosCliente })}</p>
                    {pontosCliente >= PONTOS_PARA_RESGATE ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#e8e8e8' }}>
                        <input type="checkbox" checked={usarPontos} onChange={(e) => setUsarPontos(e.target.checked)} />
                        {t('modal_usar_pontos')}
                      </label>
                    ) : (
                      <p style={{ margin: 0, color: '#999' }}>{t('modal_faltam_pontos', { n: PONTOS_PARA_RESGATE - pontosCliente, a: Math.ceil((PONTOS_PARA_RESGATE - pontosCliente) / 2) })}</p>
                    )}
                  </>
                )}
              </div>
            )}

            <button onClick={handleConfirmarAgendamento} disabled={carregando} style={{ width: '100%', background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: carregando ? 'wait' : 'pointer', fontSize: '15px' }}>
              {carregando ? `⏳ ${t('modal_agendando')}` : `✅ ${t('modal_confirmar')}`}
            </button>
            <button onClick={() => setModalAberto(false)} style={{ width: '100%', background: 'transparent', color: '#999', border: 'none', padding: '10px', marginTop: '6px', cursor: 'pointer' }}>
              {t('modal_cancelar')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgendamentoPublico;
