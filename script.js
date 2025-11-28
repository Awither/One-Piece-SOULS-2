// ================================
// Soru Soru no Mi – Soul Workshop
// Front-end State & Logic
// ================================

// ---------- Global State ----------

const APP_STORAGE_KEY = "soulSoulFruitAppState_v1";

let state = {
  souls: [],
  homies: [],
  domains: [],
  abilities: [],
  summaries: [],
  meta: {
    createdAt: Date.now(),
    version: 1
  }
};

// ---------- Utility ----------

function generateId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

// Calculate SoL from raw might & tier
function calculateSol(rawMight, tier) {
  const tierFactorMap = {
    minion: 0.4,
    standard: 0.7,
    elite: 1.0,
    boss: 1.3,
    mythic: 1.6
  };
  const factor = tierFactorMap[tier] ?? 0.7;
  const sol = Math.round(rawMight * factor) || 1;
  return clamp(sol, 1, 10);
}

// Calculate SPU, Failure Margin, Terror Roll, HP lost
function calculateSoulNumbers({ soulDC, saveResult, d20Roll, sol }) {
  const failureMargin = Math.max(0, soulDC - saveResult);
  const terrorRoll = d20Roll + failureMargin;
  const spuGained = Math.floor((terrorRoll * sol) / 4);
  const maxHpLost = Math.floor(terrorRoll / 2);
  return { failureMargin, terrorRoll, spuGained, maxHpLost };
}

// Compute SPU totals from state
function computeSpuTotals() {
  const totalSpu = state.souls.reduce((sum, s) => sum + (s.spuGained || 0), 0);

  const homieSpu = state.homies.reduce((sum, h) => sum + (h.spuInvested || 0), 0);
  const domainSpu = state.domains.reduce((sum, d) => sum + (d.spuInvested || 0), 0);

  const spent = homieSpu + domainSpu;
  const available = totalSpu - spent;

  return {
    total: totalSpu,
    spent: spent,
    available: available
  };
}

function updateSpuDisplay() {
  const { total, spent, available } = computeSpuTotals();
  document.getElementById("spu-total").textContent = total;
  document.getElementById("spu-spent").textContent = spent;
  document.getElementById("spu-available").textContent = available;
}

// Check if we can spend SPU
function canSpendSpu(cost) {
  const { available } = computeSpuTotals();
  return cost <= available;
}

// Spend SPU by adding to a target field
function spendSpuOn(obj, field, cost) {
  if (!canSpendSpu(cost)) {
    alert("Not enough SPU available to perform this operation.");
    return false;
  }
  obj[field] = (obj[field] || 0) + cost;
  return true;
}

// ---------- Local Storage ----------

function saveStateToStorage() {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(APP_STORAGE_KEY, json);
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

function loadStateFromStorage() {
  try {
    const json = localStorage.getItem(APP_STORAGE_KEY);
    if (!json) return;
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      state = parsed;
    }
  } catch (err) {
    console.error("Failed to load state:", err);
  }
}

function resetState() {
  if (!confirm("Reset ALL data? This will clear your souls, homies, domains, abilities, and summaries.")) {
    return;
  }
  state = {
    souls: [],
    homies: [],
    domains: [],
    abilities: [],
    summaries: [],
    meta: {
      createdAt: Date.now(),
      version: 1
    }
  };
  saveStateToStorage();
  renderAll();
}

// ---------- DOM Helpers ----------

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

// Auto-resizing textareas
function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = (el.scrollHeight + 2) + "px";
}

function initTextareaAutoResize() {
  qsa("textarea[data-auto-resize]").forEach((ta) => {
    autoResizeTextarea(ta);
    ta.addEventListener("input", () => autoResizeTextarea(ta));
  });
}

// Panel collapsing
function initPanels() {
  qsa(".panel").forEach((panel) => {
    panel.classList.add("open");
    panel.classList.remove("collapsed");
    const header = panel.querySelector(".panel-header");
    const toggle = panel.querySelector(".panel-toggle");
    if (header && toggle) {
      const toggleFn = () => {
        const isOpen = panel.classList.contains("open");
        if (isOpen) {
          panel.classList.remove("open");
          panel.classList.add("collapsed");
        } else {
          panel.classList.add("open");
          panel.classList.remove("collapsed");
        }
      };
      header.addEventListener("click", (e) => {
        // Avoid toggling if clicking inside header buttons intentionally
        if (e.target === toggle || e.target === header) {
          toggleFn();
        } else if (e.target.closest(".panel-toggle")) {
          toggleFn();
        }
      });
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFn();
      });
    }
  });
}

// ---------- Souls: UI & Logic ----------

