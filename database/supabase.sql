-- ============================================================
-- CONTROLA OBRA - PostgreSQL / Supabase
-- ============================================================

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS Funcionario (
    Id          VARCHAR(36)    NOT NULL,
    Nome        VARCHAR(100)   NOT NULL,
    Funcao      VARCHAR(60)    NOT NULL,
    Diaria      DECIMAL(10,2)  NOT NULL CHECK (Diaria >= 0),
    Transporte  DECIMAL(10,2)  NOT NULL CHECK (Transporte >= 0),
    Alimentacao DECIMAL(10,2)  NOT NULL CHECK (Alimentacao >= 0),
    Telefone    VARCHAR(20)    NOT NULL,
    Ativo       BOOLEAN        NOT NULL DEFAULT TRUE,
    ObraId      VARCHAR(36)    NULL,
    CriadoEm   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    AlteradoEm TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Funcionario PRIMARY KEY (Id)
);

CREATE TABLE IF NOT EXISTS Obra (
    Id        VARCHAR(36)    NOT NULL,
    Nome      VARCHAR(100)   NOT NULL,
    Endereco  VARCHAR(200)   NOT NULL,
    Lat       DECIMAL(10,7)  NOT NULL,
    Lng       DECIMAL(10,7)  NOT NULL,
    Ativa     BOOLEAN        NOT NULL DEFAULT TRUE,
    CriadoEm TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Obra PRIMARY KEY (Id)
);

CREATE TABLE IF NOT EXISTS Presenca (
    Id             VARCHAR(36)    NOT NULL,
    FuncionarioId  VARCHAR(36)    NOT NULL,
    ObraId         VARCHAR(36)    NOT NULL,
    Data           DATE           NOT NULL,
    HoraEntrada    TIME           NOT NULL,
    HoraSaida      TIME           NULL,
    Lat            DECIMAL(10,7)  NOT NULL,
    Lng            DECIMAL(10,7)  NOT NULL,
    DistanciaObra  INT            NOT NULL CHECK (DistanciaObra >= 0),
    Status         VARCHAR(15)    NOT NULL CHECK (Status IN ('presente','ausente','meio-periodo')),
    FotoEntrada    TEXT           NULL,
    FotoSaida      TEXT           NULL,
    TipoRegistro   VARCHAR(20)    NOT NULL DEFAULT 'entrada'
                     CHECK (TipoRegistro IN ('entrada','saida-almoco','retorno-almoco','saida-jantar','retorno-jantar','saida')),
    MinutosTrabalhados  INT       NULL,
    HoraExtraAutorizada BOOLEAN   NOT NULL DEFAULT FALSE,
    TurnoNoturno        BOOLEAN   NOT NULL DEFAULT FALSE,
    SaidaAlmoco         TIME      NULL,
    RetornoAlmoco       TIME      NULL,
    SaidaJantar         TIME      NULL,
    RetornoJantar       TIME      NULL,
    CriadoEm      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Presenca      PRIMARY KEY (Id),
    CONSTRAINT FK_Presenca_Func FOREIGN KEY (FuncionarioId) REFERENCES Funcionario(Id),
    CONSTRAINT FK_Presenca_Obra FOREIGN KEY (ObraId)        REFERENCES Obra(Id),
    CONSTRAINT UQ_Presenca_Dia  UNIQUE (FuncionarioId, Data)
);

CREATE TABLE IF NOT EXISTS Perfil (
    Id   SMALLINT     NOT NULL,
    Nome VARCHAR(20)  NOT NULL,
    CONSTRAINT PK_Perfil PRIMARY KEY (Id)
);

CREATE TABLE IF NOT EXISTS Usuario (
    Id            VARCHAR(36)   NOT NULL,
    FuncionarioId VARCHAR(36)   NULL,
    PerfilId      SMALLINT      NOT NULL,
    Login         VARCHAR(50)   NOT NULL,
    SenhaHash     VARCHAR(64)   NOT NULL,
    Email         VARCHAR(100)  NULL,
    Ativo         BOOLEAN       NOT NULL DEFAULT TRUE,
    CriadoEm     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_Usuario       PRIMARY KEY (Id),
    CONSTRAINT UQ_Usuario_Login UNIQUE (Login),
    CONSTRAINT FK_Usuario_Perf  FOREIGN KEY (PerfilId)      REFERENCES Perfil(Id),
    CONSTRAINT FK_Usuario_Func  FOREIGN KEY (FuncionarioId) REFERENCES Funcionario(Id)
);

