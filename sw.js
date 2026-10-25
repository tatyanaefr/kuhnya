// Работа без интернета: игра, картинки, шрифт и озвучка сохраняются в телефоне.
// Страница и фразы берутся из интернета, если он есть, — так правки приходят сами.
const CACHE = "kuhnya-v5";   // после новых картинок или переозвучки — увеличить номер
const FILES = [
  "./", "./index.html", "./фразы.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "./img/артём-повар.png", "./fonts/nunito-cyrillic.woff2", "./fonts/nunito-latin.woff2",
];
const FRESH = ["/", "/index.html", "/фразы.js"];   // их сначала спрашиваем у интернета

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(FILES.map(f => cache.add(f).catch(() => {})));
  // вся озвучка: список фраз лежит в audio/тексты.json
  try {
    const res = await fetch("./audio/тексты.json", { cache: "no-cache" });
    if (res.ok) {
      const keys = Object.keys(await res.json());
      for (let i = 0; i < keys.length; i += 20) {
        await Promise.all(keys.slice(i, i + 20).map(k => cache.add("./audio/" + k + ".mp3").catch(() => {})));
      }
    }
  } catch (e) {}
}

self.addEventListener("install", e => e.waitUntil(precache().then(() => self.skipWaiting())));

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("kuhnya-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const path = decodeURIComponent(new URL(e.request.url).pathname);
  const fresh = e.request.mode === "navigate" || FRESH.some(f => path.endsWith(f));
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const net = () => fetch(e.request).then(res => {
        // сохраняем только целые ответы (200); кусочки файла (206) сохранять нельзя
        if (res && res.status === 200) cache.put(e.request, res.clone()).catch(() => {});
        return res;
      });
      if (fresh) {
        try { return await net(); } catch (err) { return cached || cache.match("./index.html"); }
      }
      if (cached) return cached;
      try { return await net(); } catch (err) { return Response.error(); }
    })
  );
});
