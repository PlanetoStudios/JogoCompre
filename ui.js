import { CATEGORIES, ITEMS, TRANSLATIONS } from './data.js';
import { fmt, recomputeIncome, getState, resetGame, doRebirth } from './game.js';
import { PETS } from './data.js';

// NEW: language + translations helpers
import { getCurrentLang, setCurrentLang as setLangInternal, getTranslations } from './i18n.js';

// NEW: modularized UI pieces
import { renderShop as renderShopImpl, applyTranslationsToShopButtons } from './shop-ui.js';
import { renderPetShop as renderPetShopImpl } from './petshop-ui.js';
import { updateLeaderboard } from './leaderboard.js';

// Re-export the global wiring implemented in ui-controls.js so older imports keep working.
// tombstone: previously ui.js contained large wiring functions for global controls; those were moved to ui-controls.js
import { wireGlobalControls as wireGlobalControlsImpl } from './ui-controls.js';

 // DOM refs
const shopEl = document.getElementById('shop');
const petShopEl = document.getElementById('petShop');
const mutationShopEl = document.getElementById('mutationShop');
const moneyEl = document.getElementById('money');
const incomeEl = document.getElementById('income');
const spentEl = document.getElementById('spent');
const boughtCountEl = document.getElementById('boughtCount');
const playtimeEl = document.getElementById('playtime');
const rebirthsEl = document.getElementById('rebirths');
const multiplierEl = document.getElementById('multiplier');
const leaderboardEl = document.getElementById('leaderboard');
const leaderboardTitleEl = document.getElementById('leaderboardTitle');

// tombstones for removed code from this file
// removed function createItemElement(item) {}
// removed function renderShop() {}
// removed function createPetElement(pet) {}
// removed function renderPetShop() {}
// removed function applyTranslationsToShopButtons() {}
// removed function updateLeaderboard() {}
// removed the large wireGlobalControls implementation (moved to ui-controls.js)

/**
 * Language management
 */
export function setLanguage(lang) {
  setLangInternal(lang);
  updateUI();
}

/**
 * Shop render proxies (public API kept the same)
 */
export function renderShop() {
  renderShopImpl();
}
export function renderPetShop() {
  renderPetShopImpl();
}

/**
 * Core UI update routine
 */
