// ---------- STATE ----------

const STORAGE_KEY = "shadowFruitSystem_v2";

let state = {
  shadows: [], // {id, name, raw, profTier, templateTier, sl, spu, active, techniquesText}
  buffsCatalog: {}, // id -> buff definition
  buffTargets: {}, // id -> {id,name,type:'self'|'ally'|'corpse',buffs:{buffId:count},notes:''}
  corpses: [], // {id,name,durability,shadowIds,stats,inheritedTechniques}
  abilities: [], // {id,name,role,description,action,range,target,save,dc,damage,mechanical,combo,targetId}
  ui: {
    collapsedPanels: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
    currentBuffTargetId: "self",
    buffToolsView: "hide",
    lastDC: null,
    nextIds: { shadow: 1, corpse: 1, ally: 1, ability: 1 }
  }
};

// ---------- UTIL ----------

const PROF_TIERS = [
  "0 – Untrained (civilian, fodder)",
  "1 – Basic training (rookie fighter)",
  "2 – Seasoned fighter",
  "3 – Veteran specialist",
  "4 – Elite commander",
  "5 – Master combatant",
  "6 – Legendary master",
  "7 – Mythic prodigy",
  "8 – World-class monster",
  "9 – Beyond mortal limits"
];

const TEMPLATE_TIERS = [
  "0 – Ordinary human (no training)",
  "1 – Trained fighter (martial)",
  "2 – Trained fighter (elite)",
  "3 – Advanced fighter with basic Haki",
  "4 – Advanced fighter with strong Haki / unique style",
  "5 – Devil Fruit user (standard)",
  "6 – Advanced fighter + Devil Fruit user",
  "7 – Mythical Devil Fruit user",
  "8 – Big Boss (Emperor-tier threat)",
  "9 – Final world boss / divine monster"
];

// Tag metadata for special powers
const TAG_META = {
  shadow_step_30: {
    category: "mobility",
    short: "Shadow Step 30 ft",
    power:
      "Shadow Step 30 ft: As a bonus action, teleport up to 30 ft between areas of dim light or darkness (uses/round determined by DM)."
  },
  shadow_step_60: {
    category: "mobility",
    short: "Shadow Step 60 ft",
    power:
      "Shadow Step 60 ft: As a bonus action, teleport up to 60 ft between shadows (uses/round determined by DM)."
  },
  shadow_dash: {
    category: "mobility",
    short: "Shadow Dash",
    power:
      "Shadow Dash: Once per turn, move extra distance without provoking opportunity attacks (exact distance/uses by DM)."
  },
  shadow_weapon: {
    category: "other",
    short: "Shadow Weapon",
    power:
      "Shadow Weapon: Conjured shadow-forged weapon counts as magical for overcoming resistance and can take any form you choose."
  },
  shadow_redirect: {
    category: "other",
    short: "Shadow Redirect",
    power:
      "Shadow Redirect: Use a reaction to reduce damage you or a nearby creature takes and redirect some of it to another target (DM adjudicates exact values)."
  },
  shadow_shackles: {
    category: "other",
    short: "Shadow Shackles",
    power:
      "Shadow Shackles: You can restrain foes with shadow chains that use your Shadow DC to escape or avoid."
  },
  resistance_mundane: {
    category: "defense",
    short: "Resist non-magical weapons",
    power:
      "Resistance to Non-magical Weapons: You resist bludgeoning, piercing, and slashing damage from non-magical weapon attacks."
  },
  custom: {
    category: "other",
    short: "Custom shadow effect",
    power:
      "Custom shadow effect: A unique shadow-based ability defined by you on the buff card."
  }
};

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

// Auto-resize helper for textareas (no inner scrollbars)
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ---------- BUFFS CATALOG ----------

