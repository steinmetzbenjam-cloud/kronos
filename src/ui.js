/* Kronos — interface : panneau, formulaire, recherche, import/export */
(function () {
  var VERSION = "4.7";
  var $ = function (id) { return document.getElementById(id); };

  var panel = $("panel"), panelBody = $("panel-body");
  var modal = $("modal"), form = $("form"), formTitle = $("form-title"), formDelete = $("form-delete");
  var searchInput = $("search"), toast = $("toast");
  var catModal = $("catmodal"), catList = $("catlist");
  var mapsModal = $("mapsmodal"), mapsList = $("mapslist");
  var pinModal = $("pinmodal"), pinStage = $("pinstage"), pinImg = $("pinimg");
  var pinDot = $("pindot"), pinNom = $("pin-map");
  var chooseModal = $("choosemap"), chooseList = $("chooselist"), chooseFor = null;
  var pinEventId = null, pinMapId = null, pinX = null, pinY = null;
  var viewModal = $("viewmodal"), viewStage = $("viewstage"), viewWrap = $("viewwrap");
  var viewImg = $("viewimg"), viewDot = $("viewdot");
  var vScale = 1, vX = 0, vY = 0;
  var editingId = null, toastTimer = null, panelMode = null, catSaveTimer = null;

  /* ---------- petits utilitaires ---------- */

  function say(msg) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.add("hidden"); }, 2600);
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function openPanel(html, mode) {
    panelMode = mode || null;
    panelBody.innerHTML = html;
    panel.classList.remove("hidden");
  }
  function closePanel() { panel.classList.add("hidden"); panelMode = null; }
  function escAttr(v) { return esc(v).replace(/"/g, "&quot;"); }

  /* Raccourcit une adresse trop longue pour l'affichage. */
  function urlCourte(u) {
    var clair = u.replace(/&amp;/g, "&");
    if (clair.length <= 46) return esc(clair);
    var m = /^https?:\/\/([^\/]+)(\/.*)?$/.exec(clair);
    if (!m) return esc(clair.slice(0, 44) + "…");
    var reste = m[2] || "";
    if (reste.length > 26) reste = reste.slice(0, 24) + "…";
    return esc(m[1].replace(/^www\./, "") + reste);
  }

  /* Description enrichie : liens, lieux et versets.
     Les liens sont mis de côté avant les autres traitements pour qu'aucune
     adresse ne soit prise pour une référence biblique ou un nom de lieu. */
  function renderDesc(ev) {
    var html = esc(ev.desc);
    var jetons = [];
    function garder(a) { jetons.push(a); return "\u0000" + (jetons.length - 1) + "\u0000"; }

    /* [texte](adresse) */
    html = html.replace(/\[([^\]\n]{1,140})\]\((https?:\/\/[^\s)]+)\)/g,
      function (m, txt, url) {
        return garder('<a class="link" href="' + url + '" target="_blank" rel="noopener">' +
                      txt + "</a>");
      });

    /* adresses écrites telles quelles */
    html = html.replace(/(^|[\s(\n])(https?:\/\/[^\s<>"']+)/g,
      function (m, avant, url) {
        var propre = url.replace(/[.,;:!?)\]]+$/, "");
        var suite = url.slice(propre.length);
        return avant + garder('<a class="link" href="' + propre +
               '" target="_blank" rel="noopener">' + urlCourte(propre) + "</a>") + suite;
      });

    html = Refs.linkify(Places.linkify(html, ev.startYear));
    return html.replace(/\u0000(\d+)\u0000/g, function (m, i) { return jetons[+i]; });
  }

  /* ---------- panneau : détail d'un événement ---------- */

  function showDetail(id) {
    var ev = Store.get(id);
    if (!ev) { closePanel(); return; }
    var cat = Store.category(ev.cat);
    openPanel(
      '<h2>' + esc(ev.title) + '</h2>' +
      '<p class="date">' + esc(Timeline.fmtRange(ev)) + '</p>' +
      ligneDate(ev) +
      '<p><span class="chip' + (Timeline.isCatHidden(ev.cat) ? ' off' : '') +
        '" data-act="togglecat" title="' +
        (Timeline.isCatHidden(ev.cat) ? 'Réafficher cette catégorie sur la frise'
                                      : 'Masquer cette catégorie sur la frise') +
        '"><span class="dot" style="background:' + cat.color + '"></span>' +
        esc(cat.label) + '</span></p>' +
      (ev.desc
        ? '<div class="descbox"><p class="desc">' + renderDesc(ev) + '</p></div>' +
          '<div class="btnrow readmore hidden"><button data-act="read">Tout lire</button></div>'
        : '<p class="stat">Aucune description.</p>') +
      photoSection() +
      mapSection(ev) +
      '<div class="btnrow">' +
        '<button data-act="edit">Modifier</button>' +
        '<button data-act="center">Centrer</button>' +
        '<button data-act="del" class="danger">Supprimer</button>' +
      '</div>',
      "detail"
    );
    loadPhotos(ev.id);
    fitDesc();
    panelBody.onclick = function (e) {
      var sup = e.target.closest ? e.target.closest("[data-delphoto]") : null;
      if (sup) {
        if (confirm("Supprimer cette image ?")) {
          Photos.remove(sup.getAttribute("data-delphoto"), function () {
            loadPhotos(ev.id); say("Image supprimée");
          });
        }
        return;
      }
      var vign = e.target.closest ? e.target.closest("[data-photo]") : null;
      if (vign) {
        var pid = vign.getAttribute("data-photo");
        for (var i = 0; i < photosCache.length; i++) {
          if (photosCache[i].id === pid) {
            openViewer(photosCache[i].url, esc(ev.title), null, null);
            return;
          }
        }
        return;
      }
      var host = e.target.closest ? e.target.closest("[data-act]") : null;
      var act = host ? host.getAttribute("data-act") : null;
      if (act === "edit") openForm(ev);
      if (act === "center") Timeline.focusEvent(ev.id);
      if (act === "pin") openPin(ev.id, ev.mapId);
      if (act === "choosemap") openChoose(ev.id);
      if (act === "addphoto") pickPhotos(ev.id);
      if (act === "read") openRead(ev);
      if (act === "togglecat") {
        var masquee = !Timeline.isCatHidden(ev.cat);
        Timeline.setCatHidden(ev.cat, masquee);
        showDetail(ev.id);
        say(masquee ? 'Catégorie « ' + Store.category(ev.cat).label + ' » masquée'
                    : 'Catégorie « ' + Store.category(ev.cat).label + ' » réaffichée');
      }
      if (act === "monter" || act === "descendre") {
        if (Store.reorder(ev.id, act === "monter" ? -1 : 1)) {
          Timeline.rebuild();
          showDetail(ev.id);
        }
      }
      if (act === "view") openView(ev);
      if (act === "unmap") {
        Store.setMap(ev.id, null);
        showDetail(ev.id);
        say("Carte retirée de cet événement");
      }
      if (act === "del") {
        if (confirm('Supprimer « ' + ev.title + ' » ?')) {
          Photos.removeForEvent(ev.id);
          Store.remove(ev.id);
          Timeline.rebuild(); Timeline.select(null); closePanel();
          say("Événement supprimé");
        }
      }
    };
  }

  /* ---------- panneau : résultats de recherche ---------- */

  function showResults(q) {
    var ref = Refs.parseQuery(q);
    var list, entete;

    if (ref) {
      /* recherche par passage : « 2 R 18 », « Daniel 9 », « Mt 24:14 » */
      list = Store.all().filter(function (ev) {
        return Refs.covers(ev.title + "\n" + ev.desc, ref);
      }).sort(function (a, b) { return a.start - b.start; });
      Timeline.setQuery(q, list.map(function (e) { return e.id; }));
      entete = list.length + ' événement' + (list.length > 1 ? 's' : '') +
               ' citant ' + esc(ref.label);
    } else {
      var qq = q.toLowerCase();
      list = Store.all().filter(function (ev) {
        return (ev.title + " " + ev.desc).toLowerCase().indexOf(qq) >= 0;
      }).sort(function (a, b) { return a.start - b.start; });
      entete = list.length + ' résultat' + (list.length > 1 ? 's' : '');
    }

    if (!list.length) {
      openPanel('<h3>Recherche</h3><p class="stat">Aucun résultat pour « ' + esc(q) + ' ».' +
        (ref ? ' Aucun événement de la frise ne cite ce passage.' : '') + '</p>', "search");
      return;
    }
    var html = '<h3>' + entete + '</h3>';
    list.slice(0, 200).forEach(function (ev) {
      html += '<button class="result" data-id="' + ev.id + '">' + esc(ev.title) +
              '<small>' + esc(Timeline.fmtRange(ev)) + '</small></button>';
    });
    openPanel(html, "search");
    panelBody.onclick = function (e) {
      var btn = e.target.closest ? e.target.closest(".result") : null;
      if (!btn) return;
      Timeline.focusEvent(btn.getAttribute("data-id"));
      showDetail(btn.getAttribute("data-id"));
    };
  }

  /* ---------- panneau : menu (filtres + données) ---------- */

  function showMenu() {
    var evs = Store.all();
    var oldest = evs.reduce(function (m, e) { return e.startYear < m ? e.startYear : m; }, 9999);
    var html = '<h2>Kronos</h2><p class="stat">' + evs.length + ' événements · le plus ancien : ' +
               esc(Timeline.fmtYearLong(oldest)) + '</p>';

    html += '<h3>Catégories</h3><div class="chips">';
    Store.categories().forEach(function (c) {
      var off = Timeline.isCatHidden(c.id) ? " off" : "";
      html += '<span class="chip' + off + '" data-cat="' + c.id + '">' +
              '<span class="dot" style="background:' + c.color + '"></span>' + esc(c.label) + '</span>';
    });
    html += '</div>';
    html += '<p class="stat" style="margin-top:8px">Touche une catégorie pour la masquer sur la frise.</p>' +
            '<div class="btnrow"><button data-act="cats">Gérer les catégories…</button>' +
            '<button data-act="revoir">Tout réafficher</button></div>';

    html += '<h3>Cartes</h3>' +
      '<div class="btnrow"><button data-act="maps">Mes cartes…</button></div>' +
      '<p class="stat" style="margin-top:8px">' + Maps.count() + ' carte' +
      (Maps.count() > 1 ? 's' : '') + ' enregistrée' + (Maps.count() > 1 ? 's' : '') +
      (Maps.count() ? ' · ' + poids(Maps.bytes()) : '') + '.' +
      (Photos.total() ? ' ' + Photos.total() + ' image' + (Photos.total() > 1 ? 's' : '') +
       ' attachée' + (Photos.total() > 1 ? 's' : '') + ' aux événements · ' +
       poids(Photos.bytes()) + '.' : '') + '</p>';

    html += '<h3>Mes données</h3><div class="btnrow">' +
      '<button data-act="export">Exporter (fichier)</button>' +
      '<button data-act="copy">Copier (sans cartes)</button>' +
      '<button data-act="import">Importer</button>' +
      '<button data-act="reset" class="danger">Réinitialiser</button>' +
      '</div>' +
      '<p class="stat" style="margin-top:10px">Version ' + VERSION +
      '. Compare-la sur tes autres appareils : un import qui perd les cartes ' +
      'vient presque toujours d\'un appareil resté sur une version antérieure. ' +
      'Recharge la page pour la mettre à jour.</p>' +
      '<p class="stat">Tes événements sont enregistrés dans ce navigateur. ' +
      'Exporte-les régulièrement (dans ton Dropbox par exemple) pour les retrouver sur tes autres appareils. ' +
      'Le fichier exporté contient aussi tes cartes et les points placés dessus.</p>';

    html += '<h3>Dates incertaines</h3><p class="stat">' +
      'Coche « ≈ environ » sous une année dans le formulaire. Sur la frise, ' +
      'un point creux et un trait en pointillés signalent une date ponctuelle ' +
      'incertaine ; une période dont le début ou la fin est incertain s\'estompe ' +
      'de ce côté au lieu de s\'arrêter net.</p>';

    html += '<h3>Recherche par passage</h3><p class="stat">' +
      'Tape une référence dans la barre de recherche — <code>2 R 18</code>, ' +
      '<code>Daniel 9</code>, <code>Mt 24:14</code> — et la frise ne garde ' +
      'que les événements qui citent ce passage. Les 66 livres sont reconnus, ' +
      'en abrégé comme en toutes lettres.</p>';

    html += '<h3>Commandes</h3><p class="stat">' +
      'Glisser : défiler · Pincer à deux doigts ou ⌘+molette : zoomer · ' +
      'Double-clic sur la frise : ajouter un événement à cette date · ' +
      'Flèches, +, −, Début : navigation clavier.</p>';

    openPanel(html, "menu");

    panelBody.onclick = function (e) {
      var chip = e.target.closest ? e.target.closest(".chip") : null;
      if (chip && chip.getAttribute("data-cat")) {
        var cat = chip.getAttribute("data-cat");
        var hidden = !Timeline.isCatHidden(cat);
        Timeline.setCatHidden(cat, hidden);
        chip.classList.toggle("off", hidden);
        return;
      }
      var act = e.target.getAttribute("data-act");
      if (act === "cats") openCats();
      if (act === "maps") openMaps();
      if (act === "revoir") { Timeline.forgetView(); showMenu(); say("Affichage réinitialisé"); }
      if (act === "export") doExport();
      if (act === "copy") doCopy();
      if (act === "import") doImport();
      if (act === "reset") {
        if (confirm("Réinitialiser Kronos ? Tes ajouts personnels seront perdus.")) {
          Store.reset(); Timeline.rebuild(); Timeline.fitAll(); closePanel();
          say("Frise réinitialisée");
        }
      }
    };
  }

  /* ---------- import / export ---------- */

  function stamp() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function doExport() {
    say("Préparation de l'export…");
    Photos.all(function (err, photos) {
      var maps = Maps.list();
      photos = err ? [] : photos;
      var blob = new Blob([Store.exportJSON(maps, photos)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kronos-" + stamp() + ".json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 6000);
      var bouts = [];
      if (maps.length) bouts.push(maps.length + " carte" + (maps.length > 1 ? "s" : ""));
      if (photos.length) bouts.push(photos.length + " image" + (photos.length > 1 ? "s" : ""));
      say("Fichier exporté — " + poids(blob.size) +
          (bouts.length ? ", " + bouts.join(" et ") + " inclus" : ""));
    });
  }
  /* Le presse-papiers ne reçoit pas les images : plusieurs mégaoctets de
     base64 n'y sont pas manipulables. */
  function doCopy() {
    var text = Store.exportJSON();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { say("Données copiées dans le presse-papiers"); },
        function () { say("Copie impossible"); }
      );
    } else { say("Copie non disponible ici"); }
  }
  function doImport() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var mode = confirm("OK = remplacer toute la frise\nAnnuler = ajouter aux événements existants")
            ? "replace" : "merge";
          var res = Store.importJSON(String(reader.result), mode);
          Timeline.rebuild(); Timeline.fitAll(); closePanel();
          var attendues = {};
          Store.all().forEach(function (ev) { if (ev.mapId) attendues[ev.mapId] = true; });
          var nbAttendues = Object.keys(attendues).length;

          function importerImages(suite) {
            if (!res.photos || !res.photos.length) return suite(0);
            Photos.importAll(res.photos, mode, function (e2, np) { suite(e2 ? 0 : np); });
          }

          if (res.maps && res.maps.length) {
            Maps.importAll(res.maps, mode, function (err, n) {
              if (err) {
                alert("Les événements ont été importés, mais l'enregistrement des " +
                      "cartes a échoué :\n\n" + err +
                      "\n\nL'espace disponible est peut-être insuffisant.");
                return;
              }
              importerImages(function (np) {
                say(res.events + " événements, " + n + " carte" + (n > 1 ? "s" : "") +
                    (np ? " et " + np + " image" + (np > 1 ? "s" : "") : "") + " importés");
              });
            });
          } else if (res.photos && res.photos.length) {
            importerImages(function (np) {
              say(res.events + " événements et " + np + " image" + (np > 1 ? "s" : "") + " importés");
            });
          } else if (nbAttendues) {
            /* Le fichier référence des cartes mais ne contient aucune image :
               il a été exporté par une version de Kronos antérieure à 1.7. */
            alert(res.events + " événements importés, mais ce fichier ne contient " +
                  "aucune image de carte.\n\n" + nbAttendues + " carte" +
                  (nbAttendues > 1 ? "s sont référencées" : " est référencée") +
                  " par tes événements.\n\nRefais l'export depuis l'appareil d'origine " +
                  "après avoir rechargé la page : les versions de Kronos antérieures à " +
                  "1.7 n'incluaient pas les images.");
          } else {
            say(res.events + " événements importés");
          }
        } catch (err) {
          alert("Fichier illisible : " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /* ---------- formulaire ---------- */

  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"];

  function fillMonths() {
    ["startMonth", "endMonth"].forEach(function (name) {
      var sel = form.elements[name];
      if (sel.options.length) return;
      var o = document.createElement("option");
      o.value = ""; o.textContent = "mois";
      sel.appendChild(o);
      MOIS.forEach(function (m, i) {
        var opt = document.createElement("option");
        opt.value = String(i + 1); opt.textContent = m;
        sel.appendChild(opt);
      });
    });
  }

  function fillCategories() {
    var sel = form.elements.cat;
    var previous = sel.value;
    sel.innerHTML = "";
    Store.categories().forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id; o.textContent = c.label;
      sel.appendChild(o);
    });
    if (previous) sel.value = previous;
    if (!sel.value && sel.options.length) sel.selectedIndex = 0;
  }

  /* ---------- éditeur de catégories ---------- */

  var PALETTE = ["#e0605a", "#e08a4a", "#d4a24c", "#8fbf5a", "#58c2a8",
                 "#6f9fe0", "#8f8ae0", "#c08ae0", "#e5a0c4", "#9aa4b5"];

  function freeColor() {
    var used = {};
    Store.categories().forEach(function (c) { used[c.color.toLowerCase()] = true; });
    for (var i = 0; i < PALETTE.length; i++) if (!used[PALETTE[i]]) return PALETTE[i];
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  }

  function renderCats() {
    var cats = Store.categories();
    var html = "";
    cats.forEach(function (c) {
      var n = Store.countInCategory(c.id);
      html += '<div class="catrow">' +
        '<input type="color" value="' + escAttr(c.color) + '" data-id="' + escAttr(c.id) + '" data-f="color">' +
        '<input type="text" value="' + escAttr(c.label) + '" data-id="' + escAttr(c.id) + '" data-f="label" maxlength="40">' +
        '<span class="count" title="' + n + ' événement(s)">' + n + '</span>' +
        (cats.length > 1 ? '<button type="button" class="del" data-id="' + escAttr(c.id) + '" title="Supprimer">✕</button>' : '') +
        '</div>';
    });
    catList.innerHTML = html;
  }

  function openCats() {
    renderCats();
    catModal.classList.remove("hidden");
  }
  function closeCats() {
    catModal.classList.add("hidden");
    fillCategories();
    if (!panel.classList.contains("hidden") && panelMode === "menu") showMenu();
    Timeline.redraw();
  }

  catList.addEventListener("input", function (e) {
    var id = e.target.getAttribute("data-id");
    var field = e.target.getAttribute("data-f");
    if (!id || !field) return;
    clearTimeout(catSaveTimer);
    var value = e.target.value;
    catSaveTimer = setTimeout(function () {
      if (field === "color") Store.updateCategory(id, undefined, value);
      else Store.updateCategory(id, value, undefined);
      Timeline.redraw();
    }, 140);
  });

  catList.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".del") : null;
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var cat = Store.category(id);
    var n = Store.countInCategory(id);
    var others = Store.categories().filter(function (c) { return c.id !== id; });
    var msg = 'Supprimer la catégorie « ' + cat.label + ' » ?';
    if (n > 0) msg += '\n\nSes ' + n + ' événement(s) passeront dans « ' + others[0].label + ' ».';
    if (!confirm(msg)) return;
    Store.removeCategory(id, others[0].id);
    renderCats();
    Timeline.rebuild();
  });

  $("cat-add").addEventListener("click", function () {
    var c = Store.addCategory("Nouvelle catégorie", freeColor());
    renderCats();
    var input = catList.querySelector('input[type="text"][data-id="' + c.id + '"]');
    if (input) { input.focus(); input.select(); }
  });
  $("cat-close").addEventListener("click", closeCats);
  $("form-cats").addEventListener("click", openCats);
  catModal.addEventListener("click", function (e) { if (e.target === catModal) closeCats(); });

  function openForm(ev, presetYear) {
    fillCategories();
    fillMonths();
    editingId = ev ? ev.id : null;
    formTitle.textContent = ev ? "Modifier l'événement" : "Nouvel événement";
    form.elements.title.value = ev ? ev.title : "";
    form.elements.start.value = ev ? ev.startYear : (presetYear !== undefined ? presetYear : Timeline.yearAtCenter());
    form.elements.end.value = (ev && ev.endYear !== null && ev.endYear !== undefined) ? ev.endYear : "";
    form.elements.startMonth.value = ev && ev.startMonth ? String(ev.startMonth) : "";
    form.elements.startDay.value = ev && ev.startDay ? String(ev.startDay) : "";
    form.elements.endMonth.value = ev && ev.endMonth ? String(ev.endMonth) : "";
    form.elements.endDay.value = ev && ev.endDay ? String(ev.endDay) : "";
    form.elements.approxStart.checked = ev ? !!ev.approxStart : false;
    form.elements.approxEnd.checked = ev ? !!ev.approxEnd : false;
    form.elements.cat.value = ev ? ev.cat : "perso";
    form.elements.desc.value = ev ? ev.desc : "";
    formDelete.classList.toggle("hidden", !ev);
    modal.classList.remove("hidden");
    setTimeout(function () { form.elements.title.focus(); }, 40);
  }
  function closeForm() { modal.classList.add("hidden"); editingId = null; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {
      t: form.elements.title.value.trim(),
      s: parseInt(form.elements.start.value, 10),
      e: form.elements.end.value === "" ? null : parseInt(form.elements.end.value, 10),
      sm: form.elements.startMonth.value || null,
      sd: form.elements.startDay.value || null,
      em: form.elements.endMonth.value || null,
      ed: form.elements.endDay.value || null,
      as: form.elements.approxStart.checked ? 1 : 0,
      ae: form.elements.approxEnd.checked ? 1 : 0,
      c: form.elements.cat.value,
      d: form.elements.desc.value.trim()
    };
    if (!data.t) { say("Il faut un titre"); return; }
    if (isNaN(data.s)) { say("Année de début invalide"); return; }
    var prev = editingId ? Store.get(editingId) : null;
    if (prev) { data.mi = prev.mapId; data.mx = prev.mapX; data.my = prev.mapY; }
    var saved = editingId ? Store.update(editingId, data) : Store.add(data);
    closeForm();
    Timeline.rebuild();
    Timeline.focusEvent(saved.id);
    showDetail(saved.id);
    say(editingId ? "Modifié" : "Ajouté à la frise");
  });

  formDelete.addEventListener("click", function () {
    if (!editingId) return;
    if (confirm("Supprimer cet événement ?")) {
      Store.remove(editingId);
      closeForm(); Timeline.rebuild(); Timeline.select(null); closePanel();
      say("Événement supprimé");
    }
  });
  $("form-cancel").addEventListener("click", closeForm);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeForm(); });

  /* ---------- ordre entre événements de même date ---------- */

  /* Flèches de position, seulement si d'autres événements partagent la date. */
  function ordreFleches(ev) {
    var groupe = Store.sameDay(ev.id);
    if (groupe.length < 2) return "";
    var rang = 0;
    for (var i = 0; i < groupe.length; i++) if (groupe[i].id === ev.id) rang = i + 1;
    return '<span class="ordre">' +
      '<button type="button" data-act="monter"' + (rang === 1 ? ' disabled' : '') +
      ' title="Placer plus haut dans la journée">↑</button>' +
      '<button type="button" data-act="descendre"' + (rang === groupe.length ? ' disabled' : '') +
      ' title="Placer plus bas dans la journée">↓</button></span>';
  }

  /* Ligne compacte sous la date : mention « environ » et flèches de position. */
  function ligneDate(ev) {
    var mention = (ev.approxStart || ev.approxEnd)
      ? '<span class="stat">≈ date approximative</span>' : '<span></span>';
    var fleches = ordreFleches(ev);
    if (mention === '<span></span>' && !fleches) return "";
    return '<div class="datemeta">' + mention + fleches + '</div>';
  }

  /* ---------- description : hauteur bornée, lecture intégrale ---------- */

  var readModal = $("readmodal"), readBody = $("readbody");

  /* Le bouton « Tout lire » n'apparaît que si le texte dépasse le cadre. */
  function fitDesc() {
    var box = panelBody.querySelector(".descbox");
    var btn = panelBody.querySelector(".readmore");
    if (!box || !btn) return;
    var deborde = box.scrollHeight > box.clientHeight + 4;
    box.classList.toggle("overflowing", deborde);
    btn.classList.toggle("hidden", !deborde);
  }

  function openRead(ev) {
    $("read-title").innerHTML = esc(ev.title) + "<small>" + esc(Timeline.fmtRange(ev)) + "</small>";
    readBody.innerHTML = renderDesc(ev);
    readBody.scrollTop = 0;
    readModal.classList.remove("hidden");
  }
  function closeRead() { readModal.classList.add("hidden"); }
  $("read-close").addEventListener("click", closeRead);

  /* ---------- images de l'événement ---------- */

  var photosFor = null, photosCache = [];

  function photoSection() {
    return '<h3>Images</h3>' +
      '<div class="photos" id="photos"><span class="stat">…</span></div>' +
      '<div class="btnrow"><button data-act="addphoto">Ajouter une image…</button></div>' +
      '<p class="stat">Ou colle une image (⌘V) pendant que cette fiche est ouverte.</p>';
  }

  function loadPhotos(eventId) {
    photosFor = eventId;
    Photos.forEvent(eventId, function (err, list) {
      if (photosFor !== eventId) return;      /* la fiche a changé entre-temps */
      var box = $("photos");
      if (!box) return;
      photosCache = err ? [] : list;
      if (!photosCache.length) {
        box.innerHTML = '<span class="stat">Aucune image.</span>';
        return;
      }
      box.innerHTML = photosCache.map(function (p) {
        return '<span class="photo" data-photo="' + p.id + '">' +
               '<img src="' + p.url + '" alt="">' +
               '<button type="button" class="del" data-delphoto="' + p.id + '">✕</button></span>';
      }).join("");
    });
  }

  function addPhotos(eventId, files) {
    var reste = files.length, ajoutees = 0;
    say(files.length > 1 ? "Ajout de " + files.length + " images…" : "Ajout de l'image…");
    files.forEach(function (f) {
      Photos.add(eventId, f, function (err) {
        if (!err) ajoutees++;
        if (--reste === 0) {
          loadPhotos(eventId);
          say(ajoutees ? (ajoutees > 1 ? ajoutees + " images ajoutées" : "Image ajoutée")
                       : "Aucune image ajoutée");
        }
      });
    });
  }

  function pickPhotos(eventId) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = function () {
      var files = [].slice.call(input.files || []);
      if (files.length) addPhotos(eventId, files);
    };
    input.click();
  }

  /* Coller une image pendant qu'une fiche est ouverte. */
  document.addEventListener("paste", function (e) {
    if (panelMode !== "detail") return;
    if (!modal.classList.contains("hidden") || !pinModal.classList.contains("hidden")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    var id = Timeline.selected();
    if (!id) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
        var f = items[i].getAsFile();
        if (f) files.push(f);
      }
    }
    if (!files.length) return;
    e.preventDefault();
    addPhotos(id, files);
  });

  /* ---------- cartes ---------- */

  function mapSection(ev) {
    var m = ev.mapId ? Maps.get(ev.mapId) : null;
    if (!m) {
      return '<h3>Carte</h3><div class="btnrow">' +
             '<button data-act="choosemap">' +
             (Maps.count() ? 'Ajouter une carte' : 'Charger une carte…') +
             '</button></div>';
    }
    var hasDot = (ev.mapX !== null && ev.mapX !== undefined);
    var dot = hasDot
      ? '<span class="dot" style="left:' + (ev.mapX * 100).toFixed(2) + '%;top:' +
        (ev.mapY * 100).toFixed(2) + '%"></span>'
      : '<span class="nodot">Aucun point placé — utilise le bouton ci-dessous</span>';
    /* La vignette ouvre la carte en plein écran ; le point ne se déplace
       que par le bouton « Déplacer le point ». */
    return '<h3>Carte</h3>' +
      '<span class="mapthumb" data-act="view" title="Afficher en plein écran">' +
      '<img src="' + m.url + '" alt="' + escAttr(m.name) + '">' + dot + '</span>' +
      '<p class="stat">' + esc(m.name) + '</p>' +
      '<div class="btnrow"><button data-act="pin">' +
      (hasDot ? 'Déplacer le point' : 'Placer le point') + '</button>' +
      '<button data-act="choosemap">Changer de carte</button>' +
      '<button data-act="unmap">Retirer la carte</button></div>';
  }

  function poids(n) {
    if (n < 1024) return Math.round(n) + " o";
    if (n < 1048576) return Math.round(n / 1024) + " Ko";
    return (n / 1048576).toFixed(1) + " Mo";
  }

  function renderMaps() {
    var list = Maps.list();
    if (!list.length) {
      mapsList.innerHTML = '<p class="stat">Aucune carte pour l\'instant.</p>';
      return;
    }
    var html = "";
    list.forEach(function (m) {
      var used = Store.all().filter(function (e) { return e.mapId === m.id; }).length;
      html += '<div class="maprow">' +
        '<span class="vignette" data-viewmap="' + escAttr(m.id) +
        '" title="Afficher en plein écran"><img src="' + m.url + '" alt=""></span>' +
        '<span class="grow">' +
          '<input type="text" value="' + escAttr(m.name) + '" data-id="' + escAttr(m.id) + '" maxlength="60">' +
          '<span class="meta">' + m.w + ' × ' + m.h + ' px · ' + poids(m.url.length * 0.75) + ' · ' +
          (used ? used + ' événement' + (used > 1 ? 's' : '') : 'aucun événement') + '</span>' +
        '</span>' +
        '<button type="button" class="del" data-id="' + escAttr(m.id) + '" title="Supprimer">✕</button>' +
        '</div>';
    });
    mapsList.innerHTML = html;
  }

  function openMaps() { renderMaps(); mapsModal.classList.remove("hidden"); }
  function closeMaps() {
    mapsModal.classList.add("hidden");
    if (!panel.classList.contains("hidden")) {
      if (panelMode === "menu") showMenu();
      else if (panelMode === "detail" && Timeline.selected()) showDetail(Timeline.selected());
    }
  }

  $("maps-add").addEventListener("click", function () {
    var name = prompt("Nom de la carte :", "");
    if (name === null) return;
    name = name.trim();
    if (!name) { say("Il faut un nom"); return; }
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      say("Chargement de l'image…");
      Maps.add(name, f, function (err, rec) {
        if (err) { alert("Impossible de charger cette carte : " + err.message); return; }
        renderMaps();
        say('Carte « ' + rec.name + ' » ajoutée');
      });
    };
    input.click();
  });

  mapsList.addEventListener("input", function (e) {
    if (e.target.tagName !== "INPUT") return;
    Maps.rename(e.target.getAttribute("data-id"), e.target.value);
  });

  mapsList.addEventListener("click", function (e) {
    /* La vignette ouvre la carte en grand, sans quitter le gestionnaire. */
    var vue = e.target.closest ? e.target.closest("[data-viewmap]") : null;
    if (vue) {
      var id = vue.getAttribute("data-viewmap");
      var toutes = Maps.list();
      var depart = 0;
      var items = toutes.map(function (m, i) {
        if (m.id === id) depart = i;
        return { url: m.url, title: m.name, x: null, y: null };
      });
      openViewerList(items, depart);
      return;
    }
    var b = e.target.closest ? e.target.closest(".del") : null;
    if (!b) return;
    var id = b.getAttribute("data-id"), m = Maps.get(id);
    if (!m) return;
    var used = Store.all().filter(function (ev) { return ev.mapId === id; });
    var msg = 'Supprimer la carte « ' + m.name + ' » ?';
    if (used.length) msg += "\n\n" + used.length + " événement" + (used.length > 1 ? "s" : "") +
                            " perdra" + (used.length > 1 ? "ont" : "") + " son point.";
    if (!confirm(msg)) return;
    used.forEach(function (ev) { Store.setMap(ev.id, null); });
    Maps.remove(id, function () { renderMaps(); say("Carte supprimée"); });
  });

  $("maps-close").addEventListener("click", closeMaps);
  mapsModal.addEventListener("click", function (e) { if (e.target === mapsModal) closeMaps(); });

  /* ---------- carte en plein écran ---------- */

  function applyView() {
    viewWrap.style.transform = "translate(" + vX + "px," + vY + "px) scale(" + vScale + ")";
  }

  /* Ajuste l'image au cadre : on fixe ses dimensions en pixels, ce qui rend
     la position du point et les calculs de zoom exacts. */
  function fitView() {
    var st = viewStage.getBoundingClientRect();
    var iw = viewImg.naturalWidth, ih = viewImg.naturalHeight;
    if (!iw || !ih || !st.width || !st.height) return;
    var k = Math.min(st.width / iw, st.height / ih);
    var w = Math.floor(iw * k), h = Math.floor(ih * k);
    viewWrap.style.width = w + "px";
    viewWrap.style.height = h + "px";
    viewImg.style.width = w + "px";
    viewImg.style.height = h + "px";
  }

  /* Empêche l'image de laisser du vide dans le cadre quand elle est zoomée. */
  function clampView() {
    if (vScale <= 1.001) { vScale = 1; vX = vY = 0; return; }
    var st = viewStage.getBoundingClientRect();
    var w = viewWrap.offsetWidth, h = viewWrap.offsetHeight;
    var baseX = (st.width - w) / 2, baseY = (st.height - h) / 2;
    var sw = w * vScale, sh = h * vScale;
    if (sw <= st.width) vX = (st.width - sw) / 2 - baseX;
    else vX = Math.max(st.width - sw - baseX, Math.min(-baseX, vX));
    if (sh <= st.height) vY = (st.height - sh) / 2 - baseY;
    else vY = Math.max(st.height - sh - baseY, Math.min(-baseY, vY));
  }

  /* Zoome en gardant sous le doigt (ou le curseur) le même point de la carte. */
  function zoomView(cx, cy, factor) {
    var r = viewWrap.getBoundingClientRect();
    var before = vScale;
    vScale = Math.max(1, Math.min(8, vScale * factor));
    var k = vScale / before;
    if (k === 1) return;
    vX += (cx - r.left) * (1 - k);
    vY += (cy - r.top) * (1 - k);
    clampView();
    applyView();
  }

  function resetView() { fitView(); vScale = 1; vX = vY = 0; applyView(); }

  /* La visionneuse travaille sur une liste : une seule image le plus souvent,
     plusieurs quand on parcourt les cartes du gestionnaire. */
  var viewList = [], viewIndex = 0, viewPickFor = null;

  function showViewItem() {
    var it = viewList[viewIndex];
    if (!it) return;
    $("view-title").textContent = String(it.title).replace(/&[a-z]+;/g, " ");
    var multi = viewList.length > 1;
    $("view-count").textContent = multi ? (viewIndex + 1) + " / " + viewList.length : "";
    $("view-prev").classList.toggle("hidden", !multi);
    $("view-next").classList.toggle("hidden", !multi);
    $("view-pick").classList.toggle("hidden", !(viewPickFor && it.id));
    viewImg.src = it.url;
    if (it.x !== null && it.x !== undefined) {
      viewDot.style.left = (it.x * 100).toFixed(3) + "%";
      viewDot.style.top = (it.y * 100).toFixed(3) + "%";
      viewDot.classList.remove("hidden");
    } else {
      viewDot.classList.add("hidden");
    }
    vScale = 1; vX = vY = 0;
    applyView();
    if (viewImg.complete && viewImg.naturalWidth) resetView();
  }

  function viewStep(d) {
    if (viewList.length < 2) return;
    viewIndex = (viewIndex + d + viewList.length) % viewList.length;
    showViewItem();
  }

  /* Sert aussi bien aux cartes (avec point) qu'aux images (sans point). */
  function openViewer(url, titre, x, y) {
    viewList = [{ url: url, title: titre, x: x, y: y }];
    viewIndex = 0;
    showViewItem();
    viewModal.classList.remove("hidden");
  }

  /* Ouvre une série parcourable, positionnée sur l'élément demandé. */
  function openViewerList(items, index) {
    if (!items.length) return;
    viewList = items;
    viewIndex = Math.max(0, Math.min(items.length - 1, index || 0));
    showViewItem();
    viewModal.classList.remove("hidden");
  }

  $("view-pick").addEventListener("click", function () {
    var it = viewList[viewIndex];
    if (!viewPickFor || !it || !it.id) return;
    var ev = viewPickFor;
    viewPickFor = null;
    closeView();
    closeChoose();
    openPin(ev, it.id);
  });
  $("view-prev").addEventListener("click", function () { viewStep(-1); });
  $("view-next").addEventListener("click", function () { viewStep(1); });

  function openView(ev) {
    var m = ev.mapId ? Maps.get(ev.mapId) : null;
    if (!m) return;
    openViewer(m.url, m.name, ev.mapX, ev.mapY);
  }
  function closeView() {
    viewModal.classList.add("hidden");
    viewImg.src = "";
    viewPickFor = null;
    $("view-pick").classList.add("hidden");
  }

  viewImg.addEventListener("load", resetView);
  $("view-close").addEventListener("click", closeView);
  $("view-reset").addEventListener("click", resetView);

  viewStage.addEventListener("wheel", function (e) {
    e.preventDefault();
    zoomView(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0022));
  }, { passive: false });

  viewStage.addEventListener("dblclick", function (e) {
    if (surFleche(e)) return;
    zoomView(e.clientX, e.clientY, vScale > 1.5 ? 1 / vScale : 2.5);
  });

  var vPointers = {}, vCount = 0, vLast = null, vPinch = 0, vMid = null;
  /* Les flèches sont dans le cadre : sans cette garde, la capture du pointeur
     destinée au déplacement leur volerait le clic. */
  function surFleche(e) { return !!(e.target.closest && e.target.closest(".viewnav")); }

  viewStage.addEventListener("pointerdown", function (e) {
    if (surFleche(e)) return;
    viewStage.setPointerCapture(e.pointerId);
    vPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    vCount++;
    if (vCount === 1) { vLast = { x: e.clientX, y: e.clientY }; viewStage.classList.add("dragging"); }
    else if (vCount === 2) {
      var k = Object.keys(vPointers), a = vPointers[k[0]], b = vPointers[k[1]];
      vPinch = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      vMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  });
  viewStage.addEventListener("pointermove", function (e) {
    if (!vPointers[e.pointerId]) return;
    vPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (vCount >= 2) {
      var k = Object.keys(vPointers), a = vPointers[k[0]], b = vPointers[k[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomView(mid.x, mid.y, d / vPinch);
      vX += mid.x - vMid.x; vY += mid.y - vMid.y;
      clampView(); applyView();
      vPinch = d; vMid = mid;
      return;
    }
    if (!vLast) return;
    vX += e.clientX - vLast.x;
    vY += e.clientY - vLast.y;
    vLast = { x: e.clientX, y: e.clientY };
    clampView(); applyView();
  });
  function endView(e) {
    if (vPointers[e.pointerId]) { delete vPointers[e.pointerId]; vCount = Math.max(0, vCount - 1); }
    if (vCount === 1) {
      var k = Object.keys(vPointers)[0];
      vLast = { x: vPointers[k].x, y: vPointers[k].y };
    }
    if (vCount === 0) { vLast = null; viewStage.classList.remove("dragging"); }
  }
  viewStage.addEventListener("pointerup", endView);
  viewStage.addEventListener("pointercancel", endView);
  window.addEventListener("resize", function () {
    if (viewModal.classList.contains("hidden")) return;
    fitView();
    clampView();
    applyView();
  });

  /* ---------- choix d'une carte, avec vignettes ---------- */

  function openChoose(eventId) {
    var list = Maps.list();
    if (!list.length) { openMaps(); say("Commence par charger une carte"); return; }
    chooseFor = eventId;
    var ev = Store.get(eventId);
    /* Si l'éditeur est ouvert, c'est la carte en cours d'édition qui est
       « actuelle », pas celle enregistrée. */
    var enCours = !pinModal.classList.contains("hidden") && pinEventId === eventId
      ? pinMapId : (ev ? ev.mapId : null);
    chooseList.innerHTML = list.map(function (m) {
      var actuelle = (enCours === m.id) ? " actuelle" : "";
      return '<button type="button" class="mapcard' + actuelle + '" data-choose="' +
             escAttr(m.id) + '"><img src="' + m.url + '" alt="">' +
             '<span class="loupe" data-preview="' + escAttr(m.id) + '" title="Voir en grand">⤢</span>' +
             '<span class="nom">' + esc(m.name) + '</span>' +
             '<span class="meta">' + m.w + ' × ' + m.h + ' px</span></button>';
    }).join("");
    chooseModal.classList.remove("hidden");
  }
  function closeChoose() { chooseModal.classList.add("hidden"); }

  chooseList.addEventListener("click", function (e) {
    /* la loupe passe en plein écran ; le reste de la carte la sélectionne */
    var oeil = e.target.closest ? e.target.closest("[data-preview]") : null;
    if (oeil) {
      e.stopPropagation();
      previewMaps(oeil.getAttribute("data-preview"), chooseFor);
      return;
    }
    var carte = e.target.closest ? e.target.closest("[data-choose]") : null;
    if (!carte) return;
    var id = chooseFor;
    closeChoose();
    openPin(id, carte.getAttribute("data-choose"));
  });

  /* Parcourt les cartes en plein écran, avec un bouton pour retenir
     celle qu'on est en train de regarder. */
  function previewMaps(mapId, eventId) {
    var toutes = Maps.list(), depart = 0;
    var items = toutes.map(function (m, i) {
      if (m.id === mapId) depart = i;
      return { url: m.url, title: m.name, x: null, y: null, id: m.id };
    });
    viewPickFor = eventId || null;
    openViewerList(items, depart);
  }
  $("choose-cancel").addEventListener("click", closeChoose);
  $("choose-manage").addEventListener("click", function () { closeChoose(); openMaps(); });
  chooseModal.addEventListener("click", function (e) { if (e.target === chooseModal) closeChoose(); });

  /* ---------- placement du point ---------- */

  function placeDot() {
    if (pinX === null || pinY === null || !pinImg.naturalWidth) {
      pinDot.classList.add("hidden");
      return;
    }
    var r = pinImg.getBoundingClientRect(), st = pinStage.getBoundingClientRect();
    pinDot.style.left = (r.left - st.left + pinX * r.width) + "px";
    pinDot.style.top = (r.top - st.top + pinY * r.height) + "px";
    pinDot.classList.remove("hidden");
  }

  /* Même correctif que pour la visionneuse : la taille d'ajustement est
     calculée ici, sinon l'image s'affiche en vraie grandeur et déborde du
     cadre — on ne peut alors plus pointer les parties masquées. */
  function fitPin() {
    /* Rien à calculer tant que la fenêtre est masquée : le cadre mesurerait
       alors quelques pixels et l'image serait réduite à néant. */
    if (pinModal.classList.contains("hidden")) return;
    var st = pinStage.getBoundingClientRect();
    var iw = pinImg.naturalWidth, ih = pinImg.naturalHeight;
    if (!iw || !ih || st.width < 20 || st.height < 20) return;
    var k = Math.min(st.width / iw, st.height / ih);
    pinImg.style.width = Math.floor(iw * k) + "px";
    pinImg.style.height = Math.floor(ih * k) + "px";
    placeDot();
  }

  function loadPinImage() {
    var m = Maps.get(pinMapId);
    pinDot.classList.add("hidden");
    pinImg.style.width = pinImg.style.height = "";
    pinImg.src = m ? m.url : "";
  }

  function openPin(eventId, mapId) {
    var list = Maps.list();
    if (!list.length) {
      closePanelKeepSelection();
      openMaps();
      say("Commence par charger une carte");
      return;
    }
    var ev = Store.get(eventId);
    if (!ev) return;
    pinEventId = eventId;
    pinMapId = mapId || ev.mapId || list[0].id;
    if (!Maps.get(pinMapId)) pinMapId = list[0].id;
    var same = (ev.mapId === pinMapId);
    pinX = same && ev.mapX !== null && ev.mapX !== undefined ? ev.mapX : null;
    pinY = same && ev.mapY !== null && ev.mapY !== undefined ? ev.mapY : null;
    var carte = Maps.get(pinMapId);
    pinNom.textContent = carte ? carte.name : "";
    $("pin-clear").classList.toggle("hidden", !ev.mapId);
    loadPinImage();
    pinModal.classList.remove("hidden");
    if (pinImg.complete && pinImg.naturalWidth) fitPin();
  }

  function closePanelKeepSelection() { /* le panneau reste tel quel */ }
  function closePin() { pinModal.classList.add("hidden"); pinEventId = null; }

  pinImg.addEventListener("load", fitPin);
  window.addEventListener("resize", function () { if (!pinModal.classList.contains("hidden")) fitPin(); });

  pinStage.addEventListener("click", function (e) {
    var r = pinImg.getBoundingClientRect();
    if (!r.width || e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top || e.clientY > r.bottom) return;
    pinX = (e.clientX - r.left) / r.width;
    pinY = (e.clientY - r.top) / r.height;
    placeDot();
  });

  /* Le nom de la carte rouvre le choix illustré. */
  pinNom.addEventListener("click", function () { if (pinEventId) openChoose(pinEventId); });

  /* Le point est facultatif : on peut rattacher une carte seule et la
     pointer plus tard. */
  $("pin-save").addEventListener("click", function () {
    var id = pinEventId;
    var avaitPoint = pinX !== null;
    Store.setMap(id, pinMapId, pinX, pinY);
    closePin();
    showDetail(id);
    say(avaitPoint ? "Point enregistré" : "Carte ajoutée, sans point");
  });
  $("pin-clear").addEventListener("click", function () {
    var id = pinEventId;
    Store.setMap(id, null);
    closePin();
    showDetail(id);
    say("Carte retirée de cet événement");
  });
  $("pin-cancel").addEventListener("click", closePin);

  /* ---------- barre du haut ---------- */

  $("btn-add").addEventListener("click", function () { openForm(null); });
  $("btn-menu").addEventListener("click", function () {
    if (!panel.classList.contains("hidden")) { closePanel(); return; }
    showMenu();
  });
  /* Versets et lieux : JW Library d'abord sur iPad et iPhone, jw.org sinon. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a.ref, a.place") : null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    Refs.open(a);
  }, true);

  $("panel-close").addEventListener("click", closePanel);
  $("btn-fit").addEventListener("click", function () { Timeline.fitAll(); });
  $("btn-zoom-in").addEventListener("click", function () { Timeline.zoomBy(1.6); });
  $("btn-zoom-out").addEventListener("click", function () { Timeline.zoomBy(1 / 1.6); });

  var searchTimer = null;
  var searchClear = $("search-clear");

  function majCroix() {
    searchClear.classList.toggle("hidden", searchInput.value === "");
  }
  searchClear.addEventListener("click", function () {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.focus();
  });

  searchInput.addEventListener("input", function () {
    majCroix();
    var q = searchInput.value.trim();
    if (!Refs.parseQuery(q)) Timeline.setQuery(q);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      if (q.length >= 2) showResults(q); else if (q.length === 0) closePanel();
    }, 180);
  });

  window.addEventListener("keydown", function (e) {
    if (!viewModal.classList.contains("hidden") &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      viewStep(e.key === "ArrowRight" ? 1 : -1);
      e.preventDefault();
      e.stopImmediatePropagation();   /* la frise ne doit pas défiler derrière */
      return;
    }
    if (e.key === "Escape") {
      if (!viewModal.classList.contains("hidden")) closeView();
      else if (!chooseModal.classList.contains("hidden")) closeChoose();
      else if (!readModal.classList.contains("hidden")) closeRead();
      else if (!pinModal.classList.contains("hidden")) closePin();
      else if (!mapsModal.classList.contains("hidden")) closeMaps();
      else if (!catModal.classList.contains("hidden")) closeCats();
      else if (!modal.classList.contains("hidden")) closeForm();
      else if (!panel.classList.contains("hidden")) closePanel();
    }
    if (e.key === "n" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) openForm(null);
  });

  /* ---------- démarrage ---------- */

  Store.load();
  Maps.init();
  Photos.init();
  Timeline.init({
    onSelect: function (id) { if (id) showDetail(id); else closePanel(); },
    onAddAt: function (year) { openForm(null, year); }
  });
})();
