import { Pool } from 'pg';
import http from 'http';
import nodemailer from 'nodemailer';
import { createHash } from 'crypto';

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function sha256(t) { return createHash('sha256').update(t).digest('hex'); }
function gerarSenhaAleatoria() { return Math.random().toString(36).slice(2, 10); }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:kriptonianoS753#@db.cslrdwbrzrbvcckswhqn.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const q = (text, params) => pool.query(text, params);

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
  const url = req.url.replace(/^\/api/, '').split('?')[0] || '/';

  try {
    if (req.method === 'POST' && url === '/login') {
      const { login, senhaHash } = await readBody(req);
      const r = await q(`
        SELECT u."Id", u."Login", u."FuncionarioId",
               p."Nome" AS "Perfil", f."Nome" AS "FuncionarioNome", f."Funcao"
        FROM "Usuario" u
        JOIN "Perfil" p ON p."Id" = u."PerfilId"
        LEFT JOIN "Funcionario" f ON f."Id" = u."FuncionarioId"
        WHERE u."Login"=$1 AND u."SenhaHash"=$2 AND u."Ativo"=TRUE
      `, [login, senhaHash]);
      if (!r.rows[0]) return send(res, 401, { error: 'Credenciais invalidas' });
      return send(res, 200, r.rows[0]);
    }

    if (req.method === 'GET' && url === '/funcionarios') {
      const r = await q('SELECT * FROM "Funcionario" ORDER BY "Nome"');
      return send(res, 200, r.rows);
    }

    if (req.method === 'POST' && url === '/funcionarios') {
      const f = await readBody(req);
      await q(`
        INSERT INTO "Funcionario" ("Id","Nome","Funcao","Diaria","Transporte","Alimentacao","Telefone","Ativo","ObraId")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT ("Id") DO UPDATE SET
          "Nome"=$2,"Funcao"=$3,"Diaria"=$4,"Transporte"=$5,"Alimentacao"=$6,"Telefone"=$7,"Ativo"=$8,"ObraId"=$9
      `, [f.id, f.nome, f.funcao, f.diaria, f.transporte, f.alimentacao, f.telefone, f.ativo, f.obraId || null]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE' && url.startsWith('/funcionarios/')) {
      const id = url.split('/')[2];
      const c = await q('SELECT COUNT(*) FROM "Presenca" WHERE "FuncionarioId"=$1', [id]);
      if (Number(c.rows[0].count) > 0) return send(res, 409, { error: 'Funcionario possui presencas cadastradas.' });
      await q('DELETE FROM "Funcionario" WHERE "Id"=$1', [id]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url === '/obras') {
      const r = await q('SELECT * FROM "Obra" ORDER BY "Nome"');
      return send(res, 200, r.rows);
    }

    if (req.method === 'POST' && url === '/obras') {
      const o = await readBody(req);
      await q(`
        INSERT INTO "Obra" ("Id","Nome","Endereco","Lat","Lng","Ativa")
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT ("Id") DO UPDATE SET "Nome"=$2,"Endereco"=$3,"Lat"=$4,"Lng"=$5,"Ativa"=$6
      `, [o.id, o.nome, o.endereco, o.lat, o.lng, o.ativa]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE' && url.startsWith('/obras/')) {
      const id = url.split('/')[2];
      const c = await q('SELECT COUNT(*) FROM "Presenca" WHERE "ObraId"=$1', [id]);
      if (Number(c.rows[0].count) > 0) return send(res, 409, { error: 'Obra possui presencas cadastradas.' });
      await q('DELETE FROM "Obra" WHERE "Id"=$1', [id]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.startsWith('/presencas') && !url.includes('/foto')) {
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const data = qs.get('data'), funcionarioId = qs.get('funcionarioId');
      const de = qs.get('de'), ate = qs.get('ate');
      let sql = 'SELECT * FROM "vw_PresencaCompleta" WHERE 1=1';
      const params = [];
      if (data)          { params.push(data);         sql += ` AND "Data"=$${params.length}`; }
      if (de)            { params.push(de);            sql += ` AND "Data">=$${params.length}`; }
      if (ate)           { params.push(ate);           sql += ` AND "Data"<=$${params.length}`; }
      if (funcionarioId) { params.push(funcionarioId); sql += ` AND "FuncionarioId"=$${params.length}`; }
      sql += ' ORDER BY "Data" DESC, "HoraEntrada"';
      const r = await q(sql, params);
      return send(res, 200, r.rows);
    }

    if (req.method === 'POST' && url === '/presencas') {
      const b = await readBody(req);
      const existe = await q('SELECT "Id" FROM "Presenca" WHERE "Id"=$1', [b.id]);
      if (existe.rows.length > 0) {
        await q(`UPDATE "Presenca" SET "HoraSaida"=$2,"Status"=$3,"DistanciaObra"=$4 WHERE "Id"=$1`,
          [b.id, b.horaSaida || null, b.status, b.distanciaObra]);
      } else {
        await q(`INSERT INTO "Presenca" ("Id","FuncionarioId","ObraId","Data","HoraEntrada","Lat","Lng","DistanciaObra","Status")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [b.id, b.funcionarioId, b.obraId, b.data, b.horaEntrada, b.lat, b.lng, b.distanciaObra, b.status]);
      }
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE' && url.match(/^\/presencas\/[^/]+$/) ) {
      const id = url.split('/')[2];
      await q('DELETE FROM "Presenca" WHERE "Id"=$1', [id]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.match(/^\/presencas\/[^/]+\/foto$/)) {
      const presencaId = url.split('/')[2];
      const chunks = [];
      await new Promise(resolve => { req.on('data', c => chunks.push(c)); req.on('end', resolve); });
      const buf = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || '';
      const boundary = ct.split('boundary=')[1];
      if (!boundary) return send(res, 400, { error: 'Boundary ausente' });
      const sep = Buffer.from('--' + boundary);
      const parts = [];
      let start = buf.indexOf(sep) + sep.length + 2;
      while (start < buf.length) {
        const end = buf.indexOf(sep, start);
        if (end === -1) break;
        const part = buf.slice(start, end - 2);
        const headerEnd = part.indexOf('\r\n\r\n');
        parts.push({ headers: part.slice(0, headerEnd).toString(), body: part.slice(headerEnd + 4) });
        start = end + sep.length + 2;
      }
      let tipo = 'entrada', fotoBuffer = null;
      for (const part of parts) {
        if (part.headers.includes('name="tipo"')) tipo = part.body.toString().trim();
        if (part.headers.includes('name="foto"')) fotoBuffer = part.body;
      }
      if (!fotoBuffer) return send(res, 400, { error: 'Foto ausente' });
      const dataUrl = `data:image/jpeg;base64,${fotoBuffer.toString('base64')}`;
      const col = tipo === 'entrada' ? '"FotoEntrada"' : '"FotoSaida"';
      await q(`UPDATE "Presenca" SET ${col}=$2 WHERE "Id"=$1`, [presencaId, dataUrl]);
      return send(res, 200, { url: dataUrl });
    }

    if (req.method === 'GET' && url === '/usuarios') {
      const r = await q(`
        SELECT u."Id", u."Login", u."Email", u."Ativo", u."FuncionarioId",
               p."Nome" AS "Perfil", f."Nome" AS "FuncionarioNome"
        FROM "Usuario" u
        JOIN "Perfil" p ON p."Id" = u."PerfilId"
        LEFT JOIN "Funcionario" f ON f."Id" = u."FuncionarioId"
        ORDER BY u."Login"
      `);
      return send(res, 200, r.rows);
    }

    if (req.method === 'POST' && url === '/usuarios') {
      const b = await readBody(req);
      const perfilId = b.perfil === 'admin' ? 1 : 2;
      await q(`
        INSERT INTO "Usuario" ("Id","Login","Email","PerfilId","FuncionarioId","SenhaHash","Ativo")
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT ("Id") DO UPDATE SET
          "Login"=$2,"Email"=$3,"PerfilId"=$4,"FuncionarioId"=$5,"Ativo"=$7,
          "SenhaHash"=CASE WHEN $6 IS NOT NULL THEN $6 ELSE "Usuario"."SenhaHash" END
      `, [b.id, b.login, b.email || null, perfilId, b.funcionarioId || null, b.senhaHash || null, b.ativo]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE' && url.match(/^\/usuarios\/[^/]+$/) && !url.includes('/reset-senha')) {
      const id = url.split('/')[2];
      await q('DELETE FROM "Usuario" WHERE "Id"=$1', [id]);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.match(/^\/usuarios\/[^/]+\/reset-senha$/)) {
      const id = url.split('/')[2];
      const r = await q('SELECT "Login","Email" FROM "Usuario" WHERE "Id"=$1 AND "Ativo"=TRUE', [id]);
      const user = r.rows[0];
      if (!user) return send(res, 404, { error: 'Usuário não encontrado.' });
      if (!user.Email) return send(res, 400, { error: 'Usuário não possui e-mail cadastrado.' });
      const novaSenha = gerarSenhaAleatoria();
      await q('UPDATE "Usuario" SET "SenhaHash"=$2 WHERE "Id"=$1', [id, sha256(novaSenha)]);
      await mailer.sendMail({
        from: `"Controla Obra" <${process.env.SMTP_USER}>`, to: user.Email,
        subject: 'Sua nova senha - Controla Obra',
        html: `<p>Olá <strong>${user.Login}</strong>, sua nova senha: <strong>${novaSenha}</strong></p>`,
      });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url === '/relatorio') {
      const qs = new URLSearchParams(req.url.split('?')[1] || '');
      const r = await q(`
        SELECT f."Nome" AS "Funcionario", f."Funcao",
               COUNT(*) AS "DiasPresente",
               SUM(CASE p."Status" WHEN 'meio-periodo' THEN 0.5 ELSE 1 END) AS "DiasEfetivos",
               SUM(CASE p."Status" WHEN 'meio-periodo' THEN f."Diaria"/2 ELSE f."Diaria" END) AS "TotalDiarias",
               SUM(f."Transporte") AS "TotalTransporte",
               SUM(f."Alimentacao") AS "TotalAlimentacao",
               SUM(CASE p."Status" WHEN 'meio-periodo' THEN (f."Diaria"/2)+f."Transporte"+f."Alimentacao"
                                   ELSE f."Diaria"+f."Transporte"+f."Alimentacao" END) AS "CustoTotal"
        FROM "Presenca" p
        JOIN "Funcionario" f ON f."Id" = p."FuncionarioId"
        JOIN "Obra" o ON o."Id" = p."ObraId"
        WHERE p."Data" BETWEEN $1 AND $2
          AND p."Status" <> 'ausente'
          AND ($3::varchar IS NULL OR p."ObraId" = $3)
        GROUP BY f."Id", f."Nome", f."Funcao"
        ORDER BY "CustoTotal" DESC
      `, [qs.get('dataInicio'), qs.get('dataFim'), qs.get('obraId') || null]);
      return send(res, 200, r.rows);
    }

    send(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('[API Error]', err.message);
    send(res, 500, { error: err.message });
  }
});

server.listen(3001, () => {
  console.log('API rodando em http://localhost:3001');
  pool.query('SELECT 1')
    .then(() => console.log('Supabase conectado.'))
    .catch(e => console.error('Falha Supabase:', e.message));
});