function renderSoulSelectOptions() {
  const select = document.getElementById("homie-linked-soul");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">— None / Composite —</option>`;
  state.souls.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.name} (SPU ${s.spuGained}, SoL ${s.sol})`;
    select.appendChild(opt);
  });
  if (currentValue) {
    select.value = currentValue;
  }
}

function renderSoulList() {
  const container = document.getElementById("soul-list");
  if (!container) return;
  const filterText = (document.getElementById("soul-filter")?.value || "").toLowerCase();

  container.innerHTML = "";

  const filtered = state.souls.filter((s) => {
    if (!filterText) return true;
    const combined = [
      s.name,
      s.traits,
      s.notes
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return combined.includes(filterText);
  });

  filtered.forEach((soul) => {
    const card = document.createElement("div");
    card.className = "soul-card";

    const main = document.createElement("div");
    main.className = "soul-main";

    const nameRow = document.createElement("div");
    nameRow.className = "soul-name-row";

    const nameEl = document.createElement("div");
    nameEl.className = "soul-name";
    nameEl.textContent = soul.name || "Unnamed Soul";

    const tagsEl = document.createElement("div");
    tagsEl.className = "soul-tags";
    const traits = soul.traits ? `Traits: ${soul.traits}` : "";
    tagsEl.textContent = traits;

    nameRow.appendChild(nameEl);
    nameRow.appendChild(tagsEl);
    main.appendChild(nameRow);

    const meta = document.createElement("div");
    meta.className = "soul-meta";

    const tierChip = document.createElement("span");
    tierChip.className = "chip";
    tierChip.textContent = `Tier: ${soul.tierLabel || soul.tier || "?"}`;
    meta.appendChild(tierChip);

    const mightChip = document.createElement("span");
    mightChip.className = "chip";
    mightChip.textContent = `Might: ${soul.rawMight}`;
    meta.appendChild(mightChip);

    const solChip = document.createElement("span");
    solChip.className = "chip";
    solChip.textContent = `SoL: ${soul.sol}`;
    meta.appendChild(solChip);

    const spuChip = document.createElement("span");
    spuChip.className = "chip";
    spuChip.textContent = `SPU: ${soul.spuGained}`;
    meta.appendChild(spuChip);

    const dcChip = document.createElement("span");
    dcChip.className = "chip";
    dcChip.textContent = `Soul DC: ${soul.soulDCUsed}`;
    meta.appendChild(dcChip);

    main.appendChild(meta);

    if (soul.notes) {
      const notes = document.createElement("div");
      notes.className = "soul-notes";
      notes.textContent = soul.notes;
      main.appendChild(notes);
    }

    const right = document.createElement("div");
    right.className = "soul-right";

    const flags = document.createElement("div");
    flags.className = "soul-flags";

    const craftLabel = document.createElement("label");
    const craftCheckbox = document.createElement("input");
    craftCheckbox.type = "checkbox";
    craftCheckbox.checked = !!soul.availableForCrafting;
    craftCheckbox.addEventListener("change", () => {
      soul.availableForCrafting = craftCheckbox.checked;
      saveStateToStorage();
    });
    craftLabel.appendChild(craftCheckbox);
    craftLabel.append(" Available for crafting");
    flags.appendChild(craftLabel);

    const immuneLabel = document.createElement("label");
    const immuneCheckbox = document.createElement("input");
    immuneCheckbox.type = "checkbox";
    immuneCheckbox.checked = !!soul.soulRipImmune;
    immuneCheckbox.addEventListener("change", () => {
      soul.soulRipImmune = immuneCheckbox.checked;
      saveStateToStorage();
    });
    immuneLabel.appendChild(immuneCheckbox);
    immuneLabel.append(" Soul-Rip Immune (24h)");
    flags.appendChild(immuneLabel);

    right.appendChild(flags);

    const stats = document.createElement("div");
    stats.className = "soul-stats";
    stats.innerHTML =
      `Failure Margin: ${soul.failureMargin} | TR: ${soul.terrorRoll}<br>` +
      `Save: ${soul.saveResult} | HP lost (flavor): ${soul.maxHpStolen}`;
    right.appendChild(stats);

    const actions = document.createElement("div");
    actions.className = "soul-actions";

    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm(`Delete soul "${soul.name || "Unnamed"}"?`)) return;
      state.souls = state.souls.filter((s) => s.id !== soul.id);
      saveStateToStorage();
      renderAll();
    });
    actions.appendChild(delBtn);

    right.appendChild(actions);

    card.appendChild(main);
    card.appendChild(right);
    container.appendChild(card);
  });
}

// Soul capture calculation
function updateSoulCalcFromForm() {
  const rawMight = Number(document.getElementById("soul-raw-might").value) || 0;
  const tier = document.getElementById("soul-tier").value || "standard";
  const soulDC = Number(document.getElementById("soul-dc").value) || 0;
  const saveResult = Number(document.getElementById("soul-save-result").value) || 0;
  const d20Roll = Number(document.getElementById("soul-d20-roll").value) || 1;

  const sol = calculateSol(rawMight, tier);
  const { failureMargin, terrorRoll, spuGained, maxHpLost } = calculateSoulNumbers({
    soulDC,
    saveResult,
    d20Roll,
    sol
  });

  document.getElementById("soul-failure-margin").textContent = failureMargin;
  document.getElementById("soul-terror-roll").textContent = terrorRoll;
  document.getElementById("soul-sol").textContent = sol;
  document.getElementById("soul-spu-gained").textContent = spuGained;
  document.getElementById("soul-max-hp-lost").textContent = maxHpLost;

  return { sol, failureMargin, terrorRoll, spuGained, maxHpLost };
}

function initSoulForm() {
  const form = document.getElementById("soul-capture-form");
  const calcBtn = document.getElementById("calc-soul-btn");

  ["soul-raw-might", "soul-tier", "soul-dc", "soul-save-result", "soul-d20-roll"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", updateSoulCalcFromForm);
      el.addEventListener("input", updateSoulCalcFromForm);
    }
  });

  if (calcBtn) {
    calcBtn.addEventListener("click", (e) => {
      e.preventDefault();
      updateSoulCalcFromForm();
    });
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const creatureName = document.getElementById("soul-creature-name").value.trim() || "Unnamed Soul";
      const rawMight = Number(document.getElementById("soul-raw-might").value) || 0;
      const tier = document.getElementById("soul-tier").value || "standard";
      const soulDC = Number(document.getElementById("soul-dc").value) || 0;
      const saveResult = Number(document.getElementById("soul-save-result").value) || 0;
      const d20Roll = Number(document.getElementById("soul-d20-roll").value) || 1;
      const traits = document.getElementById("soul-traits").value.trim();
      const notes = document.getElementById("soul-notes").value.trim();

      const { sol, failureMargin, terrorRoll, spuGained, maxHpLost } = updateSoulCalcFromForm();

      const tierLabelMap = {
        minion: "Minion",
        standard: "Standard",
        elite: "Elite",
        boss: "Boss",
        mythic: "Mythic"
      };

      const soul = {
        id: generateId("soul"),
        name: creatureName,
        rawMight,
        tier,
        tierLabel: tierLabelMap[tier] || tier,
        traits,
        sol,
        spuGained,
        soulDCUsed: soulDC,
        saveResult,
        failureMargin,
        terrorRoll,
        maxHpStolen: maxHpLost,
        notes,
        availableForCrafting: true,
        soulRipImmune: false
      };

      state.souls.push(soul);
      saveStateToStorage();
      renderAll();

      form.reset();
      // Reapply some defaults
      document.getElementById("soul-raw-might").value = 5;
      document.getElementById("soul-tier").value = "standard";
      document.getElementById("soul-dc").value = 15;
      document.getElementById("soul-save-result").value = 10;
      document.getElementById("soul-d20-roll").value = 10;
      updateSoulCalcFromForm();
    });
  }

  const filterInput = document.getElementById("soul-filter");
  if (filterInput) {
    filterInput.addEventListener("input", () => renderSoulList());
  }

  // Initial calculation
  updateSoulCalcFromForm();
}

// ---------- Homies: UI & Logic ----------

function getHomieTypeConfig(type) {
  switch (type) {
    case "minor":
      return { baseUpgradeCost: 1, label: "Minor" };
    case "territory":
      return { baseUpgradeCost: 2, label: "Territory" };
    case "buff":
      return { baseUpgradeCost: 2, label: "Buff" };
    case "signature":
      return { baseUpgradeCost: 3, label: "Signature" };
    default:
      return { baseUpgradeCost: 2, label: "Unknown" };
  }
}

function ensureHomieTiers(homie) {
  if (!homie.tiers) {
    homie.tiers = {
      hp: 0,
      ac: 0,
      damage: 0,
      utility: 0
    };
  }
}

function homieUpgradeCost(homie, tierKey) {
  ensureHomieTiers(homie);
  const { baseUpgradeCost } = getHomieTypeConfig(homie.type);
  const current = homie.tiers[tierKey] || 0;
  const newLevel = current + 1;
  return baseUpgradeCost * newLevel;
}

function homieReviveCost(homie) {
  const totalInvested = homie.spuInvested || 0;
  return Math.floor(totalInvested / 2);
}

function renderHomieTypeTag(type) {
  const cfg = getHomieTypeConfig(type);
  const span = document.createElement("span");
  span.className = "homie-type-tag";
  if (type === "minor") span.classList.add("homie-type-minor");
  if (type === "territory") span.classList.add("homie-type-territory");
  if (type === "buff") span.classList.add("homie-type-buff");
  if (type === "signature") span.classList.add("homie-type-signature");
  span.textContent = `${cfg.label} Homie`;
  return span;
}

function renderHomieList() {
  const container = document.getElementById("homie-list");
  if (!container) return;
  const filterText = (document.getElementById("homie-filter")?.value || "").toLowerCase();
  container.innerHTML = "";

  const filtered = state.homies.filter((h) => {
    if (!filterText) return true;
    const combined = [
      h.name,
      h.role,
      h.personality,
      h.type,
      h.boundLocation,
      h.buffEffects
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return combined.includes(filterText);
  });

  filtered.forEach((homie) => {
    ensureHomieTiers(homie);

    const card = document.createElement("div");
    card.className = "homie-card";

    const main = document.createElement("div");
    main.className = "homie-main";

    const headerRow = document.createElement("div");
    headerRow.className = "homie-header-row";

    const nameEl = document.createElement("div");
    nameEl.className = "homie-name";
    nameEl.textContent = homie.name || "Unnamed Homie";

    const typeTag = renderHomieTypeTag(homie.type);

    headerRow.appendChild(nameEl);
    headerRow.appendChild(typeTag);
    main.appendChild(headerRow);

    if (homie.role) {
      const role = document.createElement("div");
      role.className = "homie-role";
      role.textContent = homie.role;
      main.appendChild(role);
    }

    const statsLine = document.createElement("div");
    statsLine.className = "homie-stats-line";
    statsLine.innerHTML =
      `<span>HP: ${homie.hp || "-"}</span>` +
      `<span>AC: ${homie.ac || "-"}</span>` +
      `<span>Move: ${homie.move || "-"}</span>` +
      `<span>Damage: ${homie.damage || "-"}</span>`;
    main.appendChild(statsLine);

    if (homie.type === "territory") {
      const terrLine = document.createElement("div");
      terrLine.className = "homie-stats-line";
      const domainName = state.domains.find((d) => d.id === homie.domainId)?.name || "None";
      terrLine.textContent = `Bound to: ${homie.boundLocation || "—"} | Domain: ${domainName}`;
      main.appendChild(terrLine);
    }

    if (homie.type === "buff" && homie.buffEffects) {
      const buffLine = document.createElement("div");
      buffLine.className = "homie-stats-line";
      buffLine.textContent = `Buffs: ${homie.buffEffects}`;
      main.appendChild(buffLine);
    }

    if (homie.abilitiesText) {
      const abilities = document.createElement("div");
      abilities.className = "homie-notes";
      abilities.textContent = homie.abilitiesText;
      main.appendChild(abilities);
    }

    if (homie.personality) {
      const personality = document.createElement("div");
      personality.className = "homie-notes";
      personality.textContent = `Personality: ${homie.personality}`;
      main.appendChild(personality);
    }

    const right = document.createElement("div");
    right.className = "homie-right";

    const spuLine = document.createElement("div");
    spuLine.className = "homie-spu";
    spuLine.textContent = `SPU Invested: ${homie.spuInvested || 0}`;
    right.appendChild(spuLine);

    const status = document.createElement("div");
    status.className = "homie-status";
    if (homie.status === "destroyed") {
      status.classList.add("destroyed");
      status.textContent = "Status: Destroyed";
    } else {
      status.textContent = "Status: Active";
    }
    right.appendChild(status);

    // Upgrade grid
    const upgrades = document.createElement("div");
    upgrades.className = "homie-upgrades";

    const tierKeys = [
      { key: "hp", label: "HP Tier" },
      { key: "ac", label: "AC Tier" },
      { key: "damage", label: "Damage Tier" },
      { key: "utility", label: "Utility Tier" }
    ];

    tierKeys.forEach(({ key, label }) => {
      const row = document.createElement("div");
      row.className = "homie-upgrade-row";

      const labelSpan = document.createElement("span");
      labelSpan.textContent = `${label}: ${homie.tiers[key] || 0}`;
      row.appendChild(labelSpan);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn secondary";
      btn.textContent = "+";
      btn.addEventListener("click", () => {
        const cost = homieUpgradeCost(homie, key);
        if (!spendSpuOn(homie, "spuInvested", cost)) return;
        homie.tiers[key] = (homie.tiers[key] || 0) + 1;
        saveStateToStorage();
        renderAll();
      });
      row.appendChild(btn);

      upgrades.appendChild(row);
    });

    right.appendChild(upgrades);

    const actions = document.createElement("div");
    actions.className = "homie-actions";

    const reviveBtn = document.createElement("button");
    reviveBtn.type = "button";
    reviveBtn.className = "btn primary";
    reviveBtn.textContent = "Revive";
    reviveBtn.addEventListener("click", () => {
      const cost = homieReviveCost(homie);
      if (cost <= 0) {
        alert("Revival cost is 0 – this homie has no SPU invested yet.");
        return;
      }
      if (!canSpendSpu(cost)) {
        alert(`Not enough SPU available to pay the revival cost (${cost}).`);
        return;
      }
      if (!confirm(`Pay ${cost} SPU to revive ${homie.name || "this homie"}?`)) return;
      spendSpuOn(homie, "spuInvested", cost);
      homie.status = "active";
      saveStateToStorage();
      renderAll();
    });
    actions.appendChild(reviveBtn);

    const toggleDestroyedBtn = document.createElement("button");
    toggleDestroyedBtn.type = "button";
    toggleDestroyedBtn.className = "btn secondary";
    toggleDestroyedBtn.textContent = homie.status === "destroyed" ? "Mark Active" : "Mark Destroyed";
    toggleDestroyedBtn.addEventListener("click", () => {
      homie.status = homie.status === "destroyed" ? "active" : "destroyed";
      saveStateToStorage();
      renderAll();
    });
    actions.appendChild(toggleDestroyedBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm(`Delete homie "${homie.name || "Unnamed"}"?`)) return;
      state.homies = state.homies.filter((h) => h.id !== homie.id);
      // Remove references from domains
      state.domains.forEach((d) => {
        d.territoryHomieIds = (d.territoryHomieIds || []).filter((id) => id !== homie.id);
      });
      saveStateToStorage();
      renderAll();
    });
    actions.appendChild(delBtn);

    right.appendChild(actions);

    card.appendChild(main);
    card.appendChild(right);

    container.appendChild(card);
  });
}

function initHomieForm() {
  const form = document.getElementById("homie-form");
  const typeSelect = document.getElementById("homie-type");
  const filterInput = document.getElementById("homie-filter");

  function updateHomieTypeSpecificFields() {
    const type = typeSelect.value;
    const territoryOnly = qsa(".territory-only");
    const buffOnly = qsa(".buff-only");

    territoryOnly.forEach((el) =>
      el.classList.toggle("hidden", type !== "territory")
    );
    buffOnly.forEach((el) =>
      el.classList.toggle("hidden", type !== "buff")
    );
  }

  if (typeSelect) {
    typeSelect.addEventListener("change", updateHomieTypeSpecificFields);
    updateHomieTypeSpecificFields();
  }

  if (filterInput) {
    filterInput.addEventListener("input", () => renderHomieList());
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("homie-name").value.trim();
      const type = document.getElementById("homie-type").value || "minor";
      const linkedSoulId = document.getElementById("homie-linked-soul").value || "";
      const spuInitial = Number(document.getElementById("homie-base-spu").value) || 0;
      const role = document.getElementById("homie-role").value.trim();
      const hp = document.getElementById("homie-hp").value.trim();
      const ac = document.getElementById("homie-ac").value.trim();
      const move = document.getElementById("homie-move").value.trim();
      const damage = document.getElementById("homie-damage").value.trim();
      const abilitiesText = document.getElementById("homie-abilities").value.trim();
      const personality = document.getElementById("homie-personality").value.trim();
      const boundLocation = document.getElementById("homie-bound-location").value.trim();
      const domainId = document.getElementById("homie-domain-assignment").value || "";
      const territoryActions = document.getElementById("homie-territory-actions").value.trim();
      const buffEffects = document.getElementById("homie-buff-effects").value.trim();

      if (!name) {
        alert("Please give your homie a name.");
        return;
      }

      if (!canSpendSpu(spuInitial)) {
        alert("Not enough SPU available to invest this amount into a new homie.");
        return;
      }

      const homie = {
        id: generateId("homie"),
        name,
        type,
        linkedSoulId: linkedSoulId || null,
        spuInvested: spuInitial,
        role,
        hp,
        ac,
        move,
        damage,
        abilitiesText,
        personality,
        status: "active",
        tiers: {
          hp: 0,
          ac: 0,
          damage: 0,
          utility: 0
        },
        boundLocation: type === "territory" ? boundLocation : "",
        domainId: type === "territory" ? (domainId || null) : null,
        territoryActions: type === "territory" ? territoryActions : "",
        buffEffects: type === "buff" ? buffEffects : ""
      };

      state.homies.push(homie);
      saveStateToStorage();
      renderAll();

      form.reset();
      document.getElementById("homie-type").value = "minor";
      updateHomieTypeSpecificFields();
    });
  }
}

// ---------- Domains: UI & Logic ----------

function renderDomainSelectForTerritoryHomies() {
  const select = document.getElementById("homie-domain-assignment");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">— None yet —</option>`;
  state.domains.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    select.appendChild(opt);
  });
  if (currentValue) {
    select.value = currentValue;
  }
}

