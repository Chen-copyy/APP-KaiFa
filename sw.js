// 游戏物资波动刷新计时器 - Service Worker
// 提供离线访问 + 自动版本更新 + 通知点击行为

const APP_VERSION = "1.0.0";
const CACHE_NAME = `game-refresh-timer-v${APP_VERSION}`;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./sw.js",
  "./version.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png"
];

// 安装：预缓存关键资源，并立即接管
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存 + 立即接管所有客户端
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 抓取：全部资源统一缓存优先
// 用户主动点"立即更新"之前，绝不偷偷替换版本
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type !== "opaque") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// 消息通道：接收主线程的 "skipWaiting" 指令，立即激活新 SW
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "GET_VERSION") {
    event.source.postMessage({ type: "VERSION", version: APP_VERSION });
  }
});

// 通知点击：聚焦或打开应用
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});
