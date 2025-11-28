// ---------- STATE ----------

const STORAGE_KEY = "soulFruitSystem_v1";

let state = {
  souls: [], // {id,name,power,fear,attachment,sl,spu,active,traitsText}
  buffsCatalog: {}, // id -> buff definition
  buffTargets: {}, // id -> {id,name,type:'self'|'ally'|'homie',buffs:{buffId:count},notes:''}
  homies: [], // {id,name,body,durability,element,soulIds,stats,inheritedTraits}
  abilities: [], // {id,name,role,description,action,range,target,save,dc,damage,mechanical,combo,targetId}
  ui: {
    collapsedPanels: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
    currentBuffTargetId: "self",
    buffToolsView: "hide",
    lastDC: null,
    nextIds: { soul: 1, homie: 1, ally: 1, ability: 1 }
  }
};

// ---------- UTIL ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = {
        ...state,
        ...saved,
        ui: {
          ...state.ui,
          ...(saved.ui || {})
        }
      };
    }
  } catch (err) {
    console.error("Failed to load state", err);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save state", err);
  }
}

function nextId(kind) {
  const id = `${kind}-${state.ui.nextIds[kind] || 1}`;
  state.ui.nextIds[kind] = (state.ui.nextIds[kind] || 1) + 1;
  return id;
}

function qs(sel) {
  return document.querySelector(sel);
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ---------- BUFFS CATALOG ----------

function createDefaultBuffs() {
  const buffs = {};
  const add = (buff) => {
    buffs[buff.id] = buff;
  };

  // Defensive
  add({
    id: "temp25",
    name: "Soul Ward (+25 Temp HP)",
    category: "defense",
    baseCost: 10,
    description:
      "A fragment of soul energy forms a warding shell, granting 25 temporary hit points.",
    effect: { type: "tempHP", amount: 25 }
  });

  add({
    id: "temp60",
    name: "Great Soul Ward (+60 Temp HP)",
    category: "defense",
    baseCost: 18,
    description:
      "A massive barrier of collected souls grants 60 temporary hit points.",
    effect: { type: "tempHP", amount: 60 }
  });

  add({
    id: "soulArmor",
    name: "Soul Armor (+1 AC)",
    category: "defense",
    baseCost: 16,
    description:
      "Orbiting soul fragments harden into armor, granting +1 AC per stack.",
    effect: { type: "ac", amount: 1 }
  });

  add({
    id: "terrorShell",
    name: "Terror Shell (Resist mundane weapons)",
    category: "defense",
    baseCost: 22,
    description:
      "Terrified spirits absorb mundane blows. Grants resistance to non-magical bludgeoning, piercing, and slashing damage. Stacks can add more uses or extend to allies.",
    effect: { type: "tag", tag: "mundaneResist" }
  });

  // Mobility
  add({
    id: "soulStride",
    name: "Soul Stride (+10 ft Movement)",
    category: "mobility",
    baseCost: 10,
    description:
      "Body is lightened by soul energy. Gain +10 ft walking speed per stack.",
    effect: { type: "speed", amount: 10 }
  });

  add({
    id: "soulStep30",
    name: "Soul Step (30 ft)",
    category: "mobility",
    baseCost: 18,
    description:
      "Step through the echo of your own soul, teleporting up to 30 ft. Stacks increase uses or distance.",
    effect: { type: "tag", tag: "soulStep30" }
  });

  add({
    id: "soulStep60",
    name: "Soul Step (60 ft)",
    category: "mobility",
    baseCost: 26,
    description:
      "Greater soul-step up to 60 ft. Stacks increase uses or distance.",
    effect: { type: "tag", tag: "soulStep60" }
  });

  // Saves & checks
  const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

  ABILITIES.forEach((ab) => {
    add({
      id: `plus2_${ab.toLowerCase()}_save`,
      name: `+2 ${ab} Save Bonus`,
      category: "saves",
      baseCost: 22,
      description: `Guardian souls shield your ${ab} saving throws. +2 per stack.`,
      effect: { type: "saveBonus", ability: ab, amountPerStack: 2 }
    });
  });

  ABILITIES.forEach((ab) => {
    add({
      id: `adv_${ab.toLowerCase()}_save`,
      name: `Advantage on ${ab} saves`,
      category: "saves",
      baseCost: 26,
      description: `Loyal souls warn you of danger, granting advantage on ${ab} saves.`,
      effect: { type: "advSave", ability: ab }
    });
  });

  ABILITIES.forEach((ab) => {
    add({
      id: `adv_${ab.toLowerCase()}_check`,
      name: `Advantage on ${ab} checks`,
      category: "checks",
      baseCost: 20,
      description: `Whispering spirits guide your ${ab} checks, granting advantage.`,
      effect: { type: "advCheck", ability: ab }
    });
  });

  // Offensive / control
  add({
    id: "soulBlade",
    name: "Soul-Forged Weapon",
    category: "offense",
    baseCost: 16,
    description:
      "Create a weapon made of condensed souls. Counts as magical; stacks can add riders like extra necrotic damage.",
    effect: { type: "tag", tag: "soulBlade" }
  });

  add({
    id: "severedLifespan",
    name: "Severed Lifespan Strike",
    category: "offense",
    baseCost: 24,
    description:
      "Attacks leech lifespan on hit, dealing bonus necrotic damage and healing you or adding SPU (DM adjudicates).",
    effect: { type: "tag", tag: "lifespanStrike" }
  });

  add({
    id: "soulBind",
    name: "Soul Bind",
    category: "control",
    baseCost: 24,
    description:
      "Chains of soul-light clamp down on a foe, restraining them on a failed save. Stacks can increase DC, range, or number of targets.",
    effect: { type: "tag", tag: "soulBind" }
  });

  return buffs;
}

// Exponential cost across stacks
function buffStackCost(base, count) {
  let total = 0;
  for (let i = 1; i <= count; i++) {
    if (i === 1) total += base;
    else total += Math.round(base * (1 + 0.5 * (i - 1) * (i - 1)));
  }
  return total;
}

function nextBuffIncrementCost(base, count) {
  const nextIndex = count + 1;
  if (nextIndex === 1) return base;
  return Math.round(base * (1 + 0.5 * (nextIndex - 1) * (nextIndex - 1)));
}

// ---------- INIT BASE STATE ----------

function ensureBaseState() {
  if (!state.buffsCatalog || Object.keys(state.buffsCatalog).length === 0) {
    state.buffsCatalog = createDefaultBuffs();
  }
  if (!state.buffTargets || Object.keys(state.buffTargets).length === 0) {
    const selfTarget = {
      id: "self",
      type: "self",
      name: "Soul Fruit User",
      buffs: {},
      notes: ""
    };
    state.buffTargets[selfTarget.id] = selfTarget;
    state.ui.currentBuffTargetId = "self";
  } else if (!state.buffTargets[state.ui.currentBuffTargetId]) {
    const first = Object.values(state.buffTargets)[0];
    state.ui.currentBuffTargetId = first.id;
  }
}

// ---------- PANEL 1: SOUL CALC ----------

function computeSoulLevel(power, fear, attachment) {
  const pNorm = Math.max(0, Math.min(20, power)) / 20;
  const fNorm = Math.max(0, Math.min(10, fear)) / 10;
  const aNorm = Math.max(0, Math.min(10, attachment)) / 10;

  const p = 0.4 + 0.7 * pNorm;
  const f = 0.4 + 0.6 * fNorm;
  const a = 0.4 + 0.6 * aNorm;

  const overall = p * f * a;
  const scaled = overall * overall;

  const SL = Math.max(1, Math.round(overall * 10)); // 1–10
  const SPU = Math.max(1, Math.round(scaled * 1000)); // 1–1000, top souls near 1000

  return { SL, SPU, components: { p, f, a, overall } };
}

function handleCalcSoul() {
  const name = qs("#soul-name").value.trim() || "Unnamed Soul";
  const power = Number(qs("#soul-power").value || 0);
  const fear = Number(qs("#soul-fear").value || 0);
  const attachment = Number(qs("#soul-attachment").value || 0);

  const { SL, SPU, components } = computeSoulLevel(power, fear, attachment);
  const out = qs("#soul-calc-output");
  out.innerHTML = `
    <strong>${name}</strong> → <strong>Soul Level ${SL}</strong>, <strong>${SPU} SPU</strong><br/>
    <span class="muted">Breakdown (normalized): Power ${components.p.toFixed(
      2
    )}, Fear ${components.f.toFixed(2)}, Attachment ${components.a.toFixed(
    2
  )}.<br/>Perfect 1000 SPU only happens for absurdly strong, terrified, and emotionally heavy souls.</span>
  `;
}

function handleAddSoul() {
  const name = qs("#soul-name").value.trim() || "Unnamed Soul";
  const power = Number(qs("#soul-power").value || 0);
  const fear = Number(qs("#soul-fear").value || 0);
  const attachment = Number(qs("#soul-attachment").value || 0);

  const { SL, SPU } = computeSoulLevel(power, fear, attachment);

  const soul = {
    id: nextId("soul"),
    name,
    power,
    fear,
    attachment,
    soulLevel: SL,
    spu: SPU,
    active: true,
    traitsText: ""
  };

  state.souls.push(soul);
  renderSouls();
  updateSoulTotals();
  renderHomieSoulSelect();
  renderHomieStatIfVisible();
  renderSummary();
  saveState();
}

// ---------- PANEL 2: SOUL LIST & TOTALS ----------

function computeSPUTotals() {
  const totalSPU = state.souls
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.spu, 0);

  let spent = 0;
  Object.values(state.buffTargets).forEach((target) => {
    Object.entries(target.buffs || {}).forEach(([buffId, count]) => {
      const def = state.buffsCatalog[buffId];
      if (!def) return;
      spent += buffStackCost(def.baseCost, count);
    });
  });

  return {
    total: totalSPU,
    spent,
    available: Math.max(0, totalSPU - spent)
  };
}

