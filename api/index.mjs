import sql from 'mssql';
import express from 'express';
import { memoryStorage } from 'multer';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { createHash } from 'crypto';
import serverless from 'serverless-http';

const app = express();
app.use(express.json());

// ── Multer: armazena em memória (Vercel não tem disco persistente) ──────────
const upload = multer({ storage: memoryStorage() });

// ── E-mail ──────────────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'seu-email@gmail.com',
    pass: process.env.SMTP_PASS || 'sua-senha-app',
  },
});

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}
function gerarSenhaAleatoria() {
  return Math.random().toString(36).slice(2, 10);
}

// ── SQL Server ───────────────────────────────────────────────────────────────
const dbConfig = {
  server: process.env.DB_SERVER || 'ControleObra.mssql.somee.com',
  database: process.env.DB_NAME || 'ControleObra',
  user: process.env.DB_USER || 'controleobras',
  password: process.env.DB_PASS || '12345678',
  options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool = null;
async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(dbConfig).connect();
  pool.on('error', err => { console.error('[Pool error]', err.message); pool = null; });
  return pool;
}

function toTimeDate(hms) {
  if (!hms) return null;
  const parts = String(hms).split(':').map(Number);
  return new Date(1970, 0, 1, parts[0] || 0, parts[1] || 0, parts[2] || 0);
}

// ── Rotas ────────────────────────────────────────────────────────────────────

app.post('/login', async (req, res) => {
  const { login, senhaHash } = req.body;
  const p = await getPool();
  const r = await p.request()
    .input('Login', sql.VarChar(50), login)
    .input('SenhaHash', sql.VarChar(64), senhaHash)
    .execute('sp_Login');
  const user = r.recordset[0];
  if (!user) return res.status(401).json({ error: 'Credenciais invalidas' });
  res.json(user);
});

app.get('/funcionarios', async (_req, res) => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM Funcionario ORDER BY Nome');
  res.json(r.recordset);
});

app.post('/funcionarios', async (req, res) => {
  const f = req.body;
  const p = await getPool();
  await p.request()
    .input('Id',          sql.VarChar(36),    f.id)
    .input('Nome',        sql.NVarChar(100),  f.nome)
    .input('Funcao',      sql.NVarChar(60),   f.funcao)
    .input('Diaria',      sql.Decimal(10, 2), f.diaria)
    .input('Transporte',  sql.Decimal(10, 2), f.transporte)
    .input('Alimentacao', sql.Decimal(10, 2), f.alimentacao)
    .input('Telefone',    sql.VarChar(20),    f.telefone)
    .input('Ativo',       sql.Bit,            f.ativo ? 1 : 0)
    .input('ObraId',      sql.VarChar(36),    f.obraId || null)
    .execute('sp_SalvarFuncionario');
  res.json({ ok: true });
});

app.delete('/funcionarios/:id', async (req, res) => {
  const p = await getPool();
  const check = await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('SELECT COUNT(*) AS total FROM Presenca WHERE FuncionarioId = @Id');
  if (check.recordset[0].total > 0)
    return res.status(409).json({ error: 'Funcionario possui presencas cadastradas.' });
  await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('DELETE FROM Funcionario WHERE Id = @Id');
  res.json({ ok: true });
});

app.get('/obras', async (_req, res) => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM Obra ORDER BY Nome');
  res.json(r.recordset);
});

app.post('/obras', async (req, res) => {
  const o = req.body;
  const p = await getPool();
  await p.request()
    .input('Id',       sql.VarChar(36),   o.id)
    .input('Nome',     sql.NVarChar(100), o.nome)
    .input('Endereco', sql.NVarChar(200), o.endereco)
    .input('Lat',      sql.Decimal(10,7), o.lat)
    .input('Lng',      sql.Decimal(10,7), o.lng)
    .input('Ativa',    sql.Bit,           o.ativa ? 1 : 0)
    .execute('sp_SalvarObra');
  res.json({ ok: true });
});

app.delete('/obras/:id', async (req, res) => {
  const p = await getPool();
  const check = await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('SELECT COUNT(*) AS total FROM Presenca WHERE ObraId = @Id');
  if (check.recordset[0].total > 0)
    return res.status(409).json({ error: 'Obra possui presencas cadastradas.' });
  await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('DELETE FROM Obra WHERE Id = @Id');
  res.json({ ok: true });
});

app.get('/presencas', async (req, res) => {
  const { data, funcionarioId, de, ate } = req.query;
  const p = await getPool();
  let q = 'SELECT * FROM vw_PresencaCompleta WHERE 1=1';
  const req2 = p.request();
  if (data)         { q += ' AND Data = @Data';            req2.input('Data',   sql.Date,        data); }
  if (de)           { q += ' AND Data >= @De';             req2.input('De',     sql.Date,        de); }
  if (ate)          { q += ' AND Data <= @Ate';            req2.input('Ate',    sql.Date,        ate); }
  if (funcionarioId){ q += ' AND FuncionarioId = @FuncId'; req2.input('FuncId', sql.VarChar(36), funcionarioId); }
  q += ' ORDER BY Data DESC, HoraEntrada';
  const r = await req2.query(q);
  res.json(r.recordset);
});

