self.addEventListener("push", function (event) {
  let data = {};
  try { data = event.data.json(); } catch (e) {}
  const title = "아지트 알림";
  const body = data?.template ? `${data.template}` : "새 알림이 있습니다.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
