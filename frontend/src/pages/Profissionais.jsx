import React, { useState, useEffect } from 'react';
import {
  HORARIO_SALAO,
  HORARIO_ALMOCO,
  HORARIO_ESTENDIDO_PADRAO,
  buscarHorarioEstendido,
  salvarHorarioEstendido,
} from '../config/horarios';

const NOMES_DIAS = {
  domingo: 'Domingo',
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
};

const ORDEM_DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

function Profissionais({ t }) {
  const [profissionais, setProfissionais] = useState([
    { id: 1, nome: 'Marco Kaizen', especialidades: 'Cortes, Barba', comissao: '40%', foto: '/images/marco.jpg' },
    { id: 2, nome: 'Gabriel Little Kaizen', especialidades: 'Cortes, Permanente', comissao: '40%', foto: '/images/gabriel.jpg' },
    { id: 3, nome: 'Neia', especialidades: 'Corte Feminino, Coloração, Alisamento', comissao: '40%', foto: '/images/neia.jpg' },
  ]);

  const [novoProfissional, setNovoProfissional] = useState({
    nome: '',
    especialidades: '',
    comissao: '40%',
  });

  const [horarioEstendido, setHorarioEstendido] = useState(HORARIO_ESTENDIDO_PADRAO);
  const [carregandoHorario, setCarregandoHorario] = useState(true);
  const [salvandoHorario, setSalvandoHorario] = useState(false);
  const [mensagemHorario, setMensagemHorario] = useState('');

  useEffect(() => {
    (async () => {
      const config = await buscarHorarioEstendido();
      setHorarioEstendido(config);
      setCarregandoHorario(false);
    })();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoProfissional({ ...novoProfissional, [name]: value });
  };

  const handleAdicionarProfissional = (e) => {
    e.preventDefault();
    if (novoProfissional.nome && novoProfissional.especialidades) {
      setProfissionais([...profissionais, {
        id: profissionais.length + 1,
        ...novoProfissional,
        foto: '/images/logo.jpg'
      }]);
      setNovoProfissional({ nome: '', especialidades: '', comissao: '40%' });
    }
  };

  const handleHorarioEstendidoChange = (campo, valor) => {
    setMensagemHorario('');
    setHorarioEstendido({ ...horarioEstendido, [campo]: valor });
  };

  const handleSalvarHorarioEstendido = async () => {
    if (horarioEstendido.ativo && (!horarioEstendido.dataInicio || !horarioEstendido.dataFim)) {
      setMensagemHorario('Preencha a data de início e fim antes de ativar.');
      return;
    }
    setSalvandoHorario(true);
    setMensagemHorario('');
    try {
      await salvarHorarioEstendido(horarioEstendido);
      setMensagemHorario('Salvo! A agenda pública já está usando esse horário.');
    } catch (erro) {
      console.error('Erro ao salvar horário estendido:', erro);
      setMensagemHorario('Não consegui salvar. Confira se a tabela configuracoes_horario existe no Supabase.');
    } finally {
      setSalvandoHorario(false);
    }
  };

  return (
    <div className="page-container">
      <h2>{t('nav.profissionais')}</h2>

      <section className="form-section">
        <h3>🕒 Horário do Salão</h3>
        <p style={{ fontSize: '13px', color: '#999', marginBottom: '10px' }}>
          Todos os profissionais seguem este horário por padrão. Ele é a fonte única usada tanto aqui
          quanto na agenda pública dos clientes.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
          <tbody>
            {ORDEM_DIAS.map(dia => {
              const h = HORARIO_SALAO[dia];
              return (
                <tr key={dia} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '6px 8px' }}>{NOMES_DIAS[dia]}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {h.aberto ? `${h.abertura} - ${h.fechamento}` : 'Fechado'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: '13px' }}>
          <strong>Almoço:</strong> {HORARIO_ALMOCO.inicio} - {HORARIO_ALMOCO.fim} (todos os dias de funcionamento)
        </p>
      </section>

      <section className="form-section">
        <h3>📅 Horário Estendido (feriados)</h3>
        <p style={{ fontSize: '13px', color: '#999', marginBottom: '12px' }}>
          Use em feriados prolongados (ex: Golden Week, Obon, Ano Novo), quando os profissionais — como o
          Gabriel, que já costuma abrir mais cedo durante a semana — atendem a partir de um horário diferente
          do padrão. Enquanto ativo, o horário de abertura abaixo vale para TODOS os profissionais, nas datas
          escolhidas. O fechamento e o almoço não mudam.
        </p>

        {carregandoHorario ? (
          <p style={{ fontSize: '13px', color: '#999' }}>Carregando...</p>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={horarioEstendido.ativo}
                onChange={(e) => handleHorarioEstendidoChange('ativo', e.target.checked)}
              />
              <strong>{horarioEstendido.ativo ? 'Ativado' : 'Desativado'}</strong>
            </label>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>Abertura</label>
                <input
                  type="time"
                  value={horarioEstendido.abertura || '08:00'}
                  onChange={(e) => handleHorarioEstendidoChange('abertura', e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>Data início</label>
                <input
                  type="date"
                  value={horarioEstendido.dataInicio || ''}
                  onChange={(e) => handleHorarioEstendidoChange('dataInicio', e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>Data fim</label>
                <input
                  type="date"
                  value={horarioEstendido.dataFim || ''}
                  onChange={(e) => handleHorarioEstendidoChange('dataFim', e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSalvarHorarioEstendido}
              disabled={salvandoHorario}
            >
              {salvandoHorario ? 'Salvando...' : 'Salvar'}
            </button>

            {mensagemHorario && (
              <p style={{ fontSize: '13px', marginTop: '10px', color: mensagemHorario.startsWith('Salvo') ? '#4ade80' : '#f87171' }}>
                {mensagemHorario}
              </p>
            )}
          </>
        )}
      </section>

      <section className="form-section">
        <h3>Novo Profissional</h3>
        <form onSubmit={handleAdicionarProfissional}>
          <input
            type="text"
            name="nome"
            placeholder="Nome do Profissional"
            value={novoProfissional.nome}
            onChange={handleInputChange}
            required
          />
          <input
            type="text"
            name="especialidades"
            placeholder="Especialidades (ex: Cortes, Barba)"
            value={novoProfissional.especialidades}
            onChange={handleInputChange}
            required
          />
          <select
            name="comissao"
            value={novoProfissional.comissao}
            onChange={handleInputChange}
            required
          >
            <option value="40%">40% Comissão</option>
            <option value="30%">30% Comissão</option>
            <option value="50%">50% Comissão</option>
          </select>
          <button type="submit" className="btn-primary">Adicionar Profissional</button>
        </form>
      </section>

      <section className="profissionais-grid">
        {profissionais.map((profissional) => (
          <div key={profissional.id} className="profissional-card">
            <img src={profissional.foto} alt={profissional.nome} className="profissional-foto" />
            <div className="profissional-info">
              <h3>{profissional.nome}</h3>
              <p className="especialidades">{profissional.especialidades}</p>
              <div className="detalhes">
                <p><strong>Comissão:</strong> {profissional.comissao}</p>
                <p><strong>Horário:</strong> segue o horário do salão (acima)</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default Profissionais;
