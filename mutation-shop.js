import { ITEMS, TRANSLATIONS } from './data.js';
import { getState } from './game.js';
import { getCurrentLang } from './i18n.js';

// mutation costs (as requested earlier)
const MUTATION_COSTS = {
  gold: 100000,
  diamond: 500000,
  night: 1250000,
  obsidian: 4250000, // new mutation: 4x multiplier
};

const mutationShopEl = document.getElementById('mutationShop');

function createMutationRow(type, label, cost) {
  const currentLang = getCurrentLang();
  const T = TRANSLATIONS[currentLang];

  const row = document.createElement('div');
  row.className = 'item';
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.justifyContent = 'space-between';
  row.innerHTML = `
    <div class="left" style="gap:12px">
      <div class="icon">${type.charAt(0).toUpperCase()}</div>
      <div class="info">
        <div class="name">${label}</div>
        <div class="cost">Custo: R$ ${Number(cost).toLocaleString('pt-BR')}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px">
          ${currentLang === 'pt' ? 'Aplica a um jogo do seu inventário' : 'Apply to a game in your inventory'}
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
      <button class="buy" id="buy-mut-${type}">${currentLang === 'pt' ? 'Comprar' : 'Buy'}</button>
    </div>
  `;

  const buyBtn = row.querySelector(`#buy-mut-${type}`);
  buyBtn.addEventListener('click', async () => {
    const state = getState();
    if (state.money < cost) {
      return alert(currentLang === 'pt' ? 'Você não tem dinheiro suficiente.' : 'Not enough money.');
    }

    // build a list of owned item ids to choose from
    const owned = Object.keys(state.counts).filter(id => (state.counts[id] || 0) > 0);
    if (owned.length === 0) {
      return alert(currentLang === 'pt' ? 'Você não possui jogos para mutar.' : 'You have no games to mutate.');
    }

    // show friendly list and ask user to choose an item id
    const promptList = owned.map(id => {
      const item = ITEMS.find(it => it.id === id);
      const name = item ? item.name : id;
      // show counts so user knows how many copies they have
      const cnt = state.counts[id] || 0;
      return `${id} — ${name} (${cnt})`;
    }).join('\n');

    const choice = prompt(
      (currentLang === 'pt'
        ? `Escolha o ID do jogo para aplicar a mutação ${label} (copie o id):\n`
        : `Choose the item ID to apply ${label}: \n`) + promptList
    );
    if (!choice) return;

    const selectedId = String(choice).trim();
    if (!owned.includes(selectedId)) {
      return alert(currentLang === 'pt' ? 'ID inválido ou não possui esse jogo.' : 'Invalid ID or you do not own that game.');
    }

    // Enforce rule: player must have more than 1 copy to apply a mutation,
    // because applying consumes one unmutated copy. This prevents mutating the last copy.
    const availableCopies = state.counts[selectedId] || 0;
    if (availableCopies <= 1) {
      return alert(
        currentLang === 'pt'
          ? 'Você precisa ter mais de uma cópia deste jogo para aplicar uma mutação (a mutação consome uma cópia não-mutada).'
          : 'You must own more than one copy of this game to apply a mutation (mutation consumes one unmutated copy).'
      );
    }

    // perform purchase: deduct money, consume one unmutated copy, and increment mutation counter on that item
    state.money = Number(state.money) - cost;
    state.counts[selectedId] = Math.max(0, (state.counts[selectedId] || 0) - 1);

    state.mutations = state.mutations || {};
    state.mutations[selectedId] = state.mutations[selectedId] || { gold: 0, diamond: 0, night: 0 };
    state.mutations[selectedId][type] = (state.mutations[selectedId][type] || 0) + 1;

    // notify and update UI by lazy-importing ui module to avoid circular deps
    try {
      const ui = await import('./ui.js');
      if (ui.updateUI) ui.updateUI();
    } catch (_) {}

    alert(
      currentLang === 'pt'
        ? `Mutação ${label} aplicada a ${selectedId}! Uma cópia não-mutada foi consumida.`
        : `${label} mutation applied to ${selectedId}! One unmutated copy was consumed.`
    );
    // re-render shop after purchase so buttons/states reflect new money and counts
    renderMutationShop();
  });

  return row;
}

export function renderMutationShop() {
  if (!mutationShopEl) return;
  const currentLang = getCurrentLang();
  const T = TRANSLATIONS[currentLang];

  mutationShopEl.innerHTML = `<h2 style="margin-top:0" id="mutationShopTitle">${currentLang==='pt' ? 'Loja de Mutação' : 'Mutation Shop'}</h2>`;

  const list = document.createElement('div');
  list.className = 'cat-items-vertical';

  list.appendChild(createMutationRow('gold', currentLang === 'pt' ? 'Ouro (+25%)' : 'Gold (+25%)', MUTATION_COSTS.gold));
  list.appendChild(createMutationRow('diamond', currentLang === 'pt' ? 'Diamante (+50%)' : 'Diamond (+50%)', MUTATION_COSTS.diamond));
  list.appendChild(createMutationRow('night', currentLang === 'pt' ? 'Noite (x2)' : 'Night (x2)', MUTATION_COSTS.night));
  // new obsidian mutation: multiplies base income by 4
  list.appendChild(createMutationRow('obsidian', currentLang === 'pt' ? 'Obsidiana (x4)' : 'Obsidian (x4)', MUTATION_COSTS.obsidian));

  mutationShopEl.appendChild(list);

  // update UI counts / availability via ui.updateUI if present
  import('./ui.js').then((m) => { if (m.updateUI) m.updateUI(); }).catch(()=>{});
}

