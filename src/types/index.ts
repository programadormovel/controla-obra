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
  status: "presente" | "ausente" | "meio-periodo";
  fotoEntrada?: string;
  fotoSaida?: string;
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