function renderTerritoryHomiesForDomainAssign() {
  const select = document.getElementById("domain-territory-homies");
  if (!select) return;
  const prevSelected = Array.from(select.selectedOptions).map((opt) => opt.value);

  select.innerHTML = "";

  const territoryHomies = state.homies.filter((h) => h.type === "territory");

  territoryHomies.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = `${h.name} (${h.boundLocation || "unbound"})`;
    if (prevSelected.includes(h.id)) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function renderDomainList() {
  const container = document.getElementById("domain-list");
  if (!container) return;
  const filterText = (document.getElementById("domain-filter")?.value || "").toLowerCase();
  container.innerHTML = "";

  const filtered = state.domains.filter((d) => {
    if (!filterText) return true;
    const combined = [
      d.name,
      d.personality,
      d.notes
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return combined.includes(filterText);
  });

  filtered.forEach((domain) => {
    const card = document.createElement("div");
    card.className = "domain-card";

    const main = document.createElement("div");
    main.className = "domain-main";

    const headerRow = document.createElement("div");
    headerRow.className = "domain-header-row";

    const nameEl = document.createElement("div");
    nameEl.className = "domain-name";
    nameEl.textContent = domain.name || "Unnamed Domain";

    const tierTag = document.createElement("span");
    tierTag.className = "domain-tier-tag";
    tierTag.textContent = `Tier ${domain.tier || "?"}`;

    headerRow.appendChild(nameEl);
    headerRow.appendChild(tierTag);
    main.appendChild(headerRow);

    const line1 = document.createElement("div");
    line1.className = "domain-line";
    line1.innerHTML =
      `SPU Invested: ${domain.spuInvested || 0} | Size: ${domain.size || "—"}`;
    main.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "domain-line";
    line2.textContent = `Passive Fear DC: ${domain.fearDC || "—"}`;
    main.appendChild(line2);

    if (domain.personality) {
      const perso = document.createElement("div");
      perso.className = "domain-personality";
      perso.textContent = `Personality: ${domain.personality}`;
      main.appendChild(perso);
    }

    if (domain.notes) {
      const notes = document.createElement("div");
      notes.className = "domain-personality";
      notes.textContent = `Notes: ${domain.notes}`;
      main.appendChild(notes);
    }

    const right = document.createElement("div");
    right.className = "domain-right";

    // Homies
    const homiesLine = document.createElement("div");
    homiesLine.className = "domain-homies-list";
    const homieNames = (domain.territoryHomieIds || [])
      .map((id) => state.homies.find((h) => h.id === id)?.name)
      .filter(Boolean);
    homiesLine.textContent = homieNames.length
      ? `Territory Homies: ${homieNames.join(", ")}`
      : "Territory Homies: none assigned";
    right.appendChild(homiesLine);

    if (domain.lairActions) {
      const lair = document.createElement("div");
      lair.className = "domain-lair";
      lair.textContent = `Lair Actions: ${domain.lairActions}`;
      right.appendChild(lair);
    }

    const actions = document.createElement("div");
    actions.className = "homie-actions";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm(`Delete domain "${domain.name || "Unnamed"}"?`)) return;
      state.domains = state.domains.filter((d) => d.id !== domain.id);
      // Remove references from homies
      state.homies.forEach((h) => {
        if (h.domainId === domain.id) h.domainId = null;
      });
      saveStateToStorage();
      renderAll();
    });
    actions.appendChild(delBtn);

    right.appendChild(actions);

    card.appendChild(main);
    card.appendChild(right);

    container.appendChild(card);
  });
}

