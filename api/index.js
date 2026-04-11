const sql        = require('mssql');
const express    = require('express');
const multer     = require('multer');
const nodemailer = require('nodemailer');
const { createHash } = require('crypto');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function sha256(t) { return createHash('sha256').update(t).digest('hex'); }
function gerarSenhaAleatoria() { return Math.random().toString(36).slice(2, 10); }
function toTimeDate(hms) {
  if (!hms) return null;
  const p = String(hms).split(':').map(Number);
  return new Date(1970, 0, 1, p[0]||0, p[1]||0, p[2]||0);
}

const dbConfig = {
  server:   process.env.DB_SERVER   || 'ControleObra.mssql.somee.com',
  database: process.env.DB_NAME     || 'ControleObra',
  user:     process.env.DB_USER     || 'controleobras',
  password: process.env.DB_PASS     || '12345678',
  options:  { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  connectionTimeout: 60000,
  requestTimeout:    60000,
  pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
};

let pool = null;
async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(dbConfig).connect();
  pool.on('error', err => { console.error('[pool]', err.message); pool = null; });
  return pool;
}

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const router = express.Router();

router.post('/login', wrap(async (req, res) => {
  const { login, senhaHash } = req.body;
  console.log('[login] login=%s hash=%s', login, senhaHash);
  const p = await getPool();
  const r = await p.request()
    .input('Login',     sql.VarChar(50), login)
    .input('SenhaHash', sql.VarChar(64), senhaHash)
    .execute('sp_Login');
  const user = r.recordset[0];
  if (!user) return res.status(401).json({ error: 'Credenciais invalidas' });
  res.json(user);
}));

router.get('/funcionarios', wrap(async (_req, res) => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM Funcionario ORDER BY Nome');
  res.json(r.recordset);
}));

router.post('/funcionarios', wrap(async (req, res) => {
  const f = req.body, p = await getPool();
  await p.request()
    .input('Id',          sql.VarChar(36),    f.id)
    .input('Nome',        sql.NVarChar(100),  f.nome)
    .input('Funcao',      sql.NVarChar(60),   f.funcao)
    .input('Diaria',      sql.Decimal(10,2),  f.diaria)
    .input('Transporte',  sql.Decimal(10,2),  f.transporte)
    .input('Alimentacao', sql.Decimal(10,2),  f.alimentacao)
    .input('Telefone',    sql.VarChar(20),    f.telefone)
    .input('Ativo',       sql.Bit,            f.ativo ? 1 : 0)
    .input('ObraId',      sql.VarChar(36),    f.obraId || null)
    .execute('sp_SalvarFuncionario');
  res.json({ ok: true });
}));

router.delete('/funcionarios/:id', wrap(async (req, res) => {
  const p = await getPool();
  const c = await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('SELECT COUNT(*) AS total FROM Presenca WHERE FuncionarioId = @Id');
  if (c.recordset[0].total > 0) return res.status(409).json({ error: 'Funcionario possui presencas cadastradas.' });
  await p.request().input('Id', sql.VarChar(36), req.params.id).query('DELETE FROM Funcionario WHERE Id = @Id');
  res.json({ ok: true });
}));

router.get('/obras', wrap(async (_req, res) => {
  const p = await getPool();
  res.json((await p.request().query('SELECT * FROM Obra ORDER BY Nome')).recordset);
}));

router.post('/obras', wrap(async (req, res) => {
  const o = req.body, p = await getPool();
  await p.request()
    .input('Id',       sql.VarChar(36),   o.id)
    .input('Nome',     sql.NVarChar(100), o.nome)
    .input('Endereco', sql.NVarChar(200), o.endereco)
    .input('Lat',      sql.Decimal(10,7), o.lat)
    .input('Lng',      sql.Decimal(10,7), o.lng)
    .input('Ativa',    sql.Bit,           o.ativa ? 1 : 0)
    .execute('sp_SalvarObra');
  res.json({ ok: true });
}));

router.delete('/obras/:id', wrap(async (req, res) => {
  const p = await getPool();
  const c = await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('SELECT COUNT(*) AS total FROM Presenca WHERE ObraId = @Id');
  if (c.recordset[0].total > 0) return res.status(409).json({ error: 'Obra possui presencas cadastradas.' });
  await p.request().input('Id', sql.VarChar(36), req.params.id).query('DELETE FROM Obra WHERE Id = @Id');
  res.json({ ok: true });
}));

router.get('/presencas', wrap(async (req, res) => {
  const { data, funcionarioId, de, ate } = req.query;
  const p = await getPool();
  let q = 'SELECT * FROM vw_PresencaCompleta WHERE 1=1';
  const r2 = p.request();
  if (data)          { q += ' AND Data = @Data';            r2.input('Data',   sql.Date,        data); }
  if (de)            { q += ' AND Data >= @De';             r2.input('De',     sql.Date,        de); }
  if (ate)           { q += ' AND Data <= @Ate';            r2.input('Ate',    sql.Date,        ate); }
  if (funcionarioId) { q += ' AND FuncionarioId = @FuncId'; r2.input('FuncId', sql.VarChar(36), funcionarioId); }
  q += ' ORDER BY Data DESC, HoraEntrada';
  res.json((await r2.query(q)).recordset);
}));

