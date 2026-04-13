const KEY = 'co_config_he_adicional';
const PADRAO = 0;

export function getAdicionalHE(): number {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return PADRAO;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : PADRAO;
}

export function setAdicionalHE(valor: number) {
  localStorage.setItem(KEY, String(valor));
}

export function multiplicadorHE(): number {
  return 1 + getAdicionalHE() / 100;
}
