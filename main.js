import { startTimers, stopTimers, getState, resetGame, doRebirth, buyItem as buyItemFromGame } from './game.js';
import { renderShop, wireGlobalControls, updateUI, setLanguage, renderPetShop } from './ui.js';
import { updateLeaderboard } from './leaderboard.js';
import { PETS, ITEMS } from './data.js';
import { renderMutationShop } from './mutation-shop.js';
import './obsidian-block.js'; // NEW: initialize obsidian 3D block (auto-inits)

// initialize UI and shop
renderShop();
// NEW: initial pet shop render (will be hidden until toggled)
renderPetShop();
// NEW: initial mutation shop render (hidden until toggled)
renderMutationShop();

updateUI();
wireGlobalControls();

// start background timers and ensure UI updates every second
startTimers(()=> updateUI());

 // ensure language default applied (kept as 'pt' inside ui)
setLanguage('pt');

// Lucky Game removed — no dedicated button or item wiring

/**
 * Admin helpers: show/hide admin panel & button based on current account
 */
function setAdminUIForAccount(account) {
  const btn = document.getElementById('toggleAdminPanel');
  const panel = document.getElementById('adminPanel');
  const nameSpan = document.getElementById('adminAccountName');
  const moneySpan = document.getElementById('adminMoney');

  if (!btn || !panel) return;

  const isAdmin =
    account &&
    (account.name === 'lunarOWNER' || account.name === 'YokaiOwner');

  if (!isAdmin) {
    btn.style.display = 'none';
    panel.style.display = 'none';
    return;
  }

  // show button but keep panel hidden until clicked
  btn.style.display = 'inline-block';
  panel.style.display = 'none';

  if (nameSpan) nameSpan.textContent = account.name;
  if (moneySpan) {
    try {
      const state = getState();
      moneySpan.textContent =
        'R$ ' +
        Number(state.money).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    } catch (_) {
      moneySpan.textContent = '-';
    }
  }

  // wire admin action buttons once for this admin session
  wireAdminActions();
}

// wire admin panel toggle button (click to show/hide panel)
const toggleAdminBtn = document.getElementById('toggleAdminPanel');
const adminPanelEl = document.getElementById('adminPanel');
if (toggleAdminBtn && adminPanelEl) {
  toggleAdminBtn.addEventListener('click', () => {
    const isVisible = adminPanelEl.style.display === 'block';
    adminPanelEl.style.display = isVisible ? 'none' : 'block';
  });
}

