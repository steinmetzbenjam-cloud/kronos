/* Kronos — fonctionnement hors ligne.
   Stratégie « réseau d'abord » : tant qu'on a du réseau, on sert toujours la
   dernière version du code. Le cache ne prend le relais que hors ligne.
   Une stratégie « cache d'abord » servait indéfiniment un code périmé. */
var CACHE = "kronos-v27";
var FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./src/style.css", "./src/seed.js", "./src/refs.js", "./src/places.js",
  "./src/maps.js", "./src/photos.js", "./src/store.js", "./src/timeline.js", "./src/ui.js",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      /* hors ligne : on ignore le ?v=… pour retrouver le fichier en cache */
      return caches.match(e.request, { ignoreSearch: true })
        .then(function (hit) { return hit || caches.match("./index.html"); });
    })
  );
});