router.post('/presencas', wrap(async (req, res) => {
  const b = req.body, p = await getPool();
  const existe = await p.request().input('Id', sql.VarChar(36), b.id).query('SELECT Id FROM Presenca WHERE Id = @Id');
  if (existe.recordset.length > 0) {
    await p.request()
      .input('Id',            sql.VarChar(36), b.id)
      .input('HoraSaida',     sql.Time,        toTimeDate(b.horaSaida))
      .input('Status',        sql.VarChar(15), b.status)
      .input('DistanciaObra', sql.Int,         b.distanciaObra)
      .query('UPDATE Presenca SET HoraSaida=@HoraSaida,Status=@Status,DistanciaObra=@DistanciaObra WHERE Id=@Id');
  } else {
    await p.request()
      .input('Id',            sql.VarChar(36),    b.id)
      .input('FuncionarioId', sql.VarChar(36),    b.funcionarioId)
      .input('ObraId',        sql.VarChar(36),    b.obraId)
      .input('Data',          sql.Date,           b.data)
      .input('HoraEntrada',   sql.Time,           toTimeDate(b.horaEntrada))
      .input('Lat',           sql.Decimal(10,7),  b.lat)
      .input('Lng',           sql.Decimal(10,7),  b.lng)
      .input('DistanciaObra', sql.Int,            b.distanciaObra)
      .input('Status',        sql.VarChar(15),    b.status)
      .query('INSERT INTO Presenca(Id,FuncionarioId,ObraId,Data,HoraEntrada,Lat,Lng,DistanciaObra,Status) VALUES(@Id,@FuncionarioId,@ObraId,@Data,@HoraEntrada,@Lat,@Lng,@DistanciaObra,@Status)');
  }
  res.json({ ok: true });
}));

router.delete('/presencas/:id', wrap(async (req, res) => {
  const p = await getPool();
  await p.request().input('Id', sql.VarChar(36), req.params.id).query('DELETE FROM Presenca WHERE Id = @Id');
  res.json({ ok: true });
}));

router.post('/presencas/:id/foto', upload.single('foto'), wrap(async (req, res) => {
  const { id } = req.params;
  const tipo = req.body.tipo || 'entrada';
  if (!req.file) return res.status(400).json({ error: 'Foto ausente' });
  const dataUrl = `data:image/jpeg;base64,${req.file.buffer.toString('base64')}`;
  const col = tipo === 'entrada' ? 'FotoEntrada' : 'FotoSaida';
  const p = await getPool();
  await p.request().input('Id', sql.VarChar(36), id).input('Url', sql.VarChar(8000), dataUrl)
    .query(`UPDATE Presenca SET ${col}=@Url WHERE Id=@Id`);
  res.json({ url: dataUrl });
}));

router.get('/usuarios', wrap(async (_req, res) => {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT u.Id,u.Login,u.Email,u.Ativo,u.FuncionarioId,pf.Nome AS Perfil,f.Nome AS FuncionarioNome
    FROM Usuario u JOIN Perfil pf ON pf.Id=u.PerfilId LEFT JOIN Funcionario f ON f.Id=u.FuncionarioId
    ORDER BY u.Login`);
  res.json(r.recordset);
}));

router.post('/usuarios', wrap(async (req, res) => {
  const b = req.body, p = await getPool();
  await p.request()
    .input('Id',            sql.VarChar(36),  b.id)
    .input('Login',         sql.VarChar(50),  b.login)
    .input('Email',         sql.VarChar(100), b.email || null)
    .input('PerfilId',      sql.TinyInt,      b.perfil === 'admin' ? 1 : 2)
    .input('FuncionarioId', sql.VarChar(36),  b.funcionarioId || null)
    .input('SenhaHash',     sql.VarChar(64),  b.senhaHash || null)
    .input('Ativo',         sql.Bit,          b.ativo ? 1 : 0)
    .execute('sp_SalvarUsuario');
  res.json({ ok: true });
}));

router.delete('/usuarios/:id', wrap(async (req, res) => {
  const p = await getPool();
  await p.request().input('Id', sql.VarChar(36), req.params.id).query('DELETE FROM Usuario WHERE Id = @Id');
  res.json({ ok: true });
}));

router.post('/usuarios/:id/reset-senha', wrap(async (req, res) => {
  const p = await getPool();
  const r = await p.request().input('Id', sql.VarChar(36), req.params.id)
    .query('SELECT Login,Email FROM Usuario WHERE Id=@Id AND Ativo=1');
  const user = r.recordset[0];
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (!user.Email) return res.status(400).json({ error: 'Usuário não possui e-mail cadastrado.' });
  const novaSenha = gerarSenhaAleatoria();
  await p.request().input('Id', sql.VarChar(36), req.params.id).input('Hash', sql.VarChar(64), sha256(novaSenha))
    .query('UPDATE Usuario SET SenhaHash=@Hash WHERE Id=@Id');
  await mailer.sendMail({
    from: `"Controla Obra" <${process.env.SMTP_USER}>`, to: user.Email,
    subject: 'Sua nova senha - Controla Obra',
    html: `<p>Olá <strong>${user.Login}</strong>, sua nova senha: <strong>${novaSenha}</strong></p>`,
  });
  res.json({ ok: true });
}));

router.get('/relatorio', wrap(async (req, res) => {
  const { dataInicio, dataFim, obraId } = req.query;
  const p = await getPool();
  const r = await p.request()
    .input('DataInicio', sql.Date,        dataInicio)
    .input('DataFim',    sql.Date,        dataFim)
    .input('ObraId',     sql.VarChar(36), obraId || null)
    .execute('sp_RelatorioCusto');
  res.json(r.recordset);
}));

app.use('/api', router);
app.use('/',    router);

app.use((err, _req, res, _next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: err.message });
});

module.exports = serverless(app);
