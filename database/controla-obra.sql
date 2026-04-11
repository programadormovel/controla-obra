-- ============================================================
-- CONTROLA OBRA - Script de Banco de Dados
-- SQL Server 2016+
-- ============================================================

USE ControleObra;

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Funcionario')
BEGIN
    CREATE TABLE Funcionario (
        Id          VARCHAR(36)    NOT NULL,
        Nome        NVARCHAR(100)  NOT NULL,
        Funcao      NVARCHAR(60)   NOT NULL,
        Diaria      DECIMAL(10,2)  NOT NULL CHECK (Diaria >= 0),
        Transporte  DECIMAL(10,2)  NOT NULL CHECK (Transporte >= 0),
        Alimentacao DECIMAL(10,2)  NOT NULL CHECK (Alimentacao >= 0),
        Telefone    VARCHAR(20)    NOT NULL,
        Ativo       BIT            NOT NULL DEFAULT 1,
        CriadoEm   DATETIME2      NOT NULL DEFAULT GETDATE(),
        AlteradoEm DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Funcionario PRIMARY KEY (Id)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Obra')
BEGIN
    CREATE TABLE Obra (
        Id        VARCHAR(36)    NOT NULL,
        Nome      NVARCHAR(100)  NOT NULL,
        Endereco  NVARCHAR(200)  NOT NULL,
        Lat       DECIMAL(10,7)  NOT NULL,
        Lng       DECIMAL(10,7)  NOT NULL,
        Ativa     BIT            NOT NULL DEFAULT 1,
        CriadoEm DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Obra PRIMARY KEY (Id)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Presenca')
BEGIN
    CREATE TABLE Presenca (
        Id             VARCHAR(36)    NOT NULL,
        FuncionarioId  VARCHAR(36)    NOT NULL,
        ObraId         VARCHAR(36)    NOT NULL,
        Data           DATE           NOT NULL,
        HoraEntrada    TIME(0)        NOT NULL,
        HoraSaida      TIME(0)        NULL,
        Lat            DECIMAL(10,7)  NOT NULL,
        Lng            DECIMAL(10,7)  NOT NULL,
        DistanciaObra  INT            NOT NULL CHECK (DistanciaObra >= 0),
        Status         VARCHAR(15)    NOT NULL
                           CHECK (Status IN ('presente','ausente','meio-periodo')),
        CriadoEm      DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Presenca       PRIMARY KEY (Id),
        CONSTRAINT FK_Presenca_Func  FOREIGN KEY (FuncionarioId) REFERENCES Funcionario(Id),
        CONSTRAINT FK_Presenca_Obra  FOREIGN KEY (ObraId)        REFERENCES Obra(Id),
        CONSTRAINT UQ_Presenca_Dia   UNIQUE (FuncionarioId, Data)
    );
END

-- Perfis de acesso
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Perfil')
BEGIN
    CREATE TABLE Perfil (
        Id   TINYINT      NOT NULL,
        Nome VARCHAR(20)  NOT NULL,
        CONSTRAINT PK_Perfil PRIMARY KEY (Id)
    );
    INSERT INTO Perfil (Id, Nome) VALUES (1, 'admin'), (2, 'funcionario');
END

-- Usuários do sistema
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuario')
BEGIN
    CREATE TABLE Usuario (
        Id            VARCHAR(36)    NOT NULL,
        FuncionarioId VARCHAR(36)    NULL,
        PerfilId      TINYINT        NOT NULL,
        Login         VARCHAR(50)    NOT NULL,
        SenhaHash     VARCHAR(64)    NOT NULL,
        Email         VARCHAR(100)   NULL,
        Ativo         BIT            NOT NULL DEFAULT 1,
        CriadoEm     DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_Usuario          PRIMARY KEY (Id),
        CONSTRAINT UQ_Usuario_Login    UNIQUE (Login),
        CONSTRAINT FK_Usuario_Perfil   FOREIGN KEY (PerfilId)      REFERENCES Perfil(Id),
        CONSTRAINT FK_Usuario_Func     FOREIGN KEY (FuncionarioId) REFERENCES Funcionario(Id)
    );
END

-- Adicionar coluna Email se a tabela já existia sem ela
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Usuario') AND name = 'Email')
    ALTER TABLE Usuario ADD Email VARCHAR(100) NULL;

-- Adicionar coluna ObraId se a tabela Funcionario já existia sem ela
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Funcionario') AND name = 'ObraId')
    ALTER TABLE Funcionario ADD ObraId VARCHAR(36) NULL;

-- Adicionar colunas de foto na Presenca
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Presenca') AND name = 'FotoEntrada')
    ALTER TABLE Presenca ADD FotoEntrada VARCHAR(200) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Presenca') AND name = 'FotoSaida')
    ALTER TABLE Presenca ADD FotoSaida VARCHAR(200) NULL;

-- ------------------------------------------------------------
-- ÝNDICES
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Presenca_Data')
    CREATE INDEX IX_Presenca_Data          ON Presenca (Data);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Presenca_FuncionarioId')
    CREATE INDEX IX_Presenca_FuncionarioId ON Presenca (FuncionarioId);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Presenca_ObraId')
    CREATE INDEX IX_Presenca_ObraId        ON Presenca (ObraId);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuario_Login')
    CREATE INDEX IX_Usuario_Login          ON Usuario (Login);

-- ------------------------------------------------------------
-- TRIGGER
-- ------------------------------------------------------------
IF OBJECT_ID('trg_Funcionario_AlteradoEm','TR') IS NOT NULL
    DROP TRIGGER trg_Funcionario_AlteradoEm;

EXEC('
CREATE TRIGGER trg_Funcionario_AlteradoEm ON Funcionario AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Funcionario SET AlteradoEm = GETDATE()
    FROM Funcionario f INNER JOIN inserted i ON f.Id = i.Id;
END;
');

-- ------------------------------------------------------------
-- VIEWS
-- ------------------------------------------------------------
IF OBJECT_ID('vw_PresencaCompleta','V') IS NOT NULL DROP VIEW vw_PresencaCompleta;

EXEC('
CREATE VIEW vw_PresencaCompleta AS
SELECT
    p.Id, p.Data, p.HoraEntrada, p.HoraSaida, p.Status, p.DistanciaObra, p.Lat, p.Lng,
    p.FotoEntrada, p.FotoSaida,
    f.Id   AS FuncionarioId, f.Nome AS FuncionarioNome, f.Funcao,
    f.Diaria, f.Transporte, f.Alimentacao,
    CASE p.Status WHEN ''meio-periodo'' THEN f.Diaria/2 ELSE f.Diaria END AS DiariaPaga,
    CASE p.Status WHEN ''meio-periodo'' THEN (f.Diaria/2)+f.Transporte+f.Alimentacao
                  ELSE f.Diaria+f.Transporte+f.Alimentacao END           AS CustoTotal,
    o.Id   AS ObraId, o.Nome AS ObraNome, o.Endereco AS ObraEndereco
FROM Presenca p
JOIN Funcionario f ON f.Id = p.FuncionarioId
JOIN Obra        o ON o.Id = p.ObraId;
');

IF OBJECT_ID('vw_CustoPorObraData','V') IS NOT NULL DROP VIEW vw_CustoPorObraData;

EXEC('
CREATE VIEW vw_CustoPorObraData AS
SELECT
    o.Nome AS Obra, p.Data,
    COUNT(*)           AS TotalFuncionarios,
    SUM(CASE p.Status WHEN ''meio-periodo'' THEN f.Diaria/2 ELSE f.Diaria END) AS TotalDiarias,
    SUM(f.Transporte)  AS TotalTransporte,
    SUM(f.Alimentacao) AS TotalAlimentacao,
    SUM(CASE p.Status WHEN ''meio-periodo'' THEN (f.Diaria/2)+f.Transporte+f.Alimentacao
                      ELSE f.Diaria+f.Transporte+f.Alimentacao END)           AS CustoTotal
FROM Presenca p
JOIN Funcionario f ON f.Id = p.FuncionarioId
JOIN Obra        o ON o.Id = p.ObraId
WHERE p.Status <> ''ausente''
GROUP BY o.Nome, p.Data;
');

-- ------------------------------------------------------------
-- STORED PROCEDURES
-- ------------------------------------------------------------
IF OBJECT_ID('sp_Login','P') IS NOT NULL DROP PROCEDURE sp_Login;

EXEC('
CREATE PROCEDURE sp_Login
    @Login     VARCHAR(50),
    @SenhaHash VARCHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        u.Id, u.Login, u.FuncionarioId,
        p.Nome  AS Perfil,
        f.Nome  AS FuncionarioNome,
        f.Funcao
    FROM  Usuario u
    JOIN  Perfil  p ON p.Id = u.PerfilId
    LEFT  JOIN Funcionario f ON f.Id = u.FuncionarioId
    WHERE u.Login     = @Login
      AND u.SenhaHash = @SenhaHash
      AND u.Ativo     = 1;
END;
');

IF OBJECT_ID('sp_SalvarUsuario','P') IS NOT NULL DROP PROCEDURE sp_SalvarUsuario;

EXEC('
CREATE PROCEDURE sp_SalvarUsuario
    @Id VARCHAR(36), @Login VARCHAR(50), @Email VARCHAR(100) = NULL,
    @PerfilId TINYINT, @FuncionarioId VARCHAR(36) = NULL,
    @SenhaHash VARCHAR(64) = NULL, @Ativo BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Usuario WHERE Id = @Id)
        UPDATE Usuario
           SET Login = @Login, Email = @Email, PerfilId = @PerfilId,
               FuncionarioId = @FuncionarioId, Ativo = @Ativo,
               SenhaHash = CASE WHEN @SenhaHash IS NOT NULL THEN @SenhaHash ELSE SenhaHash END
         WHERE Id = @Id;
    ELSE
        INSERT INTO Usuario (Id, Login, Email, PerfilId, FuncionarioId, SenhaHash, Ativo)
        VALUES (@Id, @Login, @Email, @PerfilId, @FuncionarioId, ISNULL(@SenhaHash,''''), @Ativo);
END;
');

IF OBJECT_ID('sp_SalvarObra','P') IS NOT NULL DROP PROCEDURE sp_SalvarObra;

EXEC('
CREATE PROCEDURE sp_SalvarObra
    @Id VARCHAR(36), @Nome NVARCHAR(100), @Endereco NVARCHAR(200),
    @Lat DECIMAL(10,7), @Lng DECIMAL(10,7), @Ativa BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Obra WHERE Id = @Id)
        UPDATE Obra SET Nome=@Nome, Endereco=@Endereco, Lat=@Lat, Lng=@Lng, Ativa=@Ativa WHERE Id = @Id;
    ELSE
        INSERT INTO Obra (Id,Nome,Endereco,Lat,Lng,Ativa) VALUES (@Id,@Nome,@Endereco,@Lat,@Lng,@Ativa);
END;
');

IF OBJECT_ID('sp_SalvarFuncionario','P') IS NOT NULL DROP PROCEDURE sp_SalvarFuncionario;

EXEC('
CREATE PROCEDURE sp_SalvarFuncionario
    @Id VARCHAR(36), @Nome NVARCHAR(100), @Funcao NVARCHAR(60),
    @Diaria DECIMAL(10,2), @Transporte DECIMAL(10,2), @Alimentacao DECIMAL(10,2),
    @Telefone VARCHAR(20), @Ativo BIT, @ObraId VARCHAR(36) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Funcionario WHERE Id = @Id)
        UPDATE Funcionario SET Nome=@Nome, Funcao=@Funcao, Diaria=@Diaria,
            Transporte=@Transporte, Alimentacao=@Alimentacao, Telefone=@Telefone,
            Ativo=@Ativo, ObraId=@ObraId
        WHERE Id = @Id;
    ELSE
        INSERT INTO Funcionario (Id,Nome,Funcao,Diaria,Transporte,Alimentacao,Telefone,Ativo,ObraId)
        VALUES (@Id,@Nome,@Funcao,@Diaria,@Transporte,@Alimentacao,@Telefone,@Ativo,@ObraId);
END;
');

IF OBJECT_ID('sp_SalvarPresenca','P') IS NOT NULL DROP PROCEDURE sp_SalvarPresenca;

EXEC('
CREATE PROCEDURE sp_SalvarPresenca
    @Id VARCHAR(36), @FuncionarioId VARCHAR(36), @ObraId VARCHAR(36),
    @Data DATE, @HoraEntrada TIME(0), @HoraSaida TIME(0) = NULL,
    @Lat DECIMAL(10,7), @Lng DECIMAL(10,7), @DistanciaObra INT, @Status VARCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Presenca WHERE Id = @Id)
        UPDATE Presenca SET HoraSaida=@HoraSaida, Status=@Status, DistanciaObra=@DistanciaObra
        WHERE Id = @Id;
    ELSE
        INSERT INTO Presenca (Id,FuncionarioId,ObraId,Data,HoraEntrada,HoraSaida,Lat,Lng,DistanciaObra,Status)
        VALUES (@Id,@FuncionarioId,@ObraId,@Data,@HoraEntrada,@HoraSaida,@Lat,@Lng,@DistanciaObra,@Status);
END;
');

IF OBJECT_ID('sp_RelatorioCusto','P') IS NOT NULL DROP PROCEDURE sp_RelatorioCusto;

EXEC('
CREATE PROCEDURE sp_RelatorioCusto
    @DataInicio DATE, @DataFim DATE, @ObraId VARCHAR(36) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        f.Nome AS Funcionario, f.Funcao,
        COUNT(*) AS DiasPresente,
        SUM(CASE p.Status WHEN ''meio-periodo'' THEN 0.5 ELSE 1 END) AS DiasEfetivos,
        SUM(CASE p.Status WHEN ''meio-periodo'' THEN f.Diaria/2 ELSE f.Diaria END) AS TotalDiarias,
        SUM(f.Transporte)  AS TotalTransporte,
        SUM(f.Alimentacao) AS TotalAlimentacao,
        SUM(CASE p.Status WHEN ''meio-periodo'' THEN (f.Diaria/2)+f.Transporte+f.Alimentacao
                          ELSE f.Diaria+f.Transporte+f.Alimentacao END) AS CustoTotal
    FROM Presenca p
    JOIN Funcionario f ON f.Id = p.FuncionarioId
    JOIN Obra        o ON o.Id = p.ObraId
    WHERE p.Data BETWEEN @DataInicio AND @DataFim
      AND p.Status <> ''ausente''
      AND (@ObraId IS NULL OR p.ObraId = @ObraId)
    GROUP BY f.Id, f.Nome, f.Funcao
    ORDER BY CustoTotal DESC;
END;
');

-- ------------------------------------------------------------
-- SEED
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Funcionario)
BEGIN
    INSERT INTO Funcionario (Id,Nome,Funcao,Diaria,Transporte,Alimentacao,Telefone,Ativo) VALUES
        ('f1','Carlos Silva', 'Pedreiro',    180.00,20.00,25.00,'11999990001',1),
        ('f2',N'João Souza',  'Servente',    130.00,20.00,25.00,'11999990002',1),
        ('f3','Pedro Lima',   'Eletricista', 220.00,25.00,25.00,'11999990003',1),
        ('f4','Marcos Rocha', 'Encanador',   200.00,25.00,25.00,'11999990004',1),
        ('f5',N'André Costa', 'Pintor',      160.00,20.00,25.00,'11999990005',1);
END

IF NOT EXISTS (SELECT 1 FROM Obra)
BEGIN
    INSERT INTO Obra (Id,Nome,Endereco,Lat,Lng,Ativa) VALUES
        ('o1',N'Residência Jardins','Rua das Flores, 123 - Jardins',-23.5614000,-46.6558000,1),
        ('o2','Comercial Centro',   'Av. Paulista, 456 - Centro',   -23.5629000,-46.6544000,1),
        ('o3','Reforma Moema',      N'Rua Iraí, 789 - Moema',       -23.6012000,-46.6658000,1);
END

-- Senhas: admin=admin123 | funcionários=obra1234
IF NOT EXISTS (SELECT 1 FROM Usuario)
BEGIN
    INSERT INTO Usuario (Id, FuncionarioId, PerfilId, Login, SenhaHash, Ativo) VALUES
        ('u0', NULL, 1, 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 1);

    INSERT INTO Usuario (Id, FuncionarioId, PerfilId, Login, SenhaHash, Ativo) VALUES
        ('u1','f1',2,'11999990001','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',1),
        ('u2','f2',2,'11999990002','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',1),
        ('u3','f3',2,'11999990003','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',1),
        ('u4','f4',2,'11999990004','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',1),
        ('u5','f5',2,'11999990005','b9c950640e1b3740743070f7e4c9d6d26e082ac9fa8c9e6d8b9e9e9e9e9e9e9e',1);
END

SELECT 'Funcionarios' AS Tabela, COUNT(*) AS Total FROM Funcionario UNION ALL
SELECT 'Obras',    COUNT(*) FROM Obra UNION ALL
SELECT 'Usuarios', COUNT(*) FROM Usuario UNION ALL
SELECT 'Presencas',COUNT(*) FROM Presenca;

PRINT '=== Script executado com sucesso ===';

 ALTER TABLE Funcionario ADD ObraId VARCHAR(36) NULL;

--drop procedure sp_SalvarPresenca
CREATE PROCEDURE sp_SalvarFuncionario
    @Id VARCHAR(36), @Nome NVARCHAR(100), @Funcao NVARCHAR(60),
    @Diaria DECIMAL(10,2), @Transporte DECIMAL(10,2), @Alimentacao DECIMAL(10,2),
    @Telefone VARCHAR(20), @Ativo BIT, @ObraId VARCHAR(36) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Funcionario WHERE Id = @Id)
        UPDATE Funcionario SET Nome=@Nome, Funcao=@Funcao, Diaria=@Diaria,
            Transporte=@Transporte, Alimentacao=@Alimentacao, Telefone=@Telefone,
            Ativo=@Ativo, ObraId=@ObraId
        WHERE Id = @Id;
    ELSE
        INSERT INTO Funcionario (Id,Nome,Funcao,Diaria,Transporte,Alimentacao,Telefone,Ativo,ObraId)
        VALUES (@Id,@Nome,@Funcao,@Diaria,@Transporte,@Alimentacao,@Telefone,@Ativo,@ObraId);
END;

IF OBJECT_ID('sp_SalvarPresenca','P') IS NOT NULL DROP PROCEDURE sp_SalvarPresenca;
EXEC('
CREATE PROCEDURE sp_SalvarPresenca
    @Id VARCHAR(36), @FuncionarioId VARCHAR(36), @ObraId VARCHAR(36),
    @Data DATE, @HoraEntrada VARCHAR(8), @HoraSaida VARCHAR(8) = NULL,
    @Lat DECIMAL(10,7), @Lng DECIMAL(10,7), @DistanciaObra INT, @Status VARCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Presenca WHERE Id = @Id)
        UPDATE Presenca SET HoraSaida=CAST(@HoraSaida AS TIME(0)), Status=@Status, DistanciaObra=@DistanciaObra
        WHERE Id = @Id;
    ELSE
        INSERT INTO Presenca (Id,FuncionarioId,ObraId,Data,HoraEntrada,HoraSaida,Lat,Lng,DistanciaObra,Status)
        VALUES (@Id,@FuncionarioId,@ObraId,@Data,CAST(@HoraEntrada AS TIME(0)),CAST(@HoraSaida AS TIME(0)),@Lat,@Lng,@DistanciaObra,@Status);
END;
');
