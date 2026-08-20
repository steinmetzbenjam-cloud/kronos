/* Kronos — images attachées aux événements.
   Base IndexedDB distincte de celle des cartes. Seules les métadonnées
   restent en mémoire ; les images sont lues à la demande, pour ne pas
   charger des dizaines de mégaoctets au démarrage. */
var Photos = (function () {

  var DBNAME = "kronos-photos", STORE = "photos", MAXSIDE = 1800;
  var db = null, index = [];

  function open(cb) {
    if (db) return cb(null, db);
    if (!window.indexedDB) return cb(new Error("IndexedDB indisponible"));
    var req = indexedDB.open(DBNAME, 1);
    req.onupgradeneeded = function () {
      var d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        var st = d.createObjectStore(STORE, { keyPath: "id" });
        st.createIndex("eventId", "eventId", { unique: false });
      }
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

  /* Index léger : on parcourt au curseur sans retenir les images. */
  function refresh(cb) {
    store("readonly", function (err, st) {
      if (err) { index = []; return cb && cb(err); }
      var out = [];
      st.openCursor().onsuccess = function (e) {
        var cur = e.target.result;
        if (cur) {
          var v = cur.value;
          out.push({ id: v.id, eventId: v.eventId, w: v.w, h: v.h,
                     bytes: v.url ? v.url.length * 0.75 : 0, added: v.added });
          cur.continue();
        } else {
          index = out;
          if (cb) cb(null, index);
        }
      };
    });
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function shrink(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight;
      var k = Math.min(1, MAXSIDE / Math.max(w, h));
      var cw = Math.round(w * k), ch = Math.round(h * k);
      var cv = document.createElement("canvas");
      cv.width = cw; cv.height = ch;
      var cx = cv.getContext("2d");
      cx.imageSmoothingQuality = "high";
      /* Le JPEG ne connaît pas la transparence : sans ce fond blanc, les
         zones transparentes d'un PNG viendraient en noir. */
      cx.fillStyle = "#ffffff";
      cx.fillRect(0, 0, cw, ch);
      cx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      /* Toujours du JPEG : c'est ce qui pèse le moins, et les captures d'écran
         collées arrivent en PNG, cinq à dix fois plus lourdes. */
      var out = cv.toDataURL("image/jpeg", 0.85);
      if (out.length > 1200000) out = cv.toDataURL("image/jpeg", 0.72);
      cb(null, { url: out, w: cw, h: ch, type: "image/jpeg" });
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(new Error("Image illisible")); };
    img.src = url;
  }

  return {
    init: function (cb) { refresh(cb); },
    countFor: function (eventId) {
      return index.filter(function (p) { return p.eventId === eventId; }).length;
    },
    total: function () { return index.length; },
    bytes: function () { return index.reduce(function (n, p) { return n + p.bytes; }, 0); },

    /* Images complètes d'un événement, dans l'ordre d'ajout. */
    forEvent: function (eventId, cb) {
      store("readonly", function (err, st) {
        if (err) return cb(err, []);
        var out = [];
        var req = st.index("eventId").openCursor(IDBKeyRange.only(eventId));
        req.onsuccess = function (e) {
          var cur = e.target.result;
          if (cur) { out.push(cur.value); cur.continue(); }
          else {
            out.sort(function (a, b) { return String(a.added).localeCompare(String(b.added)); });
            cb(null, out);
          }
        };
        req.onerror = function () { cb(req.error, []); };
      });
    },

    add: function (eventId, file, cb) {
      if (!file || !/^image\//.test(file.type)) return cb(new Error("Ce fichier n'est pas une image"));
      shrink(file, function (err, out) {
        if (err) return cb(err);
        var rec = { id: uid(), eventId: eventId, url: out.url, w: out.w, h: out.h,
                    added: new Date().toISOString() };
        store("readwrite", function (e2, st) {
          if (e2) return cb(e2);
          var r = st.put(rec);
          r.onsuccess = function () { refresh(function () { cb(null, rec); }); };
          r.onerror = function () { cb(r.error); };
        });
      });
    },

    remove: function (id, cb) {
      store("readwrite", function (err, st) {
        if (err) return cb && cb(err);
        var r = st.delete(id);
        r.onsuccess = function () { refresh(function () { if (cb) cb(); }); };
        r.onerror = function () { if (cb) cb(r.error); };
      });
    },

    removeForEvent: function (eventId, cb) {
      Photos.forEvent(eventId, function (err, list) {
        if (err || !list.length) return cb && cb();
        var n = list.length;
        list.forEach(function (p) {
          Photos.remove(p.id, function () { if (--n === 0 && cb) cb(); });
        });
      });
    },

    /* Toutes les images, pour l'export. */
    all: function (cb) {
      store("readonly", function (err, st) {
        if (err) return cb(err, []);
        var req = st.getAll();
        req.onsuccess = function () { cb(null, req.result || []); };
        req.onerror = function () { cb(req.error, []); };
      });
    },

    importAll: function (list, mode, cb) {
      var records = (list || []).filter(function (p) { return p && p.id && p.url && p.eventId; });
      store("readwrite", function (err, st) {
        if (err) return cb(err, 0);
        if (mode === "replace") st.clear();
        records.forEach(function (r) { st.put(r); });
        st.transaction.oncomplete = function () {
          refresh(function () { cb(null, records.length); });
        };
        st.transaction.onerror = function () { cb(st.transaction.error, 0); };
      });
    }
  };
})();
