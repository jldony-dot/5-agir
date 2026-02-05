/* =========================================================
   5 AGIR — app.js (propre, stable, 100% local)
   - Auto + 3 regards
   - 30 phrases, 0–5, total strict = 30
   - Ordre mélangé mais stable par questionnaire
   - Stockage localStorage (rien n’est envoyé)
   ========================================================= */

const VERSION = "v2";
const MAX_PER_ITEM = 5;
const TOTAL_REQUIRED = 30;

const FORMS = [
  { key: "auto", label: "Auto-évaluation", evaluatorFixed: "Auto-évaluation" },
  { key: "regard1", label: "Regard 1" },
  { key: "regard2", label: "Regard 2" },
  { key: "regard3", label: "Regard 3" },
];

const ELEMENTS = [
  { key: "feu", label: "Feu" },
  { key: "terre", label: "Terre" },
  { key: "metal", label: "Métal" },
  { key: "eau", label: "Eau" },
  { key: "bois", label: "Bois" },
];

// 30 formules figées
const ITEMS = [
  // FEU (1-6)
  { id: 1, element: "feu", self: "Je suis optimiste." },
  { id: 2, element: "feu", self: "Je suis à l’aise à l’oral." },
  { id: 3, element: "feu", self: "Je suis attentif(ve) au collectif." },
  { id: 4, element: "feu", self: "Je suis à l’aise pour me mettre en avant." },
  { id: 5, element: "feu", self: "J’insuffle de l’enthousiasme autour de moi." },
  { id: 6, element: "feu", self: "Je suis à l’écoute des autres." },

  // TERRE (7-12)
  { id: 7, element: "terre", self: "Je suis bienveillant(e)." },
  { id: 8, element: "terre", self: "Je suis empathique." },
  { id: 9, element: "terre", self: "Je suis capable de faire le lien entre les personnes." },
  { id: 10, element: "terre", self: "Je suis pragmatique." },
  { id: 11, element: "terre", self: "Je suis juste." },
  { id: 12, element: "terre", self: "J’aime transmettre." },

  // MÉTAL (13-18)
  { id: 13, element: "metal", self: "Je suis rigoureux / rigoureuse." },
  { id: 14, element: "metal", self: "Je suis rationnel(le)." },
  { id: 15, element: "metal", self: "Je suis analytique." },
  { id: 16, element: "metal", self: "Je suis attentif(ve) aux détails." },
  { id: 17, element: "metal", self: "Je suis objectif(ve)." },
  { id: 18, element: "metal", self: "Je suis réaliste." },

  // EAU (19-24)
  { id: 19, element: "eau", self: "Je suis patient(e)." },
  { id: 20, element: "eau", self: "Je suis discret(e)." },
  { id: 21, element: "eau", self: "Je suis fidèle à mes principes." },
  { id: 22, element: "eau", self: "Je suis prudent(e)." },
  { id: 23, element: "eau", self: "Je suis capable de prendre du recul." },
  { id: 24, element: "eau", self: "Je capitalise pour durer." },

  // BOIS (25-30)
  { id: 25, element: "bois", self: "Je suis orienté(e) action." },
  { id: 26, element: "bois", self: "Je suis audacieux / audacieuse." },
  { id: 27, element: "bois", self: "Je suis efficace." },
  { id: 28, element: "bois", self: "Je suis tenace." },
  { id: 29, element: "bois", self: "Je suis créatif / créative." },
  { id: 30, element: "bois", self: "Je suis impatient(e)." },
];

/* ------------------------- Utils -------------------------- */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? n : parseInt(String(n), 10);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function storageKey(formKey) {
  return `jld_5agir_${formKey}_${VERSION}`;
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function defaultState() {
  return {
    meta: {
      subject: "",
      evaluator: "",
      updatedAt: 0,
    },
    order: [],
    answers: {},
  };
}

function loadState(formKey) {
  const raw = safeStorageGet(storageKey(formKey));
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    const s = defaultState();
    if (parsed && typeof parsed === "object") {
      s.meta = { ...s.meta, ...(parsed.meta || {}) };
      s.order = Array.isArray(parsed.order) ? parsed.order : [];
      s.answers = parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {};
    }
    return s;
  } catch {
    return defaultState();
  }
}

