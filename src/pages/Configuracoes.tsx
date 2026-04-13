import { useState } from 'react';
import { Save, Settings } from 'lucide-react';
import { getAdicionalHE, setAdicionalHE } from '../hooks/useConfigHE';

export default function Configuracoes() {
  const [adicional, setAdicional] = useState(() => getAdicionalHE());
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    const v = Math.max(0, Math.round(adicional));
    setAdicional(v);
    setAdicionalHE(v);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  const multiplicador = 1 + adicional / 100;
  const valorHoraEx = (100 / 8) * multiplicador;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Configurações</h2>
      </div>

      <div className="card card-body" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Settings size={18} color="#1e3a5f" />
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>Horas Extras</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">
            Adicional sobre o valor da hora normal (%)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              className="form-input"
              style={{ width: 120 }}
              min={0}
              max={200}
              step={5}
              value={adicional}
              onChange={e => { setAdicional(Number(e.target.value)); setSalvo(false); }}
            />
            <span style={{ fontSize: 13, color: '#64748b' }}>
              → multiplicador: <strong>{multiplicador.toFixed(2)}×</strong>
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            0% = sem adicional (proporcional puro) · 50% = CLT dia normal · 100% = CLT domingo/feriado
          </p>
        </div>

        <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569', marginBottom: 20 }}>
          Exemplo com diária de R$ 300,00: hora normal = R$ {(300 / 8).toFixed(2)} → hora extra ={' '}
          <strong style={{ color: '#1e3a5f' }}>R$ {(300 / 8 * multiplicador).toFixed(2)}</strong>
          {adicional > 0 && <span style={{ color: '#059669' }}> (+{adicional}%)</span>}
        </div>

        <button onClick={salvar} className="btn btn-primary" style={{ gap: 8 }}>
          <Save size={15} /> Salvar configuração
        </button>

        {salvo && (
          <div className="alert alert-success" style={{ marginTop: 12, marginBottom: 0 }}>
            ✅ Configuração salva com sucesso.
          </div>
        )}
      </div>
    </div>
  );
}