function initDomainForm() {
  const form = document.getElementById("domain-form");

  const filterInput = document.getElementById("domain-filter");
  if (filterInput) {
    filterInput.addEventListener("input", () => renderDomainList());
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("domain-name").value.trim();
      const tier = Number(document.getElementById("domain-tier").value) || 1;
      const spuInvested = Number(document.getElementById("domain-spu").value) || 0;
      const size = document.getElementById("domain-size").value.trim();
      const fearDC = Number(document.getElementById("domain-fear-dc").value) || 0;
      const personality = document.getElementById("domain-personality").value.trim();
      const lairActions = document.getElementById("domain-lair-actions").value.trim();
      const notes = document.getElementById("domain-notes").value.trim();
      const territorySelect = document.getElementById("domain-territory-homies");
      const territoryHomieIds = Array.from(territorySelect.selectedOptions).map((opt) => opt.value);

      if (!name) {
        alert("Please give your domain a name.");
        return;
      }

      if (!canSpendSpu(spuInvested)) {
        alert("Not enough SPU available to invest into this domain.");
        return;
      }

      const domain = {
        id: generateId("domain"),
        name,
        tier: clamp(tier, 1, 10),
        spuInvested,
        size,
        fearDC,
        personality,
        lairActions,
        notes,
        territoryHomieIds
      };

      state.domains.push(domain);

      // Update homies that have been assigned to this domain
      territoryHomieIds.forEach((id) => {
        const homie = state.homies.find((h) => h.id === id);
        if (homie) {
          homie.domainId = domain.id;
        }
      });

      saveStateToStorage();
      renderAll();

      form.reset();
      document.getElementById("domain-tier").value = 3;
      document.getElementById("domain-spu").value = 10;
      document.getElementById("domain-fear-dc").value = 15;
    });
  }
}

