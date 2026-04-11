import sql from 'mssql';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
// ── Configuração de e-mail ─────────────────────────────────────────────────
// Altere para as credenciais do seu servidor SMTP
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'seu-email@gmail.com',
    pass: process.env.SMTP_PASS || 'sua-senha-app',
  },
});

async function sha256(text) {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(text).digest('hex');
}

function gerarSenhaAleatoria() {
  return Math.random().toString(36).slice(2, 10);
}

const config = {
  server: 'ControleObra.mssql.somee.com',
  database: 'ControleObra',
  user: 'controleobras',
  password: '12345678',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool = null;

async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  pool.on('error', err => {
    console.error('[Pool error]', err.message);
    pool = null;
  });
  return pool;
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => (d += c));
    req.on('end', () => resolve(d ? JSON.parse(d) : {}));
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // ── Servir arquivos de /uploads ──────────────────────────
  if (req.method === 'GET' && url.startsWith('/uploads/')) {
    const file = path.join(UPLOADS_DIR, path.basename(url));
    if (!fs.existsSync(file)) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    return fs.createReadStream(file).pipe(res);
  }

  try {
    const p = await getPool();

    if (req.method === 'POST' && url === '/login') {
      const { login, senhaHash } = await readBody(req);
      const r = await p.request()
        .input('Login',     sql.VarChar(50), login)
        .input('SenhaHash', sql.VarChar(64), senhaHash)
        .execute('sp_Login');
      const user = r.recordset[0];
      if (!user) return send(res, 401, { error: 'Credenciais invalidas' });
      return send(res, 200, user);
    }

    if (req.method === 'GET' && url === '/funcionarios') {
      const r = await p.request().query('SELECT * FROM Funcionario ORDER BY Nome');
      return send(res, 200, r.recordset);
    }

    if (req.method === 'POST' && url === '/funcionarios') {
      const f = await readBody(req);
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
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url === '/obras') {
      const r = await p.request().query('SELECT * FROM Obra ORDER BY Nome');
      return send(res, 200, r.recordset);
    }

    if (req.method === 'POST' && url === '/obras') {
      const o = await readBody(req);
      await p.request()
        .input('Id',       sql.VarChar(36),   o.id)
        .input('Nome',     sql.NVarChar(100), o.nome)
        .input('Endereco', sql.NVarChar(200), o.endereco)
        .input('Lat',      sql.Decimal(10,7), o.lat)
        .input('Lng',      sql.Decimal(10,7), o.lng)
        .input('Ativa',    sql.Bit,           o.ativa ? 1 : 0)
        .execute('sp_SalvarObra');
      return send(res, 200, { ok: true });
    }

    // DELETE /obras/:id
    if (req.method === 'DELETE' && url.startsWith('/obras/')) {
      const id = url.split('/')[2];
      const check = await p.request().input('Id', sql.VarChar(36), id).query('SELECT COUNT(*) AS total FROM Presenca WHERE ObraId = @Id');
      if (check.recordset[0].total > 0) return send(res, 409, { error: 'Obra possui presencas cadastradas.' });
      await p.request().input('Id', sql.VarChar(36), id).query('DELETE FROM Obra WHERE Id = @Id');
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url === '/presencas') {
      const qs     = new URLSearchParams(req.url.split('?')[1] || '');
      const data   = qs.get('data');
      const funcId = qs.get('funcionarioId');
      const de     = qs.get('de');
      const ate    = qs.get('ate');
      let q = 'SELECT * FROM vw_PresencaCompleta WHERE 1=1';
      const req2 = p.request();
      if (data)   { q += ' AND Data = @Data';              req2.input('Data',   sql.Date,        data);   }
      if (de)     { q += ' AND Data >= @De';               req2.input('De',     sql.Date,        de);     }
      if (ate)    { q += ' AND Data <= @Ate';              req2.input('Ate',    sql.Date,        ate);    }
      if (funcId) { q += ' AND FuncionarioId = @FuncId';   req2.input('FuncId', sql.VarChar(36), funcId); }
      q += ' ORDER BY Data DESC, HoraEntrada';
      const r = await req2.query(q);
      return send(res, 200, r.recordset);
    }

    if (req.method === 'POST' && url === '/presencas') {
      const b = await readBody(req);
      function toTimeDate(hms) {
        if (!hms) return null;
        const parts = String(hms).split(':').map(Number);
        return new Date(1970, 0, 1, parts[0] || 0, parts[1] || 0, parts[2] || 0);
      }
      const jaExiste = await p.request()
        .input('Id', sql.VarChar(36), b.id)
        .query('SELECT Id FROM Presenca WHERE Id = @Id');
      if (jaExiste.recordset.length > 0) {
        // UPDATE: só atualiza saída, status e distância
        await p.request()
          .input('Id',            sql.VarChar(36),    b.id)
          .input('HoraSaida',     sql.Time,           toTimeDate(b.horaSaida))
          .input('Status',        sql.VarChar(15),    b.status)
          .input('DistanciaObra', sql.Int,            b.distanciaObra)
          .query('UPDATE Presenca SET HoraSaida=@HoraSaida, Status=@Status, DistanciaObra=@DistanciaObra WHERE Id=@Id');
      } else {
        // INSERT: novo registro de entrada
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
      return send(res, 200, { ok: true });
    }

    // DELETE /funcionarios/:id
    if (req.method === 'DELETE' && url.startsWith('/funcionarios/')) {
      const id = url.split('/')[2];
      const check = await p.request().input('Id', sql.VarChar(36), id).query('SELECT COUNT(*) AS total FROM Presenca WHERE FuncionarioId = @Id');
      if (check.recordset[0].total > 0) return send(res, 409, { error: 'Funcionario possui presencas cadastradas.' });
      await p.request().input('Id', sql.VarChar(36), id).query('DELETE FROM Funcionario WHERE Id = @Id');
      return send(res, 200, { ok: true });
    }

    // DELETE /presencas/:id
    if (req.method === 'DELETE' && url.startsWith('/presencas/')) {
      const id = url.split('/')[2];
      await p.request().input('Id', sql.VarChar(36), id).query('DELETE FROM Presenca WHERE Id = @Id');
      return send(res, 200, { ok: true });
    }

    // GET /usuarios
    if (req.method === 'GET' && url === '/usuarios') {
      const r = await p.request().query(`
        SELECT u.Id, u.Login, u.Email, u.Ativo, u.FuncionarioId,
               pf.Nome AS Perfil, f.Nome AS FuncionarioNome
        FROM Usuario u
        JOIN Perfil pf ON pf.Id = u.PerfilId
        LEFT JOIN Funcionario f ON f.Id = u.FuncionarioId
        ORDER BY u.Login
      `);
      return send(res, 200, r.recordset);
    }

    // POST /usuarios
    if (req.method === 'POST' && url === '/usuarios') {
      const b = await readBody(req);
      const perfilId = b.perfil === 'admin' ? 1 : 2;
      await p.request()
        .input('Id',            sql.VarChar(36),   b.id)
        .input('Login',         sql.VarChar(50),   b.login)
        .input('Email',         sql.VarChar(100),  b.email || null)
        .input('PerfilId',      sql.TinyInt,       perfilId)
        .input('FuncionarioId', sql.VarChar(36),   b.funcionarioId || null)
        .input('SenhaHash',     sql.VarChar(64),   b.senhaHash || null)
        .input('Ativo',         sql.Bit,           b.ativo ? 1 : 0)
        .execute('sp_SalvarUsuario');
      return send(res, 200, { ok: true });
    }

    // DELETE /usuarios/:id
    if (req.method === 'DELETE' && url.startsWith('/usuarios/') && !url.includes('/reset-senha')) {
      const id = url.split('/')[2];
      await p.request().input('Id', sql.VarChar(36), id).query('DELETE FROM Usuario WHERE Id = @Id');
      return send(res, 200, { ok: true });
    }

    // POST /usuarios/:id/reset-senha
    if (req.method === 'POST' && url.match(/^\/usuarios\/[^/]+\/reset-senha$/)) {
      const id = url.split('/')[2];
      const r = await p.request().input('Id', sql.VarChar(36), id)
        .query('SELECT Login, Email FROM Usuario WHERE Id = @Id AND Ativo = 1');
      const user = r.recordset[0];
      if (!user) return send(res, 404, { error: 'Usuário não encontrado.' });
      if (!user.Email) return send(res, 400, { error: 'Usuário não possui e-mail cadastrado.' });
      const novaSenha = gerarSenhaAleatoria();
      const hash = await sha256(novaSenha);
      await p.request().input('Id', sql.VarChar(36), id).input('Hash', sql.VarChar(64), hash)
        .query('UPDATE Usuario SET SenhaHash = @Hash WHERE Id = @Id');
      await mailer.sendMail({
        from: `"Controla Obra" <${process.env.SMTP_USER || 'noreply@controlaobra.com'}>`,
        to: user.Email,
        subject: 'Sua nova senha - Controla Obra',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#1e3a5f">Controla Obra</h2>
            <p>Olá, <strong>${user.Login}</strong>!</p>
            <p>Sua senha foi redefinida. Use a senha abaixo para acessar o sistema:</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:16px 24px;font-size:24px;font-weight:700;letter-spacing:4px;text-align:center;color:#1e3a5f">
              ${novaSenha}
            </div>
            <p style="color:#64748b;font-size:13px;margin-top:16px">Por segurança, altere sua senha após o primeiro acesso.</p>
          </div>
        `,
      });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url === '/relatorio') {
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const r = await p.request()
        .input('DataInicio', sql.Date,        qs.get('dataInicio'))
        .input('DataFim',    sql.Date,        qs.get('dataFim'))
        .input('ObraId',     sql.VarChar(36), qs.get('obraId') || null)
        .execute('sp_RelatorioCusto');
      return send(res, 200, r.recordset);
    }

    // POST /presencas/:id/foto
    if (req.method === 'POST' && url.match(/^\/presencas\/[^/]+\/foto$/)) {
      const presencaId = url.split('/')[2];
      const chunks = [];
      await new Promise(resolve => { req.on('data', c => chunks.push(c)); req.on('end', resolve); });
      const buf = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || '';
      const boundary = ct.split('boundary=')[1];
      if (!boundary) return send(res, 400, { error: 'Boundary ausente' });

      // parse multipart manual
      const sep = Buffer.from('--' + boundary);
      const parts = [];
      let start = buf.indexOf(sep) + sep.length + 2;
      while (start < buf.length) {
        const end = buf.indexOf(sep, start);
        if (end === -1) break;
        const part = buf.slice(start, end - 2);
        const headerEnd = part.indexOf('\r\n\r\n');
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        parts.push({ headers, body });
        start = end + sep.length + 2;
      }

      let tipo = 'entrada';
      let fotoBuffer = null;
      for (const part of parts) {
        if (part.headers.includes('name="tipo"')) tipo = part.body.toString().trim();
        if (part.headers.includes('name="foto"')) fotoBuffer = part.body;
      }
      if (!fotoBuffer) return send(res, 400, { error: 'Foto ausente' });

      const filename = `${presencaId}_${tipo}_${Date.now()}.jpg`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), fotoBuffer);
      const url2 = `/uploads/${filename}`;

      const col = tipo === 'entrada' ? 'FotoEntrada' : 'FotoSaida';
      await p.request()
        .input('Id',  sql.VarChar(36),  presencaId)
        .input('Url', sql.VarChar(200), url2)
        .query(`UPDATE Presenca SET ${col} = @Url WHERE Id = @Id`);

      return send(res, 200, { url: url2 });
    }

    send(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('[API Error]', err.message);
    send(res, 500, { error: err.message });
  }
});

server.listen(3001, () => {
  console.log('API rodando em http://localhost:3001');
  getPool()
    .then(() => console.log('SQL Server conectado.'))
    .catch(e => console.error('Falha SQL Server:', e.message));
});
