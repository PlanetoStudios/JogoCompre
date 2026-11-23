import { PETS, TRANSLATIONS } from './data.js';
import { fmt, buyPet, getState } from './game.js';
import { getCurrentLang } from './i18n.js';

const petShopEl = document.getElementById('petShop');

function createPetElement(pet) {
  const s = getState();
  const owned = s.petsOwned[pet.id] || 0;
  const stock = s.petStock[pet.id] || 0;
  const currentLang = getCurrentLang();
  const T = TRANSLATIONS[currentLang];

  const isExclusive = pet.id === 'indexaria';

  const div = document.createElement('div');
  div.className = 'item';
  div.id = 'pet-' + pet.id;
  div.innerHTML = `
    <div class="left">
      <div class="icon">${pet.icon}</div>
      <div class="info">
        <div class="name">${pet.name}${isExclusive ? ' ✦' : ''}</div>
        <div class="cost">${fmt(pet.cost)} · +${pet.mult}x</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px">
          ${currentLang === 'pt' ? 'Possui' : 'Owned'}: <span id="pet-owned-${pet.id}">${owned}</span> / 2
        </div>
        <div style="font-size:13px;color:var(--muted);margin-top:2px">
          ${T.petStockLabel}: <span id="pet-stock-${pet.id}">${stock}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
      ${isExclusive ? `<div style="font-size:12px;color:var(--muted);text-align:right;margin-bottom:6px">${currentLang==='pt' ? 'Exclusivo (conquistado)' : 'Exclusive (awarded)'}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="buy" id="buy-pet-${pet.id}">${currentLang === 'pt' ? 'Comprar' : 'Buy'}</button>
        <button class="sell" id="sell-pet-${pet.id}" style="display:${owned>0 ? 'inline-block' : 'none'}">${currentLang === 'pt' ? 'Vender' : 'Sell'}</button>
      </div>
    </div>
  `;

  const buyBtn = div.querySelector('.buy');
  const sellBtn = div.querySelector('.sell');

  // disable buy button for the exclusive pet (can't be purchased)
  if (pet.id === 'indexaria') {
    if (buyBtn) buyBtn.style.display = 'none';
  } else {
    buyBtn && buyBtn.addEventListener('click', () => {
      if (buyPet(pet)) {
        import('./ui.js').then((m) => m.updateUI());
      }
    });
  }

  if (sellBtn) {
    sellBtn.addEventListener('click', () => {
      try {
        if (sellPet(pet)) {
          import('./ui.js').then((m) => m.updateUI());
        }
      } catch (e) {
        // lazy-load sellPet from game.js if not in scope
        import('./game.js').then(mod => {
          if (mod.sellPet && mod.sellPet(pet)) {
            import('./ui.js').then((m) => m.updateUI());
          }
        });
      }
    });
  }

  return div;
}

export function renderPetShop() {
  if (!petShopEl) return;
  const currentLang = getCurrentLang();
  const T = TRANSLATIONS[currentLang];

  petShopEl.innerHTML = `<h2 style="margin-top:0" id="petShopTitle">${T.petShopTitle}</h2}`;

  const list = document.createElement('div');
  list.className = 'cat-items-vertical';
  PETS.forEach((p) => {
    const node = createPetElement(p);
    list.appendChild(node);
  });
  petShopEl.appendChild(list);

  import('./ui.js').then((m) => m.updateUI());
}

function initAccountSystem() {
  const overlay = document.getElementById('accountOverlay');
  const form = document.getElementById('accountForm');
  const nameInput = document.getElementById('accountName');
  const passInput = document.getElementById('accountPassword');
  const genderSelect = document.getElementById('accountGender');

  if (!overlay || !form || !nameInput || !passInput || !genderSelect) return;

  // helper to load stored accounts array
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

  // helper to persist single active account
  function activateAccount(account) {
    if (!account || !account.name) return;
    try {
      localStorage.setItem('gameAccount', JSON.stringify(account));
    } catch (_) {}
    // apply pending gifts and ensure leader entry
    applyPendingGiftsForAccount(account.name);
    ensureAccountInLeaderboard(account);
    // hide overlay and refresh UI
    overlay.classList.add('hidden');
    import('./ui.js').then(m => {
      m.updateUI();
    });
    // notify main to refresh admin UI if needed by dispatching a custom event
    window.dispatchEvent(new CustomEvent('accountSwitched', { detail: { name: account.name } }));
  }

  // if there are multiple saved accounts, show a chooser UI inside the same overlay
  const accountsArr = loadAccountsArray();
  const storedSingle = localStorage.getItem('gameAccount');

  if (accountsArr && accountsArr.length > 1) {
    // build a small chooser card inside overlay
    overlay.classList.remove('hidden');

    // create chooser container (replace any existing chooser)
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
      // insert chooser before the form card so user can switch
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
      b.onclick = () => {
        activateAccount(acc);
      };
      list.appendChild(b);
    });
    chooser.appendChild(list);

    // add a small row with 'Use Selected' (not required) and 'Create nova conta' button
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginTop = '6px';
    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'btn-small';
    createBtn.textContent = 'Criar nova conta';
    createBtn.onclick = () => {
      // remove chooser and reveal the create form
      chooser.remove();
      overlay.classList.remove('hidden');
      nameInput.value = '';
      passInput.value = '';
      genderSelect.value = '';
    };
    row.appendChild(createBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-small';
    cancelBtn.textContent = 'Fechar';
    cancelBtn.onclick = () => {
      overlay.classList.add('hidden');
    };
    row.appendChild(cancelBtn);

    chooser.appendChild(row);

    // ensure overlay visible and skip showing the default create form initially
    overlay.classList.remove('hidden');
    return;
  }

  // existing single-account or no-account behavior (keeps backward compatibility)
  if (storedSingle) {
    // account already exists, just hide overlay
    overlay.classList.add('hidden');
    // ensure existing account is present in leaderboard
    try {
      const acc = JSON.parse(storedSingle);
      // apply pending gifts if any
      applyPendingGiftsForAccount(acc.name);
      ensureAccountInLeaderboard(acc);
      // note: main.js handles admin UI binding on app init; dispatch an event to allow that to update now
      window.dispatchEvent(new CustomEvent('accountSwitched', { detail: { name: acc.name } }));
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

    // Save into accounts array as well as active gameAccount (allow multiple accounts)
    try {
      const raw = localStorage.getItem('accounts');
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) {
        // overwrite with fresh array
        const newArr = [account];
        localStorage.setItem('accounts', JSON.stringify(newArr));
      } else {
        // remove any prior entry with same name then push new
        const filtered = arr.filter(a => a.name !== account.name);
        filtered.push(account);
        localStorage.setItem('accounts', JSON.stringify(filtered));
      }
    } catch (_) {
      try {
        localStorage.setItem('accounts', JSON.stringify([account]));
      } catch (_) {}
    }

    // set as active
    try {
      localStorage.setItem('gameAccount', JSON.stringify(account));
    } catch (_) {}

    // apply gifts immediately when creating account
    applyPendingGiftsForAccount(account.name);
    ensureAccountInLeaderboard(account);

    overlay.classList.add('hidden');
    import('./ui.js').then((m) => m.updateUI());
    // notify listeners
    window.dispatchEvent(new CustomEvent('accountSwitched', { detail: { name: account.name } }));
  });
}