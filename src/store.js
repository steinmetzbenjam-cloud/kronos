/* Kronos — stockage local des événements (localStorage) */
var Store = (function () {
  var KEY = "kronos.data.v1";
  var SEED_VERSION = 4;   /* à incrémenter quand seed.js gagne des entrées */
  var state = { events: [], categories: [], seedVersion: 0 };

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Jours cumulés au 1er de chaque mois (année non bissextile). */
  var CUMDAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  /* Position d'un mois/jour à l'intérieur de l'année, entre 0 et 1.
     Sans jour précisé on vise le milieu du mois. */
  function frac(month, day) {
    if (!month) return 0;
    var m = Math.max(1, Math.min(12, Math.round(month)));
    var d = day ? Math.max(1, Math.min(31, Math.round(day))) : 15;
    return (CUMDAYS[m - 1] + d - 1) / 365;
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function normalize(raw) {
    /* Accepte les deux formes : celle du fichier de départ (t/s/e/c/d)
       et celle enregistrée dans le navigateur (title/start/end/cat/desc). */
    var rs = (raw.s !== undefined) ? raw.s : (raw.startYear !== undefined ? raw.startYear : raw.start);
    var re = (raw.e !== undefined) ? raw.e : (raw.endYear !== undefined ? raw.endYear : raw.end);
    var sMonth = num(raw.sm !== undefined ? raw.sm : raw.startMonth);
    var sDay   = num(raw.sd !== undefined ? raw.sd : raw.startDay);
    var eMonth = num(raw.em !== undefined ? raw.em : raw.endMonth);
    var eDay   = num(raw.ed !== undefined ? raw.ed : raw.endDay);
    var end = (re === null || re === undefined || re === "") ? null : Number(re);
    var start = Number(rs);
    if (isNaN(start)) start = 0;
    if (end !== null && isNaN(end)) end = null;
    start = Math.trunc(start);
    if (end !== null) end = Math.trunc(end);
    if (end !== null && end < start) {
      var t1 = start; start = end; end = t1;
      var t2 = sMonth; sMonth = eMonth; eMonth = t2;
      var t3 = sDay; sDay = eDay; eDay = t3;
    }
    return {
      id: raw.id || uid(),
      title: String(raw.t || raw.title || "Sans titre"),
      /* startYear : l'année entière, telle qu'on la saisit et l'affiche.
         start : la position sur la frise, mois et jour compris. */
      startYear: start,
      endYear: end,
      startMonth: sMonth, startDay: sDay,
      endMonth: end === null ? null : eMonth,
      endDay: end === null ? null : eDay,
      start: start + frac(sMonth, sDay),
      end: end === null ? null : end + frac(eMonth, eDay),
      /* dates incertaines : « environ » coché dans le formulaire */
      approxStart: !!(raw.as !== undefined ? raw.as : raw.approxStart),
      approxEnd: end === null ? false : !!(raw.ae !== undefined ? raw.ae : raw.approxEnd),
      /* carte personnelle : identifiant + position du point, en fraction 0-1 */
      mapId: (raw.mi !== undefined ? raw.mi : raw.mapId) || null,
      mapX: num(raw.mx !== undefined ? raw.mx : raw.mapX),
      mapY: num(raw.my !== undefined ? raw.my : raw.mapY),
      cat: raw.c || raw.cat || "perso",
      desc: String(raw.d || raw.desc || "")
    };
  }

  function hasCat(id) {
    for (var i = 0; i < state.categories.length; i++)
      if (state.categories[i].id === id) return true;
    return false;
  }

  /* Fabrique un identifiant stable et unique à partir du libellé saisi. */
  function catSlug(label) {
    var base = String(label).toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!base) base = "categorie";
    var id = base, n = 2;
    while (hasCat(id)) { id = base + "-" + n; n++; }
    return id;
  }

  function seedData() {
    return {
      categories: window.KRONOS_SEED.categories.slice(),
      events: window.KRONOS_SEED.events.map(normalize),
      seedVersion: SEED_VERSION
    };
  }

  /* Entrées de seed.js remplacées par des données plus précises : retirées
     lors de la migration, sauf si l'utilisateur les a modifiées entre-temps. */
  var SUPERSEDED = [{ title: "Crucifixion de Jésus", year: 30 }];

  /* Catégories fusionnées à la version 4 : la traîne « profane » de la frise
     générique d'origine, et le doublon « Bible » créé par erreur. */
  var REMAP = {
    civilisation: "profane", science: "profane", technique: "profane",
    art: "profane", exploration: "profane", "nouvelle-categorie": "bible"
  };

  function applyRemap() {
    var touches = 0;
    state.events.forEach(function (ev) {
      if (REMAP[ev.cat]) { ev.cat = REMAP[ev.cat]; touches++; }
    });
    /* on ne retire une ancienne catégorie que si plus rien ne l'utilise */
    state.categories = state.categories.filter(function (c) {
      if (!REMAP[c.id]) return true;
      return state.events.some(function (ev) { return ev.cat === c.id; });
    });
    return touches;
  }

  /* Ajoute les nouveautés de seed.js sans toucher aux ajouts personnels. */
  function mergeNewSeed() {
    if (state.seedVersion < 4) applyRemap();
    state.events = state.events.filter(function (ev) {
      for (var i = 0; i < SUPERSEDED.length; i++) {
        if (ev.title === SUPERSEDED[i].title && ev.startYear === SUPERSEDED[i].year &&
            !ev.startMonth) return false;
      }
      return true;
    });
    var known = {};
    state.events.forEach(function (ev) { known[ev.title + "|" + ev.startYear] = true; });
    var addedEvents = 0;
    window.KRONOS_SEED.events.forEach(function (raw) {
      var ev = normalize(raw);
      if (!known[ev.title + "|" + ev.startYear]) {
        state.events.push(ev);
        known[ev.title + "|" + ev.startYear] = true;
        addedEvents++;
      }
    });
    var haveCat = {};
    state.categories.forEach(function (c) { haveCat[c.id] = true; });
    window.KRONOS_SEED.categories.forEach(function (c) {
      if (!haveCat[c.id]) state.categories.push(c);
    });
    state.seedVersion = SEED_VERSION;
    save();
    return addedEvents;
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (err) { raw = null; }
    if (!raw) { state = seedData(); save(); return state; }
    try {
      var parsed = JSON.parse(raw);
      state.categories = (parsed.categories && parsed.categories.length)
        ? parsed.categories : window.KRONOS_SEED.categories.slice();
      state.events = (parsed.events || []).map(normalize);
      state.seedVersion = parsed.seedVersion || 0;
      if (state.seedVersion !== SEED_VERSION) mergeNewSeed();
    } catch (err) {
      state = seedData();
    }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (err) { return false; }
  }

  return {
    load: load,
    save: save,
    all: function () { return state.events; },
    categories: function () { return state.categories; },
    category: function (id) {
      for (var i = 0; i < state.categories.length; i++)
        if (state.categories[i].id === id) return state.categories[i];
      return { id: id, label: id, color: "#9aa4b5" };
    },
    get: function (id) {
      for (var i = 0; i < state.events.length; i++)
        if (state.events[i].id === id) return state.events[i];
      return null;
    },
    add: function (data) {
      var ev = normalize(data);
      state.events.push(ev);
      save();
      return ev;
    },
    update: function (id, data) {
      for (var i = 0; i < state.events.length; i++) {
        if (state.events[i].id === id) {
          data.id = id;
          state.events[i] = normalize(data);
          save();
          return state.events[i];
        }
      }
      return null;
    },
    /* Rattache une carte et son point à un événement, sans toucher au reste. */
    setMap: function (id, mapId, x, y) {
      for (var i = 0; i < state.events.length; i++) {
        if (state.events[i].id === id) {
          state.events[i].mapId = mapId || null;
          state.events[i].mapX = (mapId && x !== null && x !== undefined) ? x : null;
          state.events[i].mapY = (mapId && y !== null && y !== undefined) ? y : null;
          save();
          return state.events[i];
        }
      }
      return null;
    },

    remove: function (id) {
      state.events = state.events.filter(function (ev) { return ev.id !== id; });
      save();
    },

    /* ---- catégories ---- */
    countInCategory: function (id) {
      return state.events.filter(function (ev) { return ev.cat === id; }).length;
    },
    addCategory: function (label, color) {
      var cat = {
        id: catSlug(label || "Nouvelle catégorie"),
        label: String(label || "Nouvelle catégorie").trim() || "Nouvelle catégorie",
        color: color || "#9aa4b5"
      };
      state.categories.push(cat);
      save();
      return cat;
    },
    updateCategory: function (id, label, color) {
      for (var i = 0; i < state.categories.length; i++) {
        if (state.categories[i].id === id) {
          if (label !== undefined && String(label).trim() !== "")
            state.categories[i].label = String(label).trim();
          if (color !== undefined) state.categories[i].color = color;
          save();
          return state.categories[i];
        }
      }
      return null;
    },
    /* Supprime une catégorie et réaffecte ses événements à `fallbackId`. */
    removeCategory: function (id, fallbackId) {
      if (state.categories.length <= 1) return false;
      var fb = fallbackId;
      if (!fb || fb === id) {
        for (var i = 0; i < state.categories.length; i++)
          if (state.categories[i].id !== id) { fb = state.categories[i].id; break; }
      }
      state.events.forEach(function (ev) { if (ev.cat === id) ev.cat = fb; });
      state.categories = state.categories.filter(function (c) { return c.id !== id; });
      save();
      return true;
    },

    reset: function () { state = seedData(); save(); },
    /* `maps` est fourni par l'appelant (module Maps) : le stockage des
       événements et celui des images restent indépendants. */
    exportJSON: function (maps, photos) {
      return JSON.stringify({
        format: "kronos-v1",
        seedVersion: state.seedVersion,
        exported: new Date().toISOString(),
        categories: state.categories,
        maps: maps || [],
        photos: photos || [],
        events: state.events
      }, null, 2);
    },
    importJSON: function (text, mode) {
      var parsed = JSON.parse(text);
      var incoming = (parsed.events || []).map(normalize);
      if (!incoming.length) throw new Error("Aucun événement trouvé dans ce fichier.");
      if (mode === "replace") {
        state.events = incoming;
        if (parsed.categories && parsed.categories.length) state.categories = parsed.categories;
      } else {
        var seen = {};
        state.events.forEach(function (ev) { seen[ev.title + "|" + ev.startYear] = true; });
        incoming.forEach(function (ev) {
          if (!seen[ev.title + "|" + ev.startYear]) state.events.push(ev);
        });
      }
      save();
      /* Les cartes éventuelles sont renvoyées à l'appelant, qui les confie
         au module Maps (elles ne vivent pas dans le même stockage). */
      return { events: incoming.length, maps: parsed.maps || [], photos: parsed.photos || [] };
    }
  };
})();
