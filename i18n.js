import { TRANSLATIONS } from './data.js';

let currentLang = 'pt';

export function getCurrentLang() {
  return currentLang;
}

export function setCurrentLang(lang) {
  currentLang = TRANSLATIONS[lang] ? lang : 'pt';
}

export function getTranslations() {
  return TRANSLATIONS[currentLang];
}