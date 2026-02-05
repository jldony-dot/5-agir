/* =========================================================
   5 AGIR — app.js (version robuste, clés unifiées, multi-pages)
   - Auto-évaluation + Regard 1/2/3
   - 30 phrases, total strict = 30, max 5 par phrase
   - Questionnaire neutre (pas d’éléments visibles), ordre mélangé
   - Résultats par éléments (Feu/Terre/Métal/Eau/Bois) + détail
   - Stockage local (localStorage) — rien n’est envoyé sur Internet
   ========================================================= */

/* ------------------------- Config ------------------------- */

const VERSION = "v2"; // CHANGE ICI si tu veux réinitialiser tout (v3, v4, ...)
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

// 30 formules figées (mémoire)
const ITEMS = [
  // FEU (1-6)
  { id: 1, element: "feu", self: "Je suis optimiste." },
  { id: 2, element: "feu", self: "Je suis à l’aise à l’oral." },
  { id: 3, element: "feu", self: "Je suis attentif(ve) au collectif." },
  { id: 4, element: "feu", self: "Je suis à l’aise pour me mettre en avant." },
  { id: 5, element: "feu", self: "J’insuffle de l’énergie autour de moi." },
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

function defaultState() {
  return {
    meta: {
      subject: "",     // Portrait chinois de :
      evaluator: "",   // Évaluation réalisée par :
      updatedAt: 0,
    },
    order: [],         // ordre mélangé des 30 items
    answers: {},       // { [itemId]: number }
  };
}

function loadState(formKey) {
  const raw = safeStorageGet(storageKey(formKey));
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    // Normalisation légère pour éviter les états cassés
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

function ensureOrder(state) {
  const ids = ITEMS.map(i => i.id);
  const valid = new Set(ids);
  const hasAll =
    Array.isArray(state.order) &&
    state.order.length === ids.length &&
    state.order.every(x => valid.has(x));

  if (hasAll) return state.order;

  // On mélange une fois et on stocke (stable pour l’utilisateur)
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

// Transforme une phrase en “Il/Elle …” pour les Regards
function selfToOther(s) {
  let out = String(s ?? "").trim();

  // Nettoyage ponctuation
  if (!out.endsWith(".")) out += ".";

  // Remplacements spécifiques (ton cas)
  out = out.replace(/\bautour de moi\b/gi, "autour de lui/elle");

  // Départs de phrase
  out = out.replace(/^Je suis\b/i, "Il/Elle est");
  out = out.replace(/^J’/i, "Il/Elle ");
  out = out.replace(/^J'/i, "Il/Elle ");
  out = out.replace(/^J’aime\b/i, "Il/Elle aime");
  out = out.replace(/^J'aime\b/i, "Il/Elle aime");
  out = out.replace(/^Je\b/i, "Il/Elle");

  // Petites corrections (évite “Il/Elle suis” si collages bizarres)
  out = out.replace(/\bIl\/Elle suis\b/gi, "Il/Elle est");

  return out;
}

function textForForm(item, formKey) {
  if (formKey === "auto") return item.self;
  return selfToOther(item.self);
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

/* ------------------- Questionnaire UI -------------------- */

function questionnaireIntroHtml(formKey) {
  if (formKey === "auto") {
    return `
      <div class="card">
        <h1>Portrait chinois – Auto-évaluation</h1>
        <p>Ce questionnaire n’est ni un test, ni une évaluation, ni un jugement. C’est une photographie de ton fonctionnement aujourd’hui.</p>
        <p>Lis chaque phrase comme si tu te la disais intérieurement. Si ça te ressemble, mets des points. Si ça ne te ressemble pas, n’en mets pas.</p>
        <p>Réponds sans suranalyser, sans chercher l’image idéale. Ce qui m’intéresse, c’est la justesse.</p>
      </div>
    `;
  }
  return `
    <div class="card">
      <h1>Portrait chinois – ${escapeHtml(formLabel(formKey))}</h1>
      <p>Tu vas évaluer une personne que tu connais bien. Ce questionnaire n’est ni un jugement, ni une note de performance.</p>
      <p>Lis chaque phrase et demande-toi : <b>“Est-ce que cela décrit bien sa manière d’agir aujourd’hui ?”</b></p>
      <p>Réponds sans chercher l’équilibre ou l’image idéale. Appuie-toi sur ton expérience réelle de la personne.</p>
    </div>
  `;
}

function formLabel(formKey) {
  return (FORMS.find(f => f.key === formKey)?.label) || formKey;
}

function mountQuestionnaire() {
  const root = $("questionnaire");
  if (!root) return;

  const formKey = inferFormKey() || root.getAttribute("data-form") || "auto";
  const formCfg = FORMS.find(f => f.key === formKey) || FORMS[0];

  // Charge état
  const state = loadState(formKey);
  const order = ensureOrder(state);

  // Pré-remplissage du sujet depuis auto (pour les regards)
  if (formKey !== "auto") {
    const auto = loadState("auto");
    const autoSubject = (auto.meta?.subject || "").trim();
    if (autoSubject && !(state.meta?.subject || "").trim()) {
      state.meta.subject = autoSubject;
      saveState(formKey, state);
    }
  }

  // Evaluateur fixé pour auto
  if (formCfg.evaluatorFixed) {
    state.meta.evaluator = formCfg.evaluatorFixed;
    saveState(formKey, state);
  }

  // Rendu
  root.innerHTML = `
    ${questionnaireIntroHtml(formKey)}

    <div class="card">
      <h2>Champs</h2>
      <div class="grid two">
        <div>
          <label class="label">Portrait chinois de :</label>
          <input id="subject" class="input" placeholder="Prénom (ou Prénom Nom)" value="${escapeHtml(state.meta.subject || "")}" />
          <div class="small">Ce nom sera réutilisé dans les questionnaires “regard”.</div>
        </div>
        <div>
          <label class="label">Évaluation réalisée par :</label>
          <input id="evaluator" class="input" placeholder="Ton prénom" value="${escapeHtml(state.meta.evaluator || "")}" ${formCfg.evaluatorFixed ? "disabled" : ""}/>
          <div class="small">Ce nom apparaîtra dans la synthèse finale.</div>
        </div>
      </div>

      <div class="grid two mt">
        <div class="pillbox">
          <div class="pilltitle">Progression</div>
          <div class="pillvalue"><span id="progressVal">0</span> / ${TOTAL_REQUIRED} points</div>
          <div class="bar"><div id="barFill" class="barfill" style="width:0%"></div></div>
        </div>
        <div class="pillbox">
          <div class="pilltitle">Règle</div>
          <div class="pillvalue">Total strict <span id="totalStrict">0</span> / ${TOTAL_REQUIRED}</div>
          <div class="small">Max ${MAX_PER_ITEM} points par phrase.</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Répartition des points</h2>
      <div class="small">Attribue entre 0 et ${MAX_PER_ITEM} points à chaque phrase. La somme doit faire exactement ${TOTAL_REQUIRED}.</div>
      <div id="list" class="list mt"></div>
    </div>

    <div class="card">
      <div id="alert" class="warn" style="display:none"></div>
      <div class="btnrow">
        <a id="goResults" class="btn primary" href="resultats.html">Voir les résultats</a>
        <button id="reset" class="btn" type="button">Réinitialiser</button>
      </div>
      <div class="small mt">Conseil : note ce qui est vrai aujourd’hui, pas ce que tu voudrais être / voir.</div>
    </div>
  `;

  // DOM refs
  const subjectEl = $("subject");
  const evaluatorEl = $("evaluator");
  const listEl = $("list");
  const progressVal = $("progressVal");
  const totalStrict = $("totalStrict");
  const barFill = $("barFill");
  const alertEl = $("alert");
  const goResults = $("goResults");
  const resetBtn = $("reset");

  // Build list (ordre mélangé, neutre)
  const rows = order.map((id, idx) => {
    const it = ITEMS.find(x => x.id === id);
    const label = textForForm(it, formKey);
    const v = clampInt(state.answers[id] ?? 0, 0, MAX_PER_ITEM);
    return `
      <div class="row">
        <div class="rowleft">
          <div class="rowidx">#${idx + 1}</div>
          <div class="rowtext">${escapeHtml(label)}</div>
        </div>
        <div class="rowright">
          <input class="score" type="number" inputmode="numeric" min="0" max="${MAX_PER_ITEM}" step="1"
                 data-id="${id}" value="${v}" />
          <div class="hint">0–${MAX_PER_ITEM}</div>
        </div>
      </div>
    `;
  }).join("");

  listEl.innerHTML = rows;

  function syncMeta() {
    state.meta.subject = (subjectEl.value || "").trim();
    if (!formCfg.evaluatorFixed) state.meta.evaluator = (evaluatorEl.value || "").trim();

    // Si on est sur auto, on répercute le sujet dans les regards si vides
    if (formKey === "auto") {
      const subject = state.meta.subject.trim();
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
    progressVal.textContent = String(total);
    totalStrict.textContent = String(total);

    const pct = Math.min(100, Math.round((total / TOTAL_REQUIRED) * 100));
    barFill.style.width = `${pct}%`;

    // Alertes
    if (total > TOTAL_REQUIRED) {
      alertEl.style.display = "";
      alertEl.textContent = `Tu as dépassé ${TOTAL_REQUIRED} points (${total}/${TOTAL_REQUIRED}). Retire ${total - TOTAL_REQUIRED} point(s).`;
    } else if (total < TOTAL_REQUIRED) {
      alertEl.style.display = "";
      alertEl.textContent = `Le total doit faire exactement ${TOTAL_REQUIRED}. Il te manque ${TOTAL_REQUIRED - total} point(s).`;
    } else {
      alertEl.style.display = "none";
      alertEl.textContent = "";
    }

    // Bouton résultats
    const ok = total === TOTAL_REQUIRED;
    goResults.classList.toggle("disabled", !ok);
    goResults.setAttribute("aria-disabled", ok ? "false" : "true");
  }

  // Inputs listeners
  subjectEl.addEventListener("input", syncMeta);
  if (!formCfg.evaluatorFixed) evaluatorEl.addEventListener("input", syncMeta);

  listEl.addEventListener("input", (e) => {
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

  resetBtn.addEventListener("click", () => {
    const keepOrder = state.order;
    const keepMeta = state.meta;

    const fresh = defaultState();
    fresh.order = keepOrder && keepOrder.length === ITEMS.length ? keepOrder : [];
    fresh.meta = keepMeta;

    // Auto reset: evaluator fixé
    if (formCfg.evaluatorFixed) fresh.meta.evaluator = formCfg.evaluatorFixed;

    Object.assign(state, fresh);
    saveState(formKey, state);

    // Rafraîchit inputs
    listEl.querySelectorAll("input.score").forEach(inp => (inp.value = "0"));
    updateUI();
  });

  // Empêche d'aller aux résultats si pas OK
  goResults.addEventListener("click", (e) => {
    const total = sumTotalPoints(state.answers);
    if (total !== TOTAL_REQUIRED) {
      e.preventDefault();
      updateUI();
    } else {
      // Save meta au moment du clic
      syncMeta();
    }
  });

  // Init
  syncMeta();
  updateUI();
}

/* ---------------------- Résultats UI ---------------------- */

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

function interpretationText(rank) {
  // Peu de texte volontairement (tu valorises ton RDV)
  const top = rank[0]?.label || "";
  const low = rank[rank.length - 1]?.label || "";
  return `
    <div class="card">
      <h2>Lecture très synthétique</h2>
      <p>Ce rendu est volontairement générique : il te donne une première lecture des dominantes et des zones à sécuriser, sans “sur-interpréter”.</p>
      <p><b>Dominante actuelle :</b> ${escapeHtml(top)}. <b>Zone plus faible :</b> ${escapeHtml(low)}.</p>
      <p class="small">L’analyse fine (nuances, contextes, complémentarités, implications opérationnelles) est clarifiée en séance avec ton mentor préféré Jean-Luc D.</p>
    </div>
  `;
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

  const totalsTableRows = ELEMENTS.map(e => {
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

  // Détail par éléments : liste des 30 phrases regroupées en chapitres
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
        <h2>${escapeHtml(el.label)}</h2>
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
    `;
  }

  root.innerHTML = `
    <div class="card">
      <h1>Résultats — Portrait chinois de : ${escapeHtml(subject)}</h1>
      <div class="notice">
        <div><b>Rappel :</b> ce n’est pas un jugement. C’est une photographie du moment présent.</div>
      </div>

      <div class="btnrow">
        <a class="btn primary" href="questionnaire-auto.html">Auto-évaluation</a>
        <a class="btn" href="questionnaire-regard1.html">Regard 1</a>
        <a class="btn" href="questionnaire-regard2.html">Regard 2</a>
        <a class="btn" href="questionnaire-regard3.html">Regard 3</a>
      </div>
    </div>

    <div class="card">
      <h2>État de complétion</h2>
      <table class="table">
        <thead><tr><th>Questionnaire</th><th>Évaluateur</th><th>Statut</th></tr></thead>
        <tbody>${completionRows}</tbody>
      </table>
      <div class="small">Si un regard est incomplet, ses scores ne doivent pas être sur-interprétés.</div>
    </div>

    <div class="card">
      <h2>Totaux par grands chapitres</h2>
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
        <tbody>${totalsTableRows}</tbody>
      </table>
    </div>

    ${interpretationText(rankAvg)}

    <div class="card">
      <h2>Classement (lecture rapide)</h2>
      <div class="grid two">
        <div class="kpi">
          <div class="kpititle">Auto-évaluation</div>
          ${rankAuto.map(r => `
            <div class="kpirow">
              <div><b>${escapeHtml(r.label)}</b></div>
              <div class="right"><b>${r.score}</b></div>
            </div>
          `).join("")}
        </div>
        <div class="kpi">
          <div class="kpititle">Moyenne des regards</div>
          ${rankAvg.map(r => `
            <div class="kpirow">
              <div><b>${escapeHtml(r.label)}</b></div>
              <div class="right"><b>${r.score}</b></div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>

    ${detailSection("feu")}
    ${detailSection("terre")}
    ${detailSection("metal")}
    ${detailSection("eau")}
    ${detailSection("bois")}

    <div class="card">
      <div class="small">Données stockées localement dans ton navigateur (localStorage). Rien n’est envoyé sur Internet.</div>
    </div>
  `;
}

/* ------------------- Pages Intro/Dynamiques ------------------- */

function mountDynamicPageFixes() {
  // Juste pour sécuriser les boutons si tu utilises des liens “btn”
  // Rien de bloquant ici : si ça ne trouve rien, ça ne fait rien.
  const btnToQuestionnaire = document.querySelectorAll('[data-go="questionnaire"]');
  btnToQuestionnaire.forEach(b => {
    b.addEventListener("click", () => (location.href = "questionnaire-auto.html"));
  });
}

/* ------------------------- Boot -------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  mountQuestionnaire();
  mountResults();
  mountDynamicPageFixes();
});
