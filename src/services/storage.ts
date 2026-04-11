import type { Funcionario, Obra, Presenca } from '../types';
import { mockFuncionarios, mockObras, mockPresencas } from '../data/mock';
import { api } from './api';

const KEYS = { funcionarios: 'co_funcionarios', obras: 'co_obras', presencas: 'co_presencas' };

function loadLocal<T>(key: string, fallback: T[]): T[] {
  const raw = sessionStorage.getItem(key);
  if (raw) return JSON.parse(raw);
  sessionStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}
function saveLocal<T>(key: string, data: T[]) {
  sessionStorage.setItem(key, JSON.stringify(data));
}

export const db = {
  async getFuncionariosAsync(): Promise<Funcionario[]> {
    try { const l = await api.getFuncionarios(); saveLocal(KEYS.funcionarios, l); return l; }
    catch { return loadLocal(KEYS.funcionarios, mockFuncionarios); }
  },
  async getObrasAsync(): Promise<Obra[]> {
    try { const l = await api.getObras(); saveLocal(KEYS.obras, l); return l; }
    catch { return loadLocal(KEYS.obras, mockObras); }
  },
  async saveObra(o: Obra): Promise<void> {
    await api.saveObra(o);
    const list = loadLocal<Obra>(KEYS.obras, mockObras);
    const idx = list.findIndex(x => x.id === o.id);
    if (idx >= 0) list.splice(idx, 1, o); else list.push(o);
    saveLocal(KEYS.obras, list);
  },
  async deleteObra(id: string): Promise<void> {
    try { await api.deleteObra(id); } catch { /* offline */ }
    saveLocal(KEYS.obras, loadLocal<Obra>(KEYS.obras, mockObras).filter(o => o.id !== id));
  },
  async getPresencasAsync(params?: { data?: string; funcionarioId?: string; de?: string; ate?: string }): Promise<Presenca[]> {
    try { return await api.getPresencas(params); }
    catch {
      return loadLocal<Presenca>(KEYS.presencas, mockPresencas).filter(p =>
        (!params?.data || p.data === params.data) &&
        (!params?.funcionarioId || p.funcionarioId === params.funcionarioId) &&
        (!params?.de  || p.data >= params.de) &&
        (!params?.ate || p.data <= params.ate)
      );
    }
  },
  async saveFuncionario(f: Funcionario): Promise<void> {
    try { await api.saveFuncionario(f); } catch { /* offline */ }
    const list = loadLocal<Funcionario>(KEYS.funcionarios, mockFuncionarios);
    const idx = list.findIndex(x => x.id === f.id);
    if (idx >= 0) list.splice(idx, 1, f); else list.push(f);
    saveLocal(KEYS.funcionarios, list);
  },
  async savePresenca(p: Presenca): Promise<void> {
    try { await api.savePresenca(p); } catch { /* offline */ }
    const list = loadLocal<Presenca>(KEYS.presencas, mockPresencas);
    const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) list.splice(idx, 1, p); else list.push(p);
    saveLocal(KEYS.presencas, list);
  },
  async deleteFuncionario(id: string): Promise<void> {
    try { await api.deleteFuncionario(id); } catch { /* offline */ }
    saveLocal(KEYS.funcionarios, loadLocal<Funcionario>(KEYS.funcionarios, mockFuncionarios).filter(f => f.id !== id));
  },
  async deletePresenca(id: string): Promise<void> {
    try { await api.deletePresenca(id); } catch { /* offline */ }
    saveLocal(KEYS.presencas, loadLocal<Presenca>(KEYS.presencas, mockPresencas).filter(p => p.id !== id));
  },
  getFuncionarios: (): Funcionario[] => loadLocal(KEYS.funcionarios, mockFuncionarios),
  getObras: (): Obra[] => loadLocal(KEYS.obras, mockObras),
  getPresencas: (): Presenca[] => loadLocal(KEYS.presencas, mockPresencas),
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