-- ------------------------------------------------------------
-- ÍNDICES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS IX_Presenca_Data          ON Presenca (Data);
CREATE INDEX IF NOT EXISTS IX_Presenca_FuncionarioId ON Presenca (FuncionarioId);
CREATE INDEX IF NOT EXISTS IX_Presenca_ObraId        ON Presenca (ObraId);
CREATE INDEX IF NOT EXISTS IX_Usuario_Login          ON Usuario  (Login);

-- ------------------------------------------------------------
-- TRIGGER: AlteradoEm
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_set_alterado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.AlteradoEm = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_Funcionario_AlteradoEm ON Funcionario;
CREATE TRIGGER trg_Funcionario_AlteradoEm
    BEFORE UPDATE ON Funcionario
    FOR EACH ROW EXECUTE FUNCTION fn_set_alterado_em();

-- ------------------------------------------------------------
-- VIEW
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW vw_PresencaCompleta AS
SELECT
    p.Id, p.Data, p.HoraEntrada, p.HoraSaida, p.Status,
    p.TipoRegistro, p.MinutosTrabalhados, p.HoraExtraAutorizada, p.TurnoNoturno,
    p.SaidaAlmoco, p.RetornoAlmoco, p.SaidaJantar, p.RetornoJantar,
    p.DistanciaObra, p.Lat, p.Lng,
    p.FotoEntrada, p.FotoSaida,
    f.Id   AS FuncionarioId, f.Nome AS FuncionarioNome, f.Funcao,
    f.Diaria, f.Transporte, f.Alimentacao,
    CASE p.Status WHEN 'meio-periodo' THEN f.Diaria/2 ELSE f.Diaria END AS DiariaPaga,
    CASE p.Status WHEN 'meio-periodo' THEN (f.Diaria/2)+f.Transporte+f.Alimentacao
                  ELSE f.Diaria+f.Transporte+f.Alimentacao END           AS CustoTotal,
    o.Id   AS ObraId, o.Nome AS ObraNome, o.Endereco AS ObraEndereco
FROM Presenca p
JOIN Funcionario f ON f.Id = p.FuncionarioId
JOIN Obra        o ON o.Id = p.ObraId;

-- ------------------------------------------------------------
-- SEED
-- ------------------------------------------------------------

INSERT INTO Perfil (Id, Nome) VALUES (1,'admin'),(2,'funcionario')
    ON CONFLICT DO NOTHING;

INSERT INTO Funcionario (Id,Nome,Funcao,Diaria,Transporte,Alimentacao,Telefone,Ativo) VALUES
    ('f1','Carlos Silva', 'Pedreiro',    180.00,20.00,25.00,'11999990001',TRUE),
    ('f2','João Souza',   'Servente',    130.00,20.00,25.00,'11999990002',TRUE),
    ('f3','Pedro Lima',   'Eletricista', 220.00,25.00,25.00,'11999990003',TRUE),
    ('f4','Marcos Rocha', 'Encanador',   200.00,25.00,25.00,'11999990004',TRUE),
    ('f5','André Costa',  'Pintor',      160.00,20.00,25.00,'11999990005',TRUE)
    ON CONFLICT DO NOTHING;

INSERT INTO Obra (Id,Nome,Endereco,Lat,Lng,Ativa) VALUES
    ('o1','Residência Jardins','Rua das Flores, 123 - Jardins',-23.5614000,-46.6558000,TRUE),
    ('o2','Comercial Centro',  'Av. Paulista, 456 - Centro',   -23.5629000,-46.6544000,TRUE),
    ('o3','Reforma Moema',     'Rua Iraí, 789 - Moema',        -23.6012000,-46.6658000,TRUE)
    ON CONFLICT DO NOTHING;

-- Senhas: admin=admin123 | funcionários=obra1234
INSERT INTO Usuario (Id,FuncionarioId,PerfilId,Login,SenhaHash,Ativo) VALUES
    ('u0',NULL,1,'admin','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',TRUE),
    ('u1','f1',2,'11999990001','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',TRUE),
    ('u2','f2',2,'11999990002','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',TRUE),
    ('u3','f3',2,'11999990003','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',TRUE),
    ('u4','f4',2,'11999990004','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',TRUE),
    ('u5','f5',2,'11999990005','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',TRUE)
    ON CONFLICT DO NOTHING;
