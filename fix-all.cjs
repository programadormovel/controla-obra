const fs = require('fs');

fs.writeFileSync('src/types/index.ts', `export type Funcionario = {
  id: string;
  nome: string;
  funcao: string;
  diaria: number;
  transporte: number;
  alimentacao: number;
  telefone: string;
  ativo: boolean;
};

export type Obra = {
  id: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  ativa: boolean;
};

export type Presenca = {
  id: string;
  funcionarioId: string;
  obraId: string;
  data: string;
  horaEntrada: string;
  horaSaida?: string;
  lat: number;
  lng: number;
  distanciaObra: number;
  status: 'presente' | 'ausente' | 'meio-periodo';
};
`, { encoding: 'utf8' });

fs.writeFileSync('src/data/mock.ts', `import type { Funcionario, Obra, Presenca } from '../types';

export const mockFuncionarios: Funcionario[] = [
  { id: 'f1', nome: 'Carlos Silva', funcao: 'Pedreiro', diaria: 180, transporte: 20, alimentacao: 25, telefone: '11999990001', ativo: true },
  { id: 'f2', nome: 'Joao Souza', funcao: 'Servente', diaria: 130, transporte: 20, alimentacao: 25, telefone: '11999990002', ativo: true },
  { id: 'f3', nome: 'Pedro Lima', funcao: 'Eletricista', diaria: 220, transporte: 25, alimentacao: 25, telefone: '11999990003', ativo: true },
  { id: 'f4', nome: 'Marcos Rocha', funcao: 'Encanador', diaria: 200, transporte: 25, alimentacao: 25, telefone: '11999990004', ativo: true },
  { id: 'f5', nome: 'Andre Costa', funcao: 'Pintor', diaria: 160, transporte: 20, alimentacao: 25, telefone: '11999990005', ativo: true },
];

export const mockObras: Obra[] = [
  { id: 'o1', nome: 'Residencia Jardins', endereco: 'Rua das Flores, 123 - Jardins', lat: -23.5614, lng: -46.6558, ativa: true },
  { id: 'o2', nome: 'Comercial Centro', endereco: 'Av. Paulista, 456 - Centro', lat: -23.5629, lng: -46.6544, ativa: true },
  { id: 'o3', nome: 'Reforma Moema', endereco: 'Rua Irai, 789 - Moema', lat: -23.6012, lng: -46.6658, ativa: true },
];

const hoje = new Date().toISOString().split('T')[0];
const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

export const mockPresencas: Presenca[] = [
  { id: 'p1', funcionarioId: 'f1', obraId: 'o1', data: hoje, horaEntrada: '07:30', lat: -23.5614, lng: -46.6558, distanciaObra: 45, status: 'presente' },
  { id: 'p2', funcionarioId: 'f2', obraId: 'o1', data: hoje, horaEntrada: '07:45', lat: -23.5615, lng: -46.6559, distanciaObra: 62, status: 'presente' },
  { id: 'p3', funcionarioId: 'f3', obraId: 'o2', data: hoje, horaEntrada: '08:00', lat: -23.5630, lng: -46.6545, distanciaObra: 30, status: 'presente' },
  { id: 'p4', funcionarioId: 'f1', obraId: 'o1', data: ontem, horaEntrada: '07:30', horaSaida: '17:00', lat: -23.5614, lng: -46.6558, distanciaObra: 40, status: 'presente' },
  { id: 'p5', funcionarioId: 'f2', obraId: 'o2', data: ontem, horaEntrada: '08:00', horaSaida: '12:00', lat: -23.5629, lng: -46.6544, distanciaObra: 55, status: 'meio-periodo' },
];
`, { encoding: 'utf8' });

