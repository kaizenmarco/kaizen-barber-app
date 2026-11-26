/* eslint-disable no-restricted-globals */
// Service worker mínimo, só pra Web Push — sem nenhum "fetch"/cache aqui de
// propósito. Um bug de cache antigo já causou dor de cabeça neste projeto
// (ver histórico: telas "grudadas" no navegador/iPhone), então este arquivo
// não intercepta nenhuma requisição, só escuta eventos de push.

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }

  const titulo = dados.titulo || 'Kaizen Barber Shop';
  const opcoes = {
    body: dados.corpo || '',
    icon: '/admin-icon-192.png',
    badge: '/admin-icon-192.png',
    tag: dados.tag || undefined,
    data: { url: dados.url || '/admin', agendamentoId: dados.agendamento_id || null },
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // data antigo era só a url (string); o novo traz também o id do
  // agendamento, pra abrir a Agenda direto nele.
  const dados = typeof event.notification.data === 'string'
    ? { url: event.notification.data, agendamentoId: null }
    : (event.notification.data || {});
  const url = dados.url || '/admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        if ('focus' in cliente) {
          // App já aberto: avisa a página qual agendamento mostrar.
          if (dados.agendamentoId) cliente.postMessage({ tipo: 'abrir-agendamento', id: dados.agendamentoId });
          return cliente.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
