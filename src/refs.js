/* Kronos — transforme les références bibliques en liens vers la Bible d'étude
   (JW Library si l'application est installée, sinon jw.org). */
var Refs = (function () {

  /* numéro de livre -> noms et abréviations acceptés (français) */
  var BOOKS = [
    [1,["Gn","Genèse","Gen"]],[2,["Ex","Exode"]],[3,["Lv","Lévitique"]],
    [4,["Nb","Nombres"]],[5,["Dt","Deutéronome"]],[6,["Jos","Josué"]],
    [7,["Jg","Juges"]],[8,["Ru","Ruth"]],[9,["1S","1 Samuel"]],[10,["2S","2 Samuel"]],
    [11,["1R","1 Rois"]],[12,["2R","2 Rois"]],[13,["1Ch","1 Chroniques"]],
    [14,["2Ch","2 Chroniques"]],[15,["Esd","Esdras"]],[16,["Né","Néhémie"]],
    [17,["Est","Esther"]],[18,["Jb","Job"]],[19,["Ps","Psaume","Psaumes"]],
    [20,["Pr","Proverbes"]],[21,["Ec","Ecclésiaste"]],[22,["Ct","Chant de Salomon"]],
    [23,["Is","Isaïe"]],[24,["Jr","Jérémie"]],[25,["Lam","Lamentations"]],
    [26,["Ez","Ézéchiel"]],[27,["Dn","Daniel"]],[28,["Os","Osée"]],[29,["Jl","Joël"]],
    [30,["Am","Amos"]],[31,["Ab","Abdias"]],[32,["Jon","Jonas"]],[33,["Mi","Michée"]],
    [34,["Nah","Nahoum","Nahum"]],[35,["Hab","Habacuc"]],[36,["Sph","Sophonie"]],
    [37,["Ag","Aggée"]],[38,["Za","Zacharie"]],[39,["Ml","Malachie"]],
    [40,["Mt","Matthieu"]],[41,["Mc","Marc"]],[42,["Lc","Luc"]],[43,["Jn","Jean"]],
    [44,["Ac","Actes"]],[45,["Rm","Romains"]],[46,["1Co","1 Corinthiens"]],
    [47,["2Co","2 Corinthiens"]],[48,["Ga","Galates"]],[49,["Ép","Ep","Éphésiens"]],
    [50,["Ph","Philippiens"]],[51,["Col","Colossiens"]],[52,["1Th","1 Thessaloniciens"]],
    [53,["2Th","2 Thessaloniciens"]],[54,["1Tm","1 Timothée"]],[55,["2Tm","2 Timothée"]],
    [56,["Tt","Tite"]],[57,["Phm","Philémon"]],[58,["Hé","He","Hébreux"]],
    [59,["Jc","Jacques"]],[60,["1P","1 Pierre"]],[61,["2P","2 Pierre"]],
    [62,["1Jn","1 Jean"]],[63,["2Jn","2 Jean"]],[64,["3Jn","3 Jean"]],
    [65,["Jude"]],[66,["Ré","Re","Révélation","Apocalypse"]]
  ];

  var index = {};
  var names = [];
  BOOKS.forEach(function (b) {
    b[1].forEach(function (n) { index[n.toLowerCase()] = b[0]; names.push(n); });
  });
  /* les noms longs d'abord, sinon « 1 Jean » serait coupé sur « Jean » */
  names.sort(function (a, b) { return b.length - a.length; });
  var alts = names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
  var RE = new RegExp(
    "(^|[^0-9A-Za-zÀ-ÿ])(" + alts + ")\\s*(\\d{1,3})\\s*:\\s*(\\d{1,3})" +
    "(?:\\s*[-–—]\\s*(\\d{1,3})(?:\\s*:\\s*(\\d{1,3}))?)?", "g");

  function code(book, chapter, verse) {
    var b = String(book), c = String(chapter), v = String(verse);
    while (b.length < 2) b = "0" + b;
    while (c.length < 3) c = "0" + c;
    while (v.length < 3) v = "0" + v;
    return b + c + v;
  }

  function urls(start, end) {
    var range = start + (end && end !== start ? "-" + end : "");
    var query = "wtlocale=F&prefer=lang&pub=nwtsty&bible=" + range;
    return {
      web: "https://www.jw.org/finder?" + query,
      app: "jwlibrary:///finder?" + query
    };
  }

  /* iPad, iPhone, et Mac en mode tactile : on tente d'abord l'application. */
  var IS_APPLE_MOBILE = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  /* `html` doit déjà être échappé : on n'ajoute que des balises <a>. */
  function linkify(html) {
    return String(html).replace(RE, function (m, before, name, ch, v, v2, ch2) {
      var book = index[name.toLowerCase()];
      if (!book) return m;
      var start = code(book, ch, v);
      var end = ch2 ? code(book, v2, ch2) : (v2 ? code(book, ch, v2) : start);
      var u = urls(start, end);
      var text = m.slice(before.length);
      return before + '<a class="ref" href="' + u.web + '" data-app="' + u.app +
             '" target="_blank" rel="noopener">' + text + "</a>";
    });
  }

  /* Ouvre JW Library si possible, jw.org sinon. */
  function open(a) {
    var web = a.getAttribute("href"), app = a.getAttribute("data-app");
    if (!IS_APPLE_MOBILE) { window.open(web, "_blank", "noopener"); return; }
    var t = Date.now();
    setTimeout(function () {
      if (Date.now() - t < 1600) window.location.href = web;
    }, 900);
    window.location.href = app;
  }

  /* --- recherche par référence : « 2 R 18 », « Daniel 9 », « Mt 24:14 » --- */

  var QUERY_RE = new RegExp("^\\s*(" + alts + ")\\s*(\\d{1,3})?(?:\\s*:\\s*(\\d{1,3}))?\\s*$", "i");

  function parseQuery(q) {
    /* « 2 Rois 18 », « 2R 18 » et « 2 R 18 » doivent tous marcher : on essaie
       la saisie telle quelle, puis avec le chiffre recollé à l'abréviation. */
    var brut = String(q);
    var m = QUERY_RE.exec(brut) ||
            QUERY_RE.exec(brut.replace(/^\s*([123])\s+([A-Za-zÀ-ÿ])/, "$1$2"));
    if (!m) return null;
    var book = index[m[1].toLowerCase()];
    if (!book) return null;
    return { book: book, chapter: m[2] ? parseInt(m[2], 10) : null,
             verse: m[3] ? parseInt(m[3], 10) : null, label: m[0].trim() };
  }

  /* Toutes les références contenues dans un texte. */
  function scan(text) {
    var out = [], m;
    RE.lastIndex = 0;
    while ((m = RE.exec(String(text))) !== null) {
      var book = index[m[2].toLowerCase()];
      if (!book) continue;
      var ch = parseInt(m[3], 10);
      var ch2 = m[6] ? parseInt(m[5], 10) : ch;   /* « Mt 5:1-7:29 » : fin de chapitre */
      out.push({ book: book, ch: ch, ch2: Math.max(ch, ch2) });
    }
    return out;
  }

  /* Le texte cite-t-il le livre (et le chapitre) demandé ? */
  function covers(text, ref) {
    var list = scan(text);
    for (var i = 0; i < list.length; i++) {
      if (list[i].book !== ref.book) continue;
      if (ref.chapter === null) return true;
      if (ref.chapter >= list[i].ch && ref.chapter <= list[i].ch2) return true;
    }
    return false;
  }

  return { linkify: linkify, open: open, appFirst: IS_APPLE_MOBILE,
           parseQuery: parseQuery, scan: scan, covers: covers };
})();