function saveState(formKey, state) {
  state.meta = state.meta || {};
  state.meta.updatedAt = Date.now();
  return safeStorageSet(storageKey(formKey), JSON.stringify(state));
}

function inferFormKey() {
  const p = (location.pathname || "").toLowerCase();
  if (p.includes("questionnaire-regard1")) return "regard1";
  if (p.includes("questionnaire-regard2")) return "regard2";
  if (p.includes("questionnaire-regard3")) return "regard3";
  if (p.includes("questionnaire-auto")) return "auto";
  return null;
}

function formLabel(formKey) {
  return (FORMS.find(f => f.key === formKey)?.label) || formKey;
}

function ensureOrder(state) {
  const ids = ITEMS.map(i => i.id);
  const valid = new Set(ids);
  const hasAll =
    Array.isArray(state.order) &&
    state.order.length === ids.length &&
    state.order.every(x => valid.has(x));

  if (hasAll) return state.order;

  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  state.order = shuffled;
  return shuffled;
}

function sumTotalPoints(answers) {
  if (!answers || typeof answers !== "object") return 0;
  let sum = 0;
  for (const id of Object.keys(answers)) {
    sum += clampInt(answers[id], 0, MAX_PER_ITEM);
  }
  return sum;
}

function sumByElement(answers) {
  const totals = Object.fromEntries(ELEMENTS.map(e => [e.key, 0]));
  if (!answers || typeof answers !== "object") return totals;

  for (const it of ITEMS) {
    const v = clampInt(answers[it.id], 0, MAX_PER_ITEM);
    totals[it.element] += v;
  }
  return totals;
}

function averageTotals(listOfTotals) {
  const out = Object.fromEntries(ELEMENTS.map(e => [e.key, 0]));
  const n = listOfTotals.length;
  if (!n) return out;
  for (const t of listOfTotals) {
    for (const e of ELEMENTS) out[e.key] += (t?.[e.key] || 0);
  }
  for (const e of ELEMENTS) out[e.key] = Math.round((out[e.key] / n) * 10) / 10;
  return out;
}