function wireAdminActions() {
  const addMoneyBtn = document.getElementById('adminAddMoney');
  const setMoneyBtn = document.getElementById('adminSetMoney');
  const setMoneyInput = document.getElementById('adminSetMoneyValue');
  const clearLbBtn = document.getElementById('adminClearLeaderboard');
  const adminMoneySpan = document.getElementById('adminMoney');
  const addRebirthsBtn = document.getElementById('adminAddRebirths');
  const givePetsBtn = document.getElementById('adminGivePets');
  // NEW: admin complete index button reference
  const completeIndexBtn = document.getElementById('adminCompleteIndex');
  const resetGameBtn = document.getElementById('adminResetGame');

  // NEW elements for giving items
  const targetInput = document.getElementById('adminTargetAccount');
  const itemSelect = document.getElementById('adminSelectItem');
  const qtyInput = document.getElementById('adminItemQty');
  const giveBtn = document.getElementById('adminGiveItem');
  const giveMsg = document.getElementById('adminGiveMsg');

  // populate itemSelect once
  if (itemSelect && itemSelect.children.length === 0) {
    ITEMS.forEach(it => {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = `${it.name} (${it.id})`;
      itemSelect.appendChild(opt);
    });
  }

  if (addMoneyBtn) {
    addMoneyBtn.onclick = () => {
      const state = getState();
      state.money += 1000000;
      if (adminMoneySpan) {
        adminMoneySpan.textContent =
          'R$ ' +
          Number(state.money).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
      }
      updateUI();
    };
  }

  if (setMoneyBtn && setMoneyInput) {
    setMoneyBtn.onclick = () => {
      const val = Number(setMoneyInput.value);
      if (Number.isNaN(val) || val < 0) return;
      const state = getState();
      state.money = val;
      if (adminMoneySpan) {
        adminMoneySpan.textContent =
          'R$ ' +
          Number(state.money).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
      }
      updateUI();
    };
  }

  if (clearLbBtn) {
    clearLbBtn.onclick = () => {
      try {
        localStorage.removeItem('leaderboard');
      } catch (_) {
        // ignore
      }
      updateLeaderboard();
    };
  }

  // NEW: give +10 rebirths
  if (addRebirthsBtn) {
    addRebirthsBtn.onclick = () => {
      // doRebirth is imported below; loop to stack rebirths
      for (let i = 0; i < 10; i++) {
        doRebirth();
      }
      const state = getState();
      if (adminMoneySpan) {
        adminMoneySpan.textContent =
          'R$ ' +
          Number(state.money).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
      }
      updateUI();
    };
  }

  // NEW: give 1 of each pet
  if (givePetsBtn) {
    givePetsBtn.onclick = () => {
      const state = getState();
      PETS.forEach((p) => {
        state.petsOwned[p.id] = (state.petsOwned[p.id] || 0) + 1;
      });
      updateUI();
    };
  }

  // NEW: admin can force-complete the index and award the Indexaria pet
  if (completeIndexBtn) {
    completeIndexBtn.onclick = () => {
      // Force-complete index for admin: mark indexCompleted, give Indexaria pet, persist flag and refresh UI
      try {
        const state = getState();
        // set flag and award pet (ensure petsOwned exists)
        state.indexCompleted = true;
        state.petsOwned = state.petsOwned || {};
        state.petsOwned['indexaria'] = (state.petsOwned['indexaria'] || 0) + 1;
        // ensure exclusive pet stock is zero
        state.petStock = state.petStock || {};
        state.petStock['indexaria'] = 0;
        // persist flag
        try { localStorage.setItem('indexCompleted','true'); } catch (_) {}
        // recompute multipliers by calling recomputeIncome via updateUI (UI will refresh multiplier)
        updateUI();
        alert('Índice completado — Indexaria concedida!');
      } catch (e) {
        console.error('Admin complete index error', e);
        alert('Erro ao conceder índice.');
      }
    };
  }

  // NEW: full game reset (admin shortcut)
  if (resetGameBtn) {
    resetGameBtn.onclick = () => {
      resetGame();
      const state = getState();
      if (adminMoneySpan) {
        adminMoneySpan.textContent =
          'R$ ' +
          Number(state.money).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
      }
      updateUI();
    };
  }

  // Lucky Game admin shortcut removed

  // NEW: Give item to account (applies immediately to current account or stores pending gifts)
  if (giveBtn && itemSelect && targetInput && qtyInput) {
    giveBtn.onclick = () => {
      const target = (targetInput.value || '').trim();
      const itemId = itemSelect.value;
      const qty = Math.max(1, Math.floor(Number(qtyInput.value) || 1));

      if (!target || !itemId) {
        if (giveMsg) giveMsg.textContent = 'Preencha conta e jogo.';
        return;
      }

      const currentAccountRaw = localStorage.getItem('gameAccount');
      let currentName = null;
      try {
        currentName = currentAccountRaw ? JSON.parse(currentAccountRaw).name : null;
      } catch (_) {
        currentName = null;
      }

      // if target is current logged-in account, apply to state directly
      if (currentName && target === currentName) {
        const state = getState();
        state.counts[itemId] = (state.counts[itemId] || 0) + qty;
        updateUI();
        if (giveMsg) giveMsg.textContent = `Deu ${qty}x ${itemId} para ${target}.`;
        return;
      }

      // otherwise, store pending gifts in localStorage under 'pendingGifts'
      try {
        const raw = localStorage.getItem('pendingGifts');
        const pending = raw ? JSON.parse(raw) : {};
        pending[target] = pending[target] || {};
        pending[target][itemId] = (pending[target][itemId] || 0) + qty;
        localStorage.setItem('pendingGifts', JSON.stringify(pending));
        if (giveMsg) giveMsg.textContent = `Presente armazenado para ${target}: ${qty}x ${itemId}.`;
      } catch (e) {
        if (giveMsg) giveMsg.textContent = 'Erro ao armazenar presente.';
      }
    };
  }
}

// apply pending gifts for the logged-in account (called during initAccountSystem)
function applyPendingGiftsForAccount(accountName) {
  if (!accountName) return;
  try {
    const raw = localStorage.getItem('pendingGifts');
    if (!raw) return;
    const pending = JSON.parse(raw) || {};
    const gifts = pending[accountName];
    if (!gifts) return;
    const state = getState();
    Object.keys(gifts).forEach(itemId => {
      const qty = Number(gifts[itemId]) || 0;
      if (qty > 0) {
        state.counts[itemId] = (state.counts[itemId] || 0) + qty;
      }
    });
    // remove applied gifts
    delete pending[accountName];
    localStorage.setItem('pendingGifts', JSON.stringify(pending));
  } catch (_) {
    // ignore errors
  }
}

