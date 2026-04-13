export type Cargo = {
  id: string;
  nome: string;
  diaria: number;
  transporte: number;
  alimentacao: number;
};

export type Funcionario = {
  id: string;
  nome: string;
  funcao: string;
  diaria: number;
  transporte: number;
  alimentacao: number;
  telefone: string;
  ativo: boolean;
  obraId: string | null;
};

export type Obra = {
  id: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  ativa: boolean;
  turnoNoturno: boolean;
};

export type TipoRegistro = 'entrada' | 'saida-almoco' | 'retorno-almoco' | 'saida-jantar' | 'retorno-jantar' | 'saida';

export type Presenca = {
  id: string;
  funcionarioId: string;
  obraId: string;
  data: string;
  horaEntrada: string;
  horaSaida?: string;
  tipoRegistro?: TipoRegistro;
  horaUltimoRegistro?: string;
  saidaAlmoco?: string;
  retornoAlmoco?: string;
  saidaJantar?: string;
  retornoJantar?: string;
  turnoNoturno?: boolean;
  minutosTrabalhados?: number;
  minutosTrabalhadosTotal?: number;
  lat: number;
  lng: number;
  distanciaObra: number;
  status: "presente" | "ausente" | "meio-periodo";
  fotoEntrada?: string;
  fotoSaida?: string;
  horaExtraAutorizada?: boolean;
  autorizadoPor?: string;
};

export type UsuarioAdmin = {
  id: string;
  login: string;
  perfil: 'admin' | 'funcionario';
  funcionarioId: string | null;
  funcionarioNome: string | null;
  email: string | null;
  ativo: boolean;
};

export type Perfil = 'admin' | 'funcionario';

export type Usuario = {
  id: string;
  login: string;
  perfil: Perfil;
  funcionarioId: string | null;
  funcionarioNome: string | null;
  funcao: string | null;
};