function selfToOther(s) {
  let out = String(s ?? "").trim();
  if (!out.endsWith(".")) out += ".";
  out = out.replace(/\bautour de moi\b/gi, "autour de lui/elle");
  out = out.replace(/^Je suis\b/i, "Il/Elle est");
  out = out.replace(/^J’/i, "Il/Elle ");
  out = out.replace(/^J'/i, "Il/Elle ");
  out = out.replace(/^J’aime\b/i, "Il/Elle aime");
  out = out.replace(/^J'aime\b/i, "Il/Elle aime");
  out = out.replace(/^Je\b/i, "Il/Elle");
  out = out.replace(/\bIl\/Elle suis\b/gi, "Il/Elle est");
  return out;
}

function textForForm(item, formKey) {
  return formKey === "auto" ? item.self : selfToOther(item.self);
}

function setActiveNav() {
  const links = document.querySelectorAll("[data-nav]");
  if (!links.length) return;
  const path = (location.pathname || "").split("/").pop() || "";
  links.forEach(a => {
    const href = (a.getAttribute("href") || "").split("/").pop();
    if (href && href === path) a.classList.add("active");
  });
}

/* ------------------- Questionnaire -------------------- */

function mountQuestionnaire() {
  const listRoot = $("questionnaire");
  if (!listRoot) return;

  const formKey = document.body?.dataset?.form || inferFormKey() || "auto";
  const formCfg = FORMS.find(f => f.key === formKey) || FORMS[0];

  const state = loadState(formKey);
  const order = ensureOrder(state);

  // Préremplissage du sujet depuis auto pour les regards
  if (formKey !== "auto") {
    const auto = loadState("auto");
    const autoSubject = (auto.meta?.subject || "").trim();
    if (autoSubject && !(state.meta?.subject || "").trim()) {
      state.meta.subject = autoSubject;
    }
  }

  // Evaluateur fixé pour auto
  if (formCfg.evaluatorFixed) {
    state.meta.evaluator = formCfg.evaluatorFixed;
  }

  // Champs et UI présents dans la page
  const subjectEl = $("subject");
  const evaluatorEl = $("evaluator"); // présent sur regards, présent (disabled) sur auto
  const progressEl = $("progress");
  const progressText = $("progressText");
  const warnEl = $("totalWarn");
  const goBtn = $("goResults");
  const resetBtn = $("reset");

  function syncMeta() {
    if (subjectEl) state.meta.subject = (subjectEl.value || "").trim();
    if (!formCfg.evaluatorFixed && evaluatorEl) state.meta.evaluator = (evaluatorEl.value || "").trim();

    // Sur auto, répercute le sujet dans les regards si vides
    if (formKey === "auto") {
      const subject = (state.meta.subject || "").trim();
      if (subject) {
        for (const fk of ["regard1", "regard2", "regard3"]) {
          const s2 = loadState(fk);
          if (!(s2.meta?.subject || "").trim()) {
            s2.meta.subject = subject;
            saveState(fk, s2);
          }
        }
      }
    }

    saveState(formKey, state);
  }

  function updateUI() {
    const total = sumTotalPoints(state.answers);

    if (progressEl) progressEl.value = total;
    if (progressText) progressText.textContent = `${total} / ${TOTAL_REQUIRED} points`;

    if (warnEl) {
      if (total < TOTAL_REQUIRED) warnEl.textContent = `Le total doit faire exactement ${TOTAL_REQUIRED}.`;
      if (total > TOTAL_REQUIRED) warnEl.textContent = `Tu as dépassé ${TOTAL_REQUIRED} points (${total}). Retire ${total - TOTAL_REQUIRED} point(s).`;
      if (total === TOTAL_REQUIRED) warnEl.textContent = `Parfait. Tu peux afficher les résultats.`;
    }

    if (goBtn) goBtn.disabled = (total !== TOTAL_REQUIRED);
  }

  // Initialise champs
  if (subjectEl && !subjectEl.value) subjectEl.value = state.meta.subject || "";
  if (evaluatorEl) {
    if (formCfg.evaluatorFixed) {
      evaluatorEl.value = formCfg.evaluatorFixed;
      evaluatorEl.disabled = true;
    } else {
      if (!evaluatorEl.value) evaluatorEl.value = state.meta.evaluator || "";
      evaluatorEl.disabled = false;
    }
  }

  if (subjectEl) subjectEl.addEventListener("input", () => { syncMeta(); });
  if (!formCfg.evaluatorFixed && evaluatorEl) evaluatorEl.addEventListener("input", () => { syncMeta(); });

  // Injecte la liste des questions
  listRoot.innerHTML = order.map((id, idx) => {
    const it = ITEMS.find(x => x.id === id);
    const label = textForForm(it, formKey);
    const v = clampInt(state.answers[id] ?? 0, 0, MAX_PER_ITEM);

    return `
      <div class="qrow">
        <div class="qleft">
          <div class="qidx">#${idx + 1}</div>
          <div class="qtext">${escapeHtml(label)}</div>
        </div>
        <div class="qright">
          <input class="score" type="number" inputmode="numeric" min="0" max="${MAX_PER_ITEM}" step="1"
                 data-id="${id}" value="${v}" />
          <div class="qhint">0–${MAX_PER_ITEM}</div>
        </div>
      </div>
    `;
  }).join("");

  // Gestion des scores
  listRoot.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.classList.contains("score")) return;

    const id = parseInt(t.getAttribute("data-id") || "", 10);
    const v = clampInt(t.value, 0, MAX_PER_ITEM);
    t.value = String(v);

    state.answers[id] = v;
    saveState(formKey, state);
    updateUI();
  });

  // Reset
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const keepOrder = state.order;
      const keepMeta = state.meta;

      const fresh = defaultState();
      fresh.order = keepOrder && keepOrder.length === ITEMS.length ? keepOrder : [];
      fresh.meta = keepMeta;

      if (formCfg.evaluatorFixed) fresh.meta.evaluator = formCfg.evaluatorFixed;

      Object.assign(state, fresh);
      saveState(formKey, state);

      listRoot.querySelectorAll("input.score").forEach(inp => (inp.value = "0"));
      updateUI();
    });
  }

  // Go results
  if (goBtn) {
    goBtn.addEventListener("click", (e) => {
      const total = sumTotalPoints(state.answers);
      if (total !== TOTAL_REQUIRED) {
        e.preventDefault();
        updateUI();
        return;
      }
      syncMeta();
      location.href = "resultats.html";
    });
  }

  syncMeta();
  updateUI();
}

