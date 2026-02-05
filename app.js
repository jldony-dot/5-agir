/* =========
   5 Agir – app.js (version figée / neutre / multi-questionnaires)
   - 30 phrases officielles (figées)
   - Questionnaire neutre (aucun Agir affiché)
   - Auto + 3 regards (pages distinctes via body[data-form])
   - Regards affichés en "Il/Elle ..." (3e personne)
   - 0–5 par phrase, total strict = 30
   - Ordre mélangé (stable par questionnaire)
   - Résultats: regroupement par Agir + moyenne regards + comparaison + synthèse
========= */

const FORMS = ["auto", "regard1", "regard2", "regard3"];
const SUBJECT_KEY = "jld_5agir_subject_v2";

const ELEMENTS = [
  { key: "FEU", label: "Feu", tagline: "relation, expression, énergie, rayonnement" },
  { key: "TERRE", label: "Terre", tagline: "lien, stabilité, régulation, cohésion" },
  { key: "MÉTAL", label: "Métal", tagline: "structure, exigence, discernement, cadre" },
  { key: "EAU", label: "Eau", tagline: "profondeur, temps long, fondations, sens" },
  { key: "BOIS", label: "Bois", tagline: "élan, action, mouvement, conquête" },
];

/* --- 30 phrases officielles (ne pas modifier sans décision explicite) --- */
const PHRASES = [
  // FEU (1–6)
  "Je suis optimiste.",
  "Je suis à l’aise à l’oral.",
  "Je suis attentif(ve) au collectif.",
  "Je suis à l’aise pour me mettre en avant.",
  "J’insuffle de l’enthousiasme autour de moi.",
  "Je suis à l’écoute des autres.",
  // TERRE (7–12)
  "Je suis bienveillant(e).",
  "Je suis empathique.",
  "Je suis capable de faire le lien entre les personnes.",
  "Je suis pragmatique.",
  "Je suis juste.",
  "J’aime transmettre.",
  // MÉTAL (13–18)
  "Je suis rigoureux / rigoureuse.",
  "Je suis rationnel(le).",
  "Je suis analytique.",
  "Je suis attentif(ve) aux détails.",
  "Je suis objectif(ve).",
  "Je suis réaliste.",
  // EAU (19–24)
  "Je suis patient(e).",
  "Je suis discret(e).",
  "Je suis fidèle à mes principes.",
  "Je suis prudent(e).",
  "Je suis capable de prendre du recul.",
  "Je capitalise pour durer.",
  // BOIS (25–30)
  "Je suis orienté(e) action.",
  "Je suis audacieux / audacieuse.",
  "Je suis efficace.",
  "Je suis tenace.",
  "Je suis créatif / créative.",
  "Je suis impatient(e).",
];

/* ---------- Utils ---------- */