function updateSoulTotals() {
  const totals = computeSPUTotals();
  qs("#total-spu").textContent = totals.total;
  qs("#spent-spu").textContent = totals.spent;
  qs("#available-spu").textContent = totals.available;

  renderSelectedBuffsSummary();
  renderSummary();
  saveState();
}

function renderSouls() {
  const container = qs("#soul-list");
  container.innerHTML = "";
  if (!state.souls.length) {
    container.innerHTML =
      '<p class="muted">No souls stored yet. Add one in panel 1.</p>';
    return;
  }

  state.souls.forEach((soul) => {
    const card = document.createElement("div");
    card.className = "soul-card";

    const header = document.createElement("div");
    header.className = "soul-card-header";
    const nameEl = document.createElement("div");
    nameEl.className = "soul-name";
    nameEl.textContent = soul.name;
    const tag = document.createElement("span");
    tag.className = "soul-tag";
    tag.textContent = `SL ${soul.soulLevel} | ${soul.spu} SPU`;
    header.appendChild(nameEl);
    header.appendChild(tag);

    const meta = document.createElement("small");
    meta.textContent = `Power ${soul.power}/20 · Fear ${soul.fear}/10 · Attachment ${soul.attachment}/10`;

    const traitsField = document.createElement("div");
    traitsField.className = "field";
    const lbl = document.createElement("label");
    lbl.textContent =
      "Notes / traits of this soul (1 per line). Used as inherited tricks for homies.";
    const ta = document.createElement("textarea");
    ta.rows = 3;
    ta.value = soul.traitsText || "";
    ta.addEventListener("input", () => {
      soul.traitsText = ta.value;
      renderHomieStatIfVisible();
      renderSummary();
      saveState();
    });
    traitsField.appendChild(lbl);
    traitsField.appendChild(ta);

    const activeRow = document.createElement("div");
    activeRow.className = "soul-active-row";
    const activeLabel = document.createElement("label");
    const activeCheckbox = document.createElement("input");
    activeCheckbox.type = "checkbox";
    activeCheckbox.checked = soul.active;
    activeCheckbox.addEventListener("change", () => {
      soul.active = activeCheckbox.checked;
      updateSoulTotals();
      renderHomieSoulSelect();
      renderHomieStatIfVisible();
    });
    activeLabel.appendChild(activeCheckbox);
    activeLabel.appendChild(
      document.createTextNode(" Active (contributes SPU)")
    );

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-danger small-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      state.souls = state.souls.filter((x) => x.id !== soul.id);
      state.homies.forEach((h) => {
        h.soulIds = h.soulIds.filter((id) => id !== soul.id);
      });
      renderSouls();
      updateSoulTotals();
      renderHomieSoulSelect();
      renderHomieStatIfVisible();
      renderSummary();
      saveState();
    });

    activeRow.appendChild(activeLabel);
    activeRow.appendChild(removeBtn);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(traitsField);
    card.appendChild(activeRow);

    container.appendChild(card);
  });
}

