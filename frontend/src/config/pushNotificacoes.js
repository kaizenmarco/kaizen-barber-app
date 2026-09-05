import { supabase } from '../supabaseClient';

// ============================================================================
// Notificações push (Web Push) — avisa no celular mesmo com o app fechado.
// Chave pública VAPID: pode ficar aqui no código, é segura de expor (é assim
// que o Web Push funciona). A chave PRIVADA só existe na Edge Function
// enviar-push-agendamento, nunca no frontend.
// ============================================================================
export const VAPID_PUBLIC_KEY = 'BBRk4mn__23_kO2wlnzlmPV2XnWCoBXyAGQ8UW3579FXYOHBI9nqKUN3ogFDX772zqTCrDA09FWGJ4Sq9Nu5nrk';

const urlBase64ParaUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const suportaPush = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Assinatura já ativa neste navegador/dispositivo, ou null se nunca ativou.
export const buscarInscricaoAtual = async () => {
  if (!suportaPush()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
};

// Pede permissão (se ainda não tiver) e salva a inscrição no Supabase,
// vinculada ao usuário logado — é isso que faz a Edge Function conseguir
// mandar push pra esse dispositivo depois.
export const ativarNotificacoesPush = async (userId) => {
  if (!suportaPush()) throw new Error('SEM_SUPORTE');
  if (Notification.permission === 'denied') throw new Error('PERMISSAO_NEGADA');

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('PERMISSAO_NEGADA');

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ParaUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_id: userId,
    },
    { onConflict: 'endpoint' }
  );

  if (error) throw error;
  return subscription;
};

// Cancela só neste dispositivo — outros aparelhos/profissionais continuam
// recebendo normalmente.
export const desativarNotificacoesPush = async () => {
  const subscription = await buscarInscricaoAtual();
  if (!subscription) return;
  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  } finally {
    await subscription.unsubscribe();
  }
};
