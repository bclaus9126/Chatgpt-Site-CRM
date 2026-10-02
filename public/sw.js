self.addEventListener('push', event => {
  if (!event.data) return;
  event.waitUntil((async () => {
    const data = event.data.json();
    await self.registration.showNotification(data.title || 'Claus CRM', {
      body: data.body || 'New message received', icon: '/favicon.svg',
      tag: data.tag, data: {url: data.url || '/'},
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing = clients.find(client => client.url.startsWith(self.location.origin));
    if (existing) { await existing.navigate(target); await existing.focus(); }
    else await self.clients.openWindow(target);
  })());
});