// ---------- Abilities: UI & Logic ----------

function renderAssignOptionsForAbilities() {
  const select = document.getElementById("ability-assign");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">General / Party</option>`;

  // Homies
  state.homies.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = `homie:${h.id}`;
    opt.textContent = `Homie – ${h.name}`;
    select.appendChild(opt);
  });

  // Domains
  state.domains.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = `domain:${d.id}`;
    opt.textContent = `Domain – ${d.name}`;
    select.appendChild(opt);
  });

  if (currentValue) {
    select.value = currentValue;
  }
}

function abilityAssignLabel(ability) {
  if (!ability.assignTo || ability.assignTo === "") {
    return "General / Party";
  }
  if (ability.assignTo.startsWith("homie:")) {
    const id = ability.assignTo.split(":")[1];
    const homie = state.homies.find((h) => h.id === id);
    return homie ? `Homie · ${homie.name}` : "Homie";
  }
  if (ability.assignTo.startsWith("domain:")) {
    const id = ability.assignTo.split(":")[1];
    const domain = state.domains.find((d) => d.id === id);
    return domain ? `Domain · ${domain.name}` : "Domain";
  }
  return ability.assignTo;
}

function abilityTextSummary(ability) {
  return `${ability.name} (${ability.actionType || "Action"}; ${ability.range || "—"}; ${ability.target || "—"}; ${ability.save || "—"}; ${ability.damageDice || "—"}) — ${ability.effect || ""}${ability.combo ? " Combos: " + ability.combo : ""}`;
}

