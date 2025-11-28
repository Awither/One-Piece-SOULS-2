// ---------- STATE ----------

const STORAGE_KEY = "soulFruitSystem_v1";

let state = {
  souls: [], // {id,name,raw,templateTier,traits,sol,baseSpu,spu,failureMargin,terrorRoll,maxHpLost,available}
  homies: [], // {id,name,type,boundLocation,hpTier,acTier,damageTier,utilityTier,totalSpuInvested,defeated,notes}
  domains: [], // {id,name,tier,homieIds,spuInvested,stats,notes}
  abilities: [], // {id,name,ownerType,ownerId,description,action,range,target,save,dc,damage,mechanical,combo}
  ui: {
    collapsedPanels: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
    nextIds: { soul: 1, homie: 1, domain: 1, ability: 1 },
    homieTypeFilter: "all",
    lastSoulDC: 17,
    userName: "Soul Fruit User",
    userNotes: ""
  }
};

// ---------- CONFIG / CONSTANTS ----------

const SOUL_TEMPLATE_TIERS = [
  "0 – Helpless civilian (no combat)",
  "1 – Nervous town guard / thug",
  "2 – Trained soldier or rookie pirate",
  "3 – Veteran fighter / small-time captain",
  "4 – Elite commander / New World officer",
  "5 – Devil Fruit user (standard)",
  "6 – Advanced DF user or strong Haki user",
  "7 – Mythical DF user / top commander",
  "8 – Emperor-tier threat / island-level monster",
  "9 – Mythic / divine world-ending entity"
];

// Homie type power/price profiles
const HOMIE_TYPE_CONFIG = {
  minor: {
    label: "Minor Homie",
    baseCreationCost: 10,
    hpCostPerTier: 5,
    acCostPerTier: 5,
    dmgCostPerTier: 5,
    utilCostPerTier: 5,
    baseHp: 10,
    baseAc: 12
  },
  territory: {
    label: "Territory Homie",
    baseCreationCost: 25,
    hpCostPerTier: 10,
    acCostPerTier: 10,
    dmgCostPerTier: 10,
    utilCostPerTier: 10,
    baseHp: 20,
    baseAc: 14
  },
  buff: {
    label: "Buff Homie",
    baseCreationCost: 20,
    hpCostPerTier: 8,
    acCostPerTier: 8,
    dmgCostPerTier: 6,
    utilCostPerTier: 12,
    baseHp: 18,
    baseAc: 13
  },
  signature: {
    label: "Signature Homie",
    baseCreationCost: 40,
    hpCostPerTier: 15,
    acCostPerTier: 15,
    dmgCostPerTier: 15,
    utilCostPerTier: 15,
    baseHp: 40,
    baseAc: 16
  }
};

const DOMAIN_COST_PER_TIER = 15; // SPU per domain tier

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

