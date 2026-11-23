/*
  New module extracted from ui.js to host global controls and wiring such as:
  - wireGlobalControls()
  - index overlay handlers
  - settings/music toggles
  - language selector wiring
  - shop/pet/mutation toggle wiring
  This keeps ui.js focused on the public API + updateUI while the event wiring lives here.
*/

import { renderShop as renderShopImpl, applyTranslationsToShopButtons } from './shop-ui.js';
import { renderPetShop as renderPetShopImpl } from './petshop-ui.js';
import { updateLeaderboard } from './leaderboard.js';
import { setLanguage as setLangPublic, updateUI } from './ui.js';
import { getCurrentLang, setCurrentLang as setLangInternal, getTranslations } from './i18n.js';
import { recomputeIncome, getState, resetGame, doRebirth, fmt } from './game.js';
import { PETS, ITEMS, TRANSLATIONS } from './data.js';

// Exported function to wire global controls (moved out of ui.js)
export function wireGlobalControls() {
  const lang = getCurrentLang();
  const T = getTranslations();

  // index overlay
  const indexBtn = document.getElementById('indexBtn');
  const indexOverlay = document.getElementById('indexOverlay');
  const indexContent = document.getElementById('indexContent');
  const claimIndexBtn = document.getElementById('claimIndexBtn');
  const closeIndexBtn = document.getElementById('closeIndexBtn');

  function refreshIndexOverlay(){
    if (!indexContent) return;
    import('./game.js').then(m => {
      const prog = m.getIndexProgress();
      const owned = prog.owned;
      const needed = prog.needed;
      const total = prog.total;
      const already = prog.alreadyAwarded;
      const completed = prog.completed;
      indexContent.innerHTML = `
        <div style="margin-bottom:6px">Você possui ${owned} de ${total} jogos.</div>
        <div style="margin-bottom:6px">Progresso necessário para índice: ${needed} jogos (75%).</div>
        <div style="margin-bottom:6px;color:var(--accent)">${completed ? 'Índice completo!' : 'Índice incompleto.'}</div>
        <div style="font-size:12px;color:var(--muted)">Obs: o pet Indexaria só pode ser recebido uma vez quando o índice é completado.</div>
      `;
      if (claimIndexBtn) {
        claimIndexBtn.disabled = !(completed && !already);
        claimIndexBtn.textContent = already ? (getCurrentLang()==='pt' ? 'Já recebido' : 'Already claimed') : (getCurrentLang()==='pt' ? 'Receber Indexaria' : 'Claim Indexaria');
      }
    });
  }

  if (indexBtn) {
    indexBtn.addEventListener('click', () => {
      if (!indexOverlay) return;
      indexOverlay.classList.remove('hidden');
      refreshIndexOverlay();
    });
  }
  if (closeIndexBtn) {
    closeIndexBtn.addEventListener('click', () => {
      if (!indexOverlay) return;
      indexOverlay.classList.add('hidden');
    });
  }
  if (claimIndexBtn) {
    claimIndexBtn.addEventListener('click', () => {
      import('./game.js').then(m => {
        const ok = m.claimIndex();
        if (ok) {
          alert(getCurrentLang()==='pt' ? 'Você recebeu o pet Indexaria!' : 'You received the Indexaria pet!');
        } else {
          alert(getCurrentLang()==='pt' ? 'Índice não completo ou já recebido.' : 'Index not complete or already claimed.');
        }
        refreshIndexOverlay();
        updateUI();
      });
    });
  }

  // Settings / Music / Speech toggles
  const musicElRetro = document.getElementById('bgMusic');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsMusicToggle = document.getElementById('settingsMusicToggle');
  const settingsSpeechToggle = document.getElementById('settingsSpeechToggle');

  let musicEnabled = false;
  try { musicEnabled = localStorage.getItem('musicEnabled') === 'true'; } catch(_) { musicEnabled = false; }
  let speechEnabled = true;
  try { const s = localStorage.getItem('speechEnabled'); speechEnabled = s === null ? true : s === 'true'; } catch(_) { speechEnabled = true; }

  const applyMusicState = () => {
    if (!musicElRetro) return;
    musicElRetro.volume = 0.15;
    if (musicEnabled) {
      const p = musicElRetro.play();
      if (p && typeof p.then === 'function') p.catch(()=>{});
    } else {
      try { musicElRetro.pause(); musicElRetro.currentTime = 0; } catch(_) {}
    }
  };

  if (settingsMusicToggle) settingsMusicToggle.checked = musicEnabled;
  if (settingsSpeechToggle) settingsSpeechToggle.checked = speechEnabled;

  if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => settingsOverlay && settingsOverlay.classList.remove('hidden'));
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsOverlay && settingsOverlay.classList.add('hidden'));

  if (settingsMusicToggle) {
    settingsMusicToggle.addEventListener('change', (e) => {
      musicEnabled = !!e.target.checked;
      try { localStorage.setItem('musicEnabled', musicEnabled ? 'true' : 'false'); } catch(_) {}
      applyMusicState();
    });
  }
  if (settingsSpeechToggle) {
    settingsSpeechToggle.addEventListener('change', (e) => {
      speechEnabled = !!e.target.checked;
      try { localStorage.setItem('speechEnabled', speechEnabled ? 'true' : 'false'); } catch(_) {}
    });
  }
  applyMusicState();

  // Reset button
  const resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    const confirmMsg = getCurrentLang() === 'pt' ? 'Deseja reiniciar o jogo?' : 'Do you want to reset the game?';
    if (!confirm(confirmMsg)) return;
    resetGame();
    updateUI();
  });

  // Income breakdown: clicking the "Renda / s" label shows detailed contributions per item
  (function wireIncomeBreakdown() {
    const incomeLabelEl = document.getElementById('label-income');
    const incomeValueEl = document.getElementById('income');
    if (!incomeLabelEl || !incomeValueEl) return;
    incomeLabelEl.style.cursor = 'pointer';
    incomeLabelEl.title = getCurrentLang() === 'pt' ? 'Clique para ver a origem da renda por jogo' : 'Click to view income source per game';

    incomeLabelEl.addEventListener('click', () => {
      try {
        const s = getState();
        const muts = s.mutations || {};
        const lines = [];
        let total = 0;
        ITEMS.forEach(it => {
          const baseCount = s.counts[it.id] || 0;
          let contrib = baseCount * (it.income || 0);
          const itemMuts = muts[it.id] || { gold:0, diamond:0, night:0, obsidian:0 };
          if (itemMuts.gold) contrib += itemMuts.gold * (it.income || 0) * 1.25;
          if (itemMuts.diamond) contrib += itemMuts.diamond * (it.income || 0) * 1.5;
          if (itemMuts.night) contrib += itemMuts.night * (it.income || 0) * 2.0;
          if (itemMuts.obsidian) contrib += itemMuts.obsidian * (it.income || 0) * 4.0;
          if (contrib > 0) {
            lines.push(`${it.name} (${it.id}): ${fmt(contrib)}/s`);
            total += contrib;
          }
        });
        // apply multiplier note
        const multiplier = s.multiplier || 1;
        const header = getCurrentLang() === 'pt' ? 'Origem da Renda por jogo:' : 'Income source per game:';
        const multNote = multiplier !== 1 ? (getCurrentLang() === 'pt' ? `\n\nMultiplicador global aplicado: x${multiplier} (total mostrado sem multiplicador)` : `\n\nGlobal multiplier applied: x${multiplier} (listed amounts are base contributions)` ) : '';
        if (lines.length === 0) {
          alert(getCurrentLang() === 'pt' ? 'Nenhum jogo está gerando renda agora.' : 'No game is generating income right now.');
        } else {
          // show base total and what UI shows (with multiplier)
          const baseTotalText = getCurrentLang() === 'pt' ? `Total (base): ${fmt(total)}/s` : `Total (base): ${fmt(total)}/s`;
          const shownTotal = total * multiplier;
          const shownTotalText = getCurrentLang() === 'pt' ? `Total (com multiplicador x${multiplier}): ${fmt(shownTotal)}/s` : `Total (with multiplier x${multiplier}): ${fmt(shownTotal)}/s`;
          alert(`${header}\n\n${lines.join('\n')}\n\n${baseTotalText}\n${shownTotalText}${multNote}`);
        }
      } catch (e) {
        console.error('Income breakdown error', e);
      }
    });
  })();

  // Rebirth
  const rebirthBtn = document.getElementById('rebirth');
  if (rebirthBtn) rebirthBtn.addEventListener('click', () => {
    if (getState().money < 750000) {
      return alert(getCurrentLang() === 'pt' ? 'Você não tem dinheiro suficiente!' : 'You do not have enough money!');
    }
    const confirmMsg = getCurrentLang() === 'pt'
      ? 'Renascer resetará tudo e dará +1 multiplicador. Continuar?'
      : 'Rebirth will reset everything and give +1 multiplier. Continue?';
    if (!confirm(confirmMsg)) return;
    doRebirth();
    updateUI();
  });

  // Language selector
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = getCurrentLang();
    langSelect.addEventListener('change', (e) => {
      const newLang = e.target.value;
      setLangInternal(newLang);
      const shopEl = document.getElementById('shop');
      const shopVisible = shopEl && !shopEl.classList.contains('hidden');
      const toggleShopBtn = document.getElementById('toggleShop');
      if (toggleShopBtn) {
        toggleShopBtn.textContent = shopVisible ? TRANSLATIONS[newLang].closeShop : TRANSLATIONS[newLang].openShop;
      }
      const shopTitleEl = document.getElementById('shopTitle');
      if (shopTitleEl) shopTitleEl.textContent = TRANSLATIONS[newLang].shopTitle;
      const searchEl = document.getElementById('shopSearch');
      if (searchEl) searchEl.placeholder = newLang === 'pt' ? 'Pesquisar jogos...' : 'Search games...';
      const leaderboardTitleEl = document.getElementById('leaderboardTitle');
      if (leaderboardTitleEl) leaderboardTitleEl.textContent = TRANSLATIONS[newLang].leaderboardTitle;
      const petShopEl = document.getElementById('petShop');
      const petShopVisible = petShopEl && !petShopEl.classList.contains('hidden');
      const togglePetBtn = document.getElementById('togglePetShop');
      if (togglePetBtn) togglePetBtn.textContent = petShopVisible ? TRANSLATIONS[newLang].closePetShop : TRANSLATIONS[newLang].openPetShop;

      updateUI();
      applyTranslationsToShopButtons();
    });
  }

  // Toggle shop button
  const toggleShopBtn = document.getElementById('toggleShop');
  if (toggleShopBtn) {
    toggleShopBtn.addEventListener('click', () => {
      const s = document.getElementById('shop');
      const nowHidden = s.classList.toggle('hidden');
      if (!nowHidden) {
        renderShopImpl();
        const sc = document.getElementById('shopControls');
        if (sc) sc.style.display = 'flex';
      } else {
        const sc = document.getElementById('shopControls');
        if (sc) sc.style.display = 'none';
      }
      const currentLang = getCurrentLang();
      toggleShopBtn.textContent = s.classList.contains('hidden') ? TRANSLATIONS[currentLang].openShop : TRANSLATIONS[currentLang].closeShop;
      updateUI();
    });
    toggleShopBtn.textContent = getTranslations().openShop;
  }

  // Toggle pet shop
  const togglePetShopBtn = document.getElementById('togglePetShop');
  const petShopElRef = document.getElementById('petShop');
  if (togglePetShopBtn && petShopElRef) {
    togglePetShopBtn.addEventListener('click', () => {
      const nowHidden = petShopElRef.classList.toggle('hidden');
      if (!nowHidden) renderPetShopImpl();
      const currentLang = getCurrentLang();
      togglePetShopBtn.textContent = petShopElRef.classList.contains('hidden') ? TRANSLATIONS[currentLang].openPetShop : TRANSLATIONS[currentLang].closePetShop;
      updateUI();
    });
    togglePetShopBtn.textContent = getTranslations().openPetShop;
  }

  // Toggle mutation shop
  const toggleMutShopBtn = document.getElementById('toggleMutShop');
  const mutationShopEl = document.getElementById('mutationShop');
  if (toggleMutShopBtn && mutationShopEl) {
    toggleMutShopBtn.textContent = 'Abrir Loja de Mutação';
    toggleMutShopBtn.addEventListener('click', () => {
      const nowHidden = mutationShopEl.classList.toggle('hidden');
      if (!nowHidden) {
        import('./mutation-shop.js').then(m => {
          if (m.renderMutationShop) m.renderMutationShop();
        }).catch(()=>{});
      }
      toggleMutShopBtn.textContent = mutationShopEl.classList.contains('hidden') ? 'Abrir Loja de Mutação' : 'Fechar Loja de Mutação';
      updateUI();
    });
  }

  // Redeem-code button: enter a code to receive rewards (single-use per code per client)
  const redeemBtn = document.getElementById('redeemCodeBtn');
  if (redeemBtn) {
    redeemBtn.addEventListener('click', () => {
      const code = prompt(getCurrentLang() === 'pt' ? 'Digite o código:' : 'Enter code:');
      if (!code) return;
      const normalized = String(code).trim();
      try {
        const raw = localStorage.getItem('usedCodes');
        const used = raw ? JSON.parse(raw) : {};
        // first special code: sanscomhebraico -> grant 1 Undertale (only once)
        if (normalized.toLowerCase() === 'sanscomhebraico') {
          // grant one undertale to local state (unlimited uses allowed)
          import('./game.js').then(m => {
            const state = getState();
            state.counts = state.counts || {};
            state.counts['undertale'] = (state.counts['undertale'] || 0) + 1;
            // update UI and notify (do not mark as used; unlimited uses allowed)
            updateUI();
            alert(getCurrentLang() === 'pt' ? 'Você recebeu 1 Undertale! (Código aplicado)' : 'You received 1 Undertale! (Code applied)');
          }).catch(() => {
            alert(getCurrentLang() === 'pt' ? 'Erro ao aplicar o código.' : 'Error applying code.');
          });
          return;
        }

        // second special code: FLEERYZOEIRO -> grant +1 money
        if (normalized.toLowerCase() === 'fleeryzoeiro') {
          import('./game.js').then(m => {
            const state = getState();
            state.money = (Number(state.money) || 0) + 1;
            updateUI();
            alert(getCurrentLang() === 'pt' ? 'Você recebeu +1 de dinheiro! (Código aplicado)' : 'You received +1 money! (Code applied)');
          }).catch(() => {
            alert(getCurrentLang() === 'pt' ? 'Erro ao aplicar o código.' : 'Error applying code.');
          });
          return;
        }

        // third special code: Chocolete -> grant 1 Five Nights at Freddy 4 (fnaf4)
        if (normalized.toLowerCase() === 'chocolete') {
          import('./game.js').then(m => {
            const state = getState();
            state.counts = state.counts || {};
            state.counts['fnaf4'] = (state.counts['fnaf4'] || 0) + 1;
            updateUI();
            alert(getCurrentLang() === 'pt' ? 'Você recebeu 1 Five Nights at Freddy 4! (Código aplicado)' : 'You received 1 Five Nights at Freddy 4! (Code applied)');
          }).catch(() => {
            alert(getCurrentLang() === 'pt' ? 'Erro ao aplicar o código.' : 'Error applying code.');
          });
          return;
        }

        // new special code: flowerscomhebrico -> grant 5 Undertale copies
        if (normalized.toLowerCase() === 'flowerscomhebrico') {
          import('./game.js').then(m => {
            const state = getState();
            state.counts = state.counts || {};
            state.counts['undertale'] = (state.counts['undertale'] || 0) + 5;
            updateUI();
            alert(getCurrentLang() === 'pt' ? 'Você recebeu 5 Undertale(s)! (Código aplicado)' : 'You received 5 Undertale(s)! (Code applied)');
          }).catch(() => {
            alert(getCurrentLang() === 'pt' ? 'Erro ao aplicar o código.' : 'Error applying code.');
          });
          return;
        }

        // generic fallback for unknown codes
        alert(getCurrentLang() === 'pt' ? 'Código inválido.' : 'Invalid code.');
      } catch (e) {
        console.error('Redeem code error', e);
        alert(getCurrentLang() === 'pt' ? 'Erro ao processar o código.' : 'Error processing code.');
      }
    });
  }

}

// tombstones for UI responsibilities moved out:
// removed large wiring for admin panel, account overlay management, and other helpers (moved to main.js or modular files).