app.post('/presencas', async (req, res) => {
  const b = req.body;
  const p = await getPool();
  const jaExiste = await p.request().input('Id', sql.VarChar(36), b.id)
    .query('SELECT Id FROM Presenca WHERE Id = @Id');
  if (jaExiste.recordset.length > 0) {
    await p.request()
      .input('Id',            sql.VarChar(36), b.id)
      .input('HoraSaida',     sql.Time,        toTimeDate(b.horaSaida))
      .input('Status',        sql.VarChar(15), b.status)
      .input('DistanciaObra', sql.Int,         b.distanciaObra)
      .query('UPDATE Presenca SET HoraSaida=@HoraSaida, Status=@Status, DistanciaObra=@DistanciaObra WHERE Id=@Id');
  } else {
    await p.request()
      .input('Id',            sql.VarChar(36),    b.id)
      .input('FuncionarioId', sql.VarChar(36),    b.funcionarioId)
      .input('ObraId',        sql.VarChar(36),    b.obraId)
      .input('Data',          sql.Date,           b.data)
      .input('HoraEntrada',   sql.Time,           toTimeDate(b.horaEntrada))
      .input('Lat',           sql.Decimal(10, 7), b.lat)
      .input('Lng',           sql.Decimal(10, 7), b.lng)
      .input('DistanciaObra', sql.Int,            b.distanciaObra)
      .input('Status',        sql.VarChar(15),    b.status)
      .query(`INSERT INTO Presenca (Id,FuncionarioId,ObraId,Data,HoraEntrada,Lat,Lng,DistanciaObra,Status)
              VALUES (@Id,@FuncionarioId,@ObraId,@Data,@HoraEntrada,@Lat,@Lng,@DistanciaObra,@Status)`);
  }
  res.json({ ok: true });
});

app.delete('/presencas/:id', async (req, res) => {
  const p = await getPool();
  await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('DELETE FROM Presenca WHERE Id = @Id');
  res.json({ ok: true });
});

// POST /presencas/:id/foto — multer em memória, salva no Vercel Blob ou retorna URL base64
app.post('/presencas/:id/foto', upload.single('foto'), async (req, res) => {
  const presencaId = req.params.id;
  const tipo = req.body.tipo || 'entrada';
  if (!req.file) return res.status(400).json({ error: 'Foto ausente' });

  // Vercel não tem disco persistente: armazena como base64 data URL no banco
  const dataUrl = `data:image/jpeg;base64,${req.file.buffer.toString('base64')}`;
  const col = tipo === 'entrada' ? 'FotoEntrada' : 'FotoSaida';
  const p = await getPool();
  await p.request()
    .input('Id',  sql.VarChar(36),   presencaId)
    .input('Url', sql.VarChar(8000), dataUrl)
    .query(`UPDATE Presenca SET ${col} = @Url WHERE Id = @Id`);

  res.json({ url: dataUrl });
});

app.get('/usuarios', async (_req, res) => {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT u.Id, u.Login, u.Email, u.Ativo, u.FuncionarioId,
           pf.Nome AS Perfil, f.Nome AS FuncionarioNome
    FROM Usuario u
    JOIN Perfil pf ON pf.Id = u.PerfilId
    LEFT JOIN Funcionario f ON f.Id = u.FuncionarioId
    ORDER BY u.Login
  `);
  res.json(r.recordset);
});

app.post('/usuarios', async (req, res) => {
  const b = req.body;
  const p = await getPool();
  const perfilId = b.perfil === 'admin' ? 1 : 2;
  await p.request()
    .input('Id',            sql.VarChar(36),  b.id)
    .input('Login',         sql.VarChar(50),  b.login)
    .input('Email',         sql.VarChar(100), b.email || null)
    .input('PerfilId',      sql.TinyInt,      perfilId)
    .input('FuncionarioId', sql.VarChar(36),  b.funcionarioId || null)
    .input('SenhaHash',     sql.VarChar(64),  b.senhaHash || null)
    .input('Ativo',         sql.Bit,          b.ativo ? 1 : 0)
    .execute('sp_SalvarUsuario');
  res.json({ ok: true });
});

app.delete('/usuarios/:id', async (req, res) => {
  const p = await getPool();
  await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('DELETE FROM Usuario WHERE Id = @Id');
  res.json({ ok: true });
});

app.post('/usuarios/:id/reset-senha', async (req, res) => {
  const p = await getPool();
  const r = await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('SELECT Login, Email FROM Usuario WHERE Id = @Id AND Ativo = 1');
  const user = r.recordset[0];
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (!user.Email) return res.status(400).json({ error: 'Usuário não possui e-mail cadastrado.' });
  const novaSenha = gerarSenhaAleatoria();
  const hash = sha256(novaSenha);
  await p.request().input('Id', sql.VarChar(36), req.params.id).input('Hash', sql.VarChar(64), hash)
    .query('UPDATE Usuario SET SenhaHash = @Hash WHERE Id = @Id');
  await mailer.sendMail({
    from: `"Controla Obra" <${process.env.SMTP_USER || 'noreply@controlaobra.com'}>`,
    to: user.Email,
    subject: 'Sua nova senha - Controla Obra',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1e3a5f">Controla Obra</h2>
      <p>Olá, <strong>${user.Login}</strong>!</p>
      <p>Sua senha foi redefinida:</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px 24px;font-size:24px;font-weight:700;letter-spacing:4px;text-align:center;color:#1e3a5f">${novaSenha}</div>
      <p style="color:#64748b;font-size:13px;margin-top:16px">Altere sua senha após o primeiro acesso.</p>
    </div>`,
  });
  res.json({ ok: true });
});

app.get('/relatorio', async (req, res) => {
  const { dataInicio, dataFim, obraId } = req.query;
  const p = await getPool();
  const r = await p.request()
    .input('DataInicio', sql.Date,        dataInicio)
    .input('DataFim',    sql.Date,        dataFim)
    .input('ObraId',     sql.VarChar(36), obraId || null)
    .execute('sp_RelatorioCusto');
  res.json(r.recordset);
});

// ── Erro global ──────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: err.message });
});

export default serverless(app);