// ---------- PANEL 3: BOONS / BUFFS ----------

function ensureBuffTarget(id) {
  if (!state.buffTargets[id]) {
    state.buffTargets[id] = {
      id,
      name: id,
      type: "ally",
      buffs: {},
      notes: ""
    };
  }
  return state.buffTargets[id];
}

function renderBuffTargetSelect() {
  const select = qs("#buff-target-select");
  select.innerHTML = "";

  const targets = Object.values(state.buffTargets);
  targets.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  });

  if (!targets.length) return;

  if (
    !state.ui.currentBuffTargetId ||
    !state.buffTargets[state.ui.currentBuffTargetId]
  ) {
    state.ui.currentBuffTargetId = targets[0].id;
  }
  select.value = state.ui.currentBuffTargetId;

  select.onchange = () => {
    state.ui.currentBuffTargetId = select.value;
    renderBuffCards();
    renderSelectedBuffsSummary();
    renderSummary();
    saveState();
  };
}

function handleAddAllyTarget() {
  const name = qs("#ally-name-input").value.trim();
  if (!name) return;
  const id = nextId("ally");
  state.buffTargets[id] = {
    id,
    type: "ally",
    name,
    buffs: {},
    notes: ""
  };
  qs("#ally-name-input").value = "";
  renderBuffTargetSelect();
  renderSummary();
  saveState();
}

function adjustBuffStacks(buffId, delta) {
  const target = state.buffTargets[state.ui.currentBuffTargetId];
  if (!target) return;
  const current = target.buffs[buffId] || 0;
  let next = current + delta;
  if (next < 0) next = 0;
  target.buffs[buffId] = next;
  if (next === 0) delete target.buffs[buffId];

  renderBuffCards();
  updateSoulTotals();
}

function renderBuffCards() {
  const container = qs("#buff-cards-container");
  container.innerHTML = "";

  const target = state.buffTargets[state.ui.currentBuffTargetId];
  if (!target) {
    container.innerHTML = "<p>No target selected.</p>";
    return;
  }

  const buffList = Object.values(state.buffsCatalog);

  buffList.forEach((buff) => {
    const card = document.createElement("div");
    card.className = "buff-card";

    const header = document.createElement("div");
    header.className = "buff-card-header";
    const nameEl = document.createElement("div");
    nameEl.className = "buff-name";
    nameEl.textContent = buff.name;
    const meta = document.createElement("div");
    meta.className = "buff-meta";
    meta.textContent = `Base ${buff.baseCost} SPU · ${buff.category}`;
    header.appendChild(nameEl);
    header.appendChild(meta);

    const desc = document.createElement("div");
    desc.className = "buff-description";
    desc.textContent = buff.description;

    const stacksRow = document.createElement("div");
    stacksRow.className = "buff-stacks-row";

    const currentStacks = target.buffs[buff.id] || 0;
    const totalCost = buffStackCost(buff.baseCost, currentStacks);
    const nextCost = nextBuffIncrementCost(buff.baseCost, currentStacks);

    const info = document.createElement("span");
    info.innerHTML = `Copies: <strong>${currentStacks}</strong> · SPU spent here: <strong>${totalCost}</strong><br/>Next copy will cost: <strong>${nextCost}</strong> SPU`;

    const controls = document.createElement("div");
    controls.className = "stack-controls";
    const minus = document.createElement("button");
    minus.className = "stack-btn";
    minus.textContent = "−";
    minus.onclick = () => adjustBuffStacks(buff.id, -1);
    const plus = document.createElement("button");
    plus.className = "stack-btn";
    plus.textContent = "+";
    plus.onclick = () => adjustBuffStacks(buff.id, +1);
    controls.appendChild(minus);
    controls.appendChild(plus);

    stacksRow.appendChild(info);
    stacksRow.appendChild(controls);

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(stacksRow);

    container.appendChild(card);
  });
}

function renderSelectedBuffsSummary() {
  const box = qs("#selected-buffs-summary");
  const target = state.buffTargets[state.ui.currentBuffTargetId];
  if (!target) {
    box.innerHTML = "<p>No target selected.</p>";
    return;
  }

  const entries = Object.entries(target.buffs || {});
  if (!entries.length) {
    box.innerHTML = `<p>No boons spent on <strong>${target.name}</strong> yet.</p>`;
    return;
  }

  let html = `<p>Boons on <strong>${target.name}</strong>:</p><ul>`;
  entries.forEach(([buffId, count]) => {
    const def = state.buffsCatalog[buffId];
    if (!def) return;
    const totalCost = buffStackCost(def.baseCost, count);
    let totalEffect = "";
    const eff = def.effect;
    if (eff.type === "tempHP") totalEffect = `Total: +${eff.amount * count} temp HP.`;
    else if (eff.type === "speed")
      totalEffect = `Total: +${eff.amount * count} ft speed.`;
    else if (eff.type === "ac")
      totalEffect = `Total: +${eff.amount * count} AC.`;
    else if (eff.type === "saveBonus")
      totalEffect = `Total: +${eff.amountPerStack * count} to ${eff.ability} saves.`;
    html += `<li><strong>${def.name}</strong> ×${count} – SPU spent: ${totalCost}. ${totalEffect}</li>`;
  });
  html += "</ul>";
  box.innerHTML = html;
}

function handleBuffToolsViewChange() {
  const val = qs("#buff-tools-select").value;
  state.ui.buffToolsView = val;
  const custom = qs("#custom-buff-section");
  const dc = qs("#dc-helper-section");

  custom.classList.add("hidden");
  dc.classList.add("hidden");

  if (val === "custom" || val === "both") custom.classList.remove("hidden");
  if (val === "dc" || val === "both") dc.classList.remove("hidden");
  saveState();
}