function ensureBaseState() {
  if (!state.ui || !state.ui.nextIds) {
    state.ui = {
      collapsedPanels: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
      nextIds: { soul: 1, homie: 1, domain: 1, ability: 1 },
      homieTypeFilter: "all",
      lastSoulDC: 17,
      userName: "Soul Fruit User",
      userNotes: ""
    };
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

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Auto-resize helper for textareas (no inner scrollbars)
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ---------- SPU TOTALS ----------

function computeSpuTotals() {
  const total = state.souls
    .filter((s) => s.available !== false)
    .reduce((sum, s) => sum + (s.spu || 0), 0);

  let spent = 0;
  state.homies.forEach((h) => {
    spent += h.totalSpuInvested || 0;
  });
  state.domains.forEach((d) => {
    spent += d.spuInvested || 0;
  });

  const available = Math.max(0, total - spent);
  return { total, spent, available };
}

function updateSpuTotalsUI() {
  const totals = computeSpuTotals();
  const totalEl = qs("#total-spu");
  const spentEl = qs("#spent-spu");
  const availEl = qs("#available-spu");
  if (totalEl) totalEl.textContent = totals.total;
  if (spentEl) spentEl.textContent = totals.spent;
  if (availEl) availEl.textContent = totals.available;
}

// Helper to check if we have enough SPU to spend an additional amount
function canSpendSpu(additional) {
  const { available } = computeSpuTotals();
  return available >= additional;
}

// ---------- PANEL 1: HARVEST A SOUL ----------

function populateSoulTemplateSelect() {
  const sel = qs("#soul-template");
  if (!sel) return;
  sel.innerHTML = "";
  SOUL_TEMPLATE_TIERS.forEach((label, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

// Soul Level & base SPU formula
function computeSoulLevelAndBaseSpu(raw, templateTier) {
  const rawNorm = clamp(raw, 0, 20) / 20;
  const templNorm = (templateTier || 0) / (SOUL_TEMPLATE_TIERS.length - 1 || 1);

  const r = 0.5 + 0.5 * rawNorm;
  const t = 0.5 + 0.5 * templNorm;
  const overall = r * t;

  let sol = Math.round(overall * 10);
  sol = clamp(sol, 1, 10);

  const baseSpu = Math.max(1, Math.round(overall * overall * 1000));
  return { sol, baseSpu, components: { r, t, overall } };
}

// Terror helper based on Soul DC, save, d20 and SoL
function computeTerrorValues(sol) {
  const dc = Number(qs("#soul-dc")?.value || state.ui.lastSoulDC || 17);
  const saveResult = Number(qs("#soul-save-roll")?.value || 0);
  const d20 = Number(qs("#soul-d20-roll")?.value || 0);

  const failureMargin = Math.max(0, dc - saveResult);
  const terrorRoll = d20 + failureMargin;
  const maxHpLost = failureMargin > 0 ? Math.floor(terrorRoll / 2) : 0;
  const spuFromTerror =
    failureMargin > 0 ? Math.max(0, Math.floor((terrorRoll * sol) / 4)) : 0;

  return {
    dc,
    saveResult,
    failureMargin,
    terrorRoll,
    maxHpLost,
    spuFromTerror
  };
}

function updateTerrorFields(sol) {
  const { failureMargin, terrorRoll, maxHpLost } = computeTerrorValues(sol);
  const fmEl = qs("#soul-failure-margin");
  const trEl = qs("#soul-terror-roll");
  const hpEl = qs("#soul-maxhp-lost");
  if (fmEl) fmEl.value = failureMargin || 0;
  if (trEl) trEl.value = terrorRoll || 0;
  if (hpEl) hpEl.value = maxHpLost || 0;
}

function handleCalcSoul() {
  const name = qs("#soul-name")?.value?.trim() || "Unnamed Soul";
  const raw = Number(qs("#soul-raw")?.value || 0);
  const templ = Number(qs("#soul-template")?.value || 0);

  const { sol, baseSpu, components } = computeSoulLevelAndBaseSpu(raw, templ);
  const terror = computeTerrorValues(sol);

  state.ui.lastSoulDC = terror.dc;

  updateTerrorFields(sol);

  const out = qs("#soul-calc-output");
  if (out) {
    out.innerHTML = `
      <strong>${name}</strong> → <strong>Soul Level ${sol}</strong>, 
      <strong>${terror.spuFromTerror || 0} SPU</strong> captured this attempt
      <br/>
      <span class="muted">
        Underlying potential: base SPU ≈ ${baseSpu}.<br/>
        Failure margin: ${terror.failureMargin}, Terror Roll: ${terror.terrorRoll}, suggested max HP lost: ${terror.maxHpLost}.<br/>
        Breakdown (normalized): Raw ${components.r.toFixed(
          2
        )}, Template ${components.t.toFixed(2)}.
      </span>
    `;
  }

  saveState();
}

function handleAddSoul() {
  const name = qs("#soul-name")?.value?.trim() || "Unnamed Soul";
  const raw = Number(qs("#soul-raw")?.value || 0);
  const templ = Number(qs("#soul-template")?.value || 0);
  const traits = qs("#soul-traits")?.value?.trim() || "";

  const { sol, baseSpu } = computeSoulLevelAndBaseSpu(raw, templ);
  const terror = computeTerrorValues(sol);
  state.ui.lastSoulDC = terror.dc;

  updateTerrorFields(sol);

  const soul = {
    id: nextId("soul"),
    name,
    raw,
    templateTier: templ,
    traits,
    sol,
    baseSpu,
    spu: terror.spuFromTerror || 0,
    failureMargin: terror.failureMargin,
    terrorRoll: terror.terrorRoll,
    maxHpLost: terror.maxHpLost,
    available: true
  };

  state.souls.push(soul);
  renderSouls();
  updateSpuTotalsUI();
  renderHomieList();
  renderDomainHomieSelect();
  renderSummary();
  saveState();
}

// ---------- PANEL 2: SOUL BANK ----------

function renderSouls() {
  const container = qs("#soul-list");
  if (!container) return;
  container.innerHTML = "";

  if (!state.souls.length) {
    container.innerHTML =
      '<p class="muted">No souls stored yet. Harvest one in panel 1.</p>';
    return;
  }

  state.souls.forEach((soul) => {
    const card = document.createElement("div");
    card.className = "soul-card";

    const header = document.createElement("div");
    header.className = "soul-card-header";

    const nameEl = document.createElement("div");
    nameEl.className = "soul-name";
    nameEl.textContent = soul.name || "Unnamed Soul";

    const tag = document.createElement("span");
    tag.className = "soul-tag";
    tag.textContent = `SoL ${soul.sol} | ${soul.spu} SPU`;

    header.appendChild(nameEl);
    header.appendChild(tag);

    const meta = document.createElement("small");
    const templateLabel =
      SOUL_TEMPLATE_TIERS[soul.templateTier] || `Tier ${soul.templateTier}`;
    meta.textContent = `Raw ${soul.raw}/20 · Template: ${templateLabel}`;

    const traitsRow = document.createElement("div");
    traitsRow.className = "field";
    const traitsLabel = document.createElement("label");
    traitsLabel.textContent = "Traits / notes:";
    const traitsInput = document.createElement("input");
    traitsInput.type = "text";
    traitsInput.value = soul.traits || "";
    traitsInput.addEventListener("input", () => {
      soul.traits = traitsInput.value;
      saveState();
      renderSummary();
    });
    traitsRow.appendChild(traitsLabel);
    traitsRow.appendChild(traitsInput);

    const terrorInfo = document.createElement("small");
    terrorInfo.className = "soul-terror-info";
    terrorInfo.textContent = `Failure margin: ${soul.failureMargin || 0}, Terror roll: ${
      soul.terrorRoll || 0
    }, max HP lost (note): ${soul.maxHpLost || 0}`;

    const activeRow = document.createElement("div");
    activeRow.className = "soul-active-row";

    const activeLabel = document.createElement("label");
    const activeCheckbox = document.createElement("input");
    activeCheckbox.type = "checkbox";
    activeCheckbox.checked = soul.available !== false;
    activeCheckbox.addEventListener("change", () => {
      soul.available = activeCheckbox.checked;
      updateSpuTotalsUI();
      renderHomieList();
      renderSummary();
      saveState();
    });
    activeLabel.appendChild(activeCheckbox);
    activeLabel.appendChild(
      document.createTextNode(" Available for crafting / domains")
    );

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-danger small-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      state.souls = state.souls.filter((x) => x.id !== soul.id);
      renderSouls();
      updateSpuTotalsUI();
      renderSummary();
      saveState();
    });

    activeRow.appendChild(activeLabel);
    activeRow.appendChild(removeBtn);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(traitsRow);
    card.appendChild(terrorInfo);
    card.appendChild(activeRow);

    container.appendChild(card);
  });
}

// ---------- PANEL 3: HOMIE WORKSHOP ----------

function createHomie(type) {
  const cfg = HOMIE_TYPE_CONFIG[type];
  if (!cfg) return;

  const baseCost = cfg.baseCreationCost || 0;
  if (!canSpendSpu(baseCost)) {
    alert(
      `Not enough SPU to create a ${cfg.label}. You need ${baseCost} SPU available.`
    );
    return;
  }

  const homie = {
    id: nextId("homie"),
    name: `${cfg.label} ${state.ui.nextIds.homie || ""}`,
    type,
    boundLocation: "",
    hpTier: 0,
    acTier: 0,
    damageTier: 0,
    utilityTier: 0,
    totalSpuInvested: baseCost,
    defeated: false,
    notes: ""
  };

  state.homies.push(homie);
  updateSpuTotalsUI();
  renderHomieList();
  renderDomainHomieSelect();
  renderSummary();
  saveState();
}

function adjustHomieTier(homie, tierKey, delta) {
  const cfg = HOMIE_TYPE_CONFIG[homie.type];
  if (!cfg) return;

  const costMap = {
    hpTier: cfg.hpCostPerTier,
    acTier: cfg.acCostPerTier,
    damageTier: cfg.dmgCostPerTier,
    utilityTier: cfg.utilCostPerTier
  };

  const costPerStep = costMap[tierKey] || 0;
  if (!costPerStep) return;

  const current = homie[tierKey] || 0;
  const next = clamp(current + delta, 0, 5);
  if (next === current) return;

  const diff = next - current;
  if (diff > 0) {
    const additionalCost = diff * costPerStep;
    if (!canSpendSpu(additionalCost)) {
      alert(
        `Not enough SPU to increase ${tierKey} for ${homie.name}. Need ${additionalCost} SPU available.`
      );
      return;
    }
    homie[tierKey] = next;
    homie.totalSpuInvested = (homie.totalSpuInvested || 0) + additionalCost;
  } else {
    // Going down: refund costPerStep per step (optional, we’ll allow partial refund).
    const refund = -diff * costPerStep;
    homie[tierKey] = next;
    homie.totalSpuInvested = Math.max(
      HOMIE_TYPE_CONFIG[homie.type].baseCreationCost || 0,
      (homie.totalSpuInvested || 0) - refund
    );
  }

  updateSpuTotalsUI();
  renderHomieList();
  renderSummary();
  saveState();
}

function toggleHomieDefeated(homie, defeated) {
  homie.defeated = defeated;
  renderHomieList();
  renderSummary();
  saveState();
}

function reviveHomie(homie) {
  const invested = homie.totalSpuInvested || 0;
  const revivalCost = Math.floor(invested / 2);
  if (revivalCost <= 0) {
    homie.defeated = false;
    renderHomieList();
    renderSummary();
    saveState();
    return;
  }

  if (!canSpendSpu(revivalCost)) {
    alert(
      `Not enough SPU to revive ${homie.name}. Need ${revivalCost} SPU available.`
    );
    return;
  }

  homie.totalSpuInvested = invested + revivalCost;
  homie.defeated = false;

  updateSpuTotalsUI();
  renderHomieList();
  renderSummary();
  saveState();
}

function renderHomieList() {
  const container = qs("#homie-list");
  if (!container) return;
  container.innerHTML = "";

  if (!state.homies.length) {
    container.innerHTML =
      '<p class="muted">No homies yet. Spend SPU to create one using the buttons above.</p>';
    return;
  }

  const filter = state.ui.homieTypeFilter || "all";
  const homies = state.homies.filter(
    (h) => filter === "all" || h.type === filter
  );

  if (!homies.length) {
    container.innerHTML =
      '<p class="muted">No homies of that type yet. Create one using the buttons above.</p>';
    return;
  }

  homies.forEach((homie) => {
    const cfg = HOMIE_TYPE_CONFIG[homie.type] || {};
    const card = document.createElement("div");
    card.className = "homie-card";

    // Header
    const header = document.createElement("div");
    header.className = "homie-card-header";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = homie.name || "";
    nameInput.className = "homie-name-input";
    nameInput.addEventListener("input", () => {
      homie.name = nameInput.value;
      renderDomainHomieSelect();
      renderSummary();
      saveState();
    });

    const typeTag = document.createElement("span");
    typeTag.className = "homie-type-tag";
    typeTag.textContent = cfg.label || homie.type;

    header.appendChild(nameInput);
    header.appendChild(typeTag);

    // Bound location (for territory homies)
    let boundField = null;
    if (homie.type === "territory") {
      boundField = document.createElement("div");
      boundField.className = "field homie-bound-field";
      const lbl = document.createElement("label");
      lbl.textContent = "Bound Location / Area";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = "Castle roof, main road, forest gate…";
      inp.value = homie.boundLocation || "";
      inp.addEventListener("input", () => {
        homie.boundLocation = inp.value;
        renderSummary();
        saveState();
      });
      boundField.appendChild(lbl);
      boundField.appendChild(inp);
    }

    // Tier controls
    const tierGrid = document.createElement("div");
    tierGrid.className = "homie-tier-grid";

    function makeTierRow(label, key, costPer) {
      const row = document.createElement("div");
      row.className = "homie-tier-row";

      const left = document.createElement("div");
      left.className = "homie-tier-label";
      left.textContent = `${label}: ${homie[key] || 0}`;

      const costInfo = document.createElement("div");
      costInfo.className = "homie-tier-cost";
      costInfo.textContent = `Cost per +1: ${costPer} SPU`;

      const controls = document.createElement("div");
      controls.className = "homie-tier-controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "stack-btn";
      minus.textContent = "−";
      minus.addEventListener("click", () => {
        adjustHomieTier(homie, key, -1);
      });

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "stack-btn";
      plus.textContent = "+";
      plus.addEventListener("click", () => {
        adjustHomieTier(homie, key, +1);
      });

      controls.appendChild(minus);
      controls.appendChild(plus);

      row.appendChild(left);
      row.appendChild(costInfo);
      row.appendChild(controls);
      return row;
    }

    tierGrid.appendChild(
      makeTierRow("HP Tier", "hpTier", cfg.hpCostPerTier || 0)
    );
    tierGrid.appendChild(
      makeTierRow("AC Tier", "acTier", cfg.acCostPerTier || 0)
    );
    tierGrid.appendChild(
      makeTierRow("Damage Tier", "damageTier", cfg.dmgCostPerTier || 0)
    );
    tierGrid.appendChild(
      makeTierRow("Utility Tier", "utilityTier", cfg.utilCostPerTier || 0)
    );

    // Investment / revival
    const investRow = document.createElement("div");
    investRow.className = "homie-invest-row";
    const invested = homie.totalSpuInvested || 0;
    const revivalCost = Math.floor(invested / 2);

    investRow.innerHTML = `
      <span>Total SPU invested: <strong>${invested}</strong></span>
      <span>Revival cost: <strong>${revivalCost}</strong> SPU</span>
    `;

    const statusRow = document.createElement("div");
    statusRow.className = "homie-status-row";

    const statusText = document.createElement("span");
    statusText.textContent = homie.defeated ? "Status: Defeated" : "Status: Active";

    const statusButtons = document.createElement("div");
    statusButtons.className = "homie-status-buttons";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn-secondary small-btn";
    toggleBtn.textContent = homie.defeated ? "Mark Active" : "Mark Defeated";
    toggleBtn.addEventListener("click", () => {
      toggleHomieDefeated(homie, !homie.defeated);
    });

    const reviveBtn = document.createElement("button");
    reviveBtn.type = "button";
    reviveBtn.className = "btn-secondary small-btn";
    reviveBtn.textContent = "Revive (pay)";
    reviveBtn.disabled = !homie.defeated;
    reviveBtn.addEventListener("click", () => {
      reviveHomie(homie);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-danger small-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      if (!confirm(`Delete homie "${homie.name}"?`)) return;
      state.homies = state.homies.filter((h) => h.id !== homie.id);
      // Remove from any domains
      state.domains.forEach((d) => {
        d.homieIds = (d.homieIds || []).filter((id) => id !== homie.id);
      });
      updateSpuTotalsUI();
      renderHomieList();
      renderDomainHomieSelect();
      renderSummary();
      saveState();
    });

    statusButtons.appendChild(toggleBtn);
    statusButtons.appendChild(reviveBtn);
    statusButtons.appendChild(deleteBtn);

    statusRow.appendChild(statusText);
    statusRow.appendChild(statusButtons);

    // Notes field
    const notesField = document.createElement("div");
    notesField.className = "field homie-notes-field";
    const notesLabel = document.createElement("label");
    notesLabel.textContent = "Notes / role description";
    const notesArea = document.createElement("textarea");
    notesArea.rows = 2;
    notesArea.value = homie.notes || "";
    autoResizeTextarea(notesArea);
    notesArea.addEventListener("input", () => {
      homie.notes = notesArea.value;
      autoResizeTextarea(notesArea);
      saveState();
      renderSummary();
    });
    notesField.appendChild(notesLabel);
    notesField.appendChild(notesArea);

    card.appendChild(header);
    if (boundField) card.appendChild(boundField);
    card.appendChild(tierGrid);
    card.appendChild(investRow);
    card.appendChild(statusRow);
    card.appendChild(notesField);

    container.appendChild(card);
  });
}

// ---------- PANEL 4: DOMAINS & TERRITORY HOMIES ----------

function renderDomainHomieSelect() {
  const sel = qs("#domain-homie-select");
  if (!sel) return;
  const currentName = qs("#domain-name")?.value?.trim() || "";
  sel.innerHTML = "";

  const territoryHomies = state.homies.filter((h) => h.type === "territory");
  territoryHomies.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = `${h.name || "Unnamed"} (${HOMIE_TYPE_CONFIG[h.type]?.label || h.type})`;
    sel.appendChild(opt);
  });

  // Reselect homies if there's a matching domain in state
  if (currentName) {
    const dom = state.domains.find((d) => d.name === currentName);
    if (dom) {
      const set = new Set(dom.homieIds || []);
      Array.from(sel.options).forEach((o) => {
        o.selected = set.has(o.value);
      });
    }
  }
}

function buildDomainStats(domain) {
  const tier = domain.tier || 1;
  const controlRange = tier * 100; // feet, rough
  const passiveFearDc = 10 + Math.floor(tier / 2) + 2;
  const detectionBonus = `All homies in the domain gain +${Math.floor(
    tier / 2
  )} to Perception-style checks.`;

  return {
    controlRange,
    passiveFearDc,
    detectionBonus
  };
}

function handleGenerateDomain() {
  const nameInput = qs("#domain-name");
  const tierInput = qs("#domain-tier");
  if (!nameInput || !tierInput) return;

  const name = nameInput.value.trim() || "Unnamed Domain";
  let tier = Number(tierInput.value || 1);
  tier = clamp(tier, 1, 10);

  const sel = qs("#domain-homie-select");
  const selectedIds = sel
    ? Array.from(sel.selectedOptions).map((o) => o.value)
    : [];

  let domain = state.domains.find((d) => d.name === name);
  if (!domain) {
    // New domain
    const initialCost = tier * DOMAIN_COST_PER_TIER;
    if (!canSpendSpu(initialCost)) {
      alert(
        `Not enough SPU to establish this domain at tier ${tier}. Need ${initialCost} SPU available.`
      );
      return;
    }
    domain = {
      id: nextId("domain"),
      name,
      tier,
      homieIds: selectedIds,
      spuInvested: initialCost,
      stats: buildDomainStats({ tier }),
      notes: ""
    };
    state.domains.push(domain);
  } else {
    // Existing domain; only pay when increasing tier
    const oldTier = domain.tier || 1;
    const extra = Math.max(0, tier - oldTier);
    const additionalCost = extra * DOMAIN_COST_PER_TIER;
    if (additionalCost > 0 && !canSpendSpu(additionalCost)) {
      alert(
        `Not enough SPU to raise domain tier from ${oldTier} to ${tier}. Need ${additionalCost} SPU available.`
      );
      return;
    }
    domain.tier = tier;
    domain.homieIds = selectedIds;
    domain.spuInvested = (domain.spuInvested || 0) + additionalCost;
    domain.stats = buildDomainStats(domain);
  }

  updateSpuTotalsUI();
  renderDomainCard(domain);
  renderSummary();
  saveState();
}

function renderDomainCard(domain) {
  const container = qs("#domain-card");
  if (!container) return;
  container.innerHTML = "";
  if (!domain) return;

  const stats = domain.stats || buildDomainStats(domain);
  const territoryHomies = state.homies.filter((h) =>
    (domain.homieIds || []).includes(h.id)
  );

  const card = document.createElement("div");
  card.className = "domain-card";

  const header = document.createElement("div");
  header.className = "domain-header-row";

  const nameEl = document.createElement("div");
  nameEl.className = "domain-name";
  nameEl.textContent = domain.name.toUpperCase();

  const tag = document.createElement("div");
  tag.className = "domain-tier-tag";
  tag.textContent = `Domain Tier ${domain.tier} · ${domain.spuInvested} SPU invested`;

  header.appendChild(nameEl);
  header.appendChild(tag);

  const pillRow = document.createElement("div");
  pillRow.className = "domain-pill-row";

  const rangePill = document.createElement("div");
  rangePill.className = "domain-pill";
  rangePill.textContent = `Control Range: ~${stats.controlRange} ft`;

  const fearPill = document.createElement("div");
  fearPill.className = "domain-pill";
  fearPill.textContent = `Passive Fear DC: ${stats.passiveFearDc}`;

  const detPill = document.createElement("div");
  detPill.className = "domain-pill";
  detPill.textContent = `Detection: enhanced senses via homies`;

  pillRow.appendChild(rangePill);
  pillRow.appendChild(fearPill);
  pillRow.appendChild(detPill);

  const lairSec = document.createElement("div");
  lairSec.className = "domain-section";
  lairSec.innerHTML = "<h4>Lair Actions (examples)</h4>";
  const lairList = document.createElement("ul");

  const lair1 = document.createElement("li");
  lair1.textContent =
    "At the start of a round, the domain can animate roads, walls, or terrain to move or restrain enemies (grapples, difficult terrain, or forced movement).";

  const lair2 = document.createElement("li");
  lair2.textContent =
    "Once per round, a storm, fire, or themed environmental effect targets a creature in the domain (attack roll or save vs. the Passive Fear DC).";

  const lair3 = document.createElement("li");
  lair3.textContent =
    "Homies within the domain coordinate, granting advantage to one homie attack or support action per round.";

  lairList.appendChild(lair1);
  lairList.appendChild(lair2);
  lairList.appendChild(lair3);
  lairSec.appendChild(lairList);

  const homieSec = document.createElement("div");
  homieSec.className = "domain-section";
  homieSec.innerHTML = "<h4>Territory Homies Assigned</h4>";
  const homieList = document.createElement("ul");
  if (territoryHomies.length) {
    territoryHomies.forEach((h) => {
      const li = document.createElement("li");
      li.textContent = `${h.name} — Tier profile: HP ${h.hpTier}, AC ${h.acTier}, Damage ${h.damageTier}, Utility ${h.utilityTier}${
        h.boundLocation ? ` (bound to: ${h.boundLocation})` : ""
      }`;
      homieList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No specific territory homies bound yet.";
    homieList.appendChild(li);
  }
  homieSec.appendChild(homieList);

  const envSec = document.createElement("div");
  envSec.className = "domain-section";
  envSec.innerHTML = "<h4>Environmental Personality</h4>";
  const envP = document.createElement("p");
  envP.textContent =
    "Describe how the domain feels: playful candy kingdom, strict military city, haunted forest of screams, etc.";
  envSec.appendChild(envP);

  // Notes
  const notesTitle = document.createElement("div");
  notesTitle.className = "summary-section-title";
  notesTitle.textContent = "Domain Notes / Rulings";

  const notesBox = document.createElement("div");
  notesBox.className = "summary-notes";
  notesBox.contentEditable = "true";
  notesBox.textContent =
    domain.notes ||
    "Use this for special lair rulings, unique homie tricks, or story notes for the domain.";
  notesBox.addEventListener("input", () => {
    domain.notes = notesBox.textContent;
    saveState();
  });

  card.appendChild(header);
  card.appendChild(pillRow);
  card.appendChild(lairSec);
  card.appendChild(homieSec);
  card.appendChild(envSec);
  card.appendChild(notesTitle);
  card.appendChild(notesBox);

  container.appendChild(card);
}

function renderDomainCardIfExists() {
  const name = qs("#domain-name")?.value?.trim();
  if (!name) return;
  const domain = state.domains.find((d) => d.name === name);
  if (domain) renderDomainCard(domain);
}

function handleEditHomiesForDomain() {
  const panel3 = document.querySelector('[data-panel="3"]');
  state.ui.homieTypeFilter = "territory";
  const filterSel = qs("#homie-type-filter");
  if (filterSel) filterSel.value = "territory";
  renderHomieList();
  if (panel3) panel3.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- PANEL 5: AI ABILITIES ----------

function renderAbilityCards() {
  const container = qs("#ability-cards-container");
  if (!container) return;
  container.innerHTML = "";

  if (!state.abilities.length) {
    container.innerHTML =
      '<p class="muted">No abilities yet. Generate with AI or add an empty ability card.</p>';
    return;
  }

  const ownerOptions = [];

  // User
  ownerOptions.push({ value: "user:self", label: state.ui.userName || "Soul Fruit User" });

  // Homies
  state.homies.forEach((h) => {
    ownerOptions.push({
      value: `homie:${h.id}`,
      label: `Homie – ${h.name || "Unnamed"}`
    });
  });

  // Domains
  state.domains.forEach((d) => {
    ownerOptions.push({
      value: `domain:${d.id}`,
      label: `Domain – ${d.name || "Unnamed"}`
    });
  });

  state.abilities.forEach((ab) => {
    const card = document.createElement("div");
    card.className = "ability-card";

    // Name + owner row
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

    const ownerSel = document.createElement("select");
    ownerOptions.forEach((optData) => {
      const opt = document.createElement("option");
      opt.value = optData.value;
      opt.textContent = optData.label;
      ownerSel.appendChild(opt);
    });
    // Ensure ownerType/ownerId
    if (!ab.ownerType || !ab.ownerId) {
      ab.ownerType = "user";
      ab.ownerId = "self";
    }
    const combinedOwner = `${ab.ownerType}:${ab.ownerId}`;
    ownerSel.value = combinedOwner;
    ownerSel.addEventListener("change", () => {
      const [type, id] = ownerSel.value.split(":");
      ab.ownerType = type;
      ab.ownerId = id;
      saveState();
      renderSummary();
    });

    nameRow.appendChild(nameInput);
    nameRow.appendChild(ownerSel);

    const roleText = document.createElement("div");
    roleText.className = "ability-role";
    roleText.textContent =
      "Role: Offense / Defense / Support / Control / Utility";

    // Description
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

    // Mini grid
    const miniGrid = document.createElement("div");
    miniGrid.className = "ability-mini-grid";
    const miniFields = [
      ["Action", "action"],
      ["Range", "range"],
      ["Target", "target"],
      ["Save", "save"],
      ["DC", "dc"],
      ["Damage", "damage"]
    ];
    miniFields.forEach(([label, key]) => {
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

    // Mechanical effect
    const mechField = document.createElement("div");
    mechField.className = "field ability-main-text";
    const mLabel = document.createElement("label");
    mLabel.textContent =
      "Mechanical effect: what happens on hit / failed save.";
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

    // Combo logic
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

    // Footer
    const footer = document.createElement("div");
    footer.className = "ability-footer-row";

    const left = document.createElement("div");
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-secondary small-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = `${ab.name}\n${ab.description}\nAction: ${
        ab.action || ""
      } | Range: ${ab.range || ""} | Target: ${ab.target || ""} | Save: ${
        ab.save || ""
      } ${ab.dc ? "DC " + ab.dc : ""}\nDamage: ${
        ab.damage || ""
      }\n${ab.mechanical || ""}\n${ab.combo || ""}`;
      navigator.clipboard.writeText(text).catch(() => {});
    });

    const rerollBtn = document.createElement("button");
    rerollBtn.type = "button";
    rerollBtn.className = "btn-secondary small-btn";
    rerollBtn.textContent = "Reroll Text Hint";
    rerollBtn.addEventListener("click", () => {
      ab.description =
        ab.description ||
        "Soul power manifests in a new variation of the attack. Describe how the homie or soul energy changes form.";
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
    card.appendChild(roleText);
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
    ownerType: "user",
    ownerId: "self",
    description: "",
    action: "",
    range: "",
    target: "",
    save: "",
    dc: "",
    damage: "",
    mechanical: "",
    combo: ""
  };
  state.abilities.push(ab);
  renderAbilityCards();
  renderSummary();
  saveState();
}

async function generateAbilitiesWithAI() {
  const notes = qs("#ai-notes")?.value || "";

  const totals = computeSpuTotals();

  const payload = {
    souls: state.souls,
    homies: state.homies,
    domains: state.domains,
    totalSpu: totals.total,
    spentSpu: totals.spent,
    availableSpu: totals.available,
    notes
  };

  try {
    const res = await fetch("/api/generate-soul-abilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("AI endpoint error:", txt);
      alert("AI generation failed. Check console for details.");
      return;
    }

    const data = await res.json();
    const text =
      data.text ||
      "No content returned from AI. Check your API route configuration.";

    // Create a single big suggestion card attached to the user
    const ab = {
      id: nextId("ability"),
      name: "AI Soul Fruit Suggestions",
      ownerType: "user",
      ownerId: "self",
      description: text,
      action: "",
      range: "",
      target: "",
      save: "",
      dc: "",
      damage: "",
      mechanical: "",
      combo: ""
    };
    state.abilities.push(ab);
    renderAbilityCards();
    renderSummary();
    saveState();
  } catch (err) {
    console.error("AI generation error:", err);
    alert("AI generation failed due to a network or runtime error.");
  }
}

// ---------- PANEL 6: SUMMARY (SOUL PARTY DASHBOARD) ----------

function getSummaryEntities() {
  const entities = [];

  // User
  entities.push({
    id: "self",
    type: "user",
    name: state.ui.userName || "Soul Fruit User"
  });

  // Homies
  state.homies.forEach((h) => {
    entities.push({
      id: h.id,
      type: "homie",
      name: h.name || "Unnamed Homie"
    });
  });

  // Domains
  state.domains.forEach((d) => {
    entities.push({
      id: d.id,
      type: "domain",
      name: d.name || "Unnamed Domain"
    });
  });

  return entities;
}

function renderSummary() {
  const container = qs("#summary-grid");
  if (!container) return;
  container.innerHTML = "";

  const entities = getSummaryEntities();
  if (!entities.length) {
    container.innerHTML =
      "<p>No entities yet. Add homies, domains, or abilities to see a summary.</p>";
    return;
  }

  const totals = computeSpuTotals();

  entities.forEach((ent) => {
    const card = document.createElement("div");
    card.className = "summary-card";

    const header = document.createElement("div");
    header.className = "summary-header-row";

    const nameEl = document.createElement("div");
    nameEl.className = "summary-name";
    nameEl.textContent = ent.name;

    const tag = document.createElement("div");
    tag.className = "summary-tag";
    if (ent.type === "user") tag.textContent = "SOUL FRUIT USER";
    else if (ent.type === "homie") tag.textContent = "HOMIE";
    else if (ent.type === "domain") tag.textContent = "DOMAIN";
    else tag.textContent = ent.type.toUpperCase();

    header.appendChild(nameEl);
    header.appendChild(tag);

    const pillRow = document.createElement("div");
    pillRow.className = "summary-pill-row";

    let spuLinked = 0;
    let pill1Text = "";
    let pill2Text = "";
    let pill3Text = "";
    let pill4Text = "";

    if (ent.type === "user") {
      spuLinked = totals.total;
      pill1Text = "AC / HP: use character sheet";
      pill2Text = "Movement: use character sheet";
      pill3Text = `Global Soul Power: ${totals.total} SPU`;
      pill4Text = state.ui.lastSoulDC
        ? `Soul DC: ${state.ui.lastSoulDC}`
        : "Soul DC: set in panel 1";
    } else if (ent.type === "homie") {
      const h = state.homies.find((x) => x.id === ent.id);
      if (h) {
        const cfg = HOMIE_TYPE_CONFIG[h.type] || { baseHp: 10, baseAc: 12 };
        const hpEst = (cfg.baseHp || 10) + (h.hpTier || 0) * 10;
        const acEst = (cfg.baseAc || 12) + (h.acTier || 0);
        const dmgTier = h.damageTier || 0;
        const utilTier = h.utilityTier || 0;

        spuLinked = h.totalSpuInvested || 0;
        pill1Text = `HP ~${hpEst}, AC ~${acEst}`;
        pill2Text = `Damage Tier ${dmgTier}, Utility Tier ${utilTier}`;
        pill3Text = `SPU invested: ${spuLinked}`;
        pill4Text = h.defeated ? "Status: Defeated" : "Status: Active";
      }
    } else if (ent.type === "domain") {
      const d = state.domains.find((x) => x.id === ent.id);
      if (d) {
        const stats = d.stats || buildDomainStats(d);
        spuLinked = d.spuInvested || 0;
        pill1Text = `Tier ${d.tier}`;
        pill2Text = `Control Range ~${stats.controlRange} ft`;
        pill3Text = `Passive Fear DC ${stats.passiveFearDc}`;
        pill4Text = `SPU invested: ${spuLinked}`;
      }
    }

    [pill1Text, pill2Text, pill3Text, pill4Text].forEach((txt) => {
      if (!txt) return;
      const pill = document.createElement("div");
      pill.className = "summary-pill";
      pill.textContent = txt;
      pillRow.appendChild(pill);
    });

    // At a glance
    const glanceTitle = document.createElement("div");
    glanceTitle.className = "summary-section-title";
    glanceTitle.textContent = "At a Glance";

    const glanceBox = document.createElement("div");
    glanceBox.className = "summary-at-a-glance";

    if (ent.type === "user") {
      glanceBox.innerHTML =
        "<div><strong>Role:</strong> Soul fruit sovereign. Controls homies, shapes domains, and rips souls via fear.</div>";
    } else if (ent.type === "homie") {
      const h = state.homies.find((x) => x.id === ent.id);
      const cfg = h ? HOMIE_TYPE_CONFIG[h.type] : null;
      const roleLines = [];
      if (h) {
        roleLines.push(
          `<strong>Type:</strong> ${cfg?.label || h.type} (HP ${h.hpTier}, AC ${h.acTier}, Damage ${h.damageTier}, Utility ${h.utilityTier})`
        );
        if (h.notes) {
          roleLines.push(`<strong>Notes:</strong> ${h.notes}`);
        }
        if (h.type === "buff") {
          roleLines.push(
            "Buff Homie: focuses on healing, auras, advantage, and support tricks."
          );
        } else if (h.type === "territory") {
          roleLines.push(
            "Territory Homie: anchored to a place, controls or defends terrain."
          );
        } else if (h.type === "signature") {
          roleLines.push(
            "Signature Homie: elite companion, like a personal Prometheus/Zeus/Napoleon-style spirit."
          );
        } else if (h.type === "minor") {
          roleLines.push(
            "Minor Homie: small, utility-focused soul creation. Perfect for tricks, scouting, and swarming."
          );
        }
      }
      glanceBox.innerHTML = roleLines.map((l) => `<div>${l}</div>`).join("") || "—";
    } else if (ent.type === "domain") {
      const d = state.domains.find((x) => x.id === ent.id);
      if (d) {
        const stats = d.stats || buildDomainStats(d);
        const lines = [];
        lines.push(
          `<div><strong>Domain Style:</strong> Tier ${d.tier} soul-infused territory with lair actions and homies.</div>`
        );
        lines.push(
          `<div><strong>Fear & Control:</strong> Hostile creatures entering face ambient fear (DC ${stats.passiveFearDc}) and moving terrain.</div>`
        );
        if ((d.homieIds || []).length) {
          lines.push(
            `<div><strong>Homies Bound:</strong> ${d.homieIds.length} territory homie(s).</div>`
          );
        }
        glanceBox.innerHTML = lines.join("");
      } else {
        glanceBox.textContent = "—";
      }
    } else {
      glanceBox.textContent = "—";
    }

    // Abilities & techniques
    const abilitiesTitle = document.createElement("div");
    abilitiesTitle.className = "summary-section-title";
    abilitiesTitle.textContent = "Abilities & Techniques";

    const abilitiesList = document.createElement("ul");
    abilitiesList.className = "summary-list";

    const relevantAbilities = state.abilities.filter((ab) => {
      if (ent.type === "user") {
        return ab.ownerType === "user" && ab.ownerId === "self";
      }
      if (ent.type === "homie") {
        return ab.ownerType === "homie" && ab.ownerId === ent.id;
      }
      if (ent.type === "domain") {
        return ab.ownerType === "domain" && ab.ownerId === ent.id;
      }
      return false;
    });

    if (!relevantAbilities.length) {
      const li = document.createElement("li");
      li.textContent = "No abilities assigned yet.";
      abilitiesList.appendChild(li);
    } else {
      relevantAbilities.forEach((ab) => {
        const li = document.createElement("li");
        const dcText = ab.dc ? ` (DC ${ab.dc})` : "";
        li.textContent = `${ab.name || "Unnamed ability"} — ${
          ab.action || "Action"
        }; Range ${ab.range || "—"}; Target ${
          ab.target || "—"
        }; Save ${ab.save || "—"}${dcText}; Damage ${
          ab.damage || "—"
        }.`;
        abilitiesList.appendChild(li);
      });
    }

    // Notes
    const notesTitle = document.createElement("div");
    notesTitle.className = "summary-section-title";
    notesTitle.textContent = "Notes / Rulings";

    const notesBox = document.createElement("div");
    notesBox.className = "summary-notes";
    notesBox.contentEditable = "true";

    if (ent.type === "user") {
      notesBox.textContent =
        state.ui.userNotes ||
        "Use this for soul fruit rulings, edge cases, and recurring combos.";
      notesBox.addEventListener("input", () => {
        state.ui.userNotes = notesBox.textContent;
        saveState();
      });
    } else if (ent.type === "homie") {
      const h = state.homies.find((x) => x.id === ent.id);
      notesBox.textContent =
        (h && h.notes) ||
        "Use this for rulings on this homie’s powers, limits, and personality.";
      notesBox.addEventListener("input", () => {
        if (h) {
          h.notes = notesBox.textContent;
          saveState();
        }
      });
    } else if (ent.type === "domain") {
      const d = state.domains.find((x) => x.id === ent.id);
      notesBox.textContent =
        (d && d.notes) ||
        "Use this for rulings on lair actions, environmental quirks, and story details.";
      notesBox.addEventListener("input", () => {
        if (d) {
          d.notes = notesBox.textContent;
          saveState();
        }
      });
    }

    // Assemble card
    card.appendChild(header);
    card.appendChild(pillRow);
    card.appendChild(glanceTitle);
    card.appendChild(glanceBox);
    card.appendChild(abilitiesTitle);
    card.appendChild(abilitiesList);
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
      state.ui.collapsedPanels[panelId] = card.classList.contains("collapsed");
      saveState();
    });
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
  populateSoulTemplateSelect();

  // Panel 1 events
  const calcSoulBtn = qs("#btn-calc-soul");
  if (calcSoulBtn) calcSoulBtn.addEventListener("click", handleCalcSoul);

  const addSoulBtn = qs("#btn-add-soul");
  if (addSoulBtn) addSoulBtn.addEventListener("click", handleAddSoul);

  // Auto-update terror fields when DC / save / d20 change
  ["#soul-dc", "#soul-save-roll", "#soul-d20-roll"].forEach((sel) => {
    const el = qs(sel);
    if (el) {
      el.addEventListener("input", () => {
        const raw = Number(qs("#soul-raw")?.value || 0);
        const templ = Number(qs("#soul-template")?.value || 0);
        const { sol } = computeSoulLevelAndBaseSpu(raw, templ);
        updateTerrorFields(sol);
        handleCalcSoul();
      });
    }
  });

  // Panel 3 events
  const filterSel = qs("#homie-type-filter");
  if (filterSel) {
    filterSel.value = state.ui.homieTypeFilter || "all";
    filterSel.addEventListener("change", () => {
      state.ui.homieTypeFilter = filterSel.value;
      renderHomieList();
      saveState();
    });
  }

  const btnMinor = qs("#btn-add-minor-homie");
  if (btnMinor) btnMinor.addEventListener("click", () => createHomie("minor"));

  const btnTerritory = qs("#btn-add-territory-homie");
  if (btnTerritory)
    btnTerritory.addEventListener("click", () => createHomie("territory"));

  const btnBuff = qs("#btn-add-buff-homie");
  if (btnBuff) btnBuff.addEventListener("click", () => createHomie("buff"));

  const btnSignature = qs("#btn-add-signature-homie");
  if (btnSignature)
    btnSignature.addEventListener("click", () => createHomie("signature"));

  // Panel 4 events
  const btnGenDomain = qs("#btn-generate-domain");
  if (btnGenDomain)
    btnGenDomain.addEventListener("click", handleGenerateDomain);

  const btnEditHomiesDomain = qs("#btn-edit-homies-domain");
  if (btnEditHomiesDomain)
    btnEditHomiesDomain.addEventListener("click", handleEditHomiesForDomain);

  // Panel 5 events
  const btnGenAI = qs("#btn-generate-abilities");
  if (btnGenAI)
    btnGenAI.addEventListener("click", () => {
      generateAbilitiesWithAI();
    });

  const btnAddAbility = qs("#btn-add-empty-ability");
  if (btnAddAbility)
    btnAddAbility.addEventListener("click", addEmptyAbilityCard);

  // Panel 6 global buttons
  const btnSave = qs("#btn-save-now");
  if (btnSave) btnSave.addEventListener("click", handleSaveNow);

  const btnPrint = qs("#btn-print");
  if (btnPrint) btnPrint.addEventListener("click", handlePrint);

  const btnReset = qs("#btn-reset");
  if (btnReset) btnReset.addEventListener("click", handleReset);

  initCollapsible();

  // Initial renders
  renderSouls();
  renderHomieList();
  renderDomainHomieSelect();
  renderDomainCardIfExists();
  renderAbilityCards();
  updateSpuTotalsUI();
  renderSummary();
});
