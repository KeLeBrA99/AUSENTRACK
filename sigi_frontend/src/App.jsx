/**
 * AUSENTRACK - Componente principal con enrutamiento
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import RutaProtegida from './components/layout/RutaProtegida';

import Login          from './pages/auth/Login';
import Dashboard      from './pages/dashboard/Dashboard';
import Colaboradores  from './pages/colaboradores/Colaboradores';
import Entidades      from './pages/entidades/Entidades';
import Incapacidades  from './pages/incapacidades/Incapacidades';
import ProcesosDisciplinarios from './pages/procesos-disciplinarios/ProcesosDisciplinarios';
import Reclutamiento from './pages/reclutamiento/Reclutamiento';
import Contratos from './pages/contratos/Contratos';
import Evaluaciones from './pages/evaluaciones/Evaluaciones';
import Capacitaciones from './pages/capacitaciones/Capacitaciones';
import PuntosVenta from './pages/puntos-venta/PuntosVenta';
import Vacaciones from './pages/vacaciones/Vacaciones';
import EvaluacionPublica from './pages/evaluacion-publica/EvaluacionPublica';
import Retiros from './pages/retiros/Retiros';
import Dotacion from './pages/dotacion/Dotacion';
import Reportes       from './pages/reportes/Reportes';
import Usuarios       from './pages/usuarios/Usuarios';
import Auditoria      from './pages/auditoria/Auditoria';
import Perfil         from './pages/perfil/Perfil';
import Layout         from './components/layout/Layout';

function SinAcceso() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#1A1A1A' }}>Acceso restringido</h2>
                <p style={{ color: '#888', marginTop: 8, fontSize: 13 }}>No tienes permiso para acceder a esta pagina.</p>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <ErrorBoundary>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/evaluar/:token" element={<EvaluacionPublica />} />

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

                    <Route path="/procesos-disciplinarios" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <ProcesosDisciplinarios />
                        </RutaProtegida>
                    } />

                    <Route path="/reclutamiento" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Reclutamiento />
                        </RutaProtegida>
                    } />

                    <Route path="/contratos" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Contratos />
                        </RutaProtegida>
                    } />

                    <Route path="/evaluaciones" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Evaluaciones />
                        </RutaProtegida>
                    } />

                    <Route path="/capacitaciones" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Capacitaciones />
                        </RutaProtegida>
                    } />

                    <Route path="/puntos-venta" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <PuntosVenta />
                        </RutaProtegida>
                    } />

                    <Route path="/vacaciones" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Vacaciones />
                        </RutaProtegida>
                    } />

                    <Route path="/retiros" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Retiros />
                        </RutaProtegida>
                    } />

                    <Route path="/dotacion" element={
                        <RutaProtegida roles={['ADMIN', 'TALENTO_HUMANO']}>
                            <Dotacion />
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
                </ErrorBoundary>
            </BrowserRouter>
        </AuthProvider>
    );
}
