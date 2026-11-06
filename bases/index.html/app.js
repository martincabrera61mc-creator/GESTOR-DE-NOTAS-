/* ==========================================================
   Notas del curso
   ----------------------------------------------------------
   IMPORTANTE:
   1. Cambia TEACHER_PASSWORD antes de publicar.
   2. Los datos se guardan con el objeto Store, que hoy usa
      localStorage (solo existe en el navegador de quien lo
      usa). Para que docente y estudiantes vean los mismos
      datos desde distintos equipos, reemplaza los métodos de
      Store por llamadas a tu servidor (fetch). El resto del
      código no necesita cambios.
   3. La clave y los códigos se validan en el navegador, así
      que no protegen los datos de verdad. Con un servidor,
      haz esa validación allá.
   ========================================================== */

var TEACHER_PASSWORD = "docente123";
var STUDENT_IDS = ["s1", "s2", "s3", "s4"];
var CATEGORIES = [
  { key: "exc", name: "Excelente", min: 4.5 },
  { key: "sob", name: "Sobresaliente", min: 4 },
  { key: "ace", name: "Aceptable", min: 3 },
  { key: "ins", name: "Insuficiente", min: 0 }
];

/* ---------- Almacenamiento (reemplazable por tu servidor) ---------- */
var Store = {
  KEY: "notas-curso-v1",
  // Devuelve un objeto { s1: {name, code, grades:[...]}, ... }
  load: function () {
    return new Promise(function (resolve) {
      try { resolve(JSON.parse(localStorage.getItem(Store.KEY)) || {}); }
      catch (e) { resolve({}); }
    });
  },
  // Guarda los datos de un estudiante
  saveStudent: function (id, record) {
    return Store.load().then(function (all) {
      all[id] = record;
      localStorage.setItem(Store.KEY, JSON.stringify(all));
    });
  }
};

/* ---------- Utilidades ---------- */
function $(id) { return document.getElementById(id); }

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  var s = String(v).trim().replace(",", ".");
  if (s === "" || isNaN(Number(s))) return NaN;
  return Number(s);
}

function validGrade(v) { return v !== null && !isNaN(v) && v >= 0 && v <= 5; }

function categoryFor(avg) {
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (avg >= CATEGORIES[i].min) return CATEGORIES[i];
  }
  return CATEGORIES[CATEGORIES.length - 1];
}

function calculate(grades) {
  var sum = 0, n = 0;
  (grades || []).forEach(function (g) {
    var v = toNum(g);
    if (validGrade(v)) { sum += v; n++; }
  });
  if (!n) return null;
  var avg = Math.round((sum / n) * 100) / 100;
  return { avg: avg, category: categoryFor(avg) };
}

function fmt(n) { return n.toFixed(2).replace(".", ","); }

function tag(cat) {
  var s = document.createElement("span");
  s.className = "tag " + cat.key;
  s.textContent = cat.name;
  return s;
}

function showError(text) {
  var e = $("err");
  e.textContent = text;
  e.hidden = !text;
}

/* ---------- Sesión ---------- */
var session = null; // { role: "teacher" } o { role: "student", id: "s1" }

function saveSession() {
  try { sessionStorage.setItem("notas-sesion", JSON.stringify(session)); } catch (e) {}
}
function readSession() {
  try { return JSON.parse(sessionStorage.getItem("notas-sesion")); } catch (e) { return null; }
}

function logout() {
  session = null;
  try { sessionStorage.removeItem("notas-sesion"); } catch (e) {}
  showView();
}

/* ---------- Vistas ---------- */
function showView() {
  showError("");
  $("login").hidden = !!session;
  $("teacher").hidden = !(session && session.role === "teacher");
  $("student").hidden = !(session && session.role === "student");
  $("logout").hidden = !session;

  if (!session) {
    $("lead").textContent = "Ingresa como docente o como estudiante.";
    fillStudentSelect();
  } else if (session.role === "teacher") {
    $("lead").textContent = "Registra los nombres, los códigos y las notas de tus 4 estudiantes.";
    renderTeacher();
  } else {
    $("lead").textContent = "Consulta tu promedio y tu categoría.";
    renderStudent();
  }
}

/* ----- Ingreso ----- */
function selectTab(role) {
  var isTeacher = role === "teacher";
  $("tab-teacher").setAttribute("aria-selected", isTeacher);
  $("tab-student").setAttribute("aria-selected", !isTeacher);
  $("form-teacher").hidden = !isTeacher;
  $("form-student").hidden = isTeacher;
  showError("");
}

function fillStudentSelect() {
  Store.load().then(function (data) {
    var sel = $("s-name");
    sel.textContent = "";
    var named = STUDENT_IDS.filter(function (id) { return data[id] && data[id].name; });
    var first = document.createElement("option");
    first.value = "";
    first.textContent = named.length ? "Selecciona…" : "El docente aún no ha registrado estudiantes";
    sel.appendChild(first);
    named.forEach(function (id) {
      var o = document.createElement("option");
      o.value = id;
      o.textContent = data[id].name;
      sel.appendChild(o);
    });
  });
}

$("tab-teacher").addEventListener("click", function () { selectTab("teacher"); });
$("tab-student").addEventListener("click", function () { selectTab("student"); });