function handleAddCustomBuff() {
  const name = qs("#custom-buff-name").value.trim();
  const cost = Number(qs("#custom-buff-cost").value || 0);
  const desc = qs("#custom-buff-desc").value.trim();
  if (!name || cost <= 0) return;

  const id = `custom_${Date.now()}`;
  state.buffsCatalog[id] = {
    id,
    name,
    category: "custom",
    baseCost: cost,
    description: desc || "Custom soul boon / contract.",
    effect: { type: "tag", tag: "custom" }
  };

  qs("#custom-buff-name").value = "";
  qs("#custom-buff-cost").value = "10";
  qs("#custom-buff-desc").value = "";

  renderBuffCards();
  saveState();
}

function handleCalcDC() {
  const sl = Number(qs("#dc-helper-sl").value || 0);
  const prof = Number(qs("#dc-helper-prof").value || 0);
  const mod = Number(qs("#dc-helper-mod").value || 0);

  const dc = 8 + prof + mod + Math.floor(sl / 2);
  state.ui.lastDC = dc;

  const out = qs("#dc-helper-output");
  out.innerHTML = `Suggested DC for soul techniques: <strong>${dc}</strong><br/><span class="muted">Formula: 8 + prof + ability mod + floor(SL / 2).</span>`;
  renderSummary();
  saveState();
}

// ---------- PANEL 4: HOMIE CREATION ----------

function renderHomieSoulSelect() {
  const sel = qs("#homie-soul-select");
  sel.innerHTML = "";
  state.souls.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} (SL ${s.soulLevel}, ${s.spu} SPU)`;
    sel.appendChild(opt);
  });
}

function getSoulsForHomie(mode, selectedIds) {
  if (!state.souls.length) return [];
  if (mode === "all") return [...state.souls];
  if (mode === "active") return state.souls.filter((s) => s.active);
  if (mode === "selected") {
    const set = new Set(selectedIds || []);
    return state.souls.filter((s) => set.has(s.id));
  }
  return [];
}

function buildHomieStats(name, body, durability, element, poweringSouls) {
  const slSum = poweringSouls.reduce((sum, s) => sum + s.soulLevel, 0);
  const spuSum = poweringSouls.reduce((sum, s) => sum + s.spu, 0);

  const baseAC = 10 + Math.floor(durability / 2) + Math.floor(slSum / 3);
  const hp = durability * 10 + Math.round(spuSum / 8);
  const speed = 30 + Math.floor(slSum / 2);

  const STR = 8 + durability + Math.floor(slSum / 4);
  const DEX = 8 + Math.floor(slSum / 3);
  const CON = 10 + durability + Math.floor(slSum / 5);
  const INT = 6 + Math.floor(slSum / 5);
  const WIS = 8 + Math.floor(slSum / 5);
  const CHA = 8 + Math.floor(slSum / 4);

  return {
    name,
    body,
    element,
    durability,
    slSum,
    spuSum,
    ac: baseAC,
    hp,
    speed,
    STR,
    DEX,
    CON,
    INT,
    WIS,
    CHA
  };
}

function gatherInheritedTraits(poweringSouls) {
  const set = new Set();
  poweringSouls.forEach((s) => {
    const txt = s.traitsText || "";
    txt
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x.length)
      .forEach((line) => set.add(line));
  });
  return Array.from(set);
}

function upsertHomieRecord(name, stats, soulIds, inheritedTraits) {
  let homie = state.homies.find((h) => h.name === name);
  if (!homie) {
    homie = {
      id: nextId("homie"),
      name,
      body: stats.body,
      durability: stats.durability,
      element: stats.element,
      soulIds: [...soulIds],
      stats,
      inheritedTraits
    };
    state.homies.push(homie);

    state.buffTargets[homie.id] = {
      id: homie.id,
      type: "homie",
      name: homie.name,
      buffs: {},
      notes: ""
    };
  } else {
    homie.body = stats.body;
    homie.durability = stats.durability;
    homie.element = stats.element;
    homie.soulIds = [...soulIds];
    homie.stats = stats;
    homie.inheritedTraits = inheritedTraits;

    if (!state.buffTargets[homie.id]) {
      state.buffTargets[homie.id] = {
        id: homie.id,
        type: "homie",
        name: homie.name,
        buffs: {},
        notes: ""
      };
    }
  }
  return homie;
}

function renderHomieCard(homie) {
  const container = qs("#homie-stat-block");
  container.innerHTML = "";
  if (!homie) return;

  const stats = homie.stats;
  const poweringSouls = state.souls.filter((s) =>
    homie.soulIds.includes(s.id)
  );

  const card = document.createElement("div");
  card.className = "homie-card";

  const header = document.createElement("div");
  header.className = "homie-header-row";
  const nameEl = document.createElement("div");
  nameEl.className = "homie-name";
  nameEl.textContent = stats.name.toUpperCase();
  const tag = document.createElement("div");
  tag.className = "homie-tier-tag";
  tag.textContent = `Homie · ${stats.body} · SL sum ${stats.slSum}, ${stats.spuSum} SPU`;
  header.appendChild(nameEl);
  header.appendChild(tag);

  const pillRow = document.createElement("div");
  pillRow.className = "homie-pill-row";

  const acPill = document.createElement("div");
  acPill.className = "homie-pill";
  acPill.textContent = `AC ${stats.ac}`;

  const hpPill = document.createElement("div");
  hpPill.className = "homie-pill";
  hpPill.textContent = `Hit Points: ~${stats.hp}`;

  const speedPill = document.createElement("div");
  speedPill.className = "homie-pill";
  speedPill.textContent = `Speed ${stats.speed} ft.`;

  const abilityPill = document.createElement("div");
  abilityPill.className = "homie-pill";
  abilityPill.textContent = `STR ${stats.STR} · DEX ${stats.DEX} · CON ${stats.CON} · INT ${stats.INT} · WIS ${stats.WIS} · CHA ${stats.CHA}`;

  const elementPill = document.createElement("div");
  elementPill.className = "homie-pill";
  elementPill.textContent = `Element / Theme: ${stats.element || "—"}`;

  pillRow.appendChild(acPill);
  pillRow.appendChild(hpPill);
  pillRow.appendChild(speedPill);
  pillRow.appendChild(abilityPill);
  pillRow.appendChild(elementPill);

  const traitsSec = document.createElement("div");
  traitsSec.className = "homie-section";
  traitsSec.innerHTML = `<h4>Traits</h4>`;
  const traitsList = document.createElement("ul");

  const addTrait = (t) => {
    const li = document.createElement("li");
    li.textContent = t;
    traitsList.appendChild(li);
  };

  addTrait(
    `Vessel: ${stats.body}. Durability tier ${stats.durability}; hard to destroy for its size.`
  );
  addTrait(
    `Infused Souls: Powered by ${poweringSouls.length} soul(s); total SL ${stats.slSum}, total ${stats.spuSum} SPU.`
  );
  addTrait(
    "Soul Loyalty: Obeys the Soul Fruit user’s commands to the best of its ability."
  );
  addTrait("Senses: Darkvision 60 ft., can perceive soul energy and fear.");
  addTrait(
    "Damage Resistances (DM option): necrotic; bludgeoning, piercing, and slashing from non-magical attacks."
  );
  addTrait(
    "Condition Immunities (DM option): charmed, frightened, exhausted."
  );
  traitsSec.appendChild(traitsList);

  const actionsSec = document.createElement("div");
  actionsSec.className = "homie-section";
  actionsSec.innerHTML = `<h4>Actions</h4>`;
  const actionsList = document.createElement("ul");

  const multi = document.createElement("li");
  multi.textContent =
    "Multiattack: The homie makes two attacks: one basic attack and one soul-flavored attack (chosen when created).";

  const basic = document.createElement("li");
  basic.textContent = `Basic Attack: Melee Weapon Attack: +${
    Math.floor((stats.STR - 10) / 2) + 5
  } to hit, reach 5 ft., one target. Hit: 1d10 + ${
    Math.floor((stats.STR - 10) / 2) + 5
  } bludgeoning, slashing, or piercing damage (depending on body).`;

  const dc = state.ui.lastDC || 15;
  const soulBlast = document.createElement("li");
  soulBlast.textContent = `Soul Burst: Ranged spell-like attack or 15-ft cone. Creatures make a ${"WIS"} saving throw (DC ${dc}) or take 3d8 necrotic damage and become rattled by screaming spirits until the start of their next turn (disadvantage on their next attack roll). On success, half damage and no rattled effect.`;

  actionsList.appendChild(multi);
  actionsList.appendChild(basic);
  actionsList.appendChild(soulBlast);
  actionsSec.appendChild(actionsList);

  const infusedSec = document.createElement("div");
  infusedSec.className = "homie-section";
  infusedSec.innerHTML = `<h4>Infused Souls</h4>`;
  const infusedList = document.createElement("ul");
  if (poweringSouls.length) {
    poweringSouls.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.name} – SL ${s.soulLevel}, ${s.spu} SPU (Power ${s.power}, Fear ${s.fear}, Attachment ${s.attachment})`;
      infusedList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No souls currently powering this homie.";
    infusedList.appendChild(li);
  }
  infusedSec.appendChild(infusedList);

  const inheritedTraits = gatherInheritedTraits(poweringSouls);
  const inheritSec = document.createElement("div");
  inheritSec.className = "homie-section";
  inheritSec.innerHTML = `<h4>Inherited Soul Traits</h4>`;
  const inhList = document.createElement("ul");
  if (inheritedTraits.length) {
    inheritedTraits.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      inhList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No specific traits recorded yet.";
    inhList.appendChild(li);
  }
  inheritSec.appendChild(inhList);

  card.appendChild(header);
  card.appendChild(pillRow);
  card.appendChild(traitsSec);
  card.appendChild(actionsSec);
  card.appendChild(infusedSec);
  card.appendChild(inheritSec);

  container.appendChild(card);
}

