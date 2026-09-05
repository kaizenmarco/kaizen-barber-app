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
    data: dados.url || '/admin',
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
