import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { paraMinutos } from '../../config/horariosTenant';
import { IDIOMA_ADMIN_PADRAO, DIAS_SEMANA_ADMIN, traduzirAdmin } from '../../config/traducoesAdmin';

// Configuração de horário de trabalho POR PROFISSIONAL — cada um define seus
// próprios dias e blocos de horário (ex: seg-sex 09:00-12:00 e 13:00-19:00,
// sáb 08:00-17:00, sem registro nenhum = folga naquele dia). O buraco entre
// dois blocos do mesmo dia já funciona como intervalo de almoço, sem precisar
// de um campo separado — é a mesma tabela e lógica que a Agenda vai usar pra
// calcular horários livres.
//
// Sem nenhum horário cadastrado, o profissional simplesmente não aparece com
// nenhum horário livre na Agenda — por isso essa tela precisa ser preenchida
// antes de a Agenda funcionar de verdade pra cada profissional.

const CHAVES_DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function HorariosProfissionais({ t: tProp, idioma: idiomaProp, empresaId }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const nomesDias = DIAS_SEMANA_ADMIN[idioma] || DIAS_SEMANA_ADMIN['pt-BR'];
  const DIAS = CHAVES_DIAS.map((chave, i) => ({ chave, label: nomesDias[i] }));

  const [profissionais, setProfissionais] = useState([]);
  const [profissionalId, setProfissionalId] = useState('');
  const [horarios, setHorarios] = useState([]); // linhas da tabela horarios_profissional do profissional selecionado
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [novoBloco, setNovoBloco] = useState({ dia: 'segunda', inicio: '09:00', fim: '19:00' });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    buscarProfissionais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profissionalId) buscarHorarios(profissionalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profissionalId]);

  const buscarProfissionais = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data, error } = await supabase
        .from('profissionais')
        .select('id, nome')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true });
      if (error) throw error;
      setProfissionais(data || []);
      if (data && data.length > 0) setProfissionalId(data[0].id);
      else setCarregando(false);
    } catch (e) {
      setErro(`${t('horariosEmpresa.erroCarregarProfissionais')}${e.message}`);
      setCarregando(false);
    }
  };

  const buscarHorarios = async (pid) => {
    setCarregando(true);
    setErro('');
    try {
      const { data, error } = await supabase
        .from('horarios_profissional')
        .select('id, dia_semana, horario_inicio, horario_fim')
        .eq('empresa_id', empresaId)
        .eq('profissional_id', pid)
        .order('dia_semana', { ascending: true });
      if (error) throw error;
      setHorarios(data || []);
    } catch (e) {
      setErro(`${t('horariosEmpresa.erroCarregarHorarios')}${e.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const blocosPorDia = (diaChave) =>
    horarios
      .filter(h => h.dia_semana === diaChave)
      .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));

  const handleAdicionarBloco = async (e) => {
    e.preventDefault();
    if (!profissionalId) {
      setErro(t('horariosEmpresa.erroSelecioneProfissional'));
      return;
    }
    if (paraMinutos(novoBloco.fim) <= paraMinutos(novoBloco.inicio)) {
      setErro(t('horariosEmpresa.erroHorarioFinalAntes'));
      return;
    }
    const conflito = blocosPorDia(novoBloco.dia).some(b => {
      const inicioExistente = paraMinutos(b.horario_inicio.substring(0, 5));
      const fimExistente = paraMinutos(b.horario_fim.substring(0, 5));
      return paraMinutos(novoBloco.inicio) < fimExistente && paraMinutos(novoBloco.fim) > inicioExistente;
    });
    if (conflito) {
      setErro(t('horariosEmpresa.erroConflito'));
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const { error } = await supabase.from('horarios_profissional').insert([{
        profissional_id: profissionalId,
        dia_semana: novoBloco.dia,
        horario_inicio: novoBloco.inicio,
        horario_fim: novoBloco.fim,
      }]);
      if (error) throw error;
      buscarHorarios(profissionalId);
    } catch (e) {
      setErro(`${t('horariosEmpresa.erroAdicionar')}${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleRemoverBloco = async (id) => {
    try {
      const { error } = await supabase.from('horarios_profissional').delete().eq('id', id).eq('empresa_id', empresaId);
      if (error) throw error;
      buscarHorarios(profissionalId);
    } catch (e) {
      setErro(`${t('horariosEmpresa.erroRemover')}${e.message}`);
    }
  };

  if (carregando && profissionais.length === 0) {
    return (
      <div className="page-container">
        <h2>{t('horariosEmpresa.titulo')}</h2>
        <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
      </div>
    );
  }

  if (profissionais.length === 0) {
    return (
      <div className="page-container">
        <h2>{t('horariosEmpresa.titulo')}</h2>
        <p style={{ textAlign: 'center', color: '#999' }}>
          {t('horariosEmpresa.semProfissionais', { aba: t('nav.profissionais') })}
        </p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2>{t('horariosEmpresa.titulo')}</h2>
      <p style={{ fontSize: '12px', color: '#999', marginBottom: '14px' }}>
        {t('horariosEmpresa.desc')}
      </p>

      <section className="form-section">
        <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '6px' }}>
          {t('comum.profissional')}
        </label>
        <select
          value={profissionalId}
          onChange={(e) => setProfissionalId(e.target.value)}
          style={{ marginBottom: '16px' }}
        >
          {profissionais.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>

        <h3>{t('horariosEmpresa.adicionarBlocoTitulo')}</h3>
        <form onSubmit={handleAdicionarBloco}>
          <select
            value={novoBloco.dia}
            onChange={(e) => setNovoBloco({ ...novoBloco, dia: e.target.value })}
          >
            {DIAS.map(d => (
              <option key={d.chave} value={d.chave}>{d.label}</option>
            ))}
          </select>
          <input
            type="time"
            value={novoBloco.inicio}
            onChange={(e) => setNovoBloco({ ...novoBloco, inicio: e.target.value })}
            required
          />
          <input
            type="time"
            value={novoBloco.fim}
            onChange={(e) => setNovoBloco({ ...novoBloco, fim: e.target.value })}
            required
          />
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? t('comum.salvando') : t('horariosEmpresa.adicionarBlocoBtn')}
          </button>
        </form>
        {erro && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '10px' }}>{erro}</p>}
      </section>

      <section className="list-section">
        <h3>{t('horariosEmpresa.semanaAtualTitulo')}</h3>
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DIAS.map(d => {
              const blocos = blocosPorDia(d.chave);
              return (
                <div key={d.chave} style={{ border: '1px solid #404040', borderRadius: '8px', padding: '10px 14px' }}>
                  <strong style={{ color: '#d4af37' }}>{d.label}</strong>
                  {blocos.length === 0 ? (
                    <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>{t('horariosEmpresa.folga')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {blocos.map(b => (
                        <span
                          key={b.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#2d2d2d',
                            border: '1px solid #404040',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '13px',
                          }}
                        >
                          {b.horario_inicio.substring(0, 5)}–{b.horario_fim.substring(0, 5)}
                          <button
                            onClick={() => handleRemoverBloco(b.id)}
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}
                            title={t('horariosEmpresa.removerTooltip')}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default HorariosProfissionais;