$("form-teacher").addEventListener("submit", function (e) {
  e.preventDefault();
  if ($("t-pass").value === TEACHER_PASSWORD) {
    session = { role: "teacher" };
    saveSession();
    $("t-pass").value = "";
    showView();
  } else {
    showError("La clave no es correcta. Revisa e inténtalo de nuevo.");
  }
});

$("form-student").addEventListener("submit", function (e) {
  e.preventDefault();
  var id = $("s-name").value, code = $("s-code").value.trim();
  if (!id) { showError("Elige tu nombre de la lista."); return; }
  Store.load().then(function (data) {
    var rec = data[id];
    if (rec && rec.code && rec.code === code) {
      session = { role: "student", id: id };
      saveSession();
      $("s-code").value = "";
      showView();
    } else {
      showError("El código no es correcto. Pídele a tu docente tu código personal.");
    }
  });
});

$("logout").addEventListener("click", logout);

/* ----- Panel del docente ----- */
var rows = {};

function buildTeacherTable() {
  var body = $("body");
  body.textContent = "";
  STUDENT_IDS.forEach(function (id, i) {
    var tr = body.insertRow();
    var r = { id: id, grades: [] };

    r.name = document.createElement("input");
    r.name.type = "text";
    r.name.placeholder = "Estudiante " + (i + 1);
    r.name.setAttribute("aria-label", "Nombre del estudiante " + (i + 1));
    tr.insertCell().appendChild(r.name);

    r.code = document.createElement("input");
    r.code.type = "text";
    r.code.className = "code";
    r.code.placeholder = "Código";
    r.code.setAttribute("aria-label", "Código del estudiante " + (i + 1));
    tr.insertCell().appendChild(r.code);

    for (var j = 0; j < 4; j++) {
      var g = document.createElement("input");
      g.type = "text";
      g.inputMode = "decimal";
      g.className = "g";
      g.setAttribute("aria-label", "Nota " + (j + 1) + " del estudiante " + (i + 1));
      tr.insertCell().appendChild(g);
      r.grades.push(g);
    }

    r.avg = tr.insertCell();
    r.avg.className = "n";
    r.cat = tr.insertCell();

    var save = function () { saveRow(r); };
    r.name.addEventListener("change", save);
    r.code.addEventListener("change", save);
    r.grades.forEach(function (g) {
      g.addEventListener("change", save);
      g.addEventListener("input", function () { paintRow(r); });
    });
    rows[id] = r;
  });
}

function paintRow(r) {
  r.grades.forEach(function (g) {
    var v = toNum(g.value);
    g.classList.toggle("bad", v !== null && !validGrade(v));
  });
  var res = calculate(r.grades.map(function (g) { return g.value; }));
  r.avg.textContent = res ? fmt(res.avg) : "—";
  r.cat.textContent = "";
  if (res) r.cat.appendChild(tag(res.category));
}

function saveRow(r) {
  paintRow(r);
  var grades = r.grades.map(function (g) {
    var v = toNum(g.value);
    return validGrade(v) ? v : null;
  });
  var saved = $("saved");
  Store.saveStudent(r.id, {
    name: r.name.value.trim(),
    code: r.code.value.trim(),
    grades: grades
  }).then(function () {
    saved.textContent = "Guardado.";
    setTimeout(function () { if (saved.textContent === "Guardado.") saved.textContent = ""; }, 2000);
  }, function () {
    showError("No se pudo guardar. Inténtalo de nuevo.");
  });
}

function renderTeacher() {
  if (!$("body").children.length) buildTeacherTable();
  Store.load().then(function (data) {
    STUDENT_IDS.forEach(function (id) {
      var r = rows[id], d = data[id] || {};
      r.name.value = d.name || "";
      r.code.value = d.code || "";
      r.grades.forEach(function (g, j) {
        var v = d.grades && d.grades[j];
        g.value = (v === null || v === undefined) ? "" : String(v).replace(".", ",");
      });
      paintRow(r);
    });
  });
}

/* ----- Vista del estudiante ----- */
function renderStudent() {
  var box = $("mine");
  box.textContent = "";
  Store.load().then(function (data) {
    var d = data[session.id];
    if (!d) { logout(); return; }
    var h = document.createElement("h2");
    h.textContent = d.name;
    box.appendChild(h);

    var res = calculate(d.grades);
    if (!res) {
      var p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Todavía no hay notas registradas.";
      box.appendChild(p);
      return;
    }
    var label = document.createElement("div");
    label.className = "hint";
    label.textContent = "Tu promedio";
    box.appendChild(label);

    var big = document.createElement("div");
    big.className = "big";
    big.textContent = fmt(res.avg);
    box.appendChild(big);
    box.appendChild(tag(res.category));

    var chips = document.createElement("div");
    chips.className = "chips";
    (d.grades || []).forEach(function (g, i) {
      if (g === null || g === undefined) return;
      var c = document.createElement("span");
      c.className = "chip";
      c.textContent = "Nota " + (i + 1) + ": " + fmt(Number(g));
      chips.appendChild(c);
    });
    box.appendChild(chips);
  });
}

/* ---------- Inicio ---------- */
session = readSession();
showView();
