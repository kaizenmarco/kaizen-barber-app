import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

function ClientePublico() {
  const [abaAtiva, setAbaAtiva] = useState('servicos');
  const [mesAtual, setMesAtual] = useState(new Date());
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [horariosOcupados, setHorariosOcupados] = useState({});
  const [pontosCliente, setPontosCliente] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [atendimentosRealizados, setAtendimentosRealizados] = useState(0);
  const [pontosJaResgatados, setPontosJaResgatados] = useState(0);
  const [diaHorarioSelecionado, setDiaHorarioSelecionado] = useState(null);
  const resumoRef = useRef(null);

  const [emailConsultaPontos, setEmailConsultaPontos] = useState('');
  const [consultaPontosFeita, setConsultaPontosFeita] = useState(false);
  
  const [dadosAgendamento, setDadosAgendamento] = useState({
    nome: '',
    email: '',
    telefone: '',
    profissional: '',
    hora: '',
    servico: '',
    data: ''
  });

  const [avaliacoes, setAvaliacoes] = useState([
    { id: 1, nome: 'João Silva', estrelas: 5, texto: 'Excelente atendimento! Marco é o melhor barbeiro!', data: '2026-07-25' },
    { id: 2, nome: 'Carlos Santos', estrelas: 5, texto: 'Ambiente perfeito e profissionais incríveis!', data: '2026-07-20' },
  ]);
  const [novaAvaliacao, setNovaAvaliacao] = useState({
    nome: '',
    estrelas: 5,
    texto: ''
  });

  const servicos = [
    { id: 1, uuid: '3f905b1f-61b6-4749-870a-cbe485e39fec', nome: 'Corte', preco: 4000, duracao: '40 min', duracaoMinutos: 40, descricao: 'Corte de cabelo masculino', imagem: '/images/servico_corte.png', profissionaisIds: [1, 2] },
    { id: 2, uuid: '68b86906-5816-4532-a4ac-6487531f872f', nome: 'Corte + Sobrancelhas', preco: 4500, duracao: '45 min', duracaoMinutos: 45, descricao: 'Corte completo com design de sobrancelhas', imagem: '/images/servico_corte_sobrancelhas.png', profissionaisIds: [1, 2] },
    { id: 3, uuid: 'b38f864d-e4f6-44e3-a03b-4706c7984306', nome: 'Corte + Barba', preco: 6500, duracao: '60 min', duracaoMinutos: 60, descricao: 'Corte e modelagem profissional de barba', imagem: '/images/servico_corte_barba.png', profissionaisIds: [1, 2] },
    { id: 4, uuid: '21a0d4eb-ee51-4124-a84b-34c3bdf307dc', nome: 'Coloração', preco: 15000, duracao: '180 min', duracaoMinutos: 180, descricao: 'Coloração profissional com tratamento', imagem: '/images/servico_coloracao.png', profissionaisIds: [1, 3] },
    { id: 5, uuid: '2f4ab333-ba87-40f5-9c3a-3dd911104130', nome: 'Alisamento', preco: 15000, duracao: '180 min', duracaoMinutos: 180, descricao: 'Alisamento e tratamento capilar', imagem: '/images/servico_alisamento.png', profissionaisIds: [3] },
    { id: 6, uuid: '3ccdf5fc-eda5-4c09-9d19-19bcb7ee044a', nome: 'Corte Feminino', preco: 4000, duracao: '45 min', duracaoMinutos: 45, descricao: 'Corte moderno feminino', imagem: '/images/servico_corte_feminino.png', profissionaisIds: [3] },
    { id: 7, uuid: '47d96756-2f6c-48ed-82f6-da80e0166b96', nome: 'Permanente', preco: 6000, duracao: '150 min', duracaoMinutos: 150, descricao: 'Permanente enrolado profissional', imagem: '/images/servico_permanente.png', profissionaisIds: [2, 3] },
    { id: 8, uuid: '1b3d936d-e4ff-4ab0-8bb5-78c6139230c2', nome: 'Limpeza de Pele', preco: 5000, duracao: '45 min', duracaoMinutos: 45, descricao: 'Limpeza facial profunda', imagem: '/images/servico_limpeza_pele.png', profissionaisIds: [3] },
  ];

  const profissionais = [
    { 
      id: 1, 
      uuid: '11c0c7fb-e020-4c49-ab0a-28a16109b35f',
      nome: 'Marco Kaizen', 
      especialidade: 'Especialista em Cortes e Barba',
      qualificacoes: ['14 anos de experiência', 'Dono da Kaizen', 'Especialista em Barba'],
      servicos: ['Cortes', 'Barba', 'Coloração'],
      imagem: '/images/marco.png',
      horarios: { segunda: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], terca: [], quarta: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], quinta: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], sexta: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], sabado: ['09:00', '10:00', '14:00', '15:00'], domingo: ['10:00', '11:00', '15:00', '16:00'] }
    },
    { 
      id: 2, 
      uuid: '66266181-d06b-4f54-bcc9-12dccc100cb4',
      nome: 'Gabriel Little Kaizen', 
      especialidade: 'Especialista em Cortes',
      qualificacoes: ['Profissional certificado', 'Especialista em Permanente', 'Técnica moderna'],
      servicos: ['Cortes', 'Permanente', 'Lavagem'],
      imagem: '/images/gabriel.png',
      horarios: { segunda: ['10:00', '11:00', '14:00', '15:00'], terca: [], quarta: ['10:00', '11:00', '14:00', '15:00'], quinta: ['10:00', '11:00', '14:00', '15:00'], sexta: ['10:00', '11:00', '14:00', '15:00'], sabado: ['10:00', '14:00'], domingo: ['11:00', '14:00'] }
    },
    { 
      id: 3, 
      uuid: 'ad232428-9872-46db-82b3-27819ab353ff',
      nome: 'Neia', 
      especialidade: 'Especialista em Coloração e Estética',
      qualificacoes: ['Coloração avançada', 'Limpeza facial', 'Massagem facial'],
      servicos: ['Coloração', 'Alisamento', 'Estética'],
      imagem: '/images/neia.png',
      horarios: { segunda: ['09:00', '11:00', '15:00', '16:00', '17:00'], terca: [], quarta: ['09:00', '11:00', '15:00', '16:00', '17:00'], quinta: ['09:00', '11:00', '15:00', '16:00', '17:00'], sexta: ['09:00', '11:00', '15:00', '16:00', '17:00'], sabado: ['11:00', '15:00'], domingo: ['09:00', '16:00'] }
    },
  ];

  const servicoSelecionadoInfo = servicos.find(s => s.nome === dadosAgendamento.servico);
  const duracaoSelecionada = servicoSelecionadoInfo ? servicoSelecionadoInfo.duracaoMinutos : 60;
  const profissionaisAptos = servicoSelecionadoInfo
    ? profissionais.filter(p => servicoSelecionadoInfo.profissionaisIds.includes(p.id))
    : profissionais;

  useEffect(() => {
    buscarHorariosOcupados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesAtual]);

  useEffect(() => {
    if (diaHorarioSelecionado && resumoRef.current) {
      resumoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [diaHorarioSelecionado]);

  useEffect(() => {
    if (dadosAgendamento.email && dadosAgendamento.email.includes('@')) {
      buscarPontosCliente();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosAgendamento.email]);

  const buscarPontosCliente = async (emailParam) => {
    const email = emailParam || dadosAgendamento.email;
    if (!email) return;
    setCarregandoPontos(true);
    try {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', email);

      if (!clientes || clientes.length === 0) {
        setPontosCliente(0);
        setAtendimentosRealizados(0);
        setPontosJaResgatados(0);
        setCarregandoPontos(false);
        return;
      }

      const cliente = clientes[0];

      const { data: realizados, error: erroRealizados } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('status', 'REALIZADO');

      if (erroRealizados) throw erroRealizados;

      // Conta quantos agendamentos já usaram desconto de pontos, para saber quanto ja foi resgatado
      const { data: resgates, error: erroResgates } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('cliente_id', cliente.id)
        .ilike('observacoes', '%Desconto de pontos%');

      if (erroResgates) throw erroResgates;

      const totalGanho = (realizados?.length || 0) * 2;
      const totalResgatado = (resgates?.length || 0) * 10;
      const saldo = Math.max(0, totalGanho - totalResgatado);

      setAtendimentosRealizados(realizados?.length || 0);
      setPontosJaResgatados(totalResgatado);
      setPontosCliente(saldo);
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
      setPontosCliente(0);
    } finally {
      setCarregandoPontos(false);
    }
  };

  const buscarHorariosOcupados = async () => {
    try {
      const ano = mesAtual.getFullYear();
      const mes = mesAtual.getMonth();
      
      const primeiroDia = new Date(ano, mes, 1);
      const ultimoDia = new Date(ano, mes + 1, 0);
      
      const dataInicio = primeiroDia.toISOString().split('T')[0];
      const dataFim = ultimoDia.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('agendamentos')
        .select('profissional_id, data_hora, servico_id, status')
        .gte('data_hora', `${dataInicio}T00:00:00`)
        .lte('data_hora', `${dataFim}T23:59:59`)
        .in('status', ['CONFIRMADO', 'REALIZADO']);

      if (error) throw error;

      const ocupados = {};
      data.forEach(agendamento => {
        const profUUID = agendamento.profissional_id;
        const [dataStr, horaCompleta] = agendamento.data_hora.split('T');
        const [hh, mm] = horaCompleta.split(':').map(Number);
        const inicioMin = hh * 60 + mm;
        const servicoInfo = servicos.find(s => s.uuid === agendamento.servico_id);
        const duracaoMin = servicoInfo ? servicoInfo.duracaoMinutos : 60;

        if (!ocupados[profUUID]) {
          ocupados[profUUID] = [];
        }
        ocupados[profUUID].push({ data: dataStr, inicioMin, fimMin: inicioMin + duracaoMin });
      });

      setHorariosOcupados(ocupados);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    }
  };

  const paraMinutos = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const getBlocosDeTrabalho = (horariosBase) => {
    const minutos = horariosBase.map(paraMinutos).sort((a, b) => a - b);
    const blocos = [];
    let blocoAtual = [];
    minutos.forEach((m, idx) => {
      if (idx === 0 || m - minutos[idx - 1] === 60) {
        blocoAtual.push(m);
      } else {
        blocos.push(blocoAtual);
        blocoAtual = [m];
      }
    });
    if (blocoAtual.length) blocos.push(blocoAtual);
    return blocos;
  };

  const getHorariosProfissional = (prof, data, duracaoMinutos) => {
    const diaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][data.getDay()];
    const horariosBase = prof.horarios[diaSemana] || [];
    if (horariosBase.length === 0) return [];

    const duracao = duracaoMinutos || 60;
    const blocos = getBlocosDeTrabalho(horariosBase);
    const dataStr = data.toISOString().split('T')[0];
    const intervalosOcupados = (horariosOcupados[prof.uuid] || []).filter(o => o.data === dataStr);

    return horariosBase.filter(h => {
      const inicioMin = paraMinutos(h);
      const fimMin = inicioMin + duracao;

      // precisa caber inteiro dentro do mesmo bloco de trabalho (sem invadir o almoço ou passar do fechamento)
      const bloco = blocos.find(b => b.includes(inicioMin));
      if (!bloco) return false;
      const fimDoBloco = Math.max(...bloco) + 60;
      if (fimMin > fimDoBloco) return false;

      // não pode colidir com nenhum agendamento já existente deste profissional
      const colide = intervalosOcupados.some(o => inicioMin < o.fimMin && fimMin > o.inicioMin);
      return !colide;
    });
  };

  const calcularPrecoFinal = () => {
    if (!dadosAgendamento.servico) return 0;
    const servico = servicos.find(s => s.nome === dadosAgendamento.servico);
    if (!servico) return 0;
    let preco = servico.preco;
    if (usarPontos && pontosCliente >= 10) {
      preco -= 500;
    }
    return Math.max(0, preco);
  };

  const handleSelecionarDiaHorario = (data, prof, hora) => {
    setDiaHorarioSelecionado({ data, prof, hora });
    setDadosAgendamento({
      ...dadosAgendamento,
      data: data.toISOString().split('T')[0],
      profissional: prof.nome,
      hora: hora
    });
  };

  const handleConfirmarAgendamento = async () => {
    if (!dadosAgendamento.nome || !dadosAgendamento.email) {
      alert('⚠️ Preencha seu nome e email!');
      return;
    }

    if (!dadosAgendamento.servico) {
      alert('⚠️ Selecione um serviço!');
      return;
    }

    if (usarPontos && pontosCliente < 10) {
      alert('⚠️ Você não tem pontos suficientes para resgatar desconto!');
      return;
    }

    setCarregando(true);

    try {
      let clienteId = null;
      
      const { data: clientesExistentes } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', dadosAgendamento.email);

      if (clientesExistentes && clientesExistentes.length > 0) {
        clienteId = clientesExistentes[0].id;
      } else {
        const { data: novoCliente, error: erroClienteInsert } = await supabase
          .from('clientes')
          .insert([
            {
              nome: dadosAgendamento.nome,
              email: dadosAgendamento.email,
              telefone: dadosAgendamento.telefone || null
            }
          ])
          .select('id')
          .single();

        if (erroClienteInsert) throw erroClienteInsert;
        clienteId = novoCliente.id;
      }

      const profissionalUUID = diaHorarioSelecionado.prof.uuid;
      const servicoSelecionado = servicos.find(s => s.nome === dadosAgendamento.servico);
      const servicoUUID = servicoSelecionado.uuid;
      const precoFinal = calcularPrecoFinal();

      const { error } = await supabase
        .from('agendamentos')
        .insert([
          {
            cliente_id: clienteId,
            profissional_id: profissionalUUID,
            servico_id: servicoUUID,
            data_hora: `${dadosAgendamento.data}T${dadosAgendamento.hora}:00`,
            status: 'CONFIRMADO',
            preco_final: precoFinal,
            observacoes: usarPontos ? 'Desconto de pontos de fidelidade aplicado (-¥500)' : null
          }
        ]);

      if (error) throw error;

      await buscarHorariosOcupados();

      setAgendamentoConfirmado({
        numero: Math.floor(Math.random() * 100000),
        profissional: dadosAgendamento.profissional,
        servico: dadosAgendamento.servico,
        data: new Date(dadosAgendamento.data).toLocaleDateString('pt-BR'),
        hora: dadosAgendamento.hora,
        precoOriginal: servicoSelecionado.preco,
        precoFinal: precoFinal,
        desconto: usarPontos ? 500 : 0
      });

      setDadosAgendamento({ nome: '', email: '', telefone: '', profissional: '', hora: '', servico: '', data: '' });
      setUsarPontos(false);
      setPontosCliente(0);
      setDiaHorarioSelecionado(null);

      setTimeout(() => {
        setAgendamentoConfirmado(null);
        setAbaAtiva('servicos');
      }, 5000);

    } catch (error) {
      alert('❌ Erro ao agendar: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleAdicionarAvaliacao = (e) => {
    e.preventDefault();
    if (novaAvaliacao.nome && novaAvaliacao.texto) {
      const hoje = new Date().toISOString().split('T')[0];
      setAvaliacoes([...avaliacoes, {
        id: avaliacoes.length + 1,
        ...novaAvaliacao,
        data: hoje
      }]);
      setNovaAvaliacao({ nome: '', estrelas: 5, texto: '' });
      alert('✅ Avaliação enviada!');
    }
  };

  const renderizarEstrelas = (num) => {
    return '★'.repeat(num);
  };

  const gerarCalendario = () => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasMes = ultimoDia.getDate();
    const diaInicio = primeiroDia.getDay();

    const dias = [];
    for (let i = 0; i < diaInicio; i++) dias.push(null);
    for (let i = 1; i <= diasMes; i++) dias.push(new Date(ano, mes, i));
    return dias;
  };

  if (agendamentoConfirmado) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a1a1a' }}>
        <div style={{ background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{ color: '#d4af37', fontSize: '28px', marginBottom: '20px' }}>✅ AGENDAMENTO CONFIRMADO!</h2>
          <div style={{ color: '#e8e8e8', fontSize: '16px', lineHeight: '1.8', marginBottom: '30px' }}>
            <p><strong>Número:</strong> #{agendamentoConfirmado.numero}</p>
            <p><strong>Profissional:</strong> {agendamentoConfirmado.profissional}</p>
            <p><strong>Serviço:</strong> {agendamentoConfirmado.servico}</p>
            <p><strong>Data:</strong> {agendamentoConfirmado.data}</p>
            <p><strong>Hora:</strong> {agendamentoConfirmado.hora}</p>
            <p><strong>Preço:</strong> ¥{agendamentoConfirmado.precoFinal.toLocaleString('ja-JP')}</p>
            {agendamentoConfirmado.desconto > 0 && (
              <p style={{ color: '#4ade80' }}>🎁 Desconto de fidelidade aplicado: -¥{agendamentoConfirmado.desconto.toLocaleString('ja-JP')}</p>
            )}
          </div>
          <p style={{ color: '#e8e8e8', fontSize: '13px', marginBottom: '10px' }}>⭐ Você ganhará +2 pontos de fidelidade assim que este atendimento for realizado.</p>
          <p style={{ color: '#d4af37', fontSize: '14px', fontWeight: 'bold' }}>⏱️ Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#1a1a1a', color: '#e8e8e8', minHeight: '100vh' }}>
      <header style={{ borderBottom: '3px solid #d4af37', padding: '20px', textAlign: 'center' }}>
        <img src="/images/logo.png" alt="Kaizen" style={{ width: '60px', height: '60px', marginBottom: '10px' }} />
        <h1 style={{ color: '#d4af37', fontSize: '32px', margin: '0' }}>Kaizen Barber Shop</h1>
        <p style={{ color: '#999', margin: '0' }}>Premium Barbershop - Anjo, Aichi</p>
      </header>

      <nav style={{ display: 'flex', gap: '10px', padding: '20px', borderBottom: '1px solid #404040', overflowX: 'auto' }}>
        {[
          { id: 'servicos', label: '💈 Serviços' },
          { id: 'agendar', label: '📅 Agendar' },
          { id: 'endereco', label: '📍 Endereço' },
          { id: 'profissionais', label: '👥 Profissionais' },
          { id: 'fidelidade', label: '🎁 Fidelidade' },
          { id: 'avaliacoes', label: '★ Avaliações' },
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
            <h2 style={{ color: '#d4af37', marginBottom: '30px' }}>💈 Nossos Serviços</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {servicos.map((servico) => (
                <div key={servico.id} style={{ border: '1px solid #d4af37', borderRadius: '8px', overflow: 'hidden', background: '#2d2d2d' }}>
                  <img src={servico.imagem} alt={servico.nome} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', objectPosition: 'center top' }} />
                  <div style={{ padding: '15px' }}>
                    <h3 style={{ color: '#d4af37', marginTop: '0' }}>{servico.nome}</h3>
                    <p style={{ color: '#999', fontSize: '14px', margin: '5px 0' }}>{servico.descricao}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                      <span style={{ color: '#d4af37', fontWeight: 'bold' }}>¥{servico.preco.toLocaleString('ja-JP')}</span>
                      <button onClick={() => { setDadosAgendamento({ ...dadosAgendamento, servico: servico.nome }); setDiaHorarioSelecionado(null); setAbaAtiva('agendar'); }} style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Agendar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === 'agendar' && (
          <section style={{
            backgroundImage: 'url(/images/interior.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)'
          }}>
            <div style={{
              background: 'rgba(26, 26, 26, 0.35)',
              padding: '30px'
            }}>
              <h2 style={{ color: '#d4af37', marginBottom: '20px' }}>📅 Calendário de Agendamentos</h2>

              <div style={{ maxWidth: '500px', margin: '0 auto 25px' }}>
                <label style={{ color: '#d4af37', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>1. Escolha o serviço desejado:</label>
                <select
                  value={dadosAgendamento.servico}
                  onChange={(e) => { setDadosAgendamento({ ...dadosAgendamento, servico: e.target.value }); setDiaHorarioSelecionado(null); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                >
                  <option value="">Selecione um serviço</option>
                  {servicos.map(s => (<option key={s.id} value={s.nome}>{s.nome} ({s.duracao})</option>))}
                </select>
              </div>

              {!dadosAgendamento.servico ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>👆 Escolha um serviço acima para ver os horários disponíveis.</p>
              ) : (
              <>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1))} style={{ padding: '8px 16px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>← Anterior</button>
                <span style={{ color: '#d4af37', fontWeight: 'bold', minWidth: '200px', textAlign: 'center', fontSize: '18px' }}>
                  {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1))} style={{ padding: '8px 16px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Próximo →</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '30px' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(dia => (
                  <div key={dia} style={{ textAlign: 'center', color: '#d4af37', fontWeight: 'bold', padding: '10px' }}>{dia}</div>
                ))}
                
                {gerarCalendario().map((data, idx) => {
                  if (!data) return <div key={`vazio-${idx}`}></div>;

                  const hoje = new Date();
                  const ehPassado = data < hoje && data.getDate() !== hoje.getDate();
                  
                  return (
                    <div key={data.toISOString()} style={{ border: '2px solid #d4af37', padding: '10px', borderRadius: '6px', background: 'rgba(45, 45, 45, 0.8)', minHeight: '170px', opacity: ehPassado ? 0.5 : 1 }}>
                      <div style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '8px' }}>{data.getDate()}</div>
                      <div style={{ fontSize: '11px' }}>
                        {!ehPassado && profissionaisAptos.map(prof => {
                          const horarios = getHorariosProfissional(prof, data, duracaoSelecionada);
                          return horarios.length > 0 ? (
                            <div key={prof.id} style={{ marginBottom: '8px' }}>
                              <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '10px', marginBottom: '3px' }}>{prof.nome}:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {horarios.map(h => (
                                  <button key={h} onClick={() => handleSelecionarDiaHorario(data, prof, h)} style={{ background: '#4ade80', color: '#1a1a1a', border: 'none', borderRadius: '5px', padding: '6px 9px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', minWidth: '44px', minHeight: '32px' }}>{h}</button>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {diaHorarioSelecionado && (
                <div ref={resumoRef} style={{ background: 'rgba(45, 45, 45, 0.95)', border: '2px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
                  <h3 style={{ color: '#d4af37' }}>📅 Resumo</h3>
                  <p><strong>Data:</strong> {diaHorarioSelecionado.data.toLocaleDateString('pt-BR')}</p>
                  <p><strong>Hora:</strong> {diaHorarioSelecionado.hora}</p>
                  <p><strong>Profissional:</strong> {diaHorarioSelecionado.prof.nome}</p>
                  <p><strong>Serviço:</strong> {dadosAgendamento.servico} {servicoSelecionadoInfo ? `(${servicoSelecionadoInfo.duracao})` : ''}</p>

                  <input type="text" placeholder="Nome" value={dadosAgendamento.nome} onChange={(e) => setDadosAgendamento({...dadosAgendamento, nome: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
                  <input type="email" placeholder="Email" value={dadosAgendamento.email} onChange={(e) => setDadosAgendamento({...dadosAgendamento, email: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
                  <input type="tel" placeholder="Telefone" value={dadosAgendamento.telefone} onChange={(e) => setDadosAgendamento({...dadosAgendamento, telefone: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />

                  {dadosAgendamento.email && dadosAgendamento.email.includes('@') && (
                    <div style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid #d4af37', borderRadius: '4px', padding: '12px', marginBottom: '15px', fontSize: '13px' }}>
                      {carregandoPontos ? (
                        <p style={{ margin: 0, color: '#999' }}>⏳ Consultando seus pontos de fidelidade...</p>
                      ) : (
                        <>
                          <p style={{ margin: '0 0 8px 0', color: '#d4af37' }}>🎁 Você tem <strong>{pontosCliente} pontos</strong> de fidelidade disponíveis.</p>
                          {pontosCliente >= 10 ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#e8e8e8' }}>
                              <input type="checkbox" checked={usarPontos} onChange={(e) => setUsarPontos(e.target.checked)} />
                              Usar 10 pontos agora para ganhar ¥500 de desconto neste agendamento
                            </label>
                          ) : (
                            <p style={{ margin: 0, color: '#999' }}>Faltam {10 - pontosCliente} pontos ({Math.ceil((10 - pontosCliente) / 2)} atendimento{Math.ceil((10 - pontosCliente) / 2) > 1 ? 's' : ''}) para o próximo desconto de ¥500.</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setDiaHorarioSelecionado(null)} style={{ background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleConfirmarAgendamento} disabled={carregando} style={{ flex: 1, background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: carregando ? 'wait' : 'pointer' }}>{carregando ? '⏳' : '✅ Confirmar'}</button>
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          </section>
        )}

        {abaAtiva === 'endereco' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>📍 Localização</h2>
            <div style={{ maxWidth: '600px' }}>
              <h3>Kaizen Barber Shop</h3>
              <p>Aichi-Ken Anjo-Shi<br />Hamatomi-Cho 4-17<br />San City Oomy 302</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <img src="/images/fachada.png" alt="Fachada" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                <img src="/images/interior.png" alt="Interior" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                <img src="/images/detalhes.png" alt="Detalhes" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                <img src="/images/ambiente.png" alt="Ambiente" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
            </div>
          </section>
        )}

        {abaAtiva === 'profissionais' && (
          <section>
            <h2 style={{ color: '#d4af37', marginBottom: '30px' }}>👥 Profissionais</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {profissionais.map((prof) => (
                <div key={prof.id} style={{ border: '1px solid #d4af37', borderRadius: '8px', overflow: 'hidden', background: '#2d2d2d' }}>
                  <img src={prof.imagem} alt={prof.nome} style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover', objectPosition: 'center top' }} />
                  <div style={{ padding: '15px' }}>
                    <h3 style={{ color: '#d4af37' }}>{prof.nome}</h3>
                    <p style={{ color: '#999', fontSize: '14px' }}>{prof.especialidade}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === 'fidelidade' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>🎁 Fidelidade</h2>
            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '600px', marginBottom: '20px' }}>
              <p>✅ 2 pontos por atendimento realizado</p>
              <p>✅ 10 pontos = ¥500 de desconto no próximo agendamento</p>
            </div>

            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '600px' }}>
              <h3 style={{ color: '#d4af37', marginTop: 0 }}>Consultar meu saldo</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder="Seu email cadastrado"
                  value={emailConsultaPontos}
                  onChange={(e) => setEmailConsultaPontos(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                />
                <button
                  onClick={async () => { await buscarPontosCliente(emailConsultaPontos); setConsultaPontosFeita(true); }}
                  disabled={!emailConsultaPontos.includes('@') || carregandoPontos}
                  style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: carregandoPontos ? 'wait' : 'pointer' }}
                >
                  {carregandoPontos ? '⏳' : 'Consultar'}
                </button>
              </div>

              {consultaPontosFeita && !carregandoPontos && (
                <div style={{ marginTop: '20px', color: '#e8e8e8', lineHeight: '1.8' }}>
                  <p>Atendimentos realizados: <strong style={{ color: '#d4af37' }}>{atendimentosRealizados}</strong></p>
                  <p>Pontos já resgatados: <strong style={{ color: '#60a5fa' }}>{pontosJaResgatados}</strong></p>
                  <p style={{ fontSize: '18px' }}>Saldo disponível: <strong style={{ color: '#4ade80' }}>{pontosCliente} pontos</strong></p>
                  {pontosCliente >= 10 ? (
                    <p style={{ color: '#4ade80', fontWeight: 'bold' }}>🎉 Você já pode resgatar ¥500 de desconto no seu próximo agendamento! É só marcar a opção na hora de confirmar o horário.</p>
                  ) : (
                    <p style={{ color: '#999' }}>Faltam {10 - pontosCliente} pontos para o próximo desconto de ¥500.</p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {abaAtiva === 'avaliacoes' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>★ Avaliações</h2>
            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '30px', maxWidth: '600px' }}>
              <h3 style={{ color: '#d4af37' }}>Deixe sua avaliação!</h3>
              <form onSubmit={handleAdicionarAvaliacao}>
                <input type="text" placeholder="Seu nome" value={novaAvaliacao.nome} onChange={(e) => setNovaAvaliacao({...novaAvaliacao, nome: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} required />
                <textarea placeholder="Sua avaliação" value={novaAvaliacao.texto} onChange={(e) => setNovaAvaliacao({...novaAvaliacao, texto: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box', minHeight: '80px' }} required />
                <button type="submit" style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>Enviar</button>
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
        <p>&copy; 2026 Kaizen Barber Shop. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

export default ClientePublico;