/* Kronos — moteur de la frise (rendu canvas, zoom, défilement) */
var Timeline = (function () {

  var MIN_YEAR = -4300, MAX_YEAR = 2120;
  var MAX_PPY  = 20000;         // pixels par année : jusqu'au jour près
  var FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif';
  var STEPS = [5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5, 2, 1];
  var MAX_LANES = 40;           // garde-fou : au-delà les barres seraient invisibles

  var canvas, ctx, stage, zoomLabel;
  var dpr = 1, W = 0, H = 0;
  var view = { top: MIN_YEAR, ppy: 0.2 };
  var hits = [];
  var periods = [], points = [], eras = [], laneCount = 1;
  var selectedId = null, hiddenCats = {}, query = "", matchIds = null;
  var drawQueued = false, lastSpan = -1, zoomTimer = null;
  var handlers = { select: null, addAt: null, laneChange: null };

  /* ---------------- utilitaires ---------------- */

  function deaccent(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function fmtYearShort(y) {
    y = Math.round(y);
    if (y < 0) return (-y) + " av.";
    if (y === 0) return "0";
    return String(y);
  }
  function fmtYearLong(y) {
    y = Math.round(y);
    if (y < 0) return (-y) + " av. J.-C.";
    if (y === 0) return "an 0";
    return String(y);
  }
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"];
  var MOIS_AB = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.",
                 "août", "sept.", "oct.", "nov.", "déc."];
  var CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var LONG = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function fromDoy(doy) {
    for (var m = 11; m >= 0; m--) if (doy > CUM[m]) return [m + 1, doy - CUM[m]];
    return [1, doy];
  }

  function fmtDate(year, month, day) {
    var y = fmtYearLong(year);
    if (!month) return y;
    var m = MOIS[Math.max(1, Math.min(12, month)) - 1];
    if (!day) return m + " " + y;
    return (day === 1 ? "1er" : day) + " " + m + " " + y;
  }

  function fmtRange(ev) {
    var a = (ev.approxStart ? "≈ " : "") + fmtDate(ev.startYear, ev.startMonth, ev.startDay);
    if (ev.endYear === null || ev.endYear === undefined) return a;
    var b = (ev.approxEnd ? "≈ " : "") + fmtDate(ev.endYear, ev.endMonth, ev.endDay);
    /* Avec des mois, la durée se compte au dixième d'année près :
       le ministère de Jésus fait 3,5 ans, pas 4. */
    var n = (ev.startMonth || ev.endMonth)
      ? Math.round((ev.end - ev.start) * 10) / 10
      : ev.endYear - ev.startYear;
    if (n <= 0) return a + " → " + b;
    var txt = (Math.round(n) === n) ? String(n) : n.toFixed(1).replace(".", ",");
    return a + " → " + b + "  ·  " + txt + " an" + (n >= 2 ? "s" : "");
  }
  /* Couleur hexadécimale convertie en rgba, pour les dégradés d'incertitude. */
  function withAlpha(hex, a) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "rgba(154,164,181," + a + ")";
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  /* Coupe un texte à la largeur voulue en ajoutant des points de suspension.
     Les mesures sont mémorisées : la fonction est appelée à chaque image. */
  var coupeCache = {};
  function couper(texte, largeur) {
    if (largeur < 12) return "";
    var cle = texte + "|" + Math.round(largeur) + "|" + ctx.font;
    if (coupeCache[cle] !== undefined) return coupeCache[cle];
    var res = texte;
    if (ctx.measureText(texte).width > largeur) {
      var lo = 0, hi = texte.length;
      while (lo < hi) {
        var mid = (lo + hi + 1) >> 1;
        if (ctx.measureText(texte.slice(0, mid) + "…").width <= largeur) lo = mid;
        else hi = mid - 1;
      }
      res = lo > 0 ? texte.slice(0, lo).replace(/[\s,;:]+$/, "") + "…" : "";
    }
    coupeCache[cle] = res;
    if (Object.keys(coupeCache).length > 4000) coupeCache = {};
    return res;
  }

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- conversions temps <-> écran ---------------- */

  function yearToY(y) { return (y - view.top) * view.ppy; }
  function yToYear(py) { return view.top + py / view.ppy; }
  function minPPY() { return H > 0 ? H / (MAX_YEAR - MIN_YEAR) : 0.05; }

  /* ---------- mémoire de la vue entre deux sessions ---------- */

  var VIEW_KEY = "kronos.view.v1";
  var saveTimer = null;

  function saveView() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        var masquees = [];
        for (var k in hiddenCats) if (hiddenCats[k]) masquees.push(k);
        localStorage.setItem(VIEW_KEY, JSON.stringify({
          top: view.top, ppy: view.ppy, hidden: masquees
        }));
      } catch (err) { /* stockage plein ou refusé : sans conséquence */ }
    }, 400);
  }

  /* Rend true si une vue valide a été restaurée. */
  function loadView() {
    var raw = null;
    try { raw = localStorage.getItem(VIEW_KEY); } catch (err) { return false; }
    if (!raw) return false;
    try {
      var v = JSON.parse(raw);
      if (typeof v.top !== "number" || typeof v.ppy !== "number") return false;
      if (!isFinite(v.top) || !isFinite(v.ppy) || v.ppy <= 0) return false;
      view.top = v.top;
      view.ppy = v.ppy;
      hiddenCats = {};
      (v.hidden || []).forEach(function (c) { hiddenCats[c] = true; });
      clampView();
      return true;
    } catch (err) { return false; }
  }

  function clampView() {
    var mn = minPPY();
    if (view.ppy < mn) view.ppy = mn;
    if (view.ppy > MAX_PPY) view.ppy = MAX_PPY;
    var span = H / view.ppy;
    var maxTop = MAX_YEAR - span;
    if (maxTop < MIN_YEAR) maxTop = MIN_YEAR;
    if (view.top < MIN_YEAR) view.top = MIN_YEAR;
    if (view.top > maxTop) view.top = maxTop;
    saveView();
  }

  function zoomAt(py, factor) {
    var anchor = yToYear(py);
    var mn = minPPY();
    view.ppy = Math.max(mn, Math.min(MAX_PPY, view.ppy * factor));
    view.top = anchor - py / view.ppy;
    clampView();
    requestDraw();
  }

  /* ---------------- mise en page ---------------- */

  function layout() {
    var narrow = W < 620;
    var gutter = narrow ? 84 : 112;
    var laneX = gutter + 14;
    /* Les voies se resserrent quand les périodes sont nombreuses, pour que
       toutes restent visibles au lieu d'être coupées à droite. */
    var avail = Math.max(W * (narrow ? 0.50 : 0.45) - laneX, 30);
    /* Écart entre deux barres. Assez large pour que les noms verticaux, halo
       compris, ne se touchent pas ; resserré seulement si les barres sont
       nombreuses. */
    var pitch = Math.min(narrow ? 16 : 22, Math.max(5, avail / Math.max(laneCount, 1)));
    return {
      narrow: narrow,
      gutter: gutter,
      axisX: gutter,
      laneX: laneX,
      pitch: pitch,
      laneW: Math.max(3, pitch - (pitch > 9 ? 4 : 2)),
      laneGap: pitch > 9 ? 4 : 2
    };
  }

  /* Voies des périodes : calculées sur les années (stables au zoom).
     Une barre dont la colonne a été fixée à la main (ev.lane) y reste ;
     les autres se glissent dans le premier espace libre à sa gauche. */
  /* occupation[l] : tranches de temps déjà prises dans la colonne l */
  var occupation = [];

  function occuper(l, p) {
    if (!occupation[l]) occupation[l] = [];
    occupation[l].push({ s: p.start, e: p.end, id: p.id });
  }

  /* La colonne l est-elle déjà prise sur la période de `p` ? On ignore `p`
     lui-même, pour pouvoir interroger pendant qu'on le déplace. */
  function laneOccupee(l, p) {
    var arr = occupation[l];
    if (!arr) return false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === p.id) continue;
      if (p.start < arr[i].e && p.end > arr[i].s) return true;
    }
    return false;
  }

  /* Colonne libre la plus proche de celle demandée. */
  function laneLibreProche(p, voulue) {
    if (!laneOccupee(voulue, p)) return voulue;
    for (var d = 1; d < MAX_LANES; d++) {
      if (voulue + d < MAX_LANES && !laneOccupee(voulue + d, p)) return voulue + d;
      if (voulue - d >= 0 && !laneOccupee(voulue - d, p)) return voulue - d;
    }
    return voulue;
  }

  function rebuild() {
    var all = Store.all();
    periods = []; points = []; eras = [];
    all.forEach(function (ev) {
      if (ev.cat === "epoque" && ev.end !== null) eras.push(ev);
      else if (ev.end !== null && ev.end > ev.start) periods.push(ev);
      else points.push(ev);
    });
    eras.sort(function (a, b) { return a.start - b.start; });
    periods.sort(function (a, b) { return (a.start - b.start) || (a.ord - b.ord) || (b.end - a.end); });
    points.sort(function (a, b) { return (a.start - b.start) || (a.ord - b.ord); });

    occupation = [];

    /* Les colonnes choisies à la main sont servies en premier, et de la plus
       récente à la plus ancienne : la dernière barre déplacée obtient toujours
       la colonne visée ; celles posées avant s'écartent si elles gênent, comme
       le font les barres placées automatiquement. */
    var libres = [], manuelles = [];
    periods.forEach(function (p) {
      if (p.lane === null || p.lane === undefined) libres.push(p);
      else manuelles.push(p);
    });
    manuelles.sort(function (a, b) { return (b.laneAt || 0) - (a.laneAt || 0); });
    manuelles.forEach(function (p) {
      var voulue = Math.max(0, Math.min(p.lane, MAX_LANES - 1));
      p._lane = laneLibreProche(p, voulue);
      occuper(p._lane, p);
    });
    libres.forEach(function (p) {
      var l = 0;
      while (l < MAX_LANES - 1 && laneOccupee(l, p)) l++;
      p._lane = l;
      occuper(l, p);
    });

    laneCount = 1;
    periods.forEach(function (p) { if (p._lane + 1 > laneCount) laneCount = p._lane + 1; });
    requestDraw();
  }

  /* La couleur vient de la sous-catégorie quand il y en a une. */
  function couleur(ev) {
    return Store.category(ev.sub || ev.cat).color;
  }

  function visible(ev) {
    if (hiddenCats[ev.cat]) return false;
    if (ev.sub && hiddenCats[ev.sub]) return false;
    return true;
  }
  function matched(ev) {
    if (matchIds) return matchIds[ev.id] === true;
    if (!query) return true;
    var q = deaccent(query);
    return deaccent(ev.title).indexOf(q) >= 0 || deaccent(ev.desc).indexOf(q) >= 0;
  }

  function tickStep(minPx) {
    for (var i = STEPS.length - 1; i >= 0; i--) {
      if (STEPS[i] * view.ppy >= minPx) return STEPS[i];
    }
    return STEPS[0];
  }

  /* ---------------- rendu ---------------- */

  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; draw(); });
  }

  function draw() {
    if (!ctx || W === 0 || H === 0) return;
    var L = layout();
    hits = [];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#12151c";
    ctx.fillRect(0, 0, W, H);
    /* --- époques : bandes de fond sur toute la largeur --- */
    var L0 = layout();
    eras.forEach(function (p, i) {
      if (hiddenCats[p.cat]) return;
      var y1 = yearToY(p.start), y2 = yearToY(p.end);
      if (y2 < 0 || y1 > H) return;
      var col = couleur(p);
      ctx.fillStyle = withAlpha(col, i % 2 ? 0.16 : 0.10);
      ctx.fillRect(0, y1, W, y2 - y1);
      ctx.strokeStyle = withAlpha(col, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y1) + 0.5);
      ctx.lineTo(W, Math.round(y1) + 0.5);
      ctx.stroke();
      /* Le nom court verticalement dans la marge de gauche : il ne recouvre
         ainsi ni les barres ni les libellés d'événements. */
      var haut = Math.max(y1, 0), bas = Math.min(y2, H);
      var visible = bas - haut;
      if (visible > 70) {
        ctx.save();
        ctx.translate(15, (haut + bas) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = "600 11px " + FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(174,187,207,0.95)";
        ctx.fillText(p.title, 0, 0, visible - 14);
        var larg = Math.min(ctx.measureText(p.title).width, visible - 14);
        ctx.restore();
        hits.push({ id: p.id, x: 4, y: (haut + bas) / 2 - larg / 2, w: 22, h: larg });
      }
    });

    /* la colonne des années se détache légèrement du fond */
    ctx.fillStyle = "rgba(255,255,255,0.028)";
    ctx.fillRect(26, 0, layout().gutter - 32, H);

    var bottomYear = yToYear(H);
    var dayPx = view.ppy / 365, monthPx = view.ppy / 12;
    ctx.textBaseline = "alphabetic";
    ctx.font = "11px " + FONT;

    function rule(py, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(py) + 0.5);
      ctx.lineTo(W, Math.round(py) + 0.5);
      ctx.stroke();
    }
    function band(pa, pb, on) {
      if (!on) return;
      ctx.fillStyle = "rgba(255,255,255,0.038)";
      ctx.fillRect(0, pa, W, pb - pa);
    }
    function label(txt, py, dim) {
      ctx.font = (dim ? "" : "600 ") + "12.5px " + FONT;
      ctx.fillStyle = dim ? "#8892a3" : "#cdd6e3";
      ctx.textAlign = "right";
      ctx.fillText(txt, L.gutter - 12, py + 15);
      ctx.font = "11px " + FONT;
    }

    if (dayPx >= 16) {
      /* --- échelle du jour --- */
      var d0 = Math.floor(view.top * 365) / 365;
      for (var pd = d0; pd < bottomYear + 1 / 365; pd += 1 / 365) {
        var yy = Math.floor(pd + 1e-9);
        var doy = Math.round((pd - yy) * 365) + 1;
        var md = fromDoy(doy);
        var pyd = yearToY(pd);
        band(pyd, yearToY(pd + 1 / 365), doy % 2 === 0);
        rule(pyd, "#1d222c");
        label(md[1] + " " + MOIS_AB[md[0] - 1] + (md[0] === 1 && md[1] === 1 ? " " + fmtYearShort(yy) : ""), pyd, false);
      }
    } else if (monthPx >= 30) {
      /* --- échelle du mois --- */
      var ystart = Math.floor(view.top);
      for (var yv = ystart; yv <= bottomYear + 1; yv++) {
        for (var mo = 1; mo <= 12; mo++) {
          var pm = yv + CUM[mo - 1] / 365;
          var pym = yearToY(pm);
          if (pym < -60 || pym > H + 60) continue;
          band(pym, yearToY(yv + (CUM[mo - 1] + LONG[mo - 1]) / 365), mo % 2 === 0);
          rule(pym, mo === 1 ? "#2f3644" : "#1d222c");
          label(MOIS_AB[mo - 1] + (mo === 1 ? " " + fmtYearShort(yv) : ""), pym, mo !== 1);
        }
      }
    } else {
      /* --- échelle de l'année --- */
      var step = tickStep(54);
      var first = Math.floor(view.top / step) * step;
      for (var y = first; y < bottomYear + step; y += step) {
        var py = yearToY(y), py2 = yearToY(y + step);
        var idx = Math.round(y / step);
        band(py, py2, (((idx % 2) + 2) % 2) === 0);
        rule(py, "#1d222c");
        label(fmtYearShort(y), py, false);
      }
      if (step * view.ppy >= 220) {
        var sub = step / 5;
        ctx.strokeStyle = "rgba(38,44,56,0.5)";
        for (var y2 = first; y2 < bottomYear + step; y2 += sub) {
          if (Math.abs(y2 / step - Math.round(y2 / step)) < 1e-9) continue;
          var sy = Math.round(yearToY(y2)) + 0.5;
          ctx.beginPath(); ctx.moveTo(L.gutter - 6, sy); ctx.lineTo(W, sy); ctx.stroke();
        }
      }
    }

    /* axe principal */
    ctx.strokeStyle = "#39414f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L.axisX + 0.5, 0);
    ctx.lineTo(L.axisX + 0.5, H);
    ctx.stroke();

    /* --- périodes --- */
    var maxLaneX = L.laneX + laneCount * L.pitch;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    periods.forEach(function (p) {
      if (!visible(p)) return;
      var y1 = yearToY(p.start), y2 = yearToY(p.end);
      if (y2 < -40 || y1 > H + 40) return;
      var x = L.laneX + p._lane * L.pitch;
      if (x + L.laneW > maxLaneX + L.laneW) return;
      var col = couleur(p);
      var dim = !matched(p);
      var top = Math.max(y1, -20), bot = Math.min(y2, H + 20);

      ctx.globalAlpha = dim ? 0.15 : 0.9;
      /* Une borne incertaine n'a pas de fin nette : elle s'estompe. */
      var barH = Math.max(y2 - y1, 3);
      if ((p.approxStart || p.approxEnd) && barH > 18) {
        var g = ctx.createLinearGradient(0, y1, 0, y1 + barH);
        var f = Math.min(Math.min(30, barH * 0.34) / barH, 0.45);
        if (p.approxStart) { g.addColorStop(0, withAlpha(col, 0)); g.addColorStop(f, col); }
        else g.addColorStop(0, col);
        if (p.approxEnd) { g.addColorStop(1 - f, col); g.addColorStop(1, withAlpha(col, 0)); }
        else g.addColorStop(1, col);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = col;
      }
      rrect(x, y1, L.laneW, barH, L.laneW / 2);
      ctx.fill();

      if (selectedId === p.id) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        rrect(x - 2, y1 - 2, L.laneW + 4, Math.max(y2 - y1, 3) + 4, (L.laneW + 4) / 2);
        ctx.stroke();
      }

      var visH = bot - top;
      if (visH > 78 && L.pitch >= 15) {
        ctx.save();
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.translate(x + L.laneW / 2, (top + bot) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = "600 11px " + FONT;
        ctx.fillStyle = "#12151c";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(18,21,28,0.85)";
        ctx.strokeText(p.title, 0, 0, visH - 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(p.title, 0, 0, visH - 16);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      hits.push({ id: p.id, bar: true, x: x - 5, y: Math.max(y1, 0), w: L.laneW + 10, h: Math.max(Math.min(y2, H) - Math.max(y1, 0), 12) });
    });

    /* --- colonne visée pendant un déplacement latéral --- */
    if (laneDrag && laneDrag.armed) {
      var gx = L.laneX + laneDrag.lane * L.pitch;
      ctx.fillStyle = "rgba(224,178,90,0.10)";
      ctx.fillRect(gx - 2, 0, L.laneW + 4, H);
      ctx.strokeStyle = "rgba(224,178,90,0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(gx - 2) + 0.5, 0.5, L.laneW + 4, H - 1);
      var badge = "colonne " + (laneDrag.lane + 1);
      var by = Math.max(Math.min(yearToY(laneDrag.ev.start), H - 26), 16);
      ctx.font = "600 11px " + FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      var bw = ctx.measureText(badge).width + 14;
      var bx = Math.min(gx + L.laneW + 8, W - bw - 6);
      ctx.fillStyle = "rgba(10,12,16,0.9)";
      rrect(bx, by - 10, bw, 20, 10);
      ctx.fill();
      ctx.fillStyle = "#e0b25a";
      ctx.fillText(badge, bx + 7, by);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }

    /* --- événements ponctuels : une seule colonne --- */
    var colX = Math.min(L.laneX + laneCount * L.pitch + 12, W * 0.55);
    var lastY = -1e9;
    ctx.textAlign = "left";
    points.forEach(function (p) {
      if (!visible(p)) return;
      var py = yearToY(p.start);
      if (py < -30 || py > H + 30) return;
      var col = couleur(p);

      /* Le libellé descend juste ce qu'il faut pour ne pas toucher le
         précédent, mais jamais de plus de MAX_SHIFT : au-delà on ne garde que
         le point, et le libellé revient dès qu'on zoome. */
      var MAX_SHIFT = Math.max(34, Math.min(H * 0.7, (view.ppy / 365) * 6));
      var ly = Math.max(py, lastY + 18);
      var showLabel = (ly - py) <= MAX_SHIFT && ly <= H + 10;
      if (showLabel) lastY = ly;

      var dim = !matched(p);
      var sel = selectedId === p.id;
      ctx.globalAlpha = dim ? 0.18 : 1;

      /* trait de rappel */
      if (showLabel) {
        ctx.strokeStyle = "rgba(120,132,152,0.45)";
        ctx.lineWidth = 1;
        if (p.approxStart) ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(L.axisX + 5, py);
        ctx.lineTo(Math.max(colX - 16, L.axisX + 8), py);
        ctx.lineTo(colX - 6, ly);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* point sur l'axe : plein si la date est sûre, creux si elle est approximative */
      var r = sel ? 5.5 : 3.6;
      if (p.approxStart) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(L.axisX, py, r + 0.6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(L.axisX, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sel) {
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(L.axisX, py, 8.5, 0, Math.PI * 2); ctx.stroke();
      }

      if (!showLabel) {
        ctx.globalAlpha = 1;
        hits.push({ id: p.id, x: L.axisX - 10, y: py - 8, w: 20, h: 16 });
        return;
      }

      ctx.textBaseline = "middle";
      var yl = (p.approxStart ? "≈ " : "") + fmtYearShort(p.startYear);
      ctx.font = "600 12.5px " + FONT;
      ctx.fillStyle = sel ? "#ffffff" : "#e0b25a";
      ctx.fillText(yl, colX, ly);
      var wy = ctx.measureText(yl).width;
      var tx = colX + wy + 10;
      ctx.font = (sel ? "600 " : "") + "12.5px " + FONT;
      ctx.fillStyle = sel ? "#ffffff" : "#dbe2ec";
      ctx.fillText(couper(p.title, W - tx - 12), tx, ly);
      ctx.globalAlpha = 1;

      hits.push({ id: p.id, x: colX - 24, y: ly - 9, w: W - colX + 24, h: 18 });
      hits.push({ id: p.id, x: L.axisX - 9, y: py - 9, w: 18, h: 18 });
    });

    /* --- repère « aujourd'hui » --- */
    var now = new Date().getFullYear();
    var ny = yearToY(now);
    if (ny > -20 && ny < H + 20) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(224,178,90,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, ny); ctx.lineTo(W, ny); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(224,178,90,0.9)";
      ctx.font = "10px " + FONT;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("aujourd'hui", W - 10, ny - 3);
    }

    /* indicateur d'échelle : visible seulement quand l'échelle change */
    if (zoomLabel) {
      var years = H / view.ppy;
      var span = Math.round(years > 2 ? years : years * 365);
      if (span !== lastSpan) {
        lastSpan = span;
        zoomLabel.textContent = years > 2
          ? "vue : " + span.toLocaleString("fr-FR") + " ans"
          : "vue : " + span.toLocaleString("fr-FR") + " jours";
        zoomLabel.style.opacity = "1";
        clearTimeout(zoomTimer);
        zoomTimer = setTimeout(function () { zoomLabel.style.opacity = "0"; }, 1500);
      }
    }
  }

  /* ---------------- interactions ---------------- */

  function hitAt(x, y) {
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }
  function hitTest(x, y) {
    var h = hitAt(x, y);
    return h ? h.id : null;
  }
  /* Pour le déplacement latéral on ne cherche que les barres : les libellés
     des événements ponctuels débordent parfois sur la dernière colonne. */
  function barAt(x, y) {
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i];
      if (!h.bar) continue;
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }
  function periodById(id) {
    for (var i = 0; i < periods.length; i++) if (periods[i].id === id) return periods[i];
    return null;
  }

  /* ---------- déplacement latéral d'une barre de période ----------
     Glisser une barre vers la droite ou la gauche change sa colonne :
     à gauche, contre l'axe, les périodes qui comptent le plus. */

  var laneDrag = null;

  function laneAtX(x, L) {
    return Math.round((x - L.laneX - L.laneW / 2) / L.pitch);
  }

  function armLaneDrag() {
    laneDrag.armed = true;
    laneDrag.max = Math.min(laneCount, MAX_LANES - 1);
    if (laneDrag.from > laneDrag.max) laneDrag.max = laneDrag.from;
    selectedId = laneDrag.ev.id;
    canvas.classList.add("lane-dragging");
  }

  function moveLaneDrag(x) {
    var L = layout();
    var l = laneAtX(x + laneDrag.grab, L);
    if (l < 0) l = 0;
    if (l > laneDrag.max) l = laneDrag.max;
    if (l === laneDrag.lane) return;
    laneDrag.lane = l;
    laneDrag.ev._lane = l;
    requestDraw();
  }

  /* Remet la barre où elle était : pincement, annulation du geste. */
  function cancelLaneDrag() {
    if (!laneDrag) return;
    laneDrag.ev._lane = laneDrag.from;
    laneDrag = null;
    canvas.classList.remove("lane-dragging");
    requestDraw();
  }

  function dropLaneDrag() {
    var d = laneDrag;
    laneDrag = null;
    canvas.classList.remove("lane-dragging");
    if (!d || !d.armed) return false;
    if (d.lane === d.from) { requestDraw(); return true; }   /* revenu à sa place */
    Store.setLane(d.ev.id, d.lane);
    rebuild();
    if (handlers.laneChange) handlers.laneChange(d.ev.id, d.lane);
    return true;
  }

  var pointers = {}, pcount = 0;
  var dragLast = 0, dragMoved = 0, vel = 0, lastT = 0, inertiaId = null;
  var pinchDist = 0, pinchMid = 0;
  var lastTapT = 0, lastTapY = 0;

  function localPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function stopInertia() {
    if (inertiaId) { cancelAnimationFrame(inertiaId); inertiaId = null; }
    vel = 0;
  }
  function startInertia() {
    stopInertia();
    if (Math.abs(vel) < 0.05) return;
    var tick = function () {
      view.top -= vel / view.ppy;
      vel *= 0.94;
      clampView();
      requestDraw();
      if (Math.abs(vel) > 0.05) inertiaId = requestAnimationFrame(tick);
      else inertiaId = null;
    };
    inertiaId = requestAnimationFrame(tick);
  }

  function onDown(e) {
    canvas.setPointerCapture(e.pointerId);
    var p = localPos(e);
    pointers[e.pointerId] = p;
    pcount++;
    stopInertia();
    if (pcount === 1) {
      dragLast = p.y; dragMoved = 0; lastT = e.timeStamp || 0;
      canvas.classList.add("dragging");
      /* Une barre sous le doigt : le geste pourra devenir un changement de
         colonne s'il part sur le côté plutôt que vers le haut ou le bas. */
      var h = barAt(p.x, p.y);
      var per = h ? periodById(h.id) : null;
      if (per) {
        var L = layout();
        laneDrag = {
          ev: per, from: per._lane, lane: per._lane,
          x0: p.x, y0: p.y, armed: false, max: laneCount,
          grab: (L.laneX + per._lane * L.pitch + L.laneW / 2) - p.x
        };
      }
    } else if (pcount === 2) {
      cancelLaneDrag();
      var ks = Object.keys(pointers);
      var a = pointers[ks[0]], b = pointers[ks[1]];
      pinchDist = Math.abs(a.y - b.y) + Math.abs(a.x - b.x) || 1;
      pinchMid = (a.y + b.y) / 2;
    }
  }

  function onMove(e) {
    if (!pointers[e.pointerId]) return;
    var p = localPos(e);
    pointers[e.pointerId] = p;

    if (pcount >= 2) {
      var ks = Object.keys(pointers);
      var a = pointers[ks[0]], b = pointers[ks[1]];
      var d = Math.abs(a.y - b.y) + Math.abs(a.x - b.x) || 1;
      var mid = (a.y + b.y) / 2;
      if (pinchDist > 0) zoomAt(mid, d / pinchDist);
      view.top -= (mid - pinchMid) / view.ppy;
      clampView();
      pinchDist = d; pinchMid = mid;
      dragMoved += 99;
      requestDraw();
      return;
    }

    if (laneDrag) {
      var ldx = p.x - laneDrag.x0, ldy = p.y - laneDrag.y0;
      if (!laneDrag.armed) {
        if (Math.abs(ldx) > 8 && Math.abs(ldx) > Math.abs(ldy)) armLaneDrag();
        else if (Math.abs(ldy) > 6) laneDrag = null;   /* c'est un défilement */
      }
      if (laneDrag) {
        dragMoved += 99;    /* ce n'est plus une simple tape */
        moveLaneDrag(p.x);
        return;             /* la frise ne défile pas pendant ce geste */
      }
    }

    var dy = p.y - dragLast;
    dragMoved += Math.abs(dy);
    var dt = (e.timeStamp || 0) - lastT;
    if (dt > 0) vel = dy / (dt / 16.7);
    lastT = e.timeStamp || 0;
    dragLast = p.y;
    view.top -= dy / view.ppy;
    clampView();
    requestDraw();
  }

  function onUp(e) {
    var p = pointers[e.pointerId];
    if (pointers[e.pointerId]) { delete pointers[e.pointerId]; pcount = Math.max(0, pcount - 1); }
    if (pcount === 1) {
      var k = Object.keys(pointers)[0];
      dragLast = pointers[k].y; vel = 0;
    }
    if (pcount === 0) {
      canvas.classList.remove("dragging");
      if (dropLaneDrag()) return;
      if (dragMoved < 6 && p) {
        var t = e.timeStamp || 0;
        if (t - lastTapT < 320 && Math.abs(p.y - lastTapY) < 20) {
          lastTapT = 0;
          if (handlers.addAt) handlers.addAt(Math.round(yToYear(p.y)));
          return;
        }
        lastTapT = t; lastTapY = p.y;
        var id = hitTest(p.x, p.y);
        selectedId = id;
        requestDraw();
        if (handlers.select) handlers.select(id);
      } else {
        startInertia();
      }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    stopInertia();
    var mult = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? H : 1);
    if (e.ctrlKey || e.metaKey) {
      zoomAt(localPos(e).y, Math.exp(-e.deltaY * mult * 0.01));
    } else {
      view.top += (e.deltaY * mult) / view.ppy;
      clampView();
      requestDraw();
    }
  }

  function onKey(e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    var pageYears = H / view.ppy;
    if (e.key === "ArrowDown") { view.top += pageYears * 0.08; }
    else if (e.key === "ArrowUp") { view.top -= pageYears * 0.08; }
    else if (e.key === "PageDown") { view.top += pageYears * 0.85; }
    else if (e.key === "PageUp") { view.top -= pageYears * 0.85; }
    else if (e.key === "+" || e.key === "=") { zoomAt(H / 2, 1.4); return; }
    else if (e.key === "-" || e.key === "_") { zoomAt(H / 2, 1 / 1.4); return; }
    else if (e.key === "Home") { fitAll(); return; }
    else return;
    e.preventDefault();
    clampView();
    requestDraw();
  }

  /* ---------------- dimension ---------------- */

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    clampView();
    requestDraw();
  }

  /* ---------------- navigation ---------------- */

  function fitAll() {
    view.ppy = minPPY();
    view.top = MIN_YEAR;
    clampView();
    requestDraw();
  }

  /* Cale la vue pour qu'un intervalle d'années tienne entièrement à l'écran. */
  function fitRange(a, b) {
    if (!isFinite(a)) return;
    if (!isFinite(b) || b <= a) b = a + 1;
    var etendue = b - a;
    var marge = Math.max(etendue * 0.07, 0.5);
    var span = etendue + 2 * marge;
    view.ppy = Math.max(minPPY(), Math.min(MAX_PPY, H / span));
    view.top = a - marge;
    clampView();
    requestDraw();
  }

  function centerOn(year, ppy) {
    if (ppy) view.ppy = Math.max(minPPY(), Math.min(MAX_PPY, ppy));
    view.top = year - (H / view.ppy) / 2;
    clampView();
    requestDraw();
  }

  function focusEvent(id) {
    var ev = Store.get(id);
    if (!ev) return;
    selectedId = id;
    if (ev.end !== null && ev.end > ev.start) {
      var span = (ev.end - ev.start) * 1.6 || 40;
      centerOn((ev.start + ev.end) / 2, H / span);
    } else {
      centerOn(ev.start, Math.max(view.ppy, 3));
    }
  }

  /* ---------------- initialisation ---------------- */

  function init(opts) {
    stage = document.getElementById("stage");
    canvas = document.getElementById("canvas");
    zoomLabel = document.getElementById("zoomlabel");
    ctx = canvas.getContext("2d");
    handlers.select = opts.onSelect || null;
    handlers.addAt = opts.onAddAt || null;
    handlers.laneChange = opts.onLaneChange || null;

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", function (e) { cancelLaneDrag(); onUp(e); });
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    document.addEventListener("gesturestart", function (e) { e.preventDefault(); });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", function () { setTimeout(resize, 200); });

    rebuild();
    resize();
    /* On retrouve la frise là où on l'avait laissée ; à défaut, vue d'ensemble. */
    if (!loadView()) fitAll();
    requestDraw();
  }

  return {
    init: init,
    rebuild: rebuild,
    redraw: requestDraw,
    fitAll: fitAll,
    fitRange: fitRange,
    forgetView: function () {
      try { localStorage.removeItem(VIEW_KEY); } catch (err) {}
      hiddenCats = {};
      fitAll();
    },
    focusEvent: focusEvent,
    centerOn: centerOn,
    zoomBy: function (f) { zoomAt(H / 2, f); },
    /* `ids` (facultatif) : surligne exactement ces événements, quel que soit
       le texte — utilisé par la recherche par référence biblique. */
    setQuery: function (q, ids) {
      query = q;
      matchIds = null;
      if (ids) { matchIds = {}; ids.forEach(function (i) { matchIds[i] = true; }); }
      requestDraw();
    },
    setCatHidden: function (cat, hidden) { hiddenCats[cat] = hidden; saveView(); requestDraw(); },
    isCatHidden: function (cat) { return !!hiddenCats[cat]; },
    select: function (id) { selectedId = id; requestDraw(); },
    selected: function () { return selectedId; },
    yearAtCenter: function () { return Math.round(yToYear(H / 2)); },
    fmtYearLong: fmtYearLong,
    fmtDate: fmtDate,
    fmtRange: fmtRange
  };
})();