// simple account system: require creating an account on first visit
function initAccountSystem() {
  const overlay = document.getElementById('accountOverlay');
  const form = document.getElementById('accountForm');
  const nameInput = document.getElementById('accountName');
  const passInput = document.getElementById('accountPassword');
  const genderSelect = document.getElementById('accountGender');

  if (!overlay || !form || !nameInput || !passInput || !genderSelect) return;

  const stored = localStorage.getItem('gameAccount');
  if (stored) {
    // account already exists, just hide overlay
    overlay.classList.add('hidden');
    // ensure existing account is present in leaderboard
    try {
      const acc = JSON.parse(stored);
      // apply pending gifts if any
      applyPendingGiftsForAccount(acc.name);
      ensureAccountInLeaderboard(acc);
      // also configure admin UI for this stored account
      setAdminUIForAccount(acc);
    } catch (_) {
      // ignore parse errors
    }
  } else {
    // show overlay to create a new account
    overlay.classList.remove('hidden');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const password = passInput.value.trim();
    const gender = genderSelect.value;

    if (!name || !password || !gender) {
      return;
    }

    const account = {
      name,
      password,
      gender,
      createdAt: Date.now()
    };
    localStorage.setItem('gameAccount', JSON.stringify(account));
    // apply gifts immediately when creating account
    applyPendingGiftsForAccount(account.name);
    ensureAccountInLeaderboard(account);
    // configure admin UI (button + panel) for this new account
    setAdminUIForAccount(account);

    overlay.classList.add('hidden');
    updateUI();
  });
}

function ensureAccountInLeaderboard(account) {
  if (!account || !account.name) return;
  let lb = [];
  try {
    const raw = localStorage.getItem('leaderboard');
    if (raw) lb = JSON.parse(raw) || [];
  } catch (_) {
    lb = [];
  }
  const existingIndex = lb.findIndex(e => e.name === account.name);
  if (existingIndex === -1) {
    lb.push({
      name: account.name,
      gender: account.gender || 'outro',
      money: 0
    });
    localStorage.setItem('leaderboard', JSON.stringify(lb));
  }
}

 // wire the new switch account button to open the account overlay for creating/switching accounts
const switchBtn = document.getElementById('switchAccountBtn');

function loadAccountsArray() {
  try {
    const raw = localStorage.getItem('accounts');
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return arr;
  } catch (_) {
    return null;
  }
}

function activateAccount(account) {
  if (!account || !account.name) return;
  try {
    localStorage.setItem('gameAccount', JSON.stringify(account));
  } catch (_) {}
  // apply pending gifts and ensure leaderboard entry
  applyPendingGiftsForAccount(account.name);
  ensureAccountInLeaderboard(account);
  // hide chooser/overlay and refresh UI
  const chooser = document.getElementById('accountChooser');
  const overlay = document.getElementById('accountOverlay');
  if (chooser) chooser.remove();
  if (overlay) overlay.classList.add('hidden');
  import('./ui.js').then(m => m.updateUI());
  // notify main to refresh admin UI if needed
  window.dispatchEvent(new CustomEvent('accountSwitched', { detail: { name: account.name } }));
  // configure admin UI for the newly activated account
  setAdminUIForAccount(account);
}

function showAccountChooser() {
  const overlay = document.getElementById('accountOverlay');
  const nameInput = document.getElementById('accountName');
  const passInput = document.getElementById('accountPassword');
  const genderSelect = document.getElementById('accountGender');

  const accountsArr = loadAccountsArray();
  if (!accountsArr || accountsArr.length === 0) {
    // nothing to choose; open create overlay instead
    import('./ui.js').then(m => m.openAccountOverlay());
    return;
  }

  if (!overlay) return;
  overlay.classList.remove('hidden');

  // remove any existing chooser first
  let chooser = document.getElementById('accountChooser');
  if (!chooser) {
    chooser = document.createElement('div');
    chooser.id = 'accountChooser';
    chooser.className = 'account-card';
    chooser.style.maxWidth = '360px';
    chooser.style.display = 'flex';
    chooser.style.flexDirection = 'column';
    chooser.style.gap = '8px';
    chooser.style.padding = '12px';
    // insert chooser at top of overlay
    const firstChild = overlay.firstElementChild;
    if (firstChild) overlay.insertBefore(chooser, firstChild);
    else overlay.appendChild(chooser);
  }
  chooser.innerHTML = `<h3 style="margin:0;color:var(--accent);">Escolher Conta</h3>`;

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';
  list.style.maxHeight = '220px';
  list.style.overflowY = 'auto';

  accountsArr.forEach(acc => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-small';
    b.style.textAlign = 'left';
    b.textContent = acc.name + (acc.gender ? ` — ${acc.gender}` : '');
    b.onclick = () => activateAccount(acc);
    list.appendChild(b);
  });
  chooser.appendChild(list);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.marginTop = '6px';

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.className = 'btn-small';
  createBtn.textContent = 'Criar nova conta';
  createBtn.onclick = () => {
    chooser.remove();
    overlay.classList.remove('hidden');
    if (nameInput) nameInput.value = '';
    if (passInput) passInput.value = '';
    if (genderSelect) genderSelect.value = '';
  };
  row.appendChild(createBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-small';
  cancelBtn.textContent = 'Fechar';
  cancelBtn.onclick = () => {
    chooser.remove();
    overlay.classList.add('hidden');
  };
  row.appendChild(cancelBtn);

  chooser.appendChild(row);
}

if (switchBtn) {
  switchBtn.addEventListener('click', () => {
    // reuse chooser logic when switching
    showAccountChooser();
  });
}



initAccountSystem();