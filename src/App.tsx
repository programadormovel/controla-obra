import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Presenca from './pages/Presenca';
import Funcionarios from './pages/Funcionarios';
import Relatorio from './pages/Relatorio';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/presenca" element={<Presenca />} />
          <Route path="/funcionarios" element={<Funcionarios />} />
          <Route path="/relatorio" element={<Relatorio />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