async function copyAbilityToClipboard(ability) {
  const text = abilityTextSummary(ability);
  try {
    await navigator.clipboard.writeText(text);
    alert("Ability copied to clipboard.");
  } catch {
    // fallback
    prompt("Copy this ability:", text);
  }
}

function renderAbilityList() {
  const container = document.getElementById("ability-list");
  if (!container) return;
  const filterText = (document.getElementById("ability-filter")?.value || "").toLowerCase();

  container.innerHTML = "";

  const filtered = state.abilities.filter((a) => {
    if (!filterText) return true;
    const combined = [
      a.name,
      a.assignTo,
      a.actionType,
      a.range,
      a.target,
      a.save,
      a.damageDice,
      a.effect,
      a.combo
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return combined.includes(filterText);
  });

  filtered.forEach((ability) => {
    const card = document.createElement("div");
    card.className = "ability-card";

    const main = document.createElement("div");
    main.className = "ability-main";

    const headerRow = document.createElement("div");
    headerRow.className = "ability-header-row";

    const nameEl = document.createElement("div");
    nameEl.className = "ability-name";
    nameEl.textContent = ability.name || "Unnamed Ability";

    const assignTag = document.createElement("span");
    assignTag.className = "ability-assign-tag";
    assignTag.textContent = abilityAssignLabel(ability);

    headerRow.appendChild(nameEl);
    headerRow.appendChild(assignTag);
    main.appendChild(headerRow);

    const line1 = document.createElement("div");
    line1.className = "ability-line";
    line1.innerHTML =
      `Type: ${ability.actionType || "—"} | Range: ${ability.range || "—"} | Target: ${ability.target || "—"}`;
    main.appendChild(line1);

    const line2 = document.createElement("div");
    line2.className = "ability-line";
    line2.textContent = `Save / DC: ${ability.save || "—"} | Damage: ${ability.damageDice || "—"}`;
    main.appendChild(line2);

    if (ability.effect) {
      const effect = document.createElement("div");
      effect.className = "ability-effect";
      effect.textContent = ability.effect;
      main.appendChild(effect);
    }

    if (ability.combo) {
      const combo = document.createElement("div");
      combo.className = "ability-effect";
      combo.textContent = `Combo / Interactions: ${ability.combo}`;
      main.appendChild(combo);
    }

    const right = document.createElement("div");
    right.className = "ability-right";

    const actions = document.createElement("div");
    actions.className = "ability-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn secondary";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => copyAbilityToClipboard(ability));
    actions.appendChild(copyBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm(`Delete ability "${ability.name || "Unnamed"}"?`)) return;
      state.abilities = state.abilities.filter((a) => a.id !== ability.id);
      saveStateToStorage();
      renderAll();
    });
    actions.appendChild(delBtn);

    right.appendChild(actions);

    card.appendChild(main);
    card.appendChild(right);

    container.appendChild(card);
  });
}

