import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

// ============================================================================
// Aviso em tempo real no App Admin: toda vez que um agendamento é criado ou
// cancelado (pelo site público OU por qualquer profissional no próprio
// Admin), todo mundo que estiver com o app aberto em algum dispositivo vê um
// toast na hora + ouve um bipe — via Supabase Realtime (postgres_changes),
// sem precisar de servidor extra nem do WhatsApp/Twilio.
//
// Só funciona com o app aberto (aba ativa ou em segundo plano no navegador).
// Pra avisar mesmo com o app fechado, ver o Web Push (config/pushNotificacoes.js
// + botão "Ativar notificações" em MenuMais).
// ============================================================================

const CHAVE_SOM_MUDO = 'kaizen_admin_notificacoes_mudas';
let proximoIdToast = 1;

// Bipe curto de dois tons, sintetizado na hora (Web Audio) — sem precisar de
// nenhum arquivo de áudio. Alguns navegadores só liberam som depois da
// primeira interação da pessoa com a página; como quem usa o Admin já
// navegou entre abas antes de um evento chegar, isso raramente é problema.
function tocarBipe() {
  try {
    const AudioContextClasse = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClasse) return;
    const ctx = new AudioContextClasse();
    const tocarTom = (freq, inicio, duracao) => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      ganho.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao);
      osc.connect(ganho);
      ganho.connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracao + 0.05);
    };
    tocarTom(880, 0, 0.12);
    tocarTom(1175, 0.14, 0.18);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // Web Audio indisponível — só não toca som, sem quebrar o app.
  }
}

function NotificacoesRealtime({ t }) {
  const [toasts, setToasts] = useState([]);
  const [mudo, setMudo] = useState(() => {
    try { return localStorage.getItem(CHAVE_SOM_MUDO) === '1'; } catch { return false; }
  });
  const mudoRef = useRef(mudo);
  useEffect(() => { mudoRef.current = mudo; }, [mudo]);

  useEffect(() => {
    const buscarDetalhes = async (agendamentoId) => {
      const { data } = await supabase
        .from('agendamentos')
        .select('data_hora, clientes(nome), profissionais(nome), servicos(nome)')
        .eq('id', agendamentoId)
        .maybeSingle();
      return data;
    };

    const adicionarToast = (tipo, titulo, corpo) => {
      const id = proximoIdToast++;
      setToasts(prev => [...prev, { id, tipo, titulo, corpo }]);
      if (!mudoRef.current) tocarBipe();
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 8000);
    };

    const canal = supabase
      .channel('admin-notificacoes-agendamentos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agendamentos' }, async (payload) => {
        const d = await buscarDetalhes(payload.new.id);
        if (!d) return;
        const hora = d.data_hora?.split('T')[1]?.substring(0, 5) || '';
        adicionarToast(
          'novo',
          t('notificacoes.novoAgendamento'),
          t('notificacoes.novoAgendamentoCorpo', { cliente: d.clientes?.nome || '—', servico: d.servicos?.nome || '—', profissional: d.profissionais?.nome || '—', hora })
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agendamentos' }, async (payload) => {
        const statusAntes = payload.old?.status;
        const statusDepois = payload.new?.status;
        if (statusAntes === 'CANCELADO' || statusDepois !== 'CANCELADO') return;
        const d = await buscarDetalhes(payload.new.id);
        if (!d) return;
        const hora = d.data_hora?.split('T')[1]?.substring(0, 5) || '';
        adicionarToast(
          'cancelado',
          t('notificacoes.agendamentoCancelado'),
          t('notificacoes.agendamentoCanceladoCorpo', { cliente: d.clientes?.nome || '—', servico: d.servicos?.nome || '—', profissional: d.profissionais?.nome || '—', hora })
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [t]);

  const alternarMudo = () => {
    setMudo(prev => {
      const novo = !prev;
      try { localStorage.setItem(CHAVE_SOM_MUDO, novo ? '1' : '0'); } catch {
        // sem localStorage, só não persiste a preferência entre sessões.
      }
      return novo;
    });
  };

  const fecharToast = (id) => setToasts(prev => prev.filter(x => x.id !== id));

  return (
    <>
      <button
        type="button"
        className="notif-mudo-btn"
        onClick={alternarMudo}
        title={mudo ? t('notificacoes.ativarSom') : t('notificacoes.desativarSom')}
        aria-label={mudo ? t('notificacoes.ativarSom') : t('notificacoes.desativarSom')}
      >
        {mudo ? '🔕' : '🔔'}
      </button>

      {toasts.length > 0 && (
        <div className="notif-toast-stack">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`notif-toast notif-toast-${toast.tipo}`}
              onClick={() => fecharToast(toast.id)}
              role="button"
              tabIndex={0}
            >
              <strong>{toast.tipo === 'novo' ? '📅' : '🚫'} {toast.titulo}</strong>
              <p>{toast.corpo}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default NotificacoesRealtime;
