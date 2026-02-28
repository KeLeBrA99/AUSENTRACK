/**
 * AUSENTRACK - Componente principal con enrutamiento
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/layout/RutaProtegida';

import Login          from './pages/auth/Login';
import Dashboard      from './pages/dashboard/Dashboard';
import Colaboradores  from './pages/colaboradores/Colaboradores';
import Entidades      from './pages/entidades/Entidades';
import Incapacidades  from './pages/incapacidades/Incapacidades';
import Reportes       from './pages/reportes/Reportes';
import Usuarios       from './pages/usuarios/Usuarios';
import Auditoria      from './pages/auditoria/Auditoria';
import Perfil         from './pages/perfil/Perfil';
import Layout         from './components/layout/Layout';

function SinAcceso() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#1F3864' }}>Acceso restringido</h2>
                <p style={{ color: '#888', marginTop: 8, fontSize: 13 }}>No tienes permiso para acceder a esta pagina.</p>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    <Route path="/dashboard" element={
                        <RutaProtegida roles={['ADMIN']}>
                            <Dashboard />
                        </RutaProtegida>
                    } />

                    <Route path="/colaboradores" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO', 'NOMINA']}>
                            <Colaboradores />
                        </RutaProtegida>
                    } />

                    <Route path="/entidades" element={
                        <RutaProtegida roles={['ADMIN']}>
                            <Entidades />
                        </RutaProtegida>
                    } />

                    <Route path="/incapacidades" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Incapacidades />
                        </RutaProtegida>
                    } />

                    <Route path="/reportes" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO', 'NOMINA']}>
                            <Reportes />
                        </RutaProtegida>
                    } />

                    <Route path="/usuarios" element={
                        <RutaProtegida roles={['ADMIN']}>
                            <Usuarios />
                        </RutaProtegida>
                    } />

                    <Route path="/auditoria" element={
                        <RutaProtegida roles={['ADMIN']}>
                            <Auditoria />
                        </RutaProtegida>
                    } />

                    <Route path="/sin-acceso" element={<SinAcceso />} />
                    <Route path="/perfil" element={<RutaProtegida roles={['ADMIN','TALENTO_HUMANO','NOMINA']}><Perfil /></RutaProtegida>} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