function initAbilityForm() {
  const form = document.getElementById("ability-form");

  const filterInput = document.getElementById("ability-filter");
  if (filterInput) {
    filterInput.addEventListener("input", () => renderAbilityList());
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("ability-name").value.trim();
      const assignTo = document.getElementById("ability-assign").value || "";
      const actionType = document.getElementById("ability-action-type").value.trim();
      const range = document.getElementById("ability-range").value.trim();
      const target = document.getElementById("ability-target").value.trim();
      const save = document.getElementById("ability-save").value.trim();
      const damageDice = document.getElementById("ability-damage").value.trim();
      const effect = document.getElementById("ability-effect").value.trim();
      const combo = document.getElementById("ability-combo").value.trim();

      if (!name) {
        alert("Please give the ability a name.");
        return;
      }

      const ability = {
        id: generateId("ability"),
        name,
        assignTo,
        actionType,
        range,
        target,
        save,
        damageDice,
        effect,
        combo,
        source: "manual"
      };

      state.abilities.push(ability);
      saveStateToStorage();
      renderAll();

      form.reset();
    });
  }
}

// ---------- AI Integration ----------

async function callGenerateSoulAbilities(notes) {
  const aiStatus = document.getElementById("ai-status");
  if (aiStatus) {
    aiStatus.textContent = "Whispering with the souls...";
  }

  try {
    const res = await fetch("/api/generate-soul-abilities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        souls: state.souls,
        homies: state.homies,
        domains: state.domains,
        notes
      })
    });

    if (!res.ok) {
      throw new Error(`Server responded with status ${res.status}`);
    }

    const data = await res.json();

    const abilitiesFromAI = Array.isArray(data.abilities) ? data.abilities : [];

    const mapped = abilitiesFromAI.map((a) => ({
      id: generateId("ability"),
      name: a.name || "AI Ability",
      assignTo: a.assignTo || "",
      actionType: a.actionType || "",
      range: a.range || "",
      target: a.target || "",
      save: a.saveOrDC || a.save || "",
      damageDice: a.damageDice || "",
      effect: a.effect || a.mechanicalEffect || "",
      combo: a.combo || a.interactions || "",
      source: "ai"
    }));

    state.abilities.push(...mapped);
    saveStateToStorage();
    renderAll();

    if (aiStatus) {
      if (mapped.length > 0) {
        aiStatus.textContent = `Souls answered: ${mapped.length} abilities forged.`;
      } else {
        aiStatus.textContent = "Souls whispered, but no structured abilities were returned. Check the server logs or adjust your prompt.";
      }
    }
  } catch (err) {
    console.error(err);
    if (aiStatus) {
      aiStatus.textContent = "Error contacting the souls. Check your network or API key.";
    }
    alert("Failed to contact the AI ability forge. See console for details.");
  }
}

function initAiPanel() {
  const btn = document.getElementById("ai-generate-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const notes = document.getElementById("ai-notes").value.trim();
    btn.disabled = true;
    btn.textContent = "Consulting the Souls...";
    await callGenerateSoulAbilities(notes);
    btn.disabled = false;
    btn.textContent = "Ask the Souls (Generate Abilities)";
  });
}

// ---------- Summary / Dashboard ----------

