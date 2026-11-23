import { ITEMS } from './data.js';

const state = {
  money: 100.0,
  counts: {},
  rebirths: 0,
  multiplier: 1,
  spent: 0,
  startTime: Date.now(),
  petsOwned: {},
  petStock: {},
  nextPetRestock: Date.now() + 5 * 60 * 1000,
  // track limited item stock (for items that define .stock)
  itemStock: {},
  // track if index achievement already granted
  indexCompleted: false,
  // mutations structure per item (gold, diamond, night)
  mutations: {}
};

ITEMS.forEach(i => {
  state.counts[i.id] = 0;
  state.mutations[i.id] = { gold: 0, diamond: 0, night: 0, obsidian: 0 };
});

// -------------------- Minimal game API exports --------------------
// Simple formatter used in UI
export function fmt(v) {
  // convert to number safely
  let n = Number(v);
  if (!isFinite(n)) return 'R$ ' + String(v);

  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const locale = 'pt-BR';

  // helper to format with fixed decimals and locale for the fractional part
  function fmtFixed(value, decimals) {
    try {
      return Number(value).toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch (_) {
      return value.toFixed(decimals);
    }
  }

  // thresholds for abbreviation
  if (abs >= 1_000_000_000_000) {
    return `R$ ${sign}${fmtFixed(n / 1_000_000_000_000, 2)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `R$ ${sign}${fmtFixed(n / 1_000_000_000, 2)}B`;
  }
  if (abs >= 1_000_000) {
    return `R$ ${sign}${fmtFixed(n / 1_000_000, 2)}M`;
  }
  if (abs >= 1_000) {
    return `R$ ${sign}${fmtFixed(n / 1_000, 2)}K`;
  }

  // small numbers: show regular currency with two decimals
  try {
    return 'R$ ' + Number(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch (_) {
    return 'R$ ' + String(n);
  }
}

export function getState() {
  return state;
}

/**
 * Attempt to buy an item object (from ITEMS). Returns true on success.
 * This is a minimal implementation used by UI modules.
 */
export function buyItem(item) {
  if (!item || typeof item.id === 'undefined') return false;
  // if item has cost > 0, check money; crafted items may have cost 0 and rely on craft UI
  if (Number(state.money) < Number(item.cost || 0)) return false;

  // if item has a stock limit and none available, do not buy
  if (typeof state.itemStock[item.id] === 'number' && isFinite(state.itemStock[item.id]) && state.itemStock[item.id] <= 0) {
    return false;
  }

  // deduct money
  state.money -= Number(item.cost || 0);
  state.spent = (Number(state.spent) || 0) + Number(item.cost || 0);
  // increment owned count
  state.counts[item.id] = (state.counts[item.id] || 0) + 1;

  // reduce itemStock if tracked
  if (typeof state.itemStock[item.id] === 'number' && isFinite(state.itemStock[item.id])) {
    state.itemStock[item.id] = Math.max(0, state.itemStock[item.id] - 1);
  }

  return true;
}

/**
 * Minimal sellItem implementation so UI can call it.
 * Returns true on success.
 */
export function sellItem(item) {
  if (!item || typeof item.id === 'undefined') return false;
  const owned = state.counts[item.id] || 0;
  if (owned <= 0) return false;
  // refund half the cost when selling (common idle-game convention)
  const refund = (Number(item.cost) || 0) * 0.5;
  state.money += refund;
  state.spent = Math.max(0, state.spent - refund);
  state.counts[item.id] = owned - 1;
  // if itemStock is tracked, return one to stock
  if (typeof state.itemStock[item.id] === 'number' && isFinite(state.itemStock[item.id])) {
    state.itemStock[item.id] = (state.itemStock[item.id] || 0) + 1;
  }
  return true;
}

// Minimal buy/sell pets used by pet UI (simplified)
export function buyPet(pet) {
  if (!pet || !pet.id) return false;
  if (state.money < (pet.cost || 0)) return false;
  const owned = state.petsOwned[pet.id] || 0;
  if (owned >= 2) return false;
  const stock = state.petStock[pet.id] || Infinity;
  if (stock <= 0) return false;
  state.money -= pet.cost || 0;
  state.petsOwned[pet.id] = owned + 1;
  if (isFinite(stock)) state.petStock[pet.id] = Math.max(0, stock - 1);
  return true;
}
export function sellPet(pet) {
  if (!pet || !pet.id) return false;
  const owned = state.petsOwned[pet.id] || 0;
  if (owned <= 0) return false;
  const refund = (pet.cost || 0) * 0.5;
  state.money += refund;
  state.petsOwned[pet.id] = owned - 1;
  state.petStock[pet.id] = (state.petStock[pet.id] || 0) + 1;
  return true;
}

/**
 * Minimal recomputeIncome used by UI to show current income.
 * Takes into account base incomes and simple mutation multipliers.
 */
export function recomputeIncome() {
  let total = 0;
  ITEMS.forEach(it => {
    const count = state.counts[it.id] || 0;
    // base units
    total += count * (it.income || 0);
    // mutated incomes
    const muts = state.mutations[it.id] || { gold: 0, diamond: 0, night: 0 };
    total += (muts.gold || 0) * (it.income || 0) * 1.25;
    total += (muts.diamond || 0) * (it.income || 0) * 1.5;
    total += (muts.night || 0) * (it.income || 0) * 2.0;
    // obsidian mutations: 4x the original game's income contribution
    total += (muts.obsidian || 0) * (it.income || 0) * 4.0;
  });

  // apply global multiplier from rebirths/pets
  total = total * (state.multiplier || 1);

  // pet multipliers (simple additive multiplier per pet owned)
  if (state.petsOwned) {
    // we don't have PETS here (to avoid circular import), so assume pets modify state.multiplier elsewhere
  }

  return total;
}

/**
 * Minimal timers to accumulate income per second and update playtime.
 * startTimers accepts a callback that will be called periodically (UI update).
 */
let __incomeInterval = null;
export function startTimers(tickCallback) {
  if (__incomeInterval) return;
  __incomeInterval = setInterval(() => {
    const inc = recomputeIncome();
    state.money = Number(state.money || 0) + inc;
    if (typeof tickCallback === 'function') tickCallback();
  }, 1000);
}

export function stopTimers() {
  if (__incomeInterval) {
    clearInterval(__incomeInterval);
    __incomeInterval = null;
  }
}

/**
 * Simple reset/rebirth/claim index helpers used by UI/admin:
 */
export function resetGame() {
  // preserve account-local storage but reset runtime state
  state.money = 100.0;
  state.counts = {};
  ITEMS.forEach(i => (state.counts[i.id] = 0));
  state.spent = 0;
  state.rebirths = 0;
  state.multiplier = 1;
  state.petsOwned = {};
  state.petStock = {};
  state.itemStock = {};
  state.indexCompleted = false;
  state.startTime = Date.now();
  // mutations reset
  ITEMS.forEach(i => (state.mutations[i.id] = { gold:0, diamond:0, night:0 }));
}

export function doRebirth() {
  // simple rebirth: increment multiplier and reset most progress, but preserve money = 0
  state.rebirths = (state.rebirths || 0) + 1;
  state.multiplier = (state.multiplier || 1) + 1;
  // keep counts but reset money and reduce spent
  state.money = 0;
  state.spent = 0;
  // optional: reduce counts slightly (not implemented here)
}

/**
 * Index / achievement helpers (simplified)
 */
export function getIndexProgress() {
  const total = ITEMS.length;
  const owned = Object.values(state.counts).reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
  const needed = Math.ceil(total * 0.75);
  const completed = owned >= needed;
  const alreadyAwarded = !!state.indexCompleted;
  return { total, owned, needed, completed, alreadyAwarded };
}

export function claimIndex() {
  const prog = getIndexProgress();
  if (!prog.completed || prog.alreadyAwarded) return false;
  state.indexCompleted = true;
  state.petsOwned = state.petsOwned || {};
  state.petsOwned['indexaria'] = (state.petsOwned['indexaria'] || 0) + 1;
  return true;
}

// default export not used; named exports above are consumed by other modules

