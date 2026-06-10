importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB0a8AP88OrZLZdx7CYWLQZQfknkwbj6yw",
  authDomain: "trisphere-4b121.firebaseapp.com",
  projectId: "trisphere-4b121",
  storageBucket: "trisphere-4b121.firebasestorage.app",
  messagingSenderId: "906769842576",
  appId: "1:906769842576:web:0b8c46cba1a6d9e7e7b315"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