function renderSummaryList() {
  const container = document.getElementById("summary-list");
  if (!container) return;

  container.innerHTML = "";

  state.summaries.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "summary-card";

    const main = document.createElement("div");
    main.className = "summary-main";

    const name = document.createElement("div");
    name.className = "summary-name";
    name.textContent = entry.name || "Unnamed Entry";
    main.appendChild(name);

    if (entry.tags) {
      const tags = document.createElement("div");
      tags.className = "summary-tags";
      tags.textContent = entry.tags;
      main.appendChild(tags);
    }

    if (entry.stats) {
      const stats = document.createElement("div");
      stats.className = "summary-line";
      stats.textContent = `Stats: ${entry.stats}`;
      main.appendChild(stats);
    }

    if (entry.abilities) {
      const abilitiesLine = document.createElement("div");
      abilitiesLine.className = "summary-line";
      abilitiesLine.textContent = `Abilities: ${entry.abilities}`;
      main.appendChild(abilitiesLine);
    }

    if (entry.roles) {
      const rolesLine = document.createElement("div");
      rolesLine.className = "summary-line";
      rolesLine.textContent = `Role(s): ${entry.roles}`;
      main.appendChild(rolesLine);
    }

    const right = document.createElement("div");
    right.className = "domain-right";

    const notesLabel = document.createElement("div");
    notesLabel.className = "summary-notes-label";
    notesLabel.textContent = "Notes (editable, printable):";
    right.appendChild(notesLabel);

    const notes = document.createElement("div");
    notes.className = "summary-notes";
    notes.contentEditable = "true";
    notes.innerHTML = entry.notes || "";
    notes.addEventListener("input", () => {
      entry.notes = notes.innerHTML;
      saveStateToStorage();
    });
    right.appendChild(notes);

    const actions = document.createElement("div");
    actions.className = "homie-actions";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn danger";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", () => {
      state.summaries = state.summaries.filter((s) => s.id !== entry.id);
      saveStateToStorage();
      renderSummaryList();
    });
    actions.appendChild(delBtn);
    right.appendChild(actions);

    card.appendChild(main);
    card.appendChild(right);

    container.appendChild(card);
  });
}

function addSummaryEntry(entry) {
  state.summaries.push({
    id: generateId("summary"),
    name: entry.name || "Unnamed",
    tags: entry.tags || "",
    stats: entry.stats || "",
    abilities: entry.abilities || "",
    roles: entry.roles || "",
    notes: entry.notes || ""
  });
}

function initSummaryPanel() {
  const btnFromHomies = document.getElementById("summary-add-from-homies");
  const btnFromDomains = document.getElementById("summary-add-from-domains");
  const btnCustom = document.getElementById("summary-add-custom");

  if (btnFromHomies) {
    btnFromHomies.addEventListener("click", () => {
      state.homies.forEach((h) => {
        const stats = `AC ${h.ac || "-"}, HP ${h.hp || "-"}, Move ${h.move || "-"}, SPU ${h.spuInvested || 0}`;
        const abilities = h.abilitiesText || "";
        const roles = h.role || "";
        const tags = [
          "Homie",
          h.type === "signature" ? "Signature" : "",
          h.type === "buff" ? "Support" : "",
          h.type === "territory" ? "Territory" : ""
        ]
          .filter(Boolean)
          .join(", ");
        addSummaryEntry({
          name: h.name,
          tags,
          stats,
          abilities,
          roles
        });
      });
      saveStateToStorage();
      renderSummaryList();
    });
  }

  if (btnFromDomains) {
    btnFromDomains.addEventListener("click", () => {
      state.domains.forEach((d) => {
        const stats = `Tier ${d.tier || "-"}; SPU ${d.spuInvested || 0}; Fear DC ${d.fearDC || "-"}`;
        const homieNames = (d.territoryHomieIds || [])
          .map((id) => state.homies.find((h) => h.id === id)?.name)
          .filter(Boolean);
        const abilities = d.lairActions || "";
        const roles = `Domain (${d.size || "size unknown"})`;
        const tags = ["Domain"].join(", ");
        const notes = homieNames.length ? `Territory Homies: ${homieNames.join(", ")}` : "";
        addSummaryEntry({
          name: d.name,
          tags,
          stats,
          abilities,
          roles,
          notes
        });
      });
      saveStateToStorage();
      renderSummaryList();
    });
  }

  if (btnCustom) {
    btnCustom.addEventListener("click", () => {
      const name = prompt("Name for this summary entry (player / ally / homie / domain):", "New Entry");
      if (!name) return;
      addSummaryEntry({
        name,
        tags: "",
        stats: "",
        abilities: "",
        roles: "",
        notes: ""
      });
      saveStateToStorage();
      renderSummaryList();
    });
  }
}

// ---------- Print ----------

function initPrintButton() {
  const btn = document.getElementById("print-summary-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.print();
  });
}

// ---------- Top-level Controls ----------

function initTopControls() {
  const saveBtn = document.getElementById("save-state-btn");
  const resetBtn = document.getElementById("reset-state-btn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveStateToStorage();
      alert("State saved.");
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetState);
  }
}

// ---------- Master Render ----------

function renderAll() {
  renderSoulList();
  renderSoulSelectOptions();
  renderHomieList();
  renderDomainList();
  renderTerritoryHomiesForDomainAssign();
  renderDomainSelectForTerritoryHomies();
  renderAssignOptionsForAbilities();
  renderAbilityList();
  renderSummaryList();
  updateSpuDisplay();
}

// ---------- Init ----------

document.addEventListener("DOMContentLoaded", () => {
  loadStateFromStorage();
  initPanels();
  initTextareaAutoResize();
  initTopControls();
  initPrintButton();
  initSoulForm();
  initHomieForm();
  initDomainForm();
  initAbilityForm();
  initAiPanel();
  initSummaryPanel();
  renderAll();
});
