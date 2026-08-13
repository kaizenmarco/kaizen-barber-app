import React, { useState, useEffect } from 'react';
import {
  HORARIO_SALAO,
  HORARIO_ALMOCO,
  HORARIO_ESTENDIDO_PADRAO,
  buscarHorarioEstendido,
  salvarHorarioEstendido,
} from '../config/horarios';
import { PROFISSIONAIS, COMISSAO_PADRAO, buscarComissoes, salvarComissao } from '../config/profissionais';
import { DIAS_SEMANA_ADMIN, IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

const INDICE_DIA = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

const ORDEM_DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

function Profissionais({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const diasNomes = DIAS_SEMANA_ADMIN[idioma] || DIAS_SEMANA_ADMIN['pt-BR'];

  const [profissionaisExtras, setProfissionaisExtras] = useState([]);

  const [novoProfissional, setNovoProfissional] = useState({
    nome: '',
    especialidades: '',
    comissao: '40%',
  });

  const [horarioEstendido, setHorarioEstendido] = useState(HORARIO_ESTENDIDO_PADRAO);
  const [carregandoHorario, setCarregandoHorario] = useState(true);
  const [salvandoHorario, setSalvandoHorario] = useState(false);
  const [mensagemHorarioChave, setMensagemHorarioChave] = useState('');

  const [comissoes, setComissoes] = useState({});
  const [comissoesEditadas, setComissoesEditadas] = useState({});
  const [salvandoComissao, setSalvandoComissao] = useState(null);
  const [mensagemComissao, setMensagemComissao] = useState({});

  useEffect(() => {
    (async () => {
      const config = await buscarHorarioEstendido();
      setHorarioEstendido(config);
      setCarregandoHorario(false);
    })();
    (async () => {
      const mapa = await buscarComissoes();
      setComissoes(mapa);
      setComissoesEditadas(mapa);
    })();
  }, []);

  const handleComissaoInputChange = (uuid, valor) => {
    setMensagemComissao({ ...mensagemComissao, [uuid]: '' });
    setComissoesEditadas({ ...comissoesEditadas, [uuid]: valor });
  };

  const handleSalvarComissao = async (uuid) => {
    const valor = parseFloat(comissoesEditadas[uuid]);
    if (isNaN(valor) || valor < 0 || valor > 100) {
      setMensagemComissao({ ...mensagemComissao, [uuid]: t('profissionais.digiteNumeroValido') });
      return;
    }
    setSalvandoComissao(uuid);
    try {
      await salvarComissao(uuid, valor);
      setComissoes({ ...comissoes, [uuid]: valor });
      setMensagemComissao({ ...mensagemComissao, [uuid]: t('profissionais.comissaoSalva') });
    } catch (erro) {
      console.error('Erro ao salvar comissão:', erro);
      setMensagemComissao({ ...mensagemComissao, [uuid]: t('profissionais.erroSalvarComissao') });
    } finally {
      setSalvandoComissao(null);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoProfissional({ ...novoProfissional, [name]: value });
  };

  const handleAdicionarProfissional = (e) => {
    e.preventDefault();
    if (novoProfissional.nome && novoProfissional.especialidades) {
      setProfissionaisExtras([...profissionaisExtras, {
        id: `extra-${profissionaisExtras.length + 1}`,
        ...novoProfissional,
        foto: '/images/logo.jpg'
      }]);
      setNovoProfissional({ nome: '', especialidades: '', comissao: '40%' });
    }
  };

  const handleHorarioEstendidoChange = (campo, valor) => {
    setMensagemHorarioChave('');
    setHorarioEstendido({ ...horarioEstendido, [campo]: valor });
  };

  const handleSalvarHorarioEstendido = async () => {
    if (horarioEstendido.ativo && (!horarioEstendido.dataInicio || !horarioEstendido.dataFim)) {
      setMensagemHorarioChave('profissionais.preencherDatas');
      return;
    }
    setSalvandoHorario(true);
    setMensagemHorarioChave('');
    try {
      await salvarHorarioEstendido(horarioEstendido);
      setMensagemHorarioChave('profissionais.salvo');
    } catch (erro) {
      console.error('Erro ao salvar horário estendido:', erro);
      setMensagemHorarioChave('profissionais.erroSalvarHorario');
    } finally {
      setSalvandoHorario(false);
    }
  };

  return (
    <div className="page-container">
      <h2>{t('nav.profissionais')}</h2>

      <section className="form-section">
        <h3>{t('profissionais.horarioSalao')}</h3>
        <p style={{ fontSize: '13px', color: '#999', marginBottom: '10px' }}>
          {t('profissionais.horarioSalaoDesc')}
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
          <tbody>
            {ORDEM_DIAS.map(dia => {
              const h = HORARIO_SALAO[dia];
              return (
                <tr key={dia} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '6px 8px' }}>{diasNomes[INDICE_DIA[dia]]}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {h.aberto ? `${h.abertura} - ${h.fechamento}` : t('comum.fechado')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: '13px' }}>
          <strong>{t('profissionais.almoco')}</strong> {HORARIO_ALMOCO.inicio} - {HORARIO_ALMOCO.fim} {t('profissionais.almocoTodosDias')}
        </p>
      </section>

      <section className="form-section">
        <h3>{t('profissionais.horarioEstendido')}</h3>
        <p style={{ fontSize: '13px', color: '#999', marginBottom: '12px' }}>
          {t('profissionais.horarioEstendidoDesc')}
        </p>

        {carregandoHorario ? (
          <p style={{ fontSize: '13px', color: '#999' }}>{t('login.carregando')}</p>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={horarioEstendido.ativo}
                onChange={(e) => handleHorarioEstendidoChange('ativo', e.target.checked)}
              />
              <strong>{horarioEstendido.ativo ? t('profissionais.ativado') : t('profissionais.desativado')}</strong>
            </label>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>{t('profissionais.abertura')}</label>
                <input
                  type="time"
                  value={horarioEstendido.abertura || '08:00'}
                  onChange={(e) => handleHorarioEstendidoChange('abertura', e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>{t('profissionais.dataInicio')}</label>
                <input
                  type="date"
                  value={horarioEstendido.dataInicio || ''}
                  onChange={(e) => handleHorarioEstendidoChange('dataInicio', e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>{t('profissionais.dataFim')}</label>
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
              {salvandoHorario ? t('comum.salvando') : t('comum.salvar')}
            </button>

            {mensagemHorarioChave && (
              <p style={{ fontSize: '13px', marginTop: '10px', color: mensagemHorarioChave === 'profissionais.salvo' ? '#4ade80' : '#f87171' }}>
                {t(mensagemHorarioChave)}
              </p>
            )}
          </>
        )}
      </section>

      <section className="form-section">
        <h3>{t('profissionais.novoProfissional')}</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          {t('profissionais.novoProfissionalDesc')}
        </p>
        <form onSubmit={handleAdicionarProfissional}>
          <input
            type="text"
            name="nome"
            placeholder={t('profissionais.nomeProfissional')}
            value={novoProfissional.nome}
            onChange={handleInputChange}
            required
          />
          <input
            type="text"
            name="especialidades"
            placeholder={t('profissionais.especialidadesPlaceholder')}
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
            <option value="40%">40% {t('profissionais.comissao').replace(':', '')}</option>
            <option value="30%">30% {t('profissionais.comissao').replace(':', '')}</option>
            <option value="50%">50% {t('profissionais.comissao').replace(':', '')}</option>
          </select>
          <button type="submit" className="btn-primary">{t('profissionais.adicionarProfissional')}</button>
        </form>
      </section>

      <section className="profissionais-grid">
        {PROFISSIONAIS.map((profissional) => (
          <div key={profissional.uuid} className="profissional-card">
            <img src={profissional.imagem} alt={profissional.nome} className="profissional-foto" />
            <div className="profissional-info">
              <h3>{profissional.nome}</h3>
              <p className="especialidades">{profissional.especialidades}</p>
              <div className="detalhes">
                <p><strong>{t('profissionais.horarioLabel')}</strong> {t('profissionais.segueHorarioSalao')}</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <strong>{t('profissionais.comissao')}</strong>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={comissoesEditadas[profissional.uuid] ?? COMISSAO_PADRAO}
                    onChange={(e) => handleComissaoInputChange(profissional.uuid, e.target.value)}
                    style={{ width: '70px' }}
                  />
                  <span>%</span>
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '8px' }}
                  onClick={() => handleSalvarComissao(profissional.uuid)}
                  disabled={salvandoComissao === profissional.uuid || Number(comissoesEditadas[profissional.uuid]) === Number(comissoes[profissional.uuid] ?? COMISSAO_PADRAO)}
                >
                  {salvandoComissao === profissional.uuid ? t('comum.salvando') : t('profissionais.salvarComissao')}
                </button>
                {mensagemComissao[profissional.uuid] && (
                  <p style={{ fontSize: '12px', marginTop: '6px', color: mensagemComissao[profissional.uuid] === t('profissionais.comissaoSalva') ? '#4ade80' : '#f87171' }}>
                    {mensagemComissao[profissional.uuid]}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {profissionaisExtras.map((profissional) => (
          <div key={profissional.id} className="profissional-card">
            <img src={profissional.foto} alt={profissional.nome} className="profissional-foto" />
            <div className="profissional-info">
              <h3>{profissional.nome}</h3>
              <p className="especialidades">{profissional.especialidades}</p>
              <div className="detalhes">
                <p><strong>{t('profissionais.comissao')}</strong> {profissional.comissao} {t('profissionais.comissaoNaoSalvo')}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default Profissionais;