fs.writeFileSync('src/services/storage.ts', `import type { Funcionario, Obra, Presenca } from '../types';
import { mockFuncionarios, mockObras, mockPresencas } from '../data/mock';

const KEYS = { funcionarios: 'co_funcionarios', obras: 'co_obras', presencas: 'co_presencas' };

function load<T>(key: string, fallback: T[]): T[] {
  const raw = sessionStorage.getItem(key);
  if (raw) return JSON.parse(raw) as T[];
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
    idx >= 0 ? list.splice(idx, 1, f) : list.push(f);
    save(KEYS.funcionarios, list);
  },

  savePresenca(p: Presenca) {
    const list = db.getPresencas();
    const idx = list.findIndex(x => x.id === p.id);
    idx >= 0 ? list.splice(idx, 1, p) : list.push(p);
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
`, { encoding: 'utf8' });

fs.writeFileSync('src/pages/Funcionarios.tsx', `import { useState } from 'react';
import { db } from '../services/storage';
import type { Funcionario } from '../types';
import { Plus, Edit2, Save, X } from 'lucide-react';

const vazio: Omit<Funcionario, 'id'> = { nome: '', funcao: '', diaria: 0, transporte: 0, alimentacao: 0, telefone: '', ativo: true };

export default function Funcionarios() {
  const [lista, setLista] = useState(() => db.getFuncionarios());
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState<Omit<Funcionario, 'id'>>(vazio);

  function salvar() {
    const f: Funcionario = editando ? { ...form, id: editando.id } : { ...form, id: 'f' + Date.now() };
    db.saveFuncionario(f);
    setLista(db.getFuncionarios());
    setEditando(null);
    setNovo(false);
    setForm(vazio);
  }

  function iniciarEdicao(f: Funcionario) {
    setEditando(f);
    setNovo(false);
    setForm({ nome: f.nome, funcao: f.funcao, diaria: f.diaria, transporte: f.transporte, alimentacao: f.alimentacao, telefone: f.telefone, ativo: f.ativo });
  }

  const inputStyle = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

  const FormRow = () => (
    <tr style={{ background: '#f0f9ff' }}>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} placeholder="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} placeholder="Funcao" value={form.funcao} onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} type="number" placeholder="0" value={form.diaria || ''} onChange={e => setForm(f => ({ ...f, diaria: +e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} type="number" placeholder="0" value={form.transporte || ''} onChange={e => setForm(f => ({ ...f, transporte: +e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} type="number" placeholder="0" value={form.alimentacao || ''} onChange={e => setForm(f => ({ ...f, alimentacao: +e.target.value }))} /></td>
      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e3a5f' }}>R$ {(form.diaria + form.transporte + form.alimentacao).toFixed(2)}</td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} placeholder="Telefone" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}>
        <button onClick={salvar} style={{ marginRight: 6, padding: '4px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}><Save size={12} /></button>
        <button onClick={() => { setEditando(null); setNovo(false); setForm(vazio); }} style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}><X size={12} /></button>
      </td>
    </tr>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#1e293b' }}>Funcionarios</h2>
        <button onClick={() => { setNovo(true); setEditando(null); setForm(vazio); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          <Plus size={16} /> Novo Funcionario
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px #0001', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Nome', 'Funcao', 'Diaria (R$)', 'Transporte (R$)', 'Alimentacao (R$)', 'Custo Total', 'Telefone', 'Acoes'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {novo && <FormRow />}
            {lista.map(f => editando?.id === f.id ? <FormRow key={f.id} /> : (
              <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: f.ativo ? 1 : 0.5 }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{f.nome}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{f.funcao}</td>
                <td style={{ padding: '10px 12px' }}>R$ {f.diaria.toFixed(2)}</td>
                <td style={{ padding: '10px 12px' }}>R$ {f.transporte.toFixed(2)}</td>
                <td style={{ padding: '10px 12px' }}>R$ {f.alimentacao.toFixed(2)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e3a5f' }}>R$ {(f.diaria + f.transporte + f.alimentacao).toFixed(2)}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{f.telefone}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => iniciarEdicao(f)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    <Edit2 size={12} /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`, { encoding: 'utf8' });

console.log('ok');
