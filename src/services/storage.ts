import type { Funcionario, Obra, Presenca } from '../types';
import { mockFuncionarios, mockObras, mockPresencas } from '../data/mock';

const KEYS = { funcionarios: 'co_funcionarios', obras: 'co_obras', presencas: 'co_presencas' };

function load<T>(key: string, fallback: T[]): T[] {
  const raw = sessionStorage.getItem(key);
  if (raw) return JSON.parse(raw);
  sessionStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}

function save<T>(key: string, data: T[]) {
  sessionStorage.setItem(key, JSON.stringify(data));
}

export const db = {
  getFuncionarios: (): Funcionario[] => load(KEYS.funcionarios, mockFuncionarios),
  getObras: (): Obra[] => load(KEYS.obras, mockObras),
  getPresencas: (): Presenca[] => load(KEYS.presencas, mockPresencas),

  saveFuncionario(f: Funcionario) {
    const list = db.getFuncionarios();
    const idx = list.findIndex(x => x.id === f.id);
    if (idx >= 0) list.splice(idx, 1, f); else list.push(f);
    save(KEYS.funcionarios, list);
  },

  savePresenca(p: Presenca) {
    const list = db.getPresencas();
    const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) list.splice(idx, 1, p); else list.push(p);
    save(KEYS.presencas, list);
  },

  deletePresenca(id: string) {
    save(KEYS.presencas, db.getPresencas().filter(p => p.id !== id));
  },
};

export function calcCustoDiario(f: Funcionario, status: Presenca['status']) {
  const diaria = status === 'meio-periodo' ? f.diaria / 2 : f.diaria;
  return { diaria, transporte: f.transporte, alimentacao: f.alimentacao, total: diaria + f.transporte + f.alimentacao };
}

export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
