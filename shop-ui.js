import { CATEGORIES, ITEMS, TRANSLATIONS } from './data.js';
import { fmt, buyItem, getState, sellItem } from './game.js';
import { getCurrentLang } from './i18n.js';

const shopEl = document.getElementById('shop');

/* Craft buffer holds temporarily placed prerequisite games for crafting items.
   structure: { itemId: placedCount, ... }
   Ensure buffer includes known crafting prereqs (existing and new ones).
*/
window.__craftBuffer = window.__craftBuffer || { spacey: 0, deltar: 0, redbal: 0, treroi: 0, banako: 0, cod: 0, pvz: 0, pvz2: 0 };

function saveCraftBuffer() {
  try { localStorage.setItem('craftBuffer', JSON.stringify(window.__craftBuffer)); } catch (_) {}
}
function loadCraftBuffer() {
  try {
    const raw = localStorage.getItem('craftBuffer');
    if (raw) {
      const parsed = JSON.parse(raw);
      // ensure new keys for Solar Smash and Terraria are present
      window.__craftBuffer = Object.assign({ spacey: 0, deltar: 0, solars: 0, terrar: 0 }, parsed);
    }
  } catch (_) {}
}
loadCraftBuffer();

// helper: map item id -> category slug and add category class to an item node
function slugify(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function findCategoryForItem(itemId) {
  for (const cat of CATEGORIES) {
    if (cat.items && cat.items.some(it => it.id === itemId)) return cat;
  }
  return null;
}
function addCategoryClassToNode(node, itemId) {
  const cat = findCategoryForItem(itemId);
  const slug = cat ? slugify(cat.name) : 'uncategorized';
  node.classList.add('cat-' + slug);
}

/**
 * Small helper to build item element for the main shop
 */
export function createItemElement(item) {
  const div = document.createElement('div');
  div.className = 'item';
  div.id = 'item-' + item.id;

  const currentLang = getCurrentLang();
  const s = getState();
  const owned = s.counts[item.id] || 0;

  div.innerHTML = `
    <div class=\"left\">
      <div class=\"icon\">${item.icon}</div>
      <div class=\"info\">
        <div class=\"name\">${item.name}</div>
        <div class=\"cost\">Custo: ${fmt(item.cost)} · Renda: ${fmt(item.income)}/s</div>
        <div style=\"font-size:13px;color:var(--muted);margin-top:6px\">
          Quantidade: <span id=\"count-${item.id}\">${owned}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
      <button class=\"buy\" id=\"buy-${item.id}\">${currentLang === 'pt' ? (item.id === 'superc' ? 'Gerar' : 'Comprar') : (item.id === 'superc' ? 'Generate' : 'Buy')}</button>
      <button class=\"sell\" id=\"sell-${item.id}\" style="display:${owned>0 ? 'inline-block' : 'none'}">${currentLang === 'pt' ? 'Vender' : 'Sell'}</button>
    </div>
  `;

  const buyBtn = div.querySelector('.buy');

  // Disable/hide buy button for items that live in the Craft category
  // (craftable items should be generated via the craft UI, not bought directly)
  try {
    const cat = findCategoryForItem(item.id);
    if (cat && String(cat.name).toLowerCase() === 'craft') {
      if (buyBtn) {
        // hide and disable the buy button for craft items
        buyBtn.style.display = 'none';
        buyBtn.disabled = true;
      }
    }
  } catch (_) {
    // fail silently if category lookup errors
  }

  // If this item defines prereq crafting requirements, create a generic craft UI
  if (item.prereq && typeof item.prereq === 'object') {
    // create craft UI container
    const craftContainer = document.createElement('div');
    craftContainer.style.display = 'flex';
    craftContainer.style.flexDirection = 'column';
    craftContainer.style.alignItems = 'stretch';
    craftContainer.style.gap = '6px';
    craftContainer.style.width = '100%';
    craftContainer.style.marginTop = '8px';

    // helper to create a prereq slot display (icon button)
    function createPrereqSlot(reqId, label, needed) {
      const slot = document.createElement('div');
      slot.style.display = 'flex';
      slot.style.alignItems = 'center';
      slot.style.gap = '8px';

      const iconBtn = document.createElement('button');
      iconBtn.type = 'button';
      iconBtn.className = 'btn-small';
      iconBtn.style.background = '#000';
      iconBtn.style.color = '#ffd400'; // yellow letters
      iconBtn.style.border = '2px solid #ffd400';
      iconBtn.style.padding = '6px 8px';
      iconBtn.style.minWidth = '72px';
      iconBtn.style.textAlign = 'center';
      iconBtn.textContent = `${reqId.toUpperCase()} (${window.__craftBuffer[reqId]||0}/${needed})`;
      iconBtn.title = `Place ${needed}x ${label} for craft`;

      // place item for craft (moves from inventory to craft buffer) or remove placed
      iconBtn.addEventListener('click', () => {
        const s = getState();
        const available = s.counts[reqId] || 0;
        const placed = window.__craftBuffer[reqId] || 0;
        if (available > 0 && placed < needed) {
          s.counts[reqId] = available - 1;
          window.__craftBuffer[reqId] = placed + 1;
          saveCraftBuffer();
          updateCraftUI();
          import('./ui.js').then((m) => m.updateUI());
        } else {
          // try to remove from craft (return to inventory) if any placed
          if (placed > 0) {
            s.counts[reqId] = (s.counts[reqId] || 0) + 1;
            window.__craftBuffer[reqId] = placed - 1;
            saveCraftBuffer();
            updateCraftUI();
            import('./ui.js').then((m) => m.updateUI());
          }
        }
      });

      const labelEl = document.createElement('div');
      labelEl.style.fontSize = '12px';
      labelEl.style.color = 'var(--muted)';
      labelEl.textContent = `${label}`;

      slot.appendChild(iconBtn);
      slot.appendChild(labelEl);

      return { slot, iconBtn, reqId, needed };
    }

    // build slots for the recipe dynamically
    const slots = [];
    const prereqRow = document.createElement('div');
    prereqRow.style.display = 'flex';
    prereqRow.style.gap = '8px';

    Object.keys(item.prereq).forEach(reqId => {
      const needed = item.prereq[reqId] || 0;
      // try to map a human-friendly label for a few known ids, fallback to id
      const labelMap = {
        spacey: 'The Space Invaders',
        deltar: 'Deltarune',
        redbal: 'RedBall',
        treroi: '3008',
        banako: 'The Banana Kong',
        cod: 'Call of Duty'
      };
      // add friendly names for recently added craft prerequisites
      labelMap.solars = 'Solar Smash';
      labelMap.terrar = 'Terraria';
      const label = labelMap[reqId] || reqId;
      const slotObj = createPrereqSlot(reqId, label, needed);
      slots.push(slotObj);
      prereqRow.appendChild(slotObj.slot);
    });

    // craft button
    const craftBtn = document.createElement('button');
    craftBtn.type = 'button';
    craftBtn.className = 'buy';
    craftBtn.textContent = currentLang === 'pt' ? 'Gerar' : 'Generate';
    craftBtn.addEventListener('click', () => {
      // check buffer meets prereq
      const buf = window.__craftBuffer;
      let ok = true;
      Object.keys(item.prereq).forEach(reqId => {
        if ((buf[reqId] || 0) < (item.prereq[reqId] || 0)) ok = false;
      });
      if (ok) {
        // perform craft: directly add the crafted item to state and clear buffer for those reqs
        const s = getState();
        s.counts[item.id] = (s.counts[item.id] || 0) + 1;
        // reduce any limited stock for the crafted item if present
        if (typeof s.itemStock[item.id] === 'number' && isFinite(s.itemStock[item.id])) {
          s.itemStock[item.id] = Math.max(0, s.itemStock[item.id] - 1);
        }
        // clear buffer entries for each prereq (they were removed from counts when placed)
        Object.keys(item.prereq).forEach(reqId => {
          window.__craftBuffer[reqId] = 0;
        });
        saveCraftBuffer();
        try {
          const msg = currentLang === 'pt'
            ? `${item.name} gerado!`
            : `${item.name} generated!`;
          alert(msg);
        } catch (_) {}
        updateCraftUI();
        import('./ui.js').then((m) => m.updateUI());
      } else {
        try {
          // build friendly message listing requirements
          const needs = Object.keys(item.prereq).map(k => `${item.prereq[k]} ${k.toUpperCase()}`).join(' e ');
          const msg = currentLang === 'pt'
            ? `Coloque ${Object.keys(item.prereq).map(k=>`${item.prereq[k]} ${labelMap && labelMap[k] ? labelMap[k] : k}`).join(' e ')} para gerar.`
            : `Place required prerequisites to generate.`;
          alert(msg);
        } catch(_) {}
      }
    });

    // small helper to update text on the slot buttons
    function updateCraftUI(){
      slots.forEach(slt => {
        slt.iconBtn.textContent = `${slt.reqId.toUpperCase()} (${(window.__craftBuffer[slt.reqId]||0)}/${slt.needed})`;
      });
      // disable craft button until buffer satisfied
      let enabled = true;
      Object.keys(item.prereq).forEach(reqId => {
        if ((window.__craftBuffer[reqId]||0) < (item.prereq[reqId]||0)) enabled = false;
      });
      craftBtn.disabled = !enabled;
    }

    // initial render
    craftContainer.appendChild(prereqRow);
    craftContainer.appendChild(craftBtn);
    div.appendChild(craftContainer);
    updateCraftUI();
  }

  buyBtn.addEventListener('click', () => {
    if (buyItem(item)) {
      // if this is a crafted item, show a small confirmation about crafting
      if (item.id === 'superc') {
        try { alert(currentLang === 'pt' ? 'Super Chapters gerado!' : 'Super Chapters generated!'); } catch(_) {}
      }
      // update UI after purchase
      import('./ui.js').then((m) => m.updateUI());
      // play spoken name if enabled (default: enabled)
      try {
        const speechEnabled = localStorage.getItem('speechEnabled');
        const enabled = speechEnabled === null ? true : speechEnabled === 'true';
        if (enabled && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(item.name);
          // prefer a male English voice when available
          const voices = speechSynthesis.getVoices() || [];
          // try to find a male English voice, fallback gracefully
          let selected = null;
          for (const v of voices) {
            const lname = (v.lang || '').toLowerCase();
            const vname = (v.name || '').toLowerCase();
            if ((lname.startsWith('en')) && /male|paul|daniel|john|david|michael|tom|alex/i.test(vname || '')) {
              selected = v;
              break;
            }
          }
          // fallback: pick any en voice, then any voice
          if (!selected) selected = voices.find(v=> (v.lang||'').toLowerCase().startsWith('en')) || voices[0] || null;
          if (selected) utter.voice = selected;
          // prefer English language for utterance
          utter.lang = 'en-US';
          utter.rate = 0.95;
          utter.pitch = 0.9;
          try { speechSynthesis.cancel(); } catch(_) {}
          speechSynthesis.speak(utter);
        }
      } catch (_) {
        // ignore speech errors
      }
    }
  });

  const sellBtn = div.querySelector('.sell');
  if (sellBtn) {
    sellBtn.addEventListener('click', () => {
      if (sellItem(item)) {
        import('./ui.js').then((m) => m.updateUI());
      }
    });
  }

  return div;
}

/**
 * Render the main shop with rarity tabs like before
 */
export function renderShop() {
  if (!shopEl) return;

  const currentLang = getCurrentLang();
  const T = TRANSLATIONS[currentLang];

  shopEl.innerHTML = `<h2 style=\"margin-top:0\" id=\"shopTitle\">${T.shopTitle}</h2>`;

  // controls (search)
  let existingControls = document.getElementById('shopControls');
  if (!existingControls) {
    const ctrl = document.createElement('div');
    ctrl.id = 'shopControls';
    ctrl.className = 'shop-controls';
    ctrl.style.display = 'none';
    ctrl.innerHTML = `
      <input id=\"shopSearch\"
        placeholder=\"${currentLang === 'pt' ? 'Pesquisar jogos...' : 'Search games...'}\"
        aria-label=\"Pesquisar jogos\" />
    `;
    shopEl.appendChild(ctrl);
    existingControls = ctrl;
  } else {
    existingControls.style.display = 'none';
  }

  // category tabs
  const tabs = document.createElement('div');
  tabs.id = 'categoryTabs';
  tabs.style.display = 'flex';
  tabs.style.gap = '8px';
  tabs.style.margin = '8px 0';

  CATEGORIES.forEach((cat, idx) => {
    const t = document.createElement('button');
    t.className = 'category-tab';
    t.type = 'button';
    t.innerHTML = `${cat.icon} ${cat.name}`;
    t.addEventListener('click', () => {
      // tiny click animation class removed shortly after to provide tactile feedback
      t.classList.add('clicked');
      setTimeout(() => t.classList.remove('clicked'), 140);

      renderCategoryItems(idx);
      document.querySelectorAll('.category-tab').forEach((b) =>
        b.classList.remove('active'),
      );
      t.classList.add('active');
    });
    tabs.appendChild(t);
  });
  shopEl.appendChild(tabs);

  // Enable pointer-drag horizontal scrolling for the category tabs so rarities can be
  // dragged to access off-screen categories (useful on narrow viewports to reach craft).
  // Simpler behavior: rely on native horizontal scrolling with visible scrollbar so clicks work normally.
  (function enableNativeScroll(el) {
    if (!el) return;
    el.style.cursor = 'default';
    el.style.overflowX = 'auto';
    el.style.overflowY = 'hidden';
    el.style.webkitOverflowScrolling = 'touch';
    // translate vertical wheel to horizontal scroll for convenience
    el.addEventListener('wheel', (evt) => {
      if (Math.abs(evt.deltaX) < Math.abs(evt.deltaY)) {
        el.scrollLeft += evt.deltaY;
        evt.preventDefault();
      }
    }, { passive: false });
  })(tabs);

  let itemsContainer = document.getElementById('itemsContainer');
  if (!itemsContainer) {
    itemsContainer = document.createElement('div');
    itemsContainer.id = 'itemsContainer';
    itemsContainer.className = 'items-container';
    shopEl.appendChild(itemsContainer);
  } else {
    itemsContainer.innerHTML = '';
  }

  function renderCategoryItems(catIndex) {
    const cat = CATEGORIES[catIndex];
    const container = document.getElementById('itemsContainer');
    container.innerHTML = '';

    const hdr = document.createElement('div');
    hdr.className = 'cat-header-block';
    hdr.innerHTML = `<strong style=\"font-size:16px\">${cat.icon} ${cat.name}</strong>`;
    container.appendChild(hdr);

    const list = document.createElement('div');
    list.className = 'cat-items-vertical';
    cat.items.forEach((item) => {
      const node = createItemElement(item);
      // tag node with its category for styling of the icon letters
      addCategoryClassToNode(node, item.id);
      list.appendChild(node);
    });
    container.appendChild(list);

    import('./ui.js').then((m) => m.updateUI());
  }

  if (CATEGORIES.length > 0) {
    renderCategoryItems(0);
    setTimeout(() => {
      const firstTab = document.querySelectorAll('.category-tab')[0];
      if (firstTab) firstTab.classList.add('active');
    }, 0);
  }

  let sr = document.getElementById('searchResults');
  if (!sr) {
    sr = document.createElement('div');
    sr.id = 'searchResults';
    sr.style.display = 'none';
    shopEl.appendChild(sr);
  } else {
    sr.style.display = 'none';
  }

  // wire search
  const shopSearch = document.getElementById('shopSearch');
  if (shopSearch) {
    shopSearch.addEventListener('input', (e) => {
      const currentLang = getCurrentLang();
      const q = e.target.value.trim().toLowerCase();
      const searchResults = document.getElementById('searchResults');
      searchResults.innerHTML = '';

      if (q === '') {
        // show normal UI, hide search results
        searchResults.style.display = 'none';
        const sc = document.getElementById('shopControls');
        if (sc) sc.style.display = shopEl.classList.contains('hidden') ? 'none' : 'flex';
        import('./ui.js').then((m) => {
          m.updateUI();
        });
        return;
      }

      let any = false;
      ITEMS.forEach((item) => {
        const name = item.name.toLowerCase();
        if (name.includes(q)) {
          any = true;
          const node = createItemElement(item);

          const btn = node.querySelector('.buy');
          if (btn) btn.textContent = currentLang === 'pt' ? 'Comprar' : 'Buy';

          const costEl = node.querySelector('.info .cost');
          if (costEl) {
            const costLabel = currentLang === 'pt' ? 'Custo' : 'Cost';
            const incomeLabel = currentLang === 'pt' ? 'Renda' : 'Income';
            costEl.textContent = `${costLabel}: ${fmt(item.cost)} · ${incomeLabel}: ${fmt(item.income)}/s`;
          }

          const qtyLine = node.querySelector('.info > div[style]');
          if (qtyLine) {
            const qtyLabel = currentLang === 'pt' ? 'Quantidade' : 'Quantity';
            qtyLine.innerHTML = `${qtyLabel}: <span id=\"count-${item.id}\">${getState().counts[item.id] || 0}</span>`;
          }

          // preserve category styling in search results
          addCategoryClassToNode(node, item.id);
          searchResults.appendChild(node);
        }
      });

      searchResults.style.display = any ? 'block' : 'none';
      const sc = document.getElementById('shopControls');
      if (sc) sc.style.display = 'flex';

      import('./ui.js').then((m) => m.updateUI());
    });
  }

  import('./ui.js').then((m) => {
    if (m.applyTranslationsToShopButtons) {
      m.applyTranslationsToShopButtons();
    }
    m.updateUI();
  });
}

/**
 * Apply translations to shop buttons and labels (called by ui.js)
 */
export function applyTranslationsToShopButtons() {
  const currentLang = getCurrentLang();
  ITEMS.forEach((item) => {
    const btn = document.getElementById('buy-' + item.id);
    if (btn) btn.textContent = currentLang === 'pt' ? 'Comprar' : 'Buy';

    const itemDiv = document.getElementById('item-' + item.id);
    if (itemDiv) {
      const info = itemDiv.querySelector('.info .cost');
      if (info) {
        const costLabel = currentLang === 'pt' ? 'Custo' : 'Cost';
        const incomeLabel = currentLang === 'pt' ? 'Renda' : 'Income';
        info.textContent = `${costLabel}: ${fmt(item.cost)} · ${incomeLabel}: ${fmt(item.income)}/s`;
      }
      const qtyLine = itemDiv.querySelector('.info > div[style]');
      if (qtyLine) {
        const qtyLabel = currentLang === 'pt' ? 'Quantidade' : 'Quantity';
        qtyLine.innerHTML = `${qtyLabel}: <span id=\"count-${item.id}\">${getState().counts[item.id] || 0}</span>`;
      }
    }
  });
}