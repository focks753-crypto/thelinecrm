/* 더라인 CRM — FCM 백그라운드 푸시 수신 서비스워커 (앱 닫혀 있을 때 알림) */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDfhwH78E308KWi_rt0Ecz411NF_IC1a8g",
  authDomain: "orangegolfzone.firebaseapp.com",
  projectId: "orangegolfzone",
  storageBucket: "orangegolfzone.firebasestorage.app",
  messagingSenderId: "433401923121",
  appId: "1:433401923121:web:e0488281021380bd037710"
});

const messaging = firebase.messaging();

// 백그라운드(앱 닫힘/비활성)에서 메시지 도착 시 알림 표시
messaging.onBackgroundMessage(function(payload){
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || '더라인 CRM';
  const body = n.body || d.body || '';
  self.registration.showNotification(title, {
    body: body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || 'theline-consult',
    data: d
  });
});

// 알림 클릭 시 앱 열기(이미 열려 있으면 포커스)
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cl){
      for (const c of cl){ if (c.url.includes('/thelinecrm') && 'focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('/thelinecrm/');
    })
  );
});
