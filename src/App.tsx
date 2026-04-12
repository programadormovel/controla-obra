import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Presenca from './pages/Presenca';
import Funcionarios from './pages/Funcionarios';
import Obras from './pages/Obras';
import Relatorio from './pages/Relatorio';
import Cargos from './pages/Cargos';
import Usuarios from './pages/Usuarios';
import GestaoPresencas from './pages/GestaoPresencas';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.perfil !== 'admin') return <Navigate to="/presenca" replace />;
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { usuario } = useAuth();

  if (!usuario) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/presenca" element={<PrivateRoute><Presenca /></PrivateRoute>} />
        <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/funcionarios" element={<AdminRoute><Funcionarios /></AdminRoute>} />
        <Route path="/obras" element={<AdminRoute><Obras /></AdminRoute>} />
        <Route path="/gestao-presencas" element={<AdminRoute><GestaoPresencas /></AdminRoute>} />
        <Route path="/relatorio" element={<AdminRoute><Relatorio /></AdminRoute>} />
        <Route path="/cargos" element={<AdminRoute><Cargos /></AdminRoute>} />
        <Route path="/usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
        <Route path="/login" element={<Navigate to={usuario.perfil === 'admin' ? '/' : '/presenca'} replace />} />
        <Route path="*" element={<Navigate to={usuario.perfil === 'admin' ? '/' : '/presenca'} replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