function handleGenerateHomie() {
  const name = qs("#homie-name").value.trim() || "Unnamed Homie";
  const body = qs("#homie-body").value.trim() || "Unknown Vessel";
  const durability = Number(qs("#homie-durability").value || 1);
  const element = qs("#homie-element").value.trim() || "Soul Infused";
  const mode = qs("#homie-soul-mode").value;
  const selectedIds = Array.from(
    qs("#homie-soul-select").selectedOptions
  ).map((o) => o.value);

  const poweringSouls = getSoulsForHomie(mode, selectedIds);
  const stats = buildHomieStats(name, body, durability, element, poweringSouls);
  const inheritedTraits = gatherInheritedTraits(poweringSouls);
  const soulIds = poweringSouls.map((s) => s.id);

  const homie = upsertHomieRecord(
    name,
    stats,
    soulIds,
    inheritedTraits
  );

  renderHomieCard(homie);
  renderBuffTargetSelect();
  renderSummary();
  saveState();
}

function renderHomieStatIfVisible() {
  const name = qs("#homie-name").value.trim();
  if (!name) return;
  const homie = state.homies.find((h) => h.name === name);
  if (homie) renderHomieCard(homie);
}

function handleEditBuffsForHomie() {
  const name = qs("#homie-name").value.trim();
  if (!name) return;
  const homie = state.homies.find((h) => h.name === name);
  if (!homie) return;
  state.ui.currentBuffTargetId = homie.id;
  renderBuffTargetSelect();
  renderBuffCards();
  renderSelectedBuffsSummary();
  renderSummary();
  saveState();
  const panel3 = document.querySelector('[data-panel="3"]');
  if (panel3) panel3.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- PANEL 5: ABILITIES ----------

function renderAbilityCards() {
  const container = qs("#ability-cards-container");
  container.innerHTML = "";
  if (!state.abilities.length) {
    container.innerHTML =
      '<p class="muted">No abilities yet. Use AI or add an empty ability card.</p>';
    return;
  }

  const targetOptions = Object.values(state.buffTargets);

  state.abilities.forEach((ab) => {
    const card = document.createElement("div");
    card.className = "ability-card";

    const nameRow = document.createElement("div");
    nameRow.className = "ability-name-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = ab.name || "";
    nameInput.placeholder = "Ability name";
    nameInput.oninput = () => {
      ab.name = nameInput.value;
      saveState();
      renderSummary();
    };

    const targetSel = document.createElement("select");
    targetOptions.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      targetSel.appendChild(opt);
    });
    if (!ab.targetId || !state.buffTargets[ab.targetId]) {
      ab.targetId = state.ui.currentBuffTargetId;
    }
    targetSel.value = ab.targetId;
    targetSel.onchange = () => {
      ab.targetId = targetSel.value;
      saveState();
      renderSummary();
    };

    nameRow.appendChild(nameInput);
    nameRow.appendChild(targetSel);

    const role = document.createElement("div");
    role.className = "ability-role";
    role.textContent =
      "Role: Offense / Defense / Support / Control / Utility";

    const descField = document.createElement("div");
    descField.className = "field ability-main-text";
    const dLabel = document.createElement("label");
    dLabel.textContent = "Description";
    const dTa = document.createElement("textarea");
    dTa.rows = 3;
    dTa.value = ab.description || "";
    autoResizeTextarea(dTa);
    dTa.oninput = () => {
      ab.description = dTa.value;
      autoResizeTextarea(dTa);
      saveState();
    };
    descField.appendChild(dLabel);
    descField.appendChild(dTa);

    const miniGrid = document.createElement("div");
    miniGrid.className = "ability-mini-grid";

    const fields = [
      ["Action", "action"],
      ["Range", "range"],
      ["Target", "target"],
      ["Save", "save"],
      ["DC", "dc"],
      ["Damage", "damage"]
    ];

    fields.forEach(([label, key]) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const l = document.createElement("label");
      l.textContent = label;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = ab[key] || "";
      inp.oninput = () => {
        ab[key] = inp.value;
        saveState();
      };
      wrap.appendChild(l);
      wrap.appendChild(inp);
      miniGrid.appendChild(wrap);
    });

    const mechField = document.createElement("div");
    mechField.className = "field ability-main-text";
    const mLabel = document.createElement("label");
    mLabel.textContent =
      "Mechanical effect: what happens on hit / failed save.";
    const mTa = document.createElement("textarea");
    mTa.rows = 3;
    mTa.value = ab.mechanical || "";
    autoResizeTextarea(mTa);
    mTa.oninput = () => {
      ab.mechanical = mTa.value;
      autoResizeTextarea(mTa);
      saveState();
    };
    mechField.appendChild(mLabel);
    mechField.appendChild(mTa);

    const comboField = document.createElement("div");
    comboField.className = "field ability-main-text";
    const cLabel = document.createElement("label");
    cLabel.textContent =
      "Optional: how this interacts with other powers / combo logic.";
    const cTa = document.createElement("textarea");
    cTa.rows = 2;
    cTa.value = ab.combo || "";
    autoResizeTextarea(cTa);
    cTa.oninput = () => {
      ab.combo = cTa.value;
      autoResizeTextarea(cTa);
      saveState();
    };
    comboField.appendChild(cLabel);
    comboField.appendChild(cTa);

    const footer = document.createElement("div");
    footer.className = "ability-footer-row";

    const left = document.createElement("div");
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-secondary small-btn";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => {
      const text = `${ab.name}\n${ab.description}\nAction: ${ab.action} | Range: ${ab.range} | Target: ${ab.target} | Save: ${ab.save} DC ${ab.dc}\nDamage: ${ab.damage}\n${ab.mechanical}\n${ab.combo}`;
      navigator.clipboard.writeText(text).catch(() => {});
    };
    const rerollBtn = document.createElement("button");
    rerollBtn.type = "button";
    rerollBtn.className = "btn-secondary small-btn";
    rerollBtn.textContent = "Reroll Hint";
    rerollBtn.onclick = () => {
      ab.description =
        ab.description ||
        "Soul energy twists into a new variation of this technique. Describe how the souls change form or personality.";
      dTa.value = ab.description;
      autoResizeTextarea(dTa);
      saveState();
    };
    left.appendChild(copyBtn);
    left.appendChild(rerollBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-danger small-btn";
    delBtn.textContent = "Delete";
    delBtn.onclick = () => {
      state.abilities = state.abilities.filter((x) => x !== ab);
      renderAbilityCards();
      renderSummary();
      saveState();
    };

    footer.appendChild(left);
    footer.appendChild(delBtn);

    card.appendChild(nameRow);
    card.appendChild(role);
    card.appendChild(descField);
    card.appendChild(miniGrid);
    card.appendChild(mechField);
    card.appendChild(comboField);
    card.appendChild(footer);

    container.appendChild(card);
  });
}