function $(id) { return document.getElementById(id); }

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function clampInt(v, min, max){
  const n = parseInt(v, 10);
  if(Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function getForm(){
  const f = document.body?.dataset?.form;
  return FORMS.includes(f) ? f : null;
}

function storageKey(form){
  return `jld_5agir_${form}_v2`;
}

function loadSubjectName(){
  return (localStorage.getItem(SUBJECT_KEY) || "").trim();
}
function saveSubjectName(name){
  localStorage.setItem(SUBJECT_KEY, (name || "").trim());
}

function defaultState(){
  return {
    meta: {
      subject: "",
      evaluator: "",
      displayOrder: null, // tableau d’index 0..29
    },
    // answers[i] = 0..5
    answers: Array.from({ length: PHRASES.length }, () => 0),
  };
}

function loadState(form){
  try{
    const raw = localStorage.getItem(storageKey(form));
    if(!raw) return defaultState();
    const s = JSON.parse(raw);

    // garde-fous
    if(!Array.isArray(s.answers) || s.answers.length !== PHRASES.length){
      s.answers = defaultState().answers;
    }
    s.meta = s.meta || defaultState().meta;
    return s;
  }catch(e){
    return defaultState();
  }
}

function saveState(form, state){
  localStorage.setItem(storageKey(form), JSON.stringify(state));
}

function clearState(form){
  localStorage.removeItem(storageKey(form));
}

function isRegard(form){
  return form && form !== "auto";
}

/* --- util demandé : mapping index -> Agir (via la position 0..29) --- */
function elementForIndex(index) {
  if (index >= 0 && index <= 5) return "FEU";
  if (index >= 6 && index <= 11) return "TERRE";
  if (index >= 12 && index <= 17) return "MÉTAL";
  if (index >= 18 && index <= 23) return "EAU";
  if (index >= 24 && index <= 29) return "BOIS";
  return "";
}

/* --- "Je..." -> "Il/Elle..." pour les regards --- */
function toThirdPersonFR(s){
  let out = String(s).trim();

  // Remplacements simples, suffisants pour nos 30 phrases
  out = out.replace(/^Je suis\b/i, "Il/Elle est");
  out = out.replace(/^J’aime\b/i, "Il/Elle aime");
  out = out.replace(/^J’insuffle\b/i, "Il/Elle insuffle");
  out = out.replace(/^Je capitalise\b/i, "Il/Elle capitalise");
  out = out.replace(/\bautour de moi\b/gi, "autour de lui/d’elle");

  // ponctuation finale
  if(!out.endsWith(".")) out = out + ".";
  return out;
}

function getOrCreateDisplayOrder(form, state){
  const ok = Array.isArray(state.meta.displayOrder) && state.meta.displayOrder.length === PHRASES.length;
  if(ok) return state.meta.displayOrder;

  const order = Array.from({ length: PHRASES.length }, (_,i)=>i);

  // Fisher–Yates
  for(let i=order.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  state.meta.displayOrder = order;
  saveState(form, state);
  return order;
}

function sumTotalPoints(answers){
  return answers.reduce((acc, v)=> acc + clampInt(v, 0, 5), 0);
}

function sumByElements(answers){
  const totals = { "FEU":0, "TERRE":0, "MÉTAL":0, "EAU":0, "BOIS":0 };
  for(let i=0; i<PHRASES.length; i++){
    const e = elementForIndex(i);
    totals[e] += clampInt(answers[i], 0, 5);
  }
  return totals;
}

function rankingFromTotals(totals){
  const arr = ELEMENTS.map(e => ({
    key: e.key,
    label: e.label,
    score: totals[e.key] ?? 0,
    tagline: e.tagline
  }));
  arr.sort((a,b)=> b.score - a.score);
  return arr;
}

function averageTotals(listTotals){
  const out = { "FEU":0, "TERRE":0, "MÉTAL":0, "EAU":0, "BOIS":0 };
  if(listTotals.length === 0) return out;

  for(const t of listTotals){
    for(const k of Object.keys(out)){
      out[k] += (t[k] ?? 0);
    }
  }
  for(const k of Object.keys(out)){
    out[k] = Math.round(out[k] / listTotals.length);
  }
  return out;
}

function setActiveNav(){
  const links = document.querySelectorAll("[data-nav]");
  const path = location.pathname.split("/").pop();
  links.forEach(a=>{
    if(a.getAttribute("href") === path) a.classList.add("active");
  });
}

/* ---------- Questionnaire ---------- */

function updateProgressUI(form){
  const state = loadState(form);
  const total = sumTotalPoints(state.answers);

  const bar = $("progress");
  const txt = $("progressText");
  if(bar){ bar.max = 30; bar.value = total; }
  if(txt){ txt.textContent = `${total} / 30 points`; }

  const warn = $("totalWarn");
  if(warn){
    if(total < 30){
      warn.textContent = "Le total doit faire exactement 30.";
      warn.className = "warn";
    } else if(total === 30){
      warn.textContent = "Parfait. Tu peux afficher les résultats.";
      warn.className = "notice";
    } else {
      warn.textContent = `Tu as dépassé 30 points (${total}). Retire ${total - 30} point(s) pour revenir à 30.`;
      warn.className = "warn";
    }
  }

  const goBtn = $("goResults");
  if(goBtn) goBtn.disabled = (total !== 30);
}

function mountQuestionnaire(){
  const form = getForm();
  const wrap = $("questionnaire");
  if(!form || !wrap) return;

  const state = loadState(form);

  // Champs meta
  const subject = $("subject");
  const evaluator = $("evaluator");

  const subjectSaved = loadSubjectName();
  if(subject){
    subject.value = state.meta.subject || subjectSaved || "";
    subject.addEventListener("input", ()=>{
      state.meta.subject = subject.value;
      saveState(form, state);
      saveSubjectName(subject.value);
    });
  }

  if(evaluator){
    evaluator.value = state.meta.evaluator || "";
    evaluator.addEventListener("input", ()=>{
      state.meta.evaluator = evaluator.value;
      saveState(form, state);
    });
  } else {
    // auto : évaluateur implicite
    state.meta.evaluator = "Auto-évaluation";
    saveState(form, state);
  }

  // Génère la liste neutre (ordre mélangé stable)
  wrap.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>Items</h2>
    <p class="small">Attribue une note de 0 à 5, puis ajuste pour obtenir un total exact de 30. Aucun item n’est “meilleur” qu’un autre.</p>
  `;

  const list = document.createElement("div");
  const order = getOrCreateDisplayOrder(form, state);

  order.forEach((idx)=>{
    const row = document.createElement("div");
    row.className = "row";

    const phrase = isRegard(form) ? toThirdPersonFR(PHRASES[idx]) : PHRASES[idx];

    const left = document.createElement("div");
    left.innerHTML = `<label>${escapeHtml(phrase)}</label>`;

    const right = document.createElement("div");
    right.className = "right";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "5";
    input.step = "1";
    input.seal = "true";

    input.value = clampInt(state.answers[idx] ?? 0, 0, 5);

    input.addEventListener("input", ()=>{
      const before = sumTotalPoints(loadState(form).answers);

      const v = clampInt(input.value, 0, 5);
      state.answers[idx] = v;
      saveState(form, state);

      const after = sumTotalPoints(loadState(form).answers);
      updateProgressUI(form);

      if(before <= 30 && after > 30){
        alert(`Tu as dépassé 30 points (${after}). Ajuste pour revenir à 30.`);
      }
    });

    const hint = document.createElement("span");
    hint.className = "small";
    hint.textContent = "0–5";

    right.appendChild(input);
    right.appendChild(hint);

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  });

  card.appendChild(list);
  wrap.appendChild(card);

  // Boutons
  const resetBtn = $("reset");
  if(resetBtn){
    resetBtn.addEventListener("click", ()=>{
      if(!confirm("Réinitialiser ce questionnaire ?")) return;
      clearState(form);
      location.reload();
    });
  }

  const goBtn = $("goResults");
  if(goBtn){
    goBtn.addEventListener("click", ()=>{
      const total = sumTotalPoints(loadState(form).answers);
      if(total !== 30){
        alert(`Le questionnaire doit totaliser 30 points. Actuellement : ${total}.`);
        return;
      }
      location.href = "resultats.html";
    });
  }

  updateProgressUI(form);
}

/* ---------- Résultats ---------- */

function readFormPayload(form){
  const s = loadState(form);
  const totalPoints = sumTotalPoints(s.answers);
  const totals = sumByElements(s.answers);

  const subject = (s.meta.subject || loadSubjectName() || "").trim();
  const evaluator =
    (form === "auto")
      ? "Auto-évaluation"
      : (s.meta.evaluator || "").trim();

  return {
    form,
    subject,
    evaluator,
    totalPoints,
    complete: totalPoints === 30,
    totals,
    rank: rankingFromTotals(totals),
  };
}

function interpretKey(key){
  const map = {
    "BOIS":  { plus:"Cap, action, conquête.", risk:"Impatience, dispersion.", move:"Choisir 1 priorité claire, tenir un rythme simple." },
    "FEU":   { plus:"Énergie relationnelle, expression, mobilisation.", risk:"Agitation, sur-réaction.", move:"Canaliser : 1 message, 1 engagement concret." },
    "TERRE": { plus:"Cohésion, stabilité, régulation.", risk:"Évitement, inertie.", move:"Clarifier les règles du jeu et assumer les décisions." },
    "MÉTAL": { plus:"Structure, exigence, clarté.", risk:"Rigidité, dureté.", move:"Décider net sans durcir ; simplifier les standards." },
    "EAU":   { plus:"Recul, sens, profondeur.", risk:"Hésitation, retrait.", move:"Petites étapes + feedback court pour relancer." },
  };
  return map[key] || { plus:"", risk:"", move:"" };
}

function interpretationCard(title, rank){
  const top = rank[0], second = rank[1], last = rank[rank.length-1];
  const A = interpretKey(top.key), B = interpretKey(second.key), C = interpretKey(last.key);

  return `
    <div class="card">
      <h2>${escapeHtml(title)}</h2>
      <p><b>Dominante (${escapeHtml(top.label)})</b> : ${escapeHtml(A.plus)}</p>
      <p class="small">Vigilance : ${escapeHtml(A.risk)}</p>
      <p><b>Appui naturel (${escapeHtml(second.label)})</b> : ${escapeHtml(B.plus)}</p>
      <p><b>Zone à sécuriser (${escapeHtml(last.label)})</b> : ${escapeHtml(C.plus)}</p>
      <p class="small">Ce n’est pas un défaut. Piste : ${escapeHtml(C.move)}</p>
      <div class="notice">Lecture utile : comment la personne décide, influence, structure, stabilise, et donne du sens. Ensuite on relie ça aux enjeux réels.</div>
    </div>
  `;
}

function buildComparisonCard(payloads){
  const complete = payloads.filter(p=>p.complete);
  if(complete.length === 0){
    return `<div class="warn">Aucun questionnaire complet : pas de comparaison possible.</div>`;
  }

  const rows = complete.map(p=>{
    const label = (p.form === "auto") ? "Auto" : `Regard ${p.form.replace("regard","")}`;
    const who = (p.form === "auto") ? "Auto-évaluation" : (p.evaluator || "—");
    const top = p.rank[0];
    const last = p.rank[p.rank.length-1];
    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(who)}</td>
        <td>${escapeHtml(top.label)} (${top.score})</td>
        <td>${escapeHtml(last.label)} (${last.score})</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="card">
      <h2>Comparaison rapide</h2>
      <table class="table">
        <thead><tr><th>Source</th><th>Évaluateur</th><th>Dominante</th><th>Point bas</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="btnrow">
        <button id="copyGlobal" class="primary">Copier un résumé global</button>
      </div>
      <div class="footer">Astuce : les écarts entre auto et regards sont souvent l’information la plus utile.</div>
    </div>
  `;
}

function buildGlobalSummary(payloads){
  const subject = (payloads.find(p=>p.subject)?.subject || loadSubjectName() || "—").trim();
  const complete = payloads.filter(p=>p.complete);

  const lines = [];
  lines.push(`Portrait chinois de : ${subject}`);
  lines.push(`Questionnaires complets : ${complete.length}/4`);

  for(const p of complete){
    const label = (p.form === "auto") ? "Auto" : `Regard ${p.form.replace("regard","")}`;
    const who = (p.form === "auto") ? "Auto-évaluation" : (p.evaluator || "—");
    const top = p.rank[0];
    const last = p.rank[p.rank.length-1];
    lines.push(`- ${label} (${who}) : dominante ${top.label} (${top.score}), point bas ${last.label} (${last.score})`);
  }
  return lines.join("\n");
}

function mountResults(){
  const root = $("results");
  if(!root) return;

  const payloads = FORMS.map(readFormPayload);
  const subject = (payloads.find(p=>p.subject)?.subject || loadSubjectName() || "").trim() || "—";

  const auto = payloads.find(p=>p.form === "auto");
  const regards = payloads.filter(p=>p.form !== "auto" && p.complete);
  const avgRegards = rankingFromTotals(averageTotals(regards.map(r=>r.totals)));

  root.innerHTML = `
    <div class="card">
      <h2>Résultats – Portrait chinois de : ${escapeHtml(subject)}</h2>
      <div class="notice">
        <div><b>Auto-évaluation</b> + <b>3 regards</b> : l’objectif est d’obtenir un portrait plus fiable, en croisant le vécu intérieur et le regard de l’entourage.</div>
        <div class="small">Rappel : ce n’est pas un jugement. C’est une photographie du moment présent.</div>
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
        <tbody>
          ${payloads.map(p=>{
            const label = p.form==="auto" ? "Auto-évaluation" : `Regard ${p.form.replace("regard","")}`;
            const who = p.form==="auto" ? "Auto-évaluation" : (p.evaluator || "—");
            const st = p.complete ? "Complet (30/30)" : `Incomplet (${p.totalPoints}/30)`;
            return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(who)}</td><td>${escapeHtml(st)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    ${auto.complete ? interpretationCard("Lecture – Auto-évaluation", auto.rank) :
      `<div class="warn">Auto-évaluation incomplète : complète d’abord l’auto-évaluation (30 points) pour activer la lecture.</div>`}

    ${regards.length ? interpretationCard(`Lecture – Moyenne des regards (${regards.length}/3)`, avgRegards) :
      `<div class="warn">Aucun regard complet pour l’instant : termine au moins 1 questionnaire “regard” (30 points) pour activer la moyenne.</div>`}

    ${buildComparisonCard(payloads)}
  `;

  const copyBtn = $("copyGlobal");
  if(copyBtn){
    copyBtn.addEventListener("click", async ()=>{
      const text = buildGlobalSummary(payloads);
      await navigator.clipboard.writeText(text);
      alert("Résumé copié.");
    });
  }
}

/* ---------- Boot ---------- */

document.addEventListener("DOMContentLoaded", ()=>{
  setActiveNav();
  mountQuestionnaire();
  mountResults();
});