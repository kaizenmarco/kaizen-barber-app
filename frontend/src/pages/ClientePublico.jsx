import React, { useState } from 'react';

function ClientePublico() {
  const [abaAtiva, setAbaAtiva] = useState('servicos');
  const [diaEscolhido, setDiaEscolhido] = useState(null);
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
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
    { id: 1, nome: 'Corte', preco: '¥4.000', duracao: '45 min', descricao: 'Corte de cabelo masculino', imagem: '/images/placeholder.jpg', profissionaisIds: [1, 2] },
    { id: 2, nome: 'Corte + Sobrancelhas', preco: '¥4.500', duracao: '45 min', descricao: 'Corte completo com design de sobrancelhas', imagem: '/images/placeholder.jpg', profissionaisIds: [1, 2] },
    { id: 3, nome: 'Corte + Barba', preco: '¥6.500', duracao: '60 min', descricao: 'Corte e modelagem profissional de barba', imagem: '/images/placeholder.jpg', profissionaisIds: [1, 2] },
    { id: 4, nome: 'Coloração', preco: '¥15.000', duracao: '90 min', descricao: 'Coloração profissional com tratamento', imagem: '/images/placeholder.jpg', profissionaisIds: [3] },
    { id: 5, nome: 'Alisamento', preco: '¥15.000', duracao: '90 min', descricao: 'Alisamento e tratamento capilar', imagem: '/images/placeholder.jpg', profissionaisIds: [3] },
    { id: 6, nome: 'Corte Feminino', preco: '¥4.000', duracao: '45 min', descricao: 'Corte moderno feminino', imagem: '/images/placeholder.jpg', profissionaisIds: [3] },
    { id: 7, nome: 'Permanente', preco: '¥6.000', duracao: '60 min', descricao: 'Permanente enrolado profissional', imagem: '/images/placeholder.jpg', profissionaisIds: [1, 2] },
    { id: 8, nome: 'Limpeza de Pele', preco: '¥5.000', duracao: '45 min', descricao: 'Limpeza facial profunda', imagem: '/images/placeholder.jpg', profissionaisIds: [3] },
  ];

  const profissionais = [
    { 
      id: 1, 
      nome: 'Marco Kaizen', 
      especialidade: 'Especialista em Cortes e Barba',
      qualificacoes: ['14 anos de experiência', 'Dono da Kaizen', 'Especialista em Barba'],
      servicos: ['Cortes', 'Barba', 'Coloração'],
      imagem: '/images/marco.png',
      horarios: { segunda: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], terca: [], quarta: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], quinta: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], sexta: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], sabado: ['09:00', '10:00', '14:00', '15:00'], domingo: ['10:00', '11:00', '15:00', '16:00'] }
    },
    { 
      id: 2, 
      nome: 'Gabriel Little Kaizen', 
      especialidade: 'Especialista em Cortes',
      qualificacoes: ['Profissional certificado', 'Especialista em Permanente', 'Técnica moderna'],
      servicos: ['Cortes', 'Permanente', 'Lavagem'],
      imagem: '/images/gabriel.jpg',
      horarios: { segunda: ['10:00', '11:00', '14:00', '15:00'], terca: [], quarta: ['10:00', '11:00', '14:00', '15:00'], quinta: ['10:00', '11:00', '14:00', '15:00'], sexta: ['10:00', '11:00', '14:00', '15:00'], sabado: ['10:00', '14:00'], domingo: ['11:00', '14:00'] }
    },
    { 
      id: 3, 
      nome: 'Neia', 
      especialidade: 'Especialista em Coloração e Estética',
      qualificacoes: ['Coloração avançada', 'Limpeza facial', 'Massagem facial'],
      servicos: ['Coloração', 'Alisamento', 'Estética'],
      imagem: '/images/neia.jpeg',
      horarios: { segunda: ['09:00', '11:00', '15:00', '16:00', '17:00'], terca: [], quarta: ['09:00', '11:00', '15:00', '16:00', '17:00'], quinta: ['09:00', '11:00', '15:00', '16:00', '17:00'], sexta: ['09:00', '11:00', '15:00', '16:00', '17:00'], sabado: ['11:00', '15:00'], domingo: ['09:00', '16:00'] }
    },
  ];

  const horarios = [
    { dia: 'Segunda', key: 'segunda', status: 'aberto' },
    { dia: 'Terça', key: 'terca', status: 'fechado' },
    { dia: 'Quarta', key: 'quarta', status: 'aberto' },
    { dia: 'Quinta', key: 'quinta', status: 'aberto' },
    { dia: 'Sexta', key: 'sexta', status: 'aberto' },
    { dia: 'Sábado', key: 'sabado', status: 'aberto' },
    { dia: 'Domingo', key: 'domingo', status: 'aberto' },
  ];

  const formasPagamento = [
    { id: 1, nome: 'Dinheiro', icon: '💵', descricao: 'Yen em espécie', qrcode: false },
    { id: 2, nome: 'Cartão', icon: '💳', descricao: 'Visa, Mastercard, AmEx', qrcode: true },
    { id: 3, nome: 'PayPay', icon: '📱', descricao: 'Aplicativo PayPay', qrcode: true },
  ];

  const redesSociais = [
    { id: 1, nome: 'Instagram', icon: '📸', url: 'https://instagram.com/marco.kaizen', botao: 'Seguir' },
    { id: 2, nome: 'WhatsApp', icon: '💬', url: 'https://wa.me/81809724251', botao: 'Mensagem' },
    { id: 3, nome: 'TikTok', icon: '🎵', url: 'https://tiktok.com', botao: 'Seguir' },
  ];

  const handleAgendar = (servico) => {
    setServicoSelecionado(servico);
    setAbaAtiva('detalhes');
  };

  const handleAgendarHorario = (profissional, hora) => {
    alert(`✅ Redirecionando para agendar ${servicoSelecionado?.nome} com ${profissional} às ${hora}`);
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
      alert('✅ Avaliação enviada! Use o código AVALIACAOKAIZEN para ganhar 20% OFF');
    }
  };

  const renderizarEstrelas = (num) => {
    return '⭐'.repeat(num);
  };

  const obterHorariosDisponiveis = (dia) => {
    if (dia === 'terca' || !dia) {
      return {};
    }
    
    const horariosDisponiveis = {};
    
    // Se tem um serviço com profissionais específicos, filtra apenas esses
    if (servicoSelecionado && servicoSelecionado.profissionaisIds) {
      profissionais.forEach(prof => {
        if (servicoSelecionado.profissionaisIds.includes(prof.id)) {
          const horarios = prof.horarios[dia] || [];
          if (horarios.length > 0) {
            horariosDisponiveis[prof.id] = {
              nome: prof.nome,
              imagem: prof.imagem,
              horarios: horarios
            };
          }
        }
      });
    } else {
      // Se não tem profissionais específicos, mostra todos
      profissionais.forEach(prof => {
        const horarios = prof.horarios[dia] || [];
        if (horarios.length > 0) {
          horariosDisponiveis[prof.id] = {
            nome: prof.nome,
            imagem: prof.imagem,
            horarios: horarios
          };
        }
      });
    }
    
    return horariosDisponiveis;
  };

  return (
    <div className="cliente-publico-container">
      {/* Header */}
      <header className="cliente-header">
        <div className="cliente-header-content">
          <img src="/images/logo.png" alt="Kaizen" className="cliente-logo" />
          <div className="cliente-header-info">
            <h1>Kaizen Barber Shop</h1>
            <p>Premium Barbershop - Anjo, Aichi</p>
          </div>
        </div>
      </header>

      {/* Abas Horizontais */}
      <nav className="cliente-abas">
        {[
          { id: 'servicos', label: '💈 Serviços', icon: '💈' },
          { id: 'detalhes', label: 'ℹ️ Detalhes', icon: 'ℹ️' },
          { id: 'endereco', label: '📍 Endereço', icon: '📍' },
          { id: 'pagamento', label: '💳 Pagamento', icon: '💳' },
          { id: 'redes', label: '📱 Redes', icon: '📱' },
          { id: 'profissionais', label: '👥 Profissionais', icon: '👥' },
          { id: 'fidelidade', label: '🎁 Fidelidade', icon: '🎁' },
          { id: 'avaliacoes', label: '⭐ Avaliações', icon: '⭐' },
        ].map((aba) => (
          <button 
            key={aba.id}
            className={`aba-btn ${abaAtiva === aba.id ? 'ativa' : ''}`}
            onClick={() => {
              setAbaAtiva(aba.id);
              setDiaEscolhido(null);
            }}
          >
            {aba.label}
          </button>
        ))}
      </nav>

      {/* Conteúdo das Abas */}
      <main className="cliente-conteudo">
        
        {/* SERVIÇOS */}
        {abaAtiva === 'servicos' && (
          <section className="aba-section">
            <h2>💈 Nossos Serviços</h2>
            <div className="servicos-grid">
              {servicos.map((servico) => (
                <div key={servico.id} className="servico-card-uniforme">
                  <div className="servico-imagem">
                    <img src={servico.imagem} alt={servico.nome} />
                  </div>
                  <div className="servico-info-uniforme">
                    <h3>{servico.nome}</h3>
                    <p className="servico-desc">{servico.descricao}</p>
                    <p className="servico-duracao">⏱️ {servico.duracao}</p>
                    <div className="servico-footer">
                      <span className="servico-preco">{servico.preco}</span>
                      <button 
                        className="btn-agendar-uniforme"
                        onClick={() => handleAgendar(servico)}
                      >
                        Agendar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DETALHES */}
        {abaAtiva === 'detalhes' && (
          <section className="aba-section">
            <h2>ℹ️ Horários de Atendimento</h2>
            {servicoSelecionado && (
              <div className="servico-selecionado-info">
                <p>Serviço selecionado: <strong>{servicoSelecionado.nome}</strong> ({servicoSelecionado.preco})</p>
              </div>
            )}
            {!diaEscolhido ? (
              <div className="horarios-grid-uniforme">
                {horarios.map((h) => (
                  <button
                    key={h.key}
                    className={`horario-card-uniforme ${h.status}`}
                    onClick={() => h.status === 'aberto' && setDiaEscolhido(h.key)}
                    style={{ cursor: h.status === 'aberto' ? 'pointer' : 'not-allowed' }}
                  >
                    <h4>{h.dia}</h4>
                    <p className="horario-time">
                      {h.status === 'aberto' ? '🟢 Clique para ver profissionais' : '🔴 Fechado'}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="horarios-profissionais-section">
                <button 
                  className="btn-voltar"
                  onClick={() => setDiaEscolhido(null)}
                >
                  ← Voltar aos dias
                </button>
                <h3>Profissionais Disponíveis - {horarios.find(h => h.key === diaEscolhido)?.dia}</h3>
                <div className="profissionais-horarios-grid">
                  {Object.entries(obterHorariosDisponiveis(diaEscolhido)).length > 0 ? (
                    Object.entries(obterHorariosDisponiveis(diaEscolhido)).map(([profId, profData]) => (
                      <div key={profId} className="prof-horarios-card-uniforme">
                        <img src={profData.imagem} alt={profData.nome} className="prof-horarios-img-uniforme" />
                        <div className="prof-horarios-info">
                          <h4>{profData.nome}</h4>
                          <div className="horarios-opcoes">
                            {profData.horarios.map((hora) => (
                              <button 
                                key={hora} 
                                className="hora-btn"
                                onClick={() => handleAgendarHorario(profData.nome, hora)}
                              >
                                {hora}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="sem-disponibilidade">Sem profissionais disponíveis neste dia</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ENDEREÇO */}
        {abaAtiva === 'endereco' && (
          <section className="aba-section">
            <h2>📍 Nossa Localização</h2>
            <div className="endereco-content-uniforme">
              <div className="endereco-info-uniforme">
                <h3>Kaizen Barber Shop</h3>
                <p><strong>Endereço Completo:</strong><br />
                Aichi-Ken Anjo-Shi<br />
                Hamatomi-Cho 4-17<br />
                San City Oomy 302</p>
                <p><strong>Referência:</strong><br />
                Do outro lado da rua em relação ao McDonald's do Korona World</p>
                <a href="https://www.google.com/maps/search/Anjo+Aichi+Hamatomi+Cho+4-17/@35.01,-136.91,15z" target="_blank" rel="noopener noreferrer" className="btn-mapa-uniforme">
                  🗺️ Ver no Google Maps
                </a>
              </div>
              <div className="endereco-fotos">
                <div className="foto-placeholder">
                  <p>Fachada da Barbearia</p>
                  <p className="pequeno">(Foto em breve)</p>
                </div>
                <div className="foto-placeholder">
                  <p>Interior da Barbearia</p>
                  <p className="pequeno">(Foto em breve)</p>
                </div>
                <div className="foto-placeholder">
                  <p>Ambiente</p>
                  <p className="pequeno">(Foto em breve)</p>
                </div>
                <div className="foto-placeholder">
                  <p>Detalhes</p>
                  <p className="pequeno">(Foto em breve)</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FORMAS DE PAGAMENTO */}
        {abaAtiva === 'pagamento' && (
          <section className="aba-section">
            <h2>💳 Formas de Pagamento</h2>
            <div className="pagamento-grid-uniforme">
              {formasPagamento.map((pag) => (
                <div key={pag.id} className="pagamento-card-uniforme">
                  <div className="pagamento-icon">{pag.icon}</div>
                  <h3>{pag.nome}</h3>
                  <p>{pag.descricao}</p>
                  {pag.qrcode && (
                    <div className="pagamento-qrcode-placeholder">
                      <p>QR Code</p>
                    </div>
                  )}
                  {!pag.qrcode ? (
                    <p className="pagamento-nota">Aceito na barbearia</p>
                  ) : (
                    <button className="btn-pagamento">Usar</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* REDES SOCIAIS */}
        {abaAtiva === 'redes' && (
          <section className="aba-section">
            <h2>📱 Redes Sociais</h2>
            <div className="redes-grid-uniforme">
              {redesSociais.map((rede) => (
                <a 
                  key={rede.id}
                  href={rede.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="rede-card-uniforme"
                >
                  <div className="rede-icon">{rede.icon}</div>
                  <h3>{rede.nome}</h3>
                  <p>
                    {rede.nome === 'WhatsApp' ? '+81 80-9724-2512' : 
                     rede.nome === 'Instagram' ? '@marco.kaizen' :
                     rede.nome === 'TikTok' ? 'Em breve' : ''}
                  </p>
                  <button>{rede.botao}</button>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* PROFISSIONAIS */}
        {abaAtiva === 'profissionais' && (
          <section className="aba-section">
            <h2>👥 Nossos Profissionais</h2>
            <div className="profissionais-lista-uniforme">
              {profissionais.map((prof) => (
                <div key={prof.id} className="prof-card-uniforme">
                  <img src={prof.imagem} alt={prof.nome} className="prof-img-uniforme" />
                  <div className="prof-info-uniforme">
                    <h3>{prof.nome}</h3>
                    <p className="prof-especialidade">{prof.especialidade}</p>
                    <div className="prof-qualificacoes">
                      <strong>Qualificações:</strong>
                      {prof.qualificacoes.map((qual, idx) => (
                        <p key={idx}>✓ {qual}</p>
                      ))}
                    </div>
                    <div className="prof-servicos">
                      <strong>Serviços:</strong>
                      <p>{prof.servicos.join(', ')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FIDELIDADE */}
        {abaAtiva === 'fidelidade' && (
          <section className="aba-section">
            <h2>🎁 Programa de Fidelidade</h2>
            <div className="fidelidade-card-uniforme">
              <h3>Ganhe pontos a cada visita!</h3>
              <div className="fidelidade-beneficios">
                <p>✅ <strong>2 pontos</strong> por cada serviço realizado</p>
                <p>✅ <strong>10 pontos</strong> = <strong>¥500</strong> de desconto</p>
                <p>✅ Válido por <strong>3 meses</strong></p>
                <p>✅ <strong>Intransferível</strong> (pessoal)</p>
              </div>
              <button className="btn-fidelidade-uniforme">Participar do Programa</button>
            </div>
          </section>
        )}

        {/* AVALIAÇÕES */}
        {abaAtiva === 'avaliacoes' && (
          <section className="aba-section">
            <h2>⭐ Avaliações</h2>
            
            <div className="avaliacoes-novo-uniforme">
              <h3>📝 Deixe sua avaliação!</h3>
              <p className="avaliacao-bonus">✨ Ganhe 20% de desconto ao avaliar serviços, profissionais e ambiente</p>
              <form onSubmit={handleAdicionarAvaliacao}>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={novaAvaliacao.nome}
                  onChange={(e) => setNovaAvaliacao({...novaAvaliacao, nome: e.target.value})}
                  required
                />
                <select
                  value={novaAvaliacao.estrelas}
                  onChange={(e) => setNovaAvaliacao({...novaAvaliacao, estrelas: parseInt(e.target.value)})}
                >
                  <option value="1">⭐ 1 estrela</option>
                  <option value="2">⭐⭐ 2 estrelas</option>
                  <option value="3">⭐⭐⭐ 3 estrelas</option>
                  <option value="4">⭐⭐⭐⭐ 4 estrelas</option>
                  <option value="5">⭐⭐⭐⭐⭐ 5 estrelas</option>
                </select>
                <textarea
                  placeholder="Sua avaliação (serviço, profissional, ambiente)"
                  value={novaAvaliacao.texto}
                  onChange={(e) => setNovaAvaliacao({...novaAvaliacao, texto: e.target.value})}
                  required
                ></textarea>
                <button type="submit" className="btn-enviar-avaliacao-uniforme">Enviar Avaliação - Ganhar 20% OFF</button>
              </form>
            </div>

            <div className="avaliacoes-lista-uniforme">
              <h3>Avaliações Recentes</h3>
              {avaliacoes.map((avaliacao) => (
                <div key={avaliacao.id} className="avaliacao-card-uniforme">
                  <div className="avaliacao-top">
                    <h4>{avaliacao.nome}</h4>
                    <span className="estrelas-uniforme">{renderizarEstrelas(avaliacao.estrelas)}</span>
                  </div>
                  <p className="avaliacao-texto-uniforme">{avaliacao.texto}</p>
                  <p className="avaliacao-data-uniforme">{avaliacao.data}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="cliente-footer">
        <p>&copy; 2026 Kaizen Barber Shop. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

export default ClientePublico;