/* ---------------------- Résultats ---------------------- */

function readFormPayload(formKey) {
  const s = loadState(formKey);
  const totalPoints = sumTotalPoints(s.answers);
  const totals = sumByElement(s.answers);

  const subject = (s.meta?.subject || "").trim();
  const evaluator =
    (FORMS.find(f => f.key === formKey)?.evaluatorFixed)
      ? (FORMS.find(f => f.key === formKey)?.evaluatorFixed)
      : (s.meta?.evaluator || "").trim();

  return {
    formKey,
    label: formLabel(formKey),
    subject,
    evaluator,
    totalPoints,
    complete: totalPoints === TOTAL_REQUIRED,
    totals,
    answers: s.answers || {},
  };
}

function rankFromTotals(totals) {
  const arr = ELEMENTS.map(e => ({
    key: e.key,
    label: e.label,
    score: totals?.[e.key] || 0
  }));
  arr.sort((a, b) => b.score - a.score);
  return arr;
}

function buildShareText(payloads) {
  const subject =
    (payloads.find(p => p.subject)?.subject || "").trim() ||
    (loadState("auto").meta?.subject || "").trim() ||
    "—";

  const complete = payloads.filter(p => p.complete);
  const lines = [];
  lines.push(`Portrait chinois de : ${subject}`);
  lines.push(`Questionnaires complets : ${complete.length}/4`);
  for (const p of complete) {
    const top = rankFromTotals(p.totals)[0];
    const low = rankFromTotals(p.totals).slice(-1)[0];
    lines.push(`- ${p.label} (${p.evaluator || "—"}) : dominante ${top.label} (${top.score}), point bas ${low.label} (${low.score}).`);
  }
  return lines.join("\n");
}