function createDefaultBuffs() {
  const buffs = {};

  function add(buff) {
    buffs[buff.id] = buff;
  }

  // Defensive / HP
  add({
    id: "temp20",
    name: "+20 Temp HP",
    category: "defense",
    baseCost: 8,
    description: "Gain 20 temporary hit points. Stacks add more temp HP.",
    effect: { type: "tempHP", amount: 20 }
  });

  add({
    id: "temp50",
    name: "+50 Temp HP",
    category: "defense",
    baseCost: 16,
    description: "Gain 50 temporary hit points. Stacks add more temp HP.",
    effect: { type: "tempHP", amount: 50 }
  });

  add({
    id: "shadowCarapace",
    name: "Shadow Carapace",
    category: "defense",
    baseCost: 18,
    description: "Your shadow plates harden, granting +1 AC per stack.",
    effect: { type: "ac", amount: 1 }
  });

  add({
    id: "shadowArmorNight",
    name: "Shadow Armor of Night",
    category: "defense",
    baseCost: 14,
    description: "In dim light or darkness, gain +1 AC per stack.",
    effect: { type: "acDark", amount: 1 }
  });

  add({
    id: "mundaneResist",
    name: "Resistance to Non-magical Weapons",
    category: "defense",
    baseCost: 20,
    description:
      "Gain resistance to bludgeoning, piercing, and slashing from non-magical attacks. Stacks grant extra uses per day or extra targets (DM adjudicates).",
    effect: { type: "other", tag: "resistance_mundane" }
  });

  // Mobility
  add({
    id: "move10",
    name: "+10 ft Movement",
    category: "mobility",
    baseCost: 10,
    description: "Shadow-slick footing. Gain +10 ft walking speed per stack.",
    effect: { type: "speed", amount: 10 }
  });

  add({
    id: "shadowStep30",
    name: "Shadow Step (30 ft)",
    category: "mobility",
    baseCost: 18,
    description:
      "As a bonus action, teleport up to 30 ft between areas of dim light or darkness. Stacks grant more uses per round or more targets.",
    effect: { type: "other", tag: "shadow_step_30" }
  });

  add({
    id: "shadowStep60",
    name: "Shadow Step (60 ft)",
    category: "mobility",
    baseCost: 28,
    description:
      "As a bonus action, teleport up to 60 ft. Stacks increase uses or distance (DM adjudicates).",
    effect: { type: "other", tag: "shadow_step_60" }
  });

  add({
    id: "shadowDash",
    name: "Shadow Dash",
    category: "mobility",
    baseCost: 15,
    description:
      "Once per turn, move an additional distance without provoking opportunity attacks. Stacks improve distance or uses.",
    effect: { type: "other", tag: "shadow_dash" }
  });

  // Save bonuses (+2 to STR/DEX/CON saves)
  add({
    id: "plus2_str_save",
    name: "+2 STR Save Bonus",
    category: "saves",
    baseCost: 25,
    description:
      "Your muscles remember the shadows’ strength. Gain +2 to Strength saving throws per stack.",
    effect: { type: "saveBonus", ability: "STR", amountPerStack: 2 }
  });
  add({
    id: "plus2_dex_save",
    name: "+2 DEX Save Bonus",
    category: "saves",
    baseCost: 30,
    description: "Shadow reflexes. Gain +2 to Dexterity saving throws per stack.",
    effect: { type: "saveBonus", ability: "DEX", amountPerStack: 2 }
  });
  add({
    id: "plus2_con_save",
    name: "+2 CON Save Bonus",
    category: "saves",
    baseCost: 35,
    description:
      "Shadow-fortified body. Gain +2 to Constitution saving throws per stack.",
    effect: { type: "saveBonus", ability: "CON", amountPerStack: 2 }
  });

  // Advantage on saves
  const saveAbilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  saveAbilities.forEach((ab) => {
    add({
      id: `adv_${ab.toLowerCase()}_save`,
      name: `Advantage on ${ab} saves`,
      category: "saves",
      baseCost: 25,
      description: `Your shadow anticipates threats. You have advantage on ${ab} saving throws.`,
      effect: { type: "advSave", ability: ab }
    });
  });

  // Advantage on ability checks (same cost as saves)
  const checkAbilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  checkAbilities.forEach((ab) => {
    add({
      id: `adv_${ab.toLowerCase()}_check`,
      name: `Advantage on ${ab} checks`,
      category: "checks",
      baseCost: 25,
      description: `Your shadow guides your ${ab} ability checks, granting advantage.`,
      effect: { type: "advCheck", ability: ab }
    });
  });

  // Offensive / utility
  add({
    id: "shadowWeapon",
    name: "Shadow Weapon",
    category: "offense",
    baseCost: 14,
    description:
      "Conjure a shadow-forged weapon that counts as magical for overcoming resistance. Stacks can add riders (extra damage, reach, etc.).",
    effect: { type: "other", tag: "shadow_weapon" }
  });

  add({
    id: "shadowRedirect",
    name: "Shadow Redirect",
    category: "offense",
    baseCost: 20,
    description:
      "When you or a creature within 5 ft would take damage, you can use your reaction to reduce it and redirect some to another target (DM adjudicates exact values). Stacks add more uses.",
    effect: { type: "other", tag: "shadow_redirect" }
  });

  add({
    id: "shadowShackles",
    name: "Shadow Shackles",
    category: "control",
    baseCost: 22,
    description:
      "Gain an at-will restraining effect: shadow chains attempt to grapple and restrain foes. Stacks can boost the save DC or number of targets.",
    effect: { type: "other", tag: "shadow_shackles" }
  });

  return buffs;
}

// exponential cost across stacks
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

// ---------- INIT ----------