export function updateUI() {
  const s = getState();
  const inc = recomputeIncome();
  const lang = getCurrentLang();
  const T = TRANSLATIONS[lang];

  moneyEl.textContent = fmt(s.money);
  incomeEl.textContent = fmt(inc) + '/s';
  spentEl.textContent = fmt(s.spent);
  boughtCountEl.textContent = Object.values(s.counts).reduce((a, b) => a + b, 0);
  rebirthsEl.textContent = s.rebirths;
  multiplierEl.textContent = 'x' + s.multiplier;

  // labels
  document.getElementById('label-money').textContent = T.money;
  document.getElementById('label-income').textContent = T.income;
  document.getElementById('statsTitle').textContent = T.stats;
  document.getElementById('label-playtime').textContent = T.playtime;
  document.getElementById('label-spent').textContent = T.spent;
  document.getElementById('label-bought').textContent = T.bought;
  document.getElementById('label-rebirths').textContent = T.rebirths;
  document.getElementById('label-mult').textContent = T.multiplier;
  // removed image limit label & value handling per user request
  document.getElementById('reset').textContent = T.reset;
  document.getElementById('rebirth').textContent = T.rebirthBtn;
  document.getElementById('credits').textContent = T.credits;
  document.getElementById('title').textContent = T.title;

  // admin panel money live-update (if visible)
  const adminMoneyEl = document.getElementById('adminMoney');
  if (adminMoneyEl) {
    adminMoneyEl.textContent = fmt(s.money);
  }

  if (leaderboardTitleEl) {
    leaderboardTitleEl.textContent = T.leaderboardTitle;
  }

  // pet shop title
  const petShopTitleEl = document.getElementById('petShopTitle');
  if (petShopTitleEl) {
    petShopTitleEl.textContent = T.petShopTitle;
  }

  // update game item buttons and counts
  ITEMS.forEach(item => {
    const btn = document.getElementById('buy-' + item.id);
    if (btn) {
      btn.disabled = s.money < item.cost;
      btn.textContent = lang === 'pt' ? 'Comprar' : 'Buy';
    }
    const sellBtn = document.getElementById('sell-' + item.id);
    if (sellBtn) {
      // show sell button only when you own at least 1
      if ((s.counts[item.id] || 0) > 0) {
        sellBtn.style.display = 'inline-block';
        sellBtn.disabled = false;
      } else {
        sellBtn.style.display = 'none';
      }
      sellBtn.textContent = lang === 'pt' ? 'Vender' : 'Sell';
    }
    const cnt = document.getElementById('count-' + item.id);
    if (cnt) cnt.textContent = s.counts[item.id] || 0;

    // update mutation counts display if present
    const mutEl = document.getElementById('mutations-' + item.id);
    if (mutEl) {
      const muts = s.mutations && s.mutations[item.id] ? s.mutations[item.id] : { gold:0, diamond:0, night:0, obsidian:0 };
      const parts = [];
      if (muts.gold) parts.push(`Ouro: ${muts.gold}`);
      if (muts.diamond) parts.push(`Diamante: ${muts.diamond}`);
      if (muts.night) parts.push(`Noite: ${muts.night}`);
      if (muts.obsidian) parts.push(`Obsidiana: ${muts.obsidian}`);
      mutEl.textContent = parts.length ? parts.join(' · ') : '';
    }

    const itemDiv = document.getElementById('item-' + item.id);
    if (itemDiv) {
      const info = itemDiv.querySelector('.info .cost');
      if (info) {
        const costLabel = lang === 'pt' ? 'Custo' : 'Cost';
        const incomeLabel = lang === 'pt' ? 'Renda' : 'Income';
        info.textContent = `${costLabel}: ${fmt(item.cost)} · ${incomeLabel}: ${fmt(item.income)}/s`;
      }
      const qtyLine = itemDiv.querySelector('.info > div[style]');
      if (qtyLine) {
        const qtyLabel = lang === 'pt' ? 'Quantidade' : 'Quantity';
        qtyLine.innerHTML = `${qtyLabel}: <span id="count-${item.id}">${s.counts[item.id] || 0}</span>`;
      }
    }
  });

  // update pet UI (owned, stock, buy/sell button states)
  PETS.forEach(pet => {
    const ownedSpan = document.getElementById('pet-owned-' + pet.id);
    const stockSpan = document.getElementById('pet-stock-' + pet.id);
    const buyBtn = document.getElementById('buy-pet-' + pet.id);
    const sellBtn = document.getElementById('sell-pet-' + pet.id);
    const owned = s.petsOwned[pet.id] || 0;
    const stock = s.petStock[pet.id] || 0;
    if (ownedSpan) ownedSpan.textContent = owned;
    if (stockSpan) stockSpan.textContent = stock;

    // buy button: enabled when you have money, less than 2 owned, and stock available
    if (buyBtn) {
      buyBtn.disabled = s.money < pet.cost || owned >= 2 || stock <= 0;
    }

    // sell button: shown only if you own at least one; enabled always when owned>0
    if (sellBtn) {
      if (owned > 0) {
        sellBtn.style.display = 'inline-block';
        sellBtn.disabled = false;
      } else {
        sellBtn.style.display = 'none';
      }
      sellBtn.textContent = getCurrentLang() === 'pt' ? 'Vender' : 'Sell';
    }
  });

  // playtime
  const ssec = Math.floor((Date.now() - s.startTime) / 1000);
  playtimeEl.textContent = ssec + 's';

  // leaderboard
  updateLeaderboard();
}

/**
 * Wire global controls
 */
// removed the large inline implementation of wireGlobalControls() here to keep ui.js concise.
// The wiring now lives in ui-controls.js; expose a thin wrapper that delegates to it.
export function wireGlobalControls() {
  // tombstone: removed detailed wiring, delegated to ui-controls.js
  return wireGlobalControlsImpl();
}

/**
 * Expose a helper to open the account overlay so admin/UI can force account creation/switch.
 * This will show the overlay and clear inputs so the user can create a new account.
 */
export function openAccountOverlay() {
  const overlay = document.getElementById('accountOverlay');
  const nameInput = document.getElementById('accountName');
  const passInput = document.getElementById('accountPassword');
  const genderSelect = document.getElementById('accountGender');

  if (!overlay || !nameInput || !passInput || !genderSelect) return;

  // clear inputs for fresh creation
  nameInput.value = '';
  passInput.value = '';
  genderSelect.value = '';

  // show overlay even if an account already exists to allow creating/switching
  overlay.classList.remove('hidden');
}