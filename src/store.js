/* Kronos — stockage local des événements (localStorage) */
var Store = (function () {
  var KEY = "kronos.data.v1";
  var SEED_VERSION = 4;   /* à incrémenter quand seed.js gagne des entrées */
  /* `themes` : les grands thèmes du Voyage. Chacun retient une sélection de
     catégories et de sous-catégories ; l'ouvrir n'affiche que celles-là. */
  var state = { events: [], categories: [], themes: [], seedVersion: 0 };

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
      /* rang parmi les événements de la même date, quand il y en a plusieurs */
      ord: (function () { var v = num(raw.o !== undefined ? raw.o : raw.ord); return v === null ? 0 : v; })(),
      /* colonne choisie à la main pour une barre de période (0 = tout à
         gauche, contre l'axe). null : la frise la place automatiquement. */
      lane: (function () {
        var v = num(raw.l !== undefined ? raw.l : raw.lane);
        return v === null ? null : Math.max(0, Math.round(v));
      })(),
      /* moment du déplacement : la barre déplacée en dernier l'emporte */
      laneAt: (function () {
        var v = num(raw.la !== undefined ? raw.la : raw.laneAt);
        return v === null ? 0 : v;
      })(),
      /* carte personnelle : identifiant + position du point, en fraction 0-1 */
      mapId: (raw.mi !== undefined ? raw.mi : raw.mapId) || null,
      mapX: num(raw.mx !== undefined ? raw.mx : raw.mapX),
      mapY: num(raw.my !== undefined ? raw.my : raw.mapY),
      cat: raw.c || raw.cat || "perso",
      /* sous-catégorie, forcément fille de `cat` ; null si aucune */
      sub: (raw.sc !== undefined ? raw.sc : raw.sub) || null,
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

  /* Une catégorie supprimée doit sortir des thèmes qui la citaient, sinon
     ils désigneraient un identifiant mort et se videraient sans le dire. */
  function purgeFromThemes(morts) {
    state.themes.forEach(function (t) {
      t.cats = t.cats.filter(function (c) { return !morts[c]; });
    });
  }

  /* Un thème retient une sélection de catégories et de sous-catégories.
     `cats` mélange les deux niveaux : choisir une catégorie mère emporte
     toutes ses filles, choisir une fille seule n'emporte qu'elle. */
  function normalizeTheme(raw) {
    raw = raw || {};
    var cats = [];
    (raw.cats || []).forEach(function (c) {
      c = String(c);
      if (c && cats.indexOf(c) === -1) cats.push(c);
    });
    return {
      id: raw.id || uid(),
      label: String(raw.label || "Sans titre").trim() || "Sans titre",
      color: raw.color || "#58c2a8",
      cats: cats
    };
  }

  function seedData() {
    return {
      categories: window.KRONOS_SEED.categories.slice(),
      events: window.KRONOS_SEED.events.map(normalize),
      themes: [],
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
      state.themes = (parsed.themes || []).map(normalizeTheme);
      state.seedVersion = parsed.seedVersion || 0;
      if (state.seedVersion !== SEED_VERSION) mergeNewSeed();
    } catch (err) {
      state = seedData();
    }
    return state;
  }

  /* Un échec d'enregistrement — stockage plein — était jusqu'ici silencieux :
     l'utilisateur perdait son texte sans le savoir. On le signale désormais. */
  var onSaveError = null;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      if (onSaveError) onSaveError(err);
      return false;
    }
  }

  return {
    load: load,
    save: save,
    onSaveError: function (fn) { onSaveError = fn; },

    /* Poids des données et part de l'espace disponible (environ 5 Mo). */
    usage: function () {
      var n = 0;
      try { n = (localStorage.getItem(KEY) || "").length; } catch (err) { n = 0; }
      return { bytes: n, percent: Math.min(100, n / (5 * 1024 * 1024) * 100) };
    },
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
    /* Événements exactement à la même position dans le temps, dans leur ordre
       d'affichage actuel. */
    sameDay: function (id) {
      var ref = null, i;
      for (i = 0; i < state.events.length; i++) if (state.events[i].id === id) ref = state.events[i];
      if (!ref) return [];
      return state.events
        .filter(function (ev) { return ev.start === ref.start; })
        .sort(function (a, b) { return a.ord - b.ord; });
    },

    /* Décale un événement d'un cran parmi ceux qui partagent sa date.
       Renvoie true si le déplacement a eu lieu. */
    reorder: function (id, delta) {
      var groupe = this.sameDay(id);
      if (groupe.length < 2) return false;
      var i = -1, k;
      for (k = 0; k < groupe.length; k++) if (groupe[k].id === id) i = k;
      var j = i + delta;
      if (i < 0 || j < 0 || j >= groupe.length) return false;
      var tmp = groupe[i]; groupe[i] = groupe[j]; groupe[j] = tmp;
      groupe.forEach(function (ev, n) { ev.ord = n; });
      save();
      return true;
    },

    /* Fixe la colonne d'une barre de période, ou la rend à nouveau
       automatique avec `lane` à null. */
    setLane: function (id, lane) {
      for (var i = 0; i < state.events.length; i++) {
        if (state.events[i].id === id) {
          var pose = (lane === null || lane === undefined);
          state.events[i].lane = pose ? null : Math.max(0, Math.round(lane));
          state.events[i].laneAt = pose ? 0 : Date.now();
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

    /* ---- grands thèmes ---- */
    themes: function () { return state.themes; },
    theme: function (id) {
      for (var i = 0; i < state.themes.length; i++)
        if (state.themes[i].id === id) return state.themes[i];
      return null;
    },
    addTheme: function (label, color, cats) {
      var t = normalizeTheme({ label: label, color: color, cats: cats });
      state.themes.push(t);
      save();
      return t;
    },
    updateTheme: function (id, patch) {
      for (var i = 0; i < state.themes.length; i++) {
        if (state.themes[i].id === id) {
          var t = state.themes[i];
          if (patch.label !== undefined && String(patch.label).trim() !== "")
            t.label = String(patch.label).trim();
          if (patch.color !== undefined) t.color = patch.color;
          if (patch.cats !== undefined) t.cats = normalizeTheme({ cats: patch.cats }).cats;
          save();
          return t;
        }
      }
      return null;
    },
    removeTheme: function (id) {
      var n = state.themes.length;
      state.themes = state.themes.filter(function (t) { return t.id !== id; });
      if (state.themes.length !== n) { save(); return true; }
      return false;
    },

    /* ---- catégories ---- */
    countInCategory: function (id) {
      return state.events.filter(function (ev) { return ev.cat === id; }).length;
    },
    addCategory: function (label, color, parent) {
      var cat = {
        id: catSlug(label || "Nouvelle catégorie"),
        label: String(label || "Nouvelle catégorie").trim() || "Nouvelle catégorie",
        color: color || "#9aa4b5"
      };
      if (parent) cat.parent = parent;
      state.categories.push(cat);
      save();
      return cat;
    },

    /* Catégories de premier niveau, dans l'ordre du fichier. */
    topCategories: function () {
      return state.categories.filter(function (c) { return !c.parent; });
    },

    /* Sous-catégories d'une catégorie donnée. */
    subCategories: function (parentId) {
      return state.categories.filter(function (c) { return c.parent === parentId; });
    },

    /* Nombre d'événements portant cette sous-catégorie. */
    countInSub: function (id) {
      return state.events.filter(function (ev) { return ev.sub === id; }).length;
    },

    /* Rattache un événement à une sous-catégorie (ou la retire avec null). */
    setSub: function (id, sub) {
      for (var i = 0; i < state.events.length; i++) {
        if (state.events[i].id === id) {
          state.events[i].sub = sub || null;
          save();
          return state.events[i];
        }
      }
      return null;
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
      var cible = null, i;
      for (i = 0; i < state.categories.length; i++)
        if (state.categories[i].id === id) cible = state.categories[i];
      if (!cible) return false;

      if (cible.parent) {
        /* sous-catégorie : les événements concernés perdent seulement la
           précision, ils restent dans la catégorie mère */
        state.events.forEach(function (ev) { if (ev.sub === id) ev.sub = null; });
        state.categories = state.categories.filter(function (c) { return c.id !== id; });
        var mortSeul = {}; mortSeul[id] = true;
        purgeFromThemes(mortSeul);
        save();
        return true;
      }

      var meres = state.categories.filter(function (c) { return !c.parent; });
      if (meres.length <= 1) return false;
      var fb = fallbackId;
      if (!fb || fb === id) {
        for (i = 0; i < meres.length; i++)
          if (meres[i].id !== id) { fb = meres[i].id; break; }
      }
      /* la catégorie emporte ses sous-catégories */
      var filles = {};
      state.categories.forEach(function (c) { if (c.parent === id) filles[c.id] = true; });
      state.events.forEach(function (ev) {
        if (ev.cat === id) { ev.cat = fb; ev.sub = null; }
        else if (ev.sub && filles[ev.sub]) ev.sub = null;
      });
      state.categories = state.categories.filter(function (c) {
        return c.id !== id && c.parent !== id;
      });
      var morts = {}; morts[id] = true;
      for (var k in filles) morts[k] = true;
      purgeFromThemes(morts);
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
        themes: state.themes,
        maps: maps || [],
        photos: photos || [],
        events: state.events
      }, null, 2);
    },
    /* Un thème seul, prêt à être envoyé : il emporte ses catégories et tous
       les événements qu'il rassemble, sans quoi il arriverait vide chez le
       destinataire. Les sous-catégories entraînent leur mère, dont les
       événements portent l'identifiant. */
    exportTheme: function (id) {
      var t = null, i;
      for (i = 0; i < state.themes.length; i++)
        if (state.themes[i].id === id) t = state.themes[i];
      if (!t) throw new Error("Thème introuvable.");

      var garde = {};
      t.cats.forEach(function (c) { garde[c] = true; });

      var besoin = {};
      t.cats.forEach(function (c) {
        besoin[c] = true;
        var cat = null;
        for (var j = 0; j < state.categories.length; j++)
          if (state.categories[j].id === c) cat = state.categories[j];
        if (cat && cat.parent) besoin[cat.parent] = true;
      });

      var evts = state.events.filter(function (ev) {
        return garde[ev.cat] || (ev.sub && garde[ev.sub]);
      });
      /* La sous-catégorie d'un événement retenu doit exister à l'arrivée. */
      evts.forEach(function (ev) {
        besoin[ev.cat] = true;
        if (ev.sub) besoin[ev.sub] = true;
      });

      return JSON.stringify({
        format: "kronos-theme-v1",
        exported: new Date().toISOString(),
        themes: [t],
        categories: state.categories.filter(function (c) { return besoin[c.id]; }),
        events: evts
      }, null, 2);
    },

    importJSON: function (text, mode) {
      var parsed = JSON.parse(text);
      var incoming = (parsed.events || []).map(normalize);
      var themesEntrants = (parsed.themes || []).map(normalizeTheme);
      /* Un fichier de thèmes seuls est légitime : c'est ainsi qu'on se passe
         une sélection sans emporter toute la frise. */
      if (!incoming.length && !themesEntrants.length)
        throw new Error("Ni événement ni thème dans ce fichier.");

      var catsAjoutees = 0;
      if (mode === "replace" && incoming.length &&
          parsed.categories && parsed.categories.length) {
        state.categories = parsed.categories;
      } else if (parsed.categories && parsed.categories.length) {
        /* Fusion : on ajoute les catégories que cette frise ne connaît pas,
           sans jamais écraser celles d'ici — le destinataire a pu renommer
           ou recolorer les siennes, et son choix prime sur le fichier. */
        parsed.categories.forEach(function (c) {
          if (!c || !c.id || hasCat(c.id)) return;
          var cat = { id: String(c.id), label: String(c.label || c.id), color: c.color || "#9aa4b5" };
          if (c.parent) cat.parent = String(c.parent);
          state.categories.push(cat);
          catsAjoutees++;
        });
      }

      var doublons = 0;
      if (incoming.length) {
        if (mode === "replace") {
          state.events = incoming;
        } else {
          /* Même titre et même année de début : l'événement est déjà là.
             C'est la règle que Kronos applique déjà à ses propres mises à
             jour, on la garde pour qu'un thème reçu deux fois n'en double
             aucun. */
          var seen = {};
          state.events.forEach(function (ev) { seen[ev.title + "|" + ev.startYear] = true; });
          incoming.forEach(function (ev) {
            if (seen[ev.title + "|" + ev.startYear]) { doublons++; return; }
            state.events.push(ev);
            seen[ev.title + "|" + ev.startYear] = true;
          });
        }
      }

      /* Les catégories du fichier viennent d'être fusionnées : un thème ne
         devrait plus en désigner d'inconnue. Si c'est le cas, elle est
         écartée plutôt que laissée pointer dans le vide. */
      var themesAjoutes = 0, themesVides = 0, catsInconnues = 0;
      if (themesEntrants.length) {
        if (mode === "replace") state.themes = [];
        var connus = {};
        state.themes.forEach(function (t) { connus[t.label.toLowerCase()] = true; });
        themesEntrants.forEach(function (t) {
          var gardees = t.cats.filter(function (c) {
            if (hasCat(c)) return true;
            catsInconnues++;
            return false;
          });
          if (!gardees.length) { themesVides++; return; }
          if (connus[t.label.toLowerCase()]) { themesVides++; return; }
          t.cats = gardees;
          state.themes.push(t);
          connus[t.label.toLowerCase()] = true;
          themesAjoutes++;
        });
      }

      save();
      /* Les cartes éventuelles sont renvoyées à l'appelant, qui les confie
         au module Maps (elles ne vivent pas dans le même stockage). */
      return {
        events: incoming.length - doublons, doublons: doublons,
        maps: parsed.maps || [], photos: parsed.photos || [],
        categories: catsAjoutees,
        themes: themesAjoutes, themesIgnores: themesVides, catsInconnues: catsInconnues
      };
    }
  };
})();