function addEmptyAbilityCard() {
  const ab = {
    id: nextId("ability"),
    name: "",
    role: "",
    description: "",
    action: "",
    range: "",
    target: "",
    save: "",
    dc: "",
    damage: "",
    mechanical: "",
    combo: "",
    targetId: state.ui.currentBuffTargetId
  };
  state.abilities.push(ab);
  renderAbilityCards();
  renderSummary();
  saveState();
}

async function generateAbilitiesWithAI() {
  const notes = qs("#ai-notes").value.trim();
  const totals = computeSPUTotals();
  const currentTarget = state.buffTargets[state.ui.currentBuffTargetId];
  const selectedBuffIds = currentTarget ? Object.keys(currentTarget.buffs) : [];

  try {
    const res = await fetch("/api/generate-soul-abilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        souls: state.souls,
        totalSpu: totals.total,
        spentSpu: totals.spent,
        availableSpu: totals.available,
        selectedBuffIds,
        notes
      })
    });

    if (!res.ok) {
      console.error("API error:", await res.text());
      alert("Failed to generate abilities with AI (API error).");
      return;
    }

    const data = await res.json();
    const text = data.text || "";
    // Store as a single big ability card the user can cut apart if they want.
    state.abilities = [
      {
        id: nextId("ability"),
        name: "AI-Generated Soul Techniques",
        role: "",
        description: text,
        action: "",
        range: "",
        target: "",
        save: "",
        dc: "",
        damage: "",
        mechanical: "",
        combo: "",
        targetId: state.ui.currentBuffTargetId
      }
    ];
    renderAbilityCards();
    renderSummary();
    saveState();
  } catch (err) {
    console.error(err);
    alert("Failed to call the AI endpoint. Check console for details.");
  }
}

// ---------- PANEL 6: SUMMARY ----------

