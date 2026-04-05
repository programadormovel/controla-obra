import { useState } from 'react';
import { db } from '../services/storage';
import type { Funcionario } from '../types';
import { Plus, Edit2, Save, X } from 'lucide-react';

const vazio: Omit<Funcionario, 'id'> = { nome: '', funcao: '', diaria: 0, transporte: 0, alimentacao: 0, telefone: '', ativo: true };

const inputStyle = { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
const thStyle = { padding: '10px 12px', textAlign: 'left' as const, color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' as const };

export default function Funcionarios() {
  const [lista, setLista] = useState(() => db.getFuncionarios());
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState<Omit<Funcionario, 'id'>>(vazio);

  function salvar() {
    const f: Funcionario = editando ? { ...form, id: editando.id } : { ...form, id: `f${Date.now()}` };
    db.saveFuncionario(f);
    setLista(db.getFuncionarios());
    setEditando(null);
    setNovo(false);
    setForm(vazio);
  }

  function cancelar() {
    setEditando(null);
    setNovo(false);
    setForm(vazio);
  }

  function iniciarEdicao(f: Funcionario) {
    setEditando(f);
    setNovo(false);
    setForm({ nome: f.nome, funcao: f.funcao, diaria: f.diaria, transporte: f.transporte, alimentacao: f.alimentacao, telefone: f.telefone, ativo: f.ativo });
  }

  const formRow = (key?: string) => (
    <tr key={key} style={{ background: '#f0f9ff' }}>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} placeholder="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} placeholder="Funcao" value={form.funcao} onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} type="number" placeholder="0" value={form.diaria || ''} onChange={e => setForm(f => ({ ...f, diaria: +e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} type="number" placeholder="0" value={form.transporte || ''} onChange={e => setForm(f => ({ ...f, transporte: +e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} type="number" placeholder="0" value={form.alimentacao || ''} onChange={e => setForm(f => ({ ...f, alimentacao: +e.target.value }))} /></td>
      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e3a5f' }}>R$ {(form.diaria + form.transporte + form.alimentacao).toFixed(2)}</td>
      <td style={{ padding: '8px 12px' }}><input style={inputStyle} placeholder="Telefone" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></td>
      <td style={{ padding: '8px 12px' }}>
        <button onClick={salvar} style={{ marginRight: 6, padding: '4px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}><Save size={12} /></button>
        <button onClick={cancelar} style={{ padding: '4px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}><X size={12} /></button>
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
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {novo && formRow('novo')}
            {lista.map(f => editando?.id === f.id ? formRow(f.id) : (
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