function ensureBaseState() {
  if (!state.buffsCatalog || Object.keys(state.buffsCatalog).length === 0) {
    state.buffsCatalog = createDefaultBuffs();
  }
  if (!state.buffTargets || Object.keys(state.buffTargets).length === 0) {
    const selfTarget = {
      id: "self",
      type: "self",
      name: "Elren (Primary User)",
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

// ---------- PANEL 1: SHADOW CALC ----------

function populateShadowSelects() {
  const profSel = qs("#shadow-prof");
  const templSel = qs("#shadow-template");
  profSel.innerHTML = "";
  PROF_TIERS.forEach((label, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = label;
    profSel.appendChild(opt);
  });
  templSel.innerHTML = "";
  TEMPLATE_TIERS.forEach((label, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = label;
    templSel.appendChild(opt);
  });
}

function computeShadowLevel(raw, profTier, templateTier) {
  const rawNorm = Math.max(0, Math.min(20, raw)) / 20;
  const profNorm = profTier / (PROF_TIERS.length - 1 || 1);
  const templNorm = templateTier / (TEMPLATE_TIERS.length - 1 || 1);

  const rawWeight = 0.6;
  const profWeight = 0.6;
  const templWeight = 0.6;

  const r = 0.4 + rawWeight * rawNorm;
  const p = 0.4 + profWeight * profNorm;
  const t = 0.4 + templWeight * templNorm;

  const overall = r * p * t;
  const scaled = overall * overall;

  const SL = Math.max(1, Math.round(overall * 10)); // 1–10
  const SPU = Math.max(1, Math.round(scaled * 1000)); // 1–1000

  return { SL, SPU, components: { r, p, t, overall } };
}

function handleCalcShadow() {
  const name = qs("#shadow-name").value.trim() || "Unnamed Shadow";
  const raw = Number(qs("#shadow-raw").value || 0);
  const prof = Number(qs("#shadow-prof").value || 0);
  const templ = Number(qs("#shadow-template").value || 0);

  const { SL, SPU, components } = computeShadowLevel(raw, prof, templ);
  const out = qs("#shadow-calc-output");
  out.innerHTML = `
    <strong>${name}</strong> → <strong>Shadow Level ${SL}</strong>, <strong>${SPU} SPU</strong><br/>
    <span class="muted">Breakdown (normalized): Raw ${components.r.toFixed(
      2
    )}, Proficiency ${components.p.toFixed(2)}, Template ${components.t.toFixed(
    2
  )}.<br/>Perfect 1000 SPU is only reached when all three inputs are maxed.</span>
  `;
}

function handleAddShadow() {
  const name = qs("#shadow-name").value.trim() || "Unnamed Shadow";
  const raw = Number(qs("#shadow-raw").value || 0);
  const prof = Number(qs("#shadow-prof").value || 0);
  const templ = Number(qs("#shadow-template").value || 0);
  const { SL, SPU } = computeShadowLevel(raw, prof, templ);

  const shadow = {
    id: nextId("shadow"),
    name,
    raw,
    profTier: prof,
    templateTier: templ,
    sl: SL,
    spu: SPU,
    active: true,
    techniquesText: ""
  };
  state.shadows.push(shadow);
  renderShadows();
  updateShadowTotals();
  renderCorpseShadowSelect();
  renderSummary();
  saveState();
}

// ---------- PANEL 2: SHADOW LIST & TOTALS ----------

function renderShadows() {
  const container = qs("#shadow-list");
  container.innerHTML = "";
  if (!state.shadows.length) {
    container.innerHTML =
      '<p class="muted">No shadows stored yet. Add one in panel 1.</p>';
    return;
  }

  state.shadows.forEach((sh) => {
    const card = document.createElement("div");
    card.className = "shadow-card";

    const header = document.createElement("div");
    header.className = "shadow-card-header";
    const nameEl = document.createElement("div");
    nameEl.className = "shadow-name";
    nameEl.textContent = sh.name;
    const tag = document.createElement("span");
    tag.className = "shadow-tag";
    tag.textContent = `SL ${sh.sl} | ${sh.spu} SPU`;
    header.appendChild(nameEl);
    header.appendChild(tag);

    const meta = document.createElement("small");
    meta.textContent = `Raw ${sh.raw}/20 · Prof: ${
      PROF_TIERS[sh.profTier]
    } · Template: ${TEMPLATE_TIERS[sh.templateTier]}`;

    const techField = document.createElement("div");
    techField.className = "field";
    const lbl = document.createElement("label");
    lbl.textContent =
      "Known abilities / attacks (1 per line). Used for inherited techniques on corpses.";
    const ta = document.createElement("textarea");
    ta.rows = 3;
    ta.value = sh.techniquesText || "";
    ta.addEventListener("input", () => {
      sh.techniquesText = ta.value;
      renderCorpseStatIfVisible();
      renderSummary();
      saveState();
    });
    techField.appendChild(lbl);
    techField.appendChild(ta);

    const activeRow = document.createElement("div");
    activeRow.className = "shadow-active-row";

    const activeLabel = document.createElement("label");
    const activeCheckbox = document.createElement("input");
    activeCheckbox.type = "checkbox";
    activeCheckbox.checked = sh.active;
    activeCheckbox.addEventListener("change", () => {
      sh.active = activeCheckbox.checked;
      updateShadowTotals();
      renderCorpseShadowSelect();
      renderSummary();
      saveState();
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
      state.shadows = state.shadows.filter((s) => s.id !== sh.id);
      state.corpses.forEach((c) => {
        c.shadowIds = c.shadowIds.filter((id) => id !== sh.id);
      });
      renderShadows();
      updateShadowTotals();
      renderCorpseShadowSelect();
      renderCorpseStatIfVisible();
      renderSummary();
      saveState();
    });

    activeRow.appendChild(activeLabel);
    activeRow.appendChild(removeBtn);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(techField);
    card.appendChild(activeRow);

    container.appendChild(card);
  });
}

function computeSPUTotals() {
  const totalSPU = state.shadows
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

function updateShadowTotals() {
  const totals = computeSPUTotals();
  qs("#total-spu").textContent = totals.total;
  qs("#spent-spu").textContent = totals.spent;
  qs("#available-spu").textContent = totals.available;

  renderSelectedBuffsSummary();
  renderSummary();
  saveState();
}

// ---------- PANEL 3: BUFFS ----------

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

  if (!state.ui.currentBuffTargetId || !state.buffTargets[state.ui.currentBuffTargetId]) {
    state.ui.currentBuffTargetId = targets[0].id;
  }
  select.value = state.ui.currentBuffTargetId;

  select.addEventListener("change", () => {
    state.ui.currentBuffTargetId = select.value;
    renderBuffCards();
    renderSelectedBuffsSummary();
    renderSummary();
    saveState();
  });
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
  updateShadowTotals();
}

function renderBuffCards() {
  const container = qs("#buff-cards-container");
  container.innerHTML = "";

  const target = state.buffTargets[state.ui.currentBuffTargetId];
  if (!target) {
    container.innerHTML = "<p>No buff target selected.</p>";
    return;
  }

  const catalog = state.buffsCatalog;
  const buffList = Object.values(catalog);

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
    const nextCost =
      currentStacks >= 0
        ? nextBuffIncrementCost(buff.baseCost, currentStacks)
        : buff.baseCost;

    const stackInfo = document.createElement("span");
    stackInfo.innerHTML = `Copies: <strong>${currentStacks}</strong> · SPU spent here: <strong>${totalCost}</strong><br/>
      Next copy will cost: <strong>${nextCost}</strong> SPU`;

    const controls = document.createElement("div");
    controls.className = "stack-controls";
    const minus = document.createElement("button");
    minus.className = "stack-btn";
    minus.textContent = "−";
    minus.addEventListener("click", () => adjustBuffStacks(buff.id, -1));
    const plus = document.createElement("button");
    plus.className = "stack-btn";
    plus.textContent = "+";
    plus.addEventListener("click", () => adjustBuffStacks(buff.id, +1));
    controls.appendChild(minus);
    controls.appendChild(plus);

    stacksRow.appendChild(stackInfo);
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
    box.innerHTML = `<p>No buffs spent on <strong>${target.name}</strong> yet.</p>`;
    return;
  }

  let html = `<p>Buffs on <strong>${target.name}</strong>:</p><ul>`;
  entries.forEach(([buffId, count]) => {
    const def = state.buffsCatalog[buffId];
    if (!def) return;
    const totalCost = buffStackCost(def.baseCost, count);
    let totalEffect = "";
    const eff = def.effect;
    if (eff.type === "tempHP") totalEffect = `Total: +${eff.amount * count} temp HP.`;
    else if (eff.type === "speed") totalEffect = `Total: +${eff.amount * count} ft speed.`;
    else if (eff.type === "ac") totalEffect = `Total: +${eff.amount * count} AC.`;
    else if (eff.type === "acDark")
      totalEffect = `Total: +${eff.amount * count} AC in dim light/darkness.`;
    else if (eff.type === "saveBonus")
      totalEffect = `Total: +${eff.amountPerStack * count} to ${eff.ability} saves.`;
    else totalEffect = "";

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
    description: desc || "Custom shadow buff.",
    effect: { type: "other", tag: "custom" }
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
  out.innerHTML = `Suggested DC for shadow techniques: <strong>${dc}</strong><br/><span class="muted">Formula: 8 + prof + ability mod + floor(SL / 2).</span>`;
  renderSummary();
  saveState();
}

// ---------- PANEL 4: CORPSE ----------

function renderCorpseShadowSelect() {
  const sel = qs("#corpse-shadow-select");
  sel.innerHTML = "";
  state.shadows.forEach((sh) => {
    const opt = document.createElement("option");
    opt.value = sh.id;
    opt.textContent = `${sh.name} (SL ${sh.sl}, ${sh.spu} SPU)`;
    sel.appendChild(opt);
  });
}

function getShadowsForCorpse(mode, selectedIds) {
  if (!state.shadows.length) return [];
  if (mode === "all") return [...state.shadows];
  if (mode === "active") return state.shadows.filter((s) => s.active);
  if (mode === "selected") {
    const set = new Set(selectedIds || []);
    return state.shadows.filter((s) => set.has(s.id));
  }
  return [];
}

function buildCorpseStats(name, durability, poweringShadows) {
  const slSum = poweringShadows.reduce((sum, s) => sum + s.sl, 0);
  const spuSum = poweringShadows.reduce((sum, s) => sum + s.spu, 0);

  const baseAC = 10 + Math.floor(durability / 2) + Math.floor(slSum / 3);
  const hp = durability * 10 + Math.round(spuSum / 8);
  const speed = 30 + Math.floor(slSum / 2);

  const STR = 10 + durability + Math.floor(slSum / 4);
  const DEX = 8 + Math.floor(slSum / 3);
  const CON = 10 + durability + Math.floor(slSum / 5);
  const INT = 6 + Math.floor(slSum / 5);
  const WIS = 8 + Math.floor(slSum / 5);
  const CHA = 6 + Math.floor(slSum / 6);

  return {
    name,
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

function gatherInheritedTechniques(poweringShadows) {
  const set = new Set();
  poweringShadows.forEach((sh) => {
    const txt = sh.techniquesText || "";
    txt
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length)
      .forEach((line) => set.add(line));
  });
  return Array.from(set);
}

function upsertCorpseRecord(name, stats, shadowIds, inheritedTechniques) {
  let corpse = state.corpses.find((c) => c.name === name);
  if (!corpse) {
    corpse = {
      id: nextId("corpse"),
      name,
      durability: stats.durability,
      shadowIds: [...shadowIds],
      stats,
      inheritedTechniques
    };
    state.corpses.push(corpse);

    state.buffTargets[corpse.id] = {
      id: corpse.id,
      type: "corpse",
      name: corpse.name,
      buffs: {},
      notes: ""
    };
  } else {
    corpse.durability = stats.durability;
    corpse.shadowIds = [...shadowIds];
    corpse.stats = stats;
    corpse.inheritedTechniques = inheritedTechniques;

    if (!state.buffTargets[corpse.id]) {
      state.buffTargets[corpse.id] = {
        id: corpse.id,
        type: "corpse",
        name: corpse.name,
        buffs: {},
        notes: ""
      };
    }
  }
  return corpse;
}

function renderCorpseCard(corpse) {
  const container = qs("#corpse-stat-block");
  container.innerHTML = "";
  if (!corpse) return;

  const stats = corpse.stats;
  const poweringShadows = state.shadows.filter((s) =>
    corpse.shadowIds.includes(s.id)
  );

  const card = document.createElement("div");
  card.className = "corpse-card";

  const headerRow = document.createElement("div");
  headerRow.className = "corpse-header-row";
  const nameEl = document.createElement("div");
  nameEl.className = "corpse-name";
  nameEl.textContent = stats.name.toUpperCase();
  const tag = document.createElement("div");
  tag.className = "corpse-tier-tag";
  tag.textContent = `Reanimated Corpse · SL sum ${stats.slSum}, ${stats.spuSum} SPU`;
  headerRow.appendChild(nameEl);
  headerRow.appendChild(tag);

  const pillRow = document.createElement("div");
  pillRow.className = "corpse-pill-row";
  const acPill = document.createElement("div");
  acPill.className = "corpse-pill";
  acPill.textContent = `AC ${stats.ac}`;
  const hpPill = document.createElement("div");
  hpPill.className = "corpse-pill";
  hpPill.textContent = `Hit Points: ~${stats.hp} (DM can convert to dice)`;
  const speedPill = document.createElement("div");
  speedPill.className = "corpse-pill";
  speedPill.textContent = `Speed ${stats.speed} ft.`;
  const abilityPill = document.createElement("div");
  abilityPill.className = "corpse-pill";
  abilityPill.textContent = `STR ${stats.STR} · DEX ${stats.DEX} · CON ${stats.CON} · INT ${stats.INT} · WIS ${stats.WIS} · CHA ${stats.CHA}`;

  pillRow.appendChild(acPill);
  pillRow.appendChild(hpPill);
  pillRow.appendChild(speedPill);
  pillRow.appendChild(abilityPill);

  const traitsSec = document.createElement("div");
  traitsSec.className = "corpse-section";
  traitsSec.innerHTML = `<h4>Traits</h4>`;
  const traitsList = document.createElement("ul");
  const trait = (text) => {
    const li = document.createElement("li");
    li.textContent = text;
    traitsList.appendChild(li);
  };
  trait(
    `Corpse Durability: Tier ${stats.durability} body; very hard to destroy for its size.`
  );
  trait(
    `Infused Shadows: Powered by ${poweringShadows.length} shadow(s); total SL ${stats.slSum}, total ${stats.spuSum} SPU. Personality and aggression are shaped by those shadows.`
  );
  trait(
    "Shadow Instincts: Gains advantage on one type of save (STR, DEX, or CON) chosen when created."
  );
  trait(
    "Shadow Resilience (DM option): Once per long rest, when reduced to 0 HP, it instead drops to 1 HP."
  );
  trait(
    "Damage Resistances (DM option): Necrotic; bludgeoning, piercing, and slashing from non-magical attacks."
  );
  trait("Condition Immunities (DM option): Charmed, frightened, poisoned.");
  trait(
    "Senses: Darkvision 60 ft., passive Perception ??. Languages: understands any languages it knew in life (if any)."
  );
  trait("Loyalty: Obeys the shadow fruit user’s commands to the best of its ability.");
  traitsSec.appendChild(traitsList);

  const actionsSec = document.createElement("div");
  actionsSec.className = "corpse-section";
  actionsSec.innerHTML = `<h4>Actions</h4>`;
  const actionsList = document.createElement("ul");
  const multi = document.createElement("li");
  multi.textContent =
    "Multiattack: The reanimated corpse makes two attacks: one Slam and one Shadow Lash (or two Slams, DM’s choice).";
  const slam = document.createElement("li");
  slam.textContent = `Slam: Melee Weapon Attack: +${Math.floor(
    (stats.STR - 10) / 2
  ) + 5} to hit, reach 5 ft., one target. Hit: 1d10 + ${
    Math.floor((stats.STR - 10) / 2) + 5
  } bludgeoning damage.`;
  const lashDc = state.ui.lastDC || 15;
  const lash = document.createElement("li");
  lash.textContent = `Shadow Lash: Melee spell-like attack: +${
    5 + Math.floor(stats.slSum / 4)
  } to hit, reach 10 ft., one target. Hit: 2d8 necrotic damage, and the target must succeed on a STR or DEX save (DC ${lashDc}) or be grappled and restrained by writhing shadow chains.`;
  actionsList.appendChild(multi);
  actionsList.appendChild(slam);
  actionsList.appendChild(lash);
  actionsSec.appendChild(actionsList);

  const infusedSec = document.createElement("div");
  infusedSec.className = "corpse-section";
  infusedSec.innerHTML = `<h4>Infused Shadows</h4>`;
  const infusedList = document.createElement("ul");
  if (poweringShadows.length) {
    poweringShadows.forEach((sh) => {
      const li = document.createElement("li");
      li.textContent = `${sh.name} – SL ${sh.sl}, ${sh.spu} SPU, Template: ${
        TEMPLATE_TIERS[sh.templateTier]
      }`;
      infusedList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No shadows currently powering this corpse.";
    infusedList.appendChild(li);
  }
  infusedSec.appendChild(infusedList);

  const inherited = gatherInheritedTechniques(poweringShadows);
  const inheritSec = document.createElement("div");
  inheritSec.className = "corpse-section";
  inheritSec.innerHTML = `<h4>Inherited Techniques</h4>`;
  const inhList = document.createElement("ul");
  if (inherited.length) {
    inherited.forEach((tech) => {
      const li = document.createElement("li");
      li.textContent = tech;
      inhList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No specific techniques recorded on powering shadows yet.";
    inhList.appendChild(li);
  }
  inheritSec.appendChild(inhList);

  card.appendChild(headerRow);
  card.appendChild(pillRow);
  card.appendChild(traitsSec);
  card.appendChild(actionsSec);
  card.appendChild(infusedSec);
  card.appendChild(inheritSec);

  container.appendChild(card);
}

function handleGenerateCorpse() {
  const nameInput = qs("#corpse-name");
  const name = nameInput.value.trim() || "Unnamed Corpse";
  const durability = Number(qs("#corpse-durability").value || 1);
  const mode = qs("#corpse-shadow-mode").value;
  const selectedIds = Array.from(
    qs("#corpse-shadow-select").selectedOptions
  ).map((o) => o.value);

  const poweringShadows = getShadowsForCorpse(mode, selectedIds);
  const stats = buildCorpseStats(name, durability, poweringShadows);
  const inheritedTechniques = gatherInheritedTechniques(poweringShadows);
  const shadowIds = poweringShadows.map((s) => s.id);

  const corpse = upsertCorpseRecord(
    name,
    stats,
    shadowIds,
    inheritedTechniques
  );

  renderCorpseCard(corpse);
  renderBuffTargetSelect();
  renderSummary();
  saveState();
}

function renderCorpseStatIfVisible() {
  const name = qs("#corpse-name").value.trim();
  if (!name) return;
  const corpse = state.corpses.find((c) => c.name === name);
  if (corpse) renderCorpseCard(corpse);
}

function handleEditBuffsForCorpse() {
  const name = qs("#corpse-name").value.trim();
  if (!name) return;
  const corpse = state.corpses.find((c) => c.name === name);
  if (!corpse) return;
  state.ui.currentBuffTargetId = corpse.id;
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
      '<p class="muted">No abilities yet. Generate with AI stub or add an empty ability card.</p>';
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
    nameInput.addEventListener("input", () => {
      ab.name = nameInput.value;
      saveState();
      renderSummary();
    });

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
    targetSel.addEventListener("change", () => {
      ab.targetId = targetSel.value;
      saveState();
      renderSummary();
    });

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
    dTa.addEventListener("input", () => {
      ab.description = dTa.value;
      autoResizeTextarea(dTa);
      saveState();
    });
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
      inp.addEventListener("input", () => {
        ab[key] = inp.value;
        saveState();
      });
      wrap.appendChild(l);
      wrap.appendChild(inp);
      miniGrid.appendChild(wrap);
    });

    const mechField = document.createElement("div");
    mechField.className = "field ability-main-text";
    const mLabel = document.createElement("label");
    mLabel.textContent = "Mechanical effect: what happens on hit / failed save.";
    const mTa = document.createElement("textarea");
    mTa.rows = 3;
    mTa.value = ab.mechanical || "";
    autoResizeTextarea(mTa);
    mTa.addEventListener("input", () => {
      ab.mechanical = mTa.value;
      autoResizeTextarea(mTa);
      saveState();
    });
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
    cTa.addEventListener("input", () => {
      ab.combo = cTa.value;
      autoResizeTextarea(cTa);
      saveState();
    });
    comboField.appendChild(cLabel);
    comboField.appendChild(cTa);

    const footer = document.createElement("div");
    footer.className = "ability-footer-row";

    const left = document.createElement("div");
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-secondary small-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = `${ab.name}\n${ab.description}\nAction: ${ab.action} | Range: ${ab.range} | Target: ${ab.target} | Save: ${ab.save} DC ${ab.dc}\nDamage: ${ab.damage}\n${ab.mechanical}\n${ab.combo}`;
      navigator.clipboard.writeText(text).catch(() => {});
    });
    const rerollBtn = document.createElement("button");
    rerollBtn.type = "button";
    rerollBtn.className = "btn-secondary small-btn";
    rerollBtn.textContent = "Reroll";
    rerollBtn.addEventListener("click", () => {
      ab.description =
        ab.description ||
        "Shadow power surges, causing a fresh variation of the attack. Describe how the shadows change form.";
      dTa.value = ab.description;
      autoResizeTextarea(dTa);
      saveState();
    });
    left.appendChild(copyBtn);
    left.appendChild(rerollBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-danger small-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      state.abilities = state.abilities.filter((x) => x !== ab);
      renderAbilityCards();
      renderSummary();
      saveState();
    });

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

function generateAbilitiesStub() {
  const dc = state.ui.lastDC || 17;
  state.abilities = [
    {
      id: nextId("ability"),
      name: "Shadow Gale Barrage",
      description:
        "Conjure a flurry of razor-sharp shadow blades that slice through enemies in a 15-foot cone.",
      action: "Action",
      range: "15-ft cone",
      target: "All creatures in cone",
      save: "DEX save",
      dc: String(dc),
      damage: "6d8 necrotic",
      mechanical:
        "On a failed save, full damage and targets are briefly outlined in violet shadow (no benefit from invisibility for 1 round). On a success, half damage and no outline.",
      combo: "Pairs well with restraining effects or fear-based control.",
      targetId: state.ui.currentBuffTargetId
    },
    {
      id: nextId("ability"),
      name: "Shadow Asgard Ascendant",
      description:
        "The user swells with stolen shadows, taking on a towering Night Emperor form wreathed in black-and-violet flames.",
      action: "Action",
      range: "Self",
      target: "Self",
      save: "—",
      dc: "",
      damage: "Melee attacks +3d8 necrotic",
      mechanical:
        "For 1 minute, your size increases by one category, your reach increases by 5 ft, and your melee weapon attacks deal an extra 3d8 necrotic damage.",
      combo: "Use when many buffs are active to maximize impact; stacks well with movement and defense buffs.",
      targetId: state.ui.currentBuffTargetId
    },
    {
      id: nextId("ability"),
      name: "Grasping Coffin",
      description:
        "Shadows surge up from the ground to form a coffin of chains and blades around a single target.",
      action: "Action",
      range: "60 ft",
      target: "One creature",
      save: "STR or DEX save",
      dc: String(dc),
      damage: "4d10 necrotic on fail, 2d10 on success",
      mechanical:
        "On a failed save, target is restrained inside a cage of shadow chains until it escapes (action to repeat save at end of each turn). On a success, the coffin partially forms but the target slips free.",
      combo: "Perfect setup for multi-attack corpses or allies; can pin down bosses.",
      targetId: state.ui.currentBuffTargetId
    }
  ];
  renderAbilityCards();
  renderSummary();
  saveState();
}

// ---------- PANEL 6: SUMMARY ----------

function computeBuffTotalsForTarget(target) {
  const totals = {
    tempHP: 0,
    speed: 0,
    ac: 0,
    acDark: 0,
    saves: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    advSaves: {}, // ability -> true
    advChecks: {}, // ability -> true
    tags: {} // tag -> {count, def}
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
    } else if (eff.type === "acDark") {
      totals.acDark += eff.amount * count;
    } else if (eff.type === "saveBonus") {
      totals.saves[eff.ability] += eff.amountPerStack * count;
    } else if (eff.type === "advSave") {
      totals.advSaves[eff.ability] = true;
    } else if (eff.type === "advCheck") {
      totals.advChecks[eff.ability] = true;
    } else if (eff.type === "other" && eff.tag) {
      if (!totals.tags[eff.tag]) {
        totals.tags[eff.tag] = { count: 0, def };
      }
      totals.tags[eff.tag].count += count;
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
      "<p>No buff targets yet. Add shadows and targets to see summary.</p>";
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
        ? "PRIMARY USER"
        : target.type === "ally"
        ? "ALLY"
        : "CORPSE";
    header.appendChild(nameEl);
    header.appendChild(tag);

    const pillRow = document.createElement("div");
    pillRow.className = "summary-pill-row";

    const buffTotals = computeBuffTotalsForTarget(target);

    const corp =
      target.type === "corpse"
        ? state.corpses.find((c) => c.id === target.id)
        : null;

    // AC
    const acPill = document.createElement("div");
    acPill.className = "summary-pill";
    if (corp && corp.stats) {
      const baseAc = corp.stats.ac;
      const bonus = buffTotals.ac + buffTotals.acDark;
      if (bonus) {
        acPill.textContent = `AC ${baseAc + bonus} (base ${baseAc} +${bonus} from buffs)`;
      } else {
        acPill.textContent = `AC ${baseAc}`;
      }
    } else {
      const bonus = buffTotals.ac + buffTotals.acDark;
      if (bonus) acPill.textContent = `Your AC +${bonus} from buffs`;
      else acPill.textContent = "AC: use character sheet";
    }

    // HP
    const hpPill = document.createElement("div");
    hpPill.className = "summary-pill";
    if (corp && corp.stats) {
      if (buffTotals.tempHP) {
        hpPill.textContent = `HP ~${corp.stats.hp} +${buffTotals.tempHP} temp HP`;
      } else hpPill.textContent = `HP ~${corp.stats.hp}`;
    } else {
      if (buffTotals.tempHP)
        hpPill.textContent = `Your HP +${buffTotals.tempHP} temp HP`;
      else hpPill.textContent = "HP: use character sheet";
    }

    // Speed
    const speedPill = document.createElement("div");
    speedPill.className = "summary-pill";
    if (corp && corp.stats) {
      if (buffTotals.speed) {
        speedPill.textContent = `Speed ${
          corp.stats.speed + buffTotals.speed
        } ft (base ${corp.stats.speed} +${buffTotals.speed})`;
      } else speedPill.textContent = `Speed ${corp.stats.speed} ft`;
    } else {
      if (buffTotals.speed)
        speedPill.textContent = `Your speed +${buffTotals.speed} ft`;
      else speedPill.textContent = "Speed: use character sheet";
    }

    // Shadow power & DC
    let targetShadowSpu = 0;
    if (target.type === "corpse" && corp) {
      targetShadowSpu = corp.stats.spuSum;
    } else {
      targetShadowSpu = globalTotals.total;
    }
    const spuPill = document.createElement("div");
    spuPill.className = "summary-pill";
    spuPill.textContent = `Shadow Power: ${targetShadowSpu} SPU`;

    const dcPill = document.createElement("div");
    dcPill.className = "summary-pill";
    if (state.ui.lastDC) {
      dcPill.textContent = `Shadow DC: ${state.ui.lastDC}`;
    } else {
      dcPill.textContent = "Shadow DC: use spell save DC or DC helper";
    }

    pillRow.appendChild(acPill);
    pillRow.appendChild(hpPill);
    pillRow.appendChild(speedPill);
    pillRow.appendChild(spuPill);
    pillRow.appendChild(dcPill);

    // ----- AT A GLANCE -----
    const glanceTitle = document.createElement("div");
    glanceTitle.className = "summary-section-title";
    glanceTitle.textContent = "At a Glance";

    const glanceBox = document.createElement("div");
    glanceBox.className = "summary-at-a-glance";

    const defPieces = [];
    if (buffTotals.tempHP) defPieces.push(`+${buffTotals.tempHP} temp HP`);
    if (buffTotals.ac) defPieces.push(`+${buffTotals.ac} AC`);
    if (buffTotals.acDark)
      defPieces.push(`+${buffTotals.acDark} AC in dim light/darkness`);

    const mobPieces = [];
    if (buffTotals.speed) mobPieces.push(`+${buffTotals.speed} ft speed`);

    const savePieces = [];
    Object.entries(buffTotals.saves).forEach(([ab, val]) => {
      if (val) savePieces.push(`+${val} ${ab} saves`);
    });

    const advSaveAbilities = Object.keys(buffTotals.advSaves);
    const advCheckAbilities = Object.keys(buffTotals.advChecks);

    const otherPieces = [];

    // Tag-based powers (Shadow Step, Weapon, etc.)
    const mobilityNames = new Set();
    const defenseNames = new Set();
    const otherNames = new Set();

    Object.entries(buffTotals.tags).forEach(([tagId, info]) => {
      const meta = TAG_META[tagId];
      if (!meta) return;
      if (meta.category === "mobility") mobilityNames.add(meta.short);
      else if (meta.category === "defense") defenseNames.add(meta.short);
      else otherNames.add(meta.short);
    });

    mobilityNames.forEach((name) => mobPieces.push(name));
    defenseNames.forEach((name) => defPieces.push(name));
    otherNames.forEach((name) => otherPieces.push(name));

    // Shadow Armor of Night: show name if present
    const targetBuffs = target.buffs || {};
    if (targetBuffs["shadowArmorNight"] && buffTotals.acDark) {
      otherPieces.push("Shadow Armor of Night");
    }

    if (advSaveAbilities.length) {
      const list = advSaveAbilities.join(", ");
      savePieces.push(`Advantage on ${list} saves`);
    }
    if (advCheckAbilities.length) {
      const list = advCheckAbilities.join(", ");
      savePieces.push(`Advantage on ${list} checks`);
    }

    const lines = [];

    if (defPieces.length) {
      lines.push(
        `<div><strong>Defenses:</strong> ${defPieces.join("; ")}</div>`
      );
    }
    if (mobPieces.length) {
      lines.push(
        `<div><strong>Mobility:</strong> ${mobPieces.join("; ")}</div>`
      );
    }
    if (savePieces.length) {
      lines.push(
        `<div><strong>Saves & Checks:</strong> ${savePieces.join("; ")}</div>`
      );
    }
    if (otherPieces.length) {
      lines.push(
        `<div><strong>Other:</strong> ${otherPieces.join("; ")}</div>`
      );
    }

    if (!lines.length) {
      glanceBox.textContent = "No buffs yet.";
    } else {
      glanceBox.innerHTML = lines.join("");
    }

    // ----- POWERS FROM BUFFS -----
    const powersTitle = document.createElement("div");
    powersTitle.className = "summary-section-title";
    powersTitle.textContent = "Powers from Buffs";

    const powersList = document.createElement("ul");
    powersList.className = "summary-list";

    const powerLines = [];

    Object.entries(buffTotals.tags).forEach(([tagId, info]) => {
      const meta = TAG_META[tagId];
      if (meta && meta.power) {
        powerLines.push(meta.power);
      }
    });

    // Special case: Shadow Armor of Night power text
    if (targetBuffs["shadowArmorNight"] && buffTotals.acDark) {
      powerLines.push(
        "Shadow Armor of Night: While in dim light or darkness, your AC increases by the amount shown above."
      );
    }

    if (!powerLines.length) {
      const li = document.createElement("li");
      li.textContent = "No special powers from buffs beyond numeric bonuses.";
      powersList.appendChild(li);
    } else {
      powerLines.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        powersList.appendChild(li);
      });
    }

    // ----- ABILITIES & TECHNIQUES -----
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
      li.textContent = "No AI or custom ability cards assigned yet.";
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

    // ----- INHERITED TECHNIQUES (CORPSES) -----
    let inheritTitle, inheritList;
    if (corp) {
      inheritTitle = document.createElement("div");
      inheritTitle.className = "summary-section-title";
      inheritTitle.textContent = "Inherited Shadow Techniques";

      inheritList = document.createElement("ul");
      inheritList.className = "summary-list";
      if (corp.inheritedTechniques && corp.inheritedTechniques.length) {
        corp.inheritedTechniques.forEach((t) => {
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

    // ----- BUFF BREAKDOWN (COLLAPSIBLE) -----
    const breakdownDetails = document.createElement("details");
    breakdownDetails.className = "summary-details";
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Show buff breakdown (stacks & SPU)";
    breakdownDetails.appendChild(summaryEl);

    const breakdownList = document.createElement("ul");
    breakdownList.className = "summary-list";

    Object.entries(targetBuffs).forEach(([buffId, count]) => {
      const def = state.buffsCatalog[buffId];
      if (!def) return;
      const li = document.createElement("li");
      const eff = def.effect;
      let effectText = "";
      if (eff.type === "tempHP")
        effectText = `Total +${eff.amount * count} temp HP.`;
      else if (eff.type === "speed")
        effectText = `Total +${eff.amount * count} ft speed.`;
      else if (eff.type === "ac")
        effectText = `Total +${eff.amount * count} AC.`;
      else if (eff.type === "acDark")
        effectText = `Total +${eff.amount * count} AC in darkness.`;
      else if (eff.type === "saveBonus")
        effectText = `Total +${eff.amountPerStack * count} to ${
          eff.ability
        } saves.`;
      else if (eff.type === "advSave")
        effectText = `Advantage on ${eff.ability} saves.`;
      else if (eff.type === "advCheck")
        effectText = `Advantage on ${eff.ability} checks.`;

      const totalCost = buffStackCost(def.baseCost, count);
      li.textContent = `${def.name} ×${count} — SPU spent: ${totalCost}. ${effectText}`;
      breakdownList.appendChild(li);
    });

    breakdownDetails.appendChild(breakdownList);

    // ----- NOTES / RULINGS -----
    const notesTitle = document.createElement("div");
    notesTitle.className = "summary-section-title";
    notesTitle.textContent = "Notes / Rulings";

    const notesBox = document.createElement("div");
    notesBox.className = "summary-notes";
    notesBox.contentEditable = "true";
    notesBox.textContent =
      target.notes ||
      "Use this for quick rulings, edge cases, or reminders (editable).";
    notesBox.addEventListener("input", () => {
      target.notes = notesBox.textContent;
      saveState();
    });

    // assemble card
    card.appendChild(header);
    card.appendChild(pillRow);
    card.appendChild(glanceTitle);
    card.appendChild(glanceBox);
    card.appendChild(powersTitle);
    card.appendChild(powersList);
    card.appendChild(abilitiesTitle);
    card.appendChild(abilitiesList);
    if (corp) {
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
    btn.addEventListener("click", () => {
      card.classList.toggle("collapsed");
      state.ui.collapsedPanels[panelId] = card.classList.contains(
        "collapsed"
      );
      saveState();
    });
  });
}

// ---------- GLOBAL BUTTONS ----------

function handleSaveNow() {
  saveState();
  alert("Shadow Fruit data saved to your browser.");
}

function handlePrint() {
  window.print();
}

function handleReset() {
  if (!confirm("Reset all data for the Shadow Fruit system?")) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

// ---------- INIT DOM ----------

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  ensureBaseState();
  populateShadowSelects();

  qs("#btn-calc-shadow").addEventListener("click", handleCalcShadow);
  qs("#btn-add-shadow").addEventListener("click", handleAddShadow);

  qs("#btn-add-ally").addEventListener("click", handleAddAllyTarget);

  qs("#buff-tools-select").value = state.ui.buffToolsView || "hide";
  qs("#buff-tools-select").addEventListener(
    "change",
    handleBuffToolsViewChange
  );
  handleBuffToolsViewChange();

  qs("#btn-add-custom-buff").addEventListener("click", handleAddCustomBuff);
  qs("#btn-calc-dc").addEventListener("click", handleCalcDC);

  qs("#corpse-shadow-mode").addEventListener("change", () => {
    const mode = qs("#corpse-shadow-mode").value;
    qs("#corpse-shadow-select").disabled = mode !== "selected";
  });
  qs("#corpse-shadow-select").disabled =
    qs("#corpse-shadow-mode").value !== "selected";

  qs("#btn-generate-corpse").addEventListener(
    "click",
    handleGenerateCorpse
  );
  qs("#btn-edit-buffs-corpse").addEventListener(
    "click",
    handleEditBuffsForCorpse
  );

  qs("#btn-generate-abilities").addEventListener(
    "click",
    generateAbilitiesStub
  );
  qs("#btn-add-empty-ability").addEventListener(
    "click",
    addEmptyAbilityCard
  );

  qs("#btn-save-now").addEventListener("click", handleSaveNow);
  qs("#btn-print").addEventListener("click", handlePrint);
  qs("#btn-reset").addEventListener("click", handleReset);

  initCollapsible();

  renderShadows();
  renderBuffTargetSelect();
  renderBuffCards();
  renderSelectedBuffsSummary();
  renderCorpseShadowSelect();
  renderAbilityCards();
  updateShadowTotals();
});