function computeBuffTotalsForTarget(target) {
  const totals = {
    tempHP: 0,
    speed: 0,
    ac: 0,
    saves: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    advSaves: {},
    advChecks: {},
    tags: {} // tag -> count
  };

  const buffs = target.buffs || {};
  Object.entries(buffs).forEach(([buffId, count]) => {
    const def = state.buffsCatalog[buffId];
    if (!def) return;
    const eff = def.effect;

    if (eff.type === "tempHP") {
      totals.tempHP += eff.amount * count;
    } else if (eff.type === "speed") {
      totals.speed += eff.amount * count;
    } else if (eff.type === "ac") {
      totals.ac += eff.amount * count;
    } else if (eff.type === "saveBonus") {
      totals.saves[eff.ability] += eff.amountPerStack * count;
    } else if (eff.type === "advSave") {
      totals.advSaves[eff.ability] = true;
    } else if (eff.type === "advCheck") {
      totals.advChecks[eff.ability] = true;
    } else if (eff.type === "tag" && eff.tag) {
      totals.tags[eff.tag] = (totals.tags[eff.tag] || 0) + count;
    }
  });

  return totals;
}

function renderSummary() {
  const container = qs("#summary-grid");
  container.innerHTML = "";

  const targets = Object.values(state.buffTargets);
  if (!targets.length) {
    container.innerHTML =
      "<p>No targets yet. Add souls and targets to see summary.</p>";
    return;
  }

  const globalTotals = computeSPUTotals();

  targets.forEach((target) => {
    const card = document.createElement("div");
    card.className = "summary-card";

    const header = document.createElement("div");
    header.className = "summary-header-row";
    const nameEl = document.createElement("div");
    nameEl.className = "summary-name";
    nameEl.textContent = target.name;
    const tag = document.createElement("div");
    tag.className = "summary-tag";
    tag.textContent =
      target.type === "self"
        ? "SOUL FRUIT USER"
        : target.type === "ally"
        ? "ALLY"
        : "HOMIE";
    header.appendChild(nameEl);
    header.appendChild(tag);

    const buffTotals = computeBuffTotalsForTarget(target);
    const homie =
      target.type === "homie"
        ? state.homies.find((h) => h.id === target.id)
        : null;

    const pillRow = document.createElement("div");
    pillRow.className = "summary-pill-row";

    // AC
    const acPill = document.createElement("div");
    acPill.className = "summary-pill";
    if (homie && homie.stats) {
      const base = homie.stats.ac;
      const bonus = buffTotals.ac;
      acPill.textContent = bonus
        ? `AC ${base + bonus} (base ${base} +${bonus} from boons)`
        : `AC ${base}`;
    } else {
      acPill.textContent = buffTotals.ac
        ? `Your AC +${buffTotals.ac} from boons`
        : "AC: use character sheet";
    }

    // HP
    const hpPill = document.createElement("div");
    hpPill.className = "summary-pill";
    if (homie && homie.stats) {
      hpPill.textContent = buffTotals.tempHP
        ? `HP ~${homie.stats.hp} +${buffTotals.tempHP} temp HP`
        : `HP ~${homie.stats.hp}`;
    } else {
      hpPill.textContent = buffTotals.tempHP
        ? `Your HP +${buffTotals.tempHP} temp HP`
        : "HP: use character sheet";
    }

    // Speed
    const speedPill = document.createElement("div");
    speedPill.className = "summary-pill";
    if (homie && homie.stats) {
      speedPill.textContent = buffTotals.speed
        ? `Speed ${homie.stats.speed + buffTotals.speed} ft (base ${
            homie.stats.speed
          } +${buffTotals.speed})`
        : `Speed ${homie.stats.speed} ft`;
    } else {
      speedPill.textContent = buffTotals.speed
        ? `Your speed +${buffTotals.speed} ft`
        : "Speed: use character sheet";
    }

    // Soul power & DC
    const spuPill = document.createElement("div");
    spuPill.className = "summary-pill";
    const targetSpu =
      target.type === "homie" && homie ? homie.stats.spuSum : globalTotals.total;
    spuPill.textContent = `Soul Power: ${targetSpu} SPU`;

    const dcPill = document.createElement("div");
    dcPill.className = "summary-pill";
    dcPill.textContent = state.ui.lastDC
      ? `Soul DC: ${state.ui.lastDC}`
      : "Soul DC: use character sheet or DC helper";

    pillRow.appendChild(acPill);
    pillRow.appendChild(hpPill);
    pillRow.appendChild(speedPill);
    pillRow.appendChild(spuPill);
    pillRow.appendChild(dcPill);

    // At a glance
    const glanceTitle = document.createElement("div");
    glanceTitle.className = "summary-section-title";
    glanceTitle.textContent = "At a Glance";

    const glanceBox = document.createElement("div");
    glanceBox.className = "summary-at-a-glance";

    const defPieces = [];
    if (buffTotals.tempHP) defPieces.push(`+${buffTotals.tempHP} temp HP`);
    if (buffTotals.ac) defPieces.push(`+${buffTotals.ac} AC`);

    const mobPieces = [];
    if (buffTotals.speed) mobPieces.push(`+${buffTotals.speed} ft speed`);
    if (buffTotals.tags.soulStep30)
      mobPieces.push("Soul Step 30 ft (teleport)");
    if (buffTotals.tags.soulStep60)
      mobPieces.push("Soul Step 60 ft (greater teleport)");

    const savePieces = [];
    Object.entries(buffTotals.saves).forEach(([ab, val]) => {
      if (val) savePieces.push(`+${val} ${ab} saves`);
    });
    const advSaveAbilities = Object.keys(buffTotals.advSaves);
    const advCheckAbilities = Object.keys(buffTotals.advChecks);
    if (advSaveAbilities.length)
      savePieces.push(`Advantage on ${advSaveAbilities.join(", ")} saves`);
    if (advCheckAbilities.length)
      savePieces.push(`Advantage on ${advCheckAbilities.join(", ")} checks`);

    const otherPieces = [];
    if (buffTotals.tags.mundaneResist)
      otherPieces.push("Resist non-magical weapon damage");
    if (buffTotals.tags.soulBlade)
      otherPieces.push("Soul-Forged Weapon (counts as magical)");
    if (buffTotals.tags.lifespanStrike)
      otherPieces.push("Severed Lifespan Strike");
    if (buffTotals.tags.soulBind)
      otherPieces.push("Soul Bind restraining effect");
    if (buffTotals.tags.custom)
      otherPieces.push("Custom soul effects (see notes)");

    const lines = [];
    if (defPieces.length)
      lines.push(`<div><strong>Defenses:</strong> ${defPieces.join("; ")}</div>`);
    if (mobPieces.length)
      lines.push(`<div><strong>Mobility:</strong> ${mobPieces.join("; ")}</div>`);
    if (savePieces.length)
      lines.push(
        `<div><strong>Saves & Checks:</strong> ${savePieces.join("; ")}</div>`
      );
    if (otherPieces.length)
      lines.push(`<div><strong>Other:</strong> ${otherPieces.join("; ")}</div>`);

    glanceBox.innerHTML = lines.length ? lines.join("") : "No boons yet.";

    // Abilities list
    const abilitiesTitle = document.createElement("div");
    abilitiesTitle.className = "summary-section-title";
    abilitiesTitle.textContent = "Abilities & Techniques";

    const abilitiesList = document.createElement("ul");
    abilitiesList.className = "summary-list";
    const abilitiesForTarget = state.abilities.filter(
      (ab) => ab.targetId === target.id
    );
    if (!abilitiesForTarget.length) {
      const li = document.createElement("li");
      li.textContent = "No abilities assigned yet.";
      abilitiesList.appendChild(li);
    } else {
      abilitiesForTarget.forEach((ab) => {
        const li = document.createElement("li");
        const dcText = ab.dc ? ` (DC ${ab.dc})` : "";
        li.textContent = `${ab.name} — ${ab.action || "Action"}; Range ${
          ab.range || "—"
        }; Target ${ab.target || "—"}; Save ${
          ab.save || "—"
        }${dcText}; Damage ${ab.damage || "—"}.`;
        abilitiesList.appendChild(li);
      });
    }

    // Inherited traits for homies
    let inheritTitle, inheritList;
    if (homie) {
      inheritTitle = document.createElement("div");
      inheritTitle.className = "summary-section-title";
      inheritTitle.textContent = "Inherited Soul Traits";

      inheritList = document.createElement("ul");
      inheritList.className = "summary-list";

      if (homie.inheritedTraits && homie.inheritedTraits.length) {
        homie.inheritedTraits.forEach((t) => {
          const li = document.createElement("li");
          li.textContent = t;
          inheritList.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = "None recorded.";
        inheritList.appendChild(li);
      }
    }

    // Buff breakdown
    const breakdownDetails = document.createElement("details");
    breakdownDetails.className = "summary-details";
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Show boon breakdown (stacks & SPU)";
    breakdownDetails.appendChild(summaryEl);

    const breakdownList = document.createElement("ul");
    breakdownList.className = "summary-list";
    Object.entries(target.buffs || {}).forEach(([buffId, count]) => {
      const def = state.buffsCatalog[buffId];
      if (!def) return;
      const totalCost = buffStackCost(def.baseCost, count);
      const li = document.createElement("li");
      li.textContent = `${def.name} ×${count} — SPU spent: ${totalCost}.`;
      breakdownList.appendChild(li);
    });
    breakdownDetails.appendChild(breakdownList);

    // Notes
    const notesTitle = document.createElement("div");
    notesTitle.className = "summary-section-title";
    notesTitle.textContent = "Notes / Rulings";

    const notesBox = document.createElement("div");
    notesBox.className = "summary-notes";
    notesBox.contentEditable = "true";
    notesBox.textContent =
      target.notes ||
      "Use this for quick rulings, edge cases, or reminders (editable).";
    notesBox.oninput = () => {
      target.notes = notesBox.textContent;
      saveState();
    };

    // assemble card
    card.appendChild(header);
    card.appendChild(pillRow);
    card.appendChild(glanceTitle);
    card.appendChild(glanceBox);
    card.appendChild(abilitiesTitle);
    card.appendChild(abilitiesList);
    if (homie) {
      card.appendChild(inheritTitle);
      card.appendChild(inheritList);
    }
    card.appendChild(breakdownDetails);
    card.appendChild(notesTitle);
    card.appendChild(notesBox);

    container.appendChild(card);
  });
}

// ---------- COLLAPSIBLE ----------

function initCollapsible() {
  qsa(".card-collapsible").forEach((card) => {
    const panelId = card.getAttribute("data-panel");
    if (state.ui.collapsedPanels[panelId]) {
      card.classList.add("collapsed");
    }
    const btn = card.querySelector(".collapse-toggle");
    if (!btn) return;
    btn.onclick = () => {
      card.classList.toggle("collapsed");
      state.ui.collapsedPanels[panelId] =
        card.classList.contains("collapsed");
      saveState();
    };
  });
}

// ---------- GLOBAL BUTTONS ----------

function handleSaveNow() {
  saveState();
  alert("Soul Fruit data saved to your browser.");
}

function handlePrint() {
  window.print();
}

function handleReset() {
  if (!confirm("Reset all data for the Soul Fruit system?")) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

// ---------- INIT DOM ----------

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  ensureBaseState();

  qs("#btn-calc-soul").onclick = handleCalcSoul;
  qs("#btn-add-soul").onclick = handleAddSoul;

  qs("#btn-add-ally").onclick = handleAddAllyTarget;

  qs("#buff-tools-select").value = state.ui.buffToolsView || "hide";
  qs("#buff-tools-select").onchange = handleBuffToolsViewChange;
  handleBuffToolsViewChange();

  qs("#btn-add-custom-buff").onclick = handleAddCustomBuff;
  qs("#btn-calc-dc").onclick = handleCalcDC;

  qs("#homie-soul-mode").onchange = () => {
    const mode = qs("#homie-soul-mode").value;
    qs("#homie-soul-select").disabled = mode !== "selected";
  };
  qs("#homie-soul-select").disabled =
    qs("#homie-soul-mode").value !== "selected";

  qs("#btn-generate-homie").onclick = handleGenerateHomie;
  qs("#btn-edit-buffs-homie").onclick = handleEditBuffsForHomie;

  qs("#btn-generate-abilities").onclick = generateAbilitiesWithAI;
  qs("#btn-add-empty-ability").onclick = addEmptyAbilityCard;

  qs("#btn-save-now").onclick = handleSaveNow;
  qs("#btn-print").onclick = handlePrint;
  qs("#btn-reset").onclick = handleReset;

  initCollapsible();

  renderSouls();
  renderBuffTargetSelect();
  renderBuffCards();
  renderSelectedBuffsSummary();
  renderHomieSoulSelect();
  renderAbilityCards();
  updateSoulTotals();
});
