import { fmt, getState } from './game.js';
import { getCurrentLang } from './i18n.js';
import { TRANSLATIONS } from './data.js';

const leaderboardEl = document.getElementById('leaderboard');
const leaderboardTitleEl = document.getElementById('leaderboardTitle');

export function updateLeaderboard() {
  if (!leaderboardEl) return;

  const currentLang = getCurrentLang();
  const T = TRANSLATIONS[currentLang];

  let account = null;
  try {
    const rawAcc = localStorage.getItem('gameAccount');
    if (rawAcc) account = JSON.parse(rawAcc);
  } catch (_) {
    account = null;
  }

  let lb = [];
  try {
    const rawLb = localStorage.getItem('leaderboard');
    if (rawLb) lb = JSON.parse(rawLb) || [];
  } catch (_) {
    lb = [];
  }

  const state = getState();
  if (account && account.name) {
    const idx = lb.findIndex((e) => e.name === account.name);
    if (idx === -1) {
      lb.push({
        name: account.name,
        gender: account.gender || 'outro',
        money: state.money,
      });
    } else {
      lb[idx].money = Math.max(lb[idx].money || 0, state.money);
    }
  }

  // sort by money (highest first) and keep only the top 10 accounts
  lb.sort((a, b) => (b.money || 0) - (a.money || 0));
  const top10 = lb.slice(0, 10);
  try {
    // store only the current top 10
    localStorage.setItem('leaderboard', JSON.stringify(top10));
  } catch (_) {
    // ignore storage errors
  }

  // update title text to current language
  if (leaderboardTitleEl) {
    leaderboardTitleEl.textContent = T.leaderboardTitle;
  }

  leaderboardEl.innerHTML = '';
  if (top10.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'leaderboard-empty';
    empty.textContent =
      currentLang === 'pt' ? 'Nenhum registro ainda.' : 'No records yet.';
    leaderboardEl.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const rankTh = document.createElement('th');
  rankTh.textContent = '#';
  const nameTh = document.createElement('th');
  nameTh.textContent = currentLang === 'pt' ? 'Conta' : 'Account';
  const moneyTh = document.createElement('th');
  moneyTh.textContent = currentLang === 'pt' ? 'Dinheiro' : 'Money';
  headRow.appendChild(rankTh);
  headRow.appendChild(nameTh);
  headRow.appendChild(moneyTh);
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  top10.forEach((entry, index) => {
    const tr = document.createElement('tr');
    const rankTd = document.createElement('td');
    rankTd.textContent = String(index + 1);
    const nameTd = document.createElement('td');
    nameTd.textContent = entry.name;
    const moneyTd = document.createElement('td');
    moneyTd.textContent = fmt(entry.money || 0);
    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(moneyTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  leaderboardEl.appendChild(table);
}