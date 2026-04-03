import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Registro from './components/Registro';
import Menu from './components/Menu';
import Mesa from './components/Mesa';
import Cuenta from './components/Cuenta';
import CerrarPagar from './components/CerrarPagar';
import PuertaFisica from './components/PuertaFisica';


// Un componente temporal para cuando el login sea exitoso
function MenuPlaceholder() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#F37A20' }}>¡Bienvenido a WePay!</h1>
      <p>Has iniciado sesión correctamente. Aquí construiremos el menú.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Redirigir la raíz al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Ruta del Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Ruta de registro */}
        <Route path="/registro" element={<Registro />} />

        {/* Ruta del Menu */}
        <Route path="/menu" element={<Menu />} />

        {/* Ruta dinámica que recibe el ID de la sesión generada */}
        <Route path="/local/:nombre_restaurante/mesa/:id" element={<Mesa />} />
        {/* <Route path="/mesa/:id" element={<Mesa />} /> */}

        {/* Ruta para generar la cuenta */}
        <Route path="/cuenta/:id" element={<Cuenta />} />

        {/* Ruta para pagar la cuenta */}
        <Route path="/pagar/:id" element={<CerrarPagar />} />

        <Route path="/local/:nombre_restaurante/id/:restaurante_id/mesa_fisica/:numero_mesa" element={<PuertaFisica />} />


      </Routes>
    </BrowserRouter>
  );
}

export default App;