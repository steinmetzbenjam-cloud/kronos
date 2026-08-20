/* Kronos — cartes personnelles.
   Les images vivent dans IndexedDB (plusieurs centaines de Mo disponibles),
   pas dans localStorage qui plafonne à quelques Mo. Les événements ne
   retiennent qu'un identifiant de carte et les coordonnées de leur point. */
var Maps = (function () {

  var DBNAME = "kronos-maps", STORE = "maps", MAXSIDE = 2200;
  var db = null, cache = [], ready = false, waiting = [];

  function open(cb) {
    if (db) return cb(null, db);
    if (!window.indexedDB) return cb(new Error("IndexedDB indisponible"));
    var req = indexedDB.open(DBNAME, 1);
    req.onupgradeneeded = function () {
      var d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = function () { db = req.result; cb(null, db); };
    req.onerror = function () { cb(req.error || new Error("ouverture impossible")); };
  }

  function store(mode, cb) {
    open(function (err, d) {
      if (err) return cb(err);
      try { cb(null, d.transaction(STORE, mode).objectStore(STORE)); }
      catch (e) { cb(e); }
    });
  }

  function byName(a, b) { return a.name.localeCompare(b.name, "fr"); }

  function refresh(cb) {
    store("readonly", function (err, st) {
      if (err) { cache = []; ready = true; if (cb) cb(err); return; }
      var req = st.getAll();
      req.onsuccess = function () {
        cache = (req.result || []).sort(byName);
        ready = true;
        waiting.splice(0).forEach(function (f) { f(); });
        if (cb) cb(null, cache);
      };
      req.onerror = function () { cache = []; ready = true; if (cb) cb(req.error); };
    });
  }

  function slug(name) {
    var base = String(name).toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "carte";
    var id = base, n = 2;
    while (get(id)) { id = base + "-" + n; n++; }
    return id;
  }

  function get(id) {
    for (var i = 0; i < cache.length; i++) if (cache[i].id === id) return cache[i];
    return null;
  }

  /* Réduit l'image pour qu'elle reste raisonnable, sans abîmer les traits :
     on garde le PNG quand il est net et léger, sinon JPEG de bonne qualité. */
  function shrink(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight;
      var scale = Math.min(1, MAXSIDE / Math.max(w, h));
      var cw = Math.round(w * scale), ch = Math.round(h * scale);
      var cv = document.createElement("canvas");
      cv.width = cw; cv.height = ch;
      var cx = cv.getContext("2d");
      cx.imageSmoothingQuality = "high";
      cx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      var out;
      if (/png/i.test(file.type)) {
        out = cv.toDataURL("image/png");
        if (out.length > 2600000) out = cv.toDataURL("image/jpeg", 0.9);
      } else {
        out = cv.toDataURL("image/jpeg", 0.9);
      }
      cb(null, { url: out, w: cw, h: ch });
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      cb(new Error("Image illisible"));
    };
    img.src = url;
  }

  function put(rec, cb) {
    store("readwrite", function (err, st) {
      if (err) return cb(err);
      var req = st.put(rec);
      req.onsuccess = function () { refresh(function () { cb(null, rec); }); };
      req.onerror = function () { cb(req.error); };
    });
  }

  return {
    init: function (cb) { refresh(function () { if (cb) cb(); }); },
    whenReady: function (fn) { if (ready) fn(); else waiting.push(fn); },
    list: function () { return cache.slice(); },
    get: get,
    count: function () { return cache.length; },

    add: function (name, file, cb) {
      if (!file) return cb(new Error("Aucun fichier"));
      if (!/^image\//.test(file.type)) return cb(new Error("Ce fichier n'est pas une image"));
      shrink(file, function (err, out) {
        if (err) return cb(err);
        put({
          id: slug(name), name: String(name).trim() || "Carte",
          url: out.url, w: out.w, h: out.h, added: new Date().toISOString()
        }, cb);
      });
    },

    rename: function (id, name) {
      var m = get(id);
      if (!m) return;
      m.name = String(name).trim() || m.name;
      store("readwrite", function (err, st) { if (!err) st.put(m); });
      cache.sort(byName);
    },

    remove: function (id, cb) {
      store("readwrite", function (err, st) {
        if (err) return cb && cb(err);
        var req = st.delete(id);
        req.onsuccess = function () { refresh(function () { if (cb) cb(); }); };
        req.onerror = function () { if (cb) cb(req.error); };
      });
    },

    /* Réinjecte des cartes venues d'un fichier exporté. */
    importAll: function (list, mode, cb) {
      var records = (list || []).filter(function (m) {
        return m && m.id && m.url;
      }).map(function (m) {
        return { id: m.id, name: m.name || m.id, url: m.url,
                 w: m.w || 0, h: m.h || 0, added: m.added || new Date().toISOString() };
      });
      store("readwrite", function (err, st) {
        if (err) return cb(err, 0);
        if (mode === "replace") st.clear();
        var kept = 0;
        records.forEach(function (r) {
          if (mode !== "replace" && get(r.id)) return;   // on ne réécrit pas l'existant
          st.put(r); kept++;
        });
        st.transaction.oncomplete = function () { refresh(function () { cb(null, kept); }); };
        st.transaction.onerror = function () { cb(st.transaction.error, 0); };
      });
    },

    /* Poids total des images, pour information dans le gestionnaire. */
    bytes: function () {
      return cache.reduce(function (n, m) { return n + (m.url ? m.url.length : 0) * 0.75; }, 0);
    }
  };
})();
