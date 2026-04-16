// 🔥 FIREBASE IMPORT
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 🔥 CONFIG
firebase.initializeApp({
  apiKey: "AIzaSyBZsNmumycpTXIshe1JvoEm7DhuQO4PiWw",
  authDomain: "chamconght-3df64.firebaseapp.com",
  projectId: "chamconght-3df64",
  messagingSenderId: "500919029656",
  appId: "1:500919029656:web:8f75866b38b83e096865ed"
});

const messaging = firebase.messaging();

// 🔥 NHẬN THÔNG BÁO KHI APP ĐÓNG
messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon.png"
  });
});

// =======================
// 🔵 PWA CACHE (GIỮ NGUYÊN)
// =======================
const CACHE_NAME = 'ht-attendance-v50';
const ASSETS = [
  'mobile.html',
  'js/mobile.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});