function mountResults() {
  const root = $("results");
  if (!root) return;

  const payloads = FORMS.map(f => readFormPayload(f.key));
  const subject =
    (payloads.find(p => p.subject)?.subject || "").trim() ||
    (loadState("auto").meta?.subject || "").trim() ||
    "—";

  const auto = payloads.find(p => p.formKey === "auto");
  const regards = payloads.filter(p => p.formKey !== "auto");

  const avgRegards = averageTotals(regards.filter(r => r.complete).map(r => r.totals));
  const rankAuto = rankFromTotals(auto.totals);
  const rankAvg = rankFromTotals(avgRegards);

  const completionRows = payloads.map(p => `
    <tr>
      <td>${escapeHtml(p.label)}</td>
      <td>${escapeHtml(p.evaluator || (p.formKey === "auto" ? "Auto-évaluation" : "—"))}</td>
      <td>${p.complete ? "OK" : `Incomplet (${p.totalPoints}/${TOTAL_REQUIRED})`}</td>
    </tr>
  `).join("");

  const totalsRows = ELEMENTS.map(e => {
    const a = auto.totals[e.key] || 0;
    const r1 = payloads.find(p => p.formKey === "regard1")?.totals?.[e.key] || 0;
    const r2 = payloads.find(p => p.formKey === "regard2")?.totals?.[e.key] || 0;
    const r3 = payloads.find(p => p.formKey === "regard3")?.totals?.[e.key] || 0;
    const avg = avgRegards[e.key] || 0;

    return `
      <tr>
        <td>${escapeHtml(e.label)}</td>
        <td>${a}</td>
        <td>${r1}</td>
        <td>${r2}</td>
        <td>${r3}</td>
        <td><b>${avg}</b></td>
      </tr>
    `;
  }).join("");

  function detailSection(elementKey) {
    const el = ELEMENTS.find(e => e.key === elementKey);
    const list = ITEMS.filter(it => it.element === elementKey);

    const rows = list.map(it => {
      const a = clampInt(auto.answers[it.id] ?? 0, 0, MAX_PER_ITEM);
      const r1 = clampInt(payloads.find(p => p.formKey === "regard1")?.answers?.[it.id] ?? 0, 0, MAX_PER_ITEM);
      const r2 = clampInt(payloads.find(p => p.formKey === "regard2")?.answers?.[it.id] ?? 0, 0, MAX_PER_ITEM);
      const r3 = clampInt(payloads.find(p => p.formKey === "regard3")?.answers?.[it.id] ?? 0, 0, MAX_PER_ITEM);

      return `
        <tr>
          <td>${escapeHtml(it.self)}</td>
          <td>${a}</td>
          <td>${r1}</td>
          <td>${r2}</td>
          <td>${r3}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="card">
        <h3>${escapeHtml(el.label)}</h3>
        <div class="tablewrap">
          <table class="table">
            <thead>
              <tr>
                <th>Formule</th>
                <th>Auto</th>
                <th>Regard 1</th>
                <th>Regard 2</th>
                <th>Regard 3</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="card">
      <h2>Résultats — Portrait chinois de : ${escapeHtml(subject)}</h2>
      <p class="muted">Rappel : ce n’est pas un jugement. C’est une photographie du moment présent.</p>
      <div class="btnrow">
        <a class="btn" href="questionnaire-auto.html">Auto-évaluation</a>
        <a class="btn" href="questionnaire-regard1.html">Regard 1</a>
        <a class="btn" href="questionnaire-regard2.html">Regard 2</a>
        <a class="btn" href="questionnaire-regard3.html">Regard 3</a>
      </div>
    </div>

    <div class="card">
      <h3>État de complétion</h3>
      <div class="tablewrap">
        <table class="table">
          <thead><tr><th>Questionnaire</th><th>Évaluateur</th><th>Statut</th></tr></thead>
          <tbody>${completionRows}</tbody>
        </table>
      </div>
      <p class="muted">La moyenne des regards ne prend en compte que les regards complets.</p>
    </div>

    <div class="card">
      <h3>Totaux par Agir</h3>
      <div class="tablewrap">
        <table class="table">
          <thead>
            <tr>
              <th>Agir</th>
              <th>Auto</th>
              <th>Regard 1</th>
              <th>Regard 2</th>
              <th>Regard 3</th>
              <th>Moyenne regards</th>
            </tr>
          </thead>
          <tbody>${totalsRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Classement (lecture rapide)</h3>
      <div class="grid two">
        <div>
          <div class="kpititle">Auto-évaluation</div>
          ${rankAuto.map(r => `
            <div class="kpirow">
              <div>${escapeHtml(r.label)}</div>
              <div class="right"><b>${r.score}</b></div>
            </div>
          `).join("")}
        </div>
        <div>
          <div class="kpititle">Moyenne des regards</div>
          ${rankAvg.map(r => `
            <div class="kpirow">
              <div>${escapeHtml(r.label)}</div>
              <div class="right"><b>${r.score}</b></div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="btnrow mt">
        <button class="btn" id="copySummary">Copier un résumé</button>
        <button class="btn" id="printPdf">Imprimer / PDF</button>
      </div>
      <p class="muted">Pour PDF : imprime cette page et choisis “Enregistrer en PDF”.</p>
    </div>

    ${detailSection("feu")}
    ${detailSection("terre")}
    ${detailSection("metal")}
    ${detailSection("eau")}
    ${detailSection("bois")}

    <div class="card">
      <p class="muted">Données stockées localement dans ton navigateur. Rien n’est envoyé sur Internet.</p>
    </div>
  `;

  const copyBtn = $("copySummary");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = buildShareText(payloads);
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Résumé copié.";
        setTimeout(() => (copyBtn.textContent = "Copier un résumé"), 1500);
      } catch {
        alert("Copie impossible. Sélectionne le texte manuellement.");
      }
    });
  }

  const printBtn = $("printPdf");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
}

/* ------------------- Intro / Dynamiques ------------------- */

function mountDynamicPageFixes() {
  const btns = document.querySelectorAll('[data-go="questionnaire"]');
  btns.forEach(b => b.addEventListener("click", () => (location.href = "questionnaire-auto.html")));
}

/* ------------------------- Boot -------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  mountQuestionnaire();
  mountResults();
  mountDynamicPageFixes();
});
