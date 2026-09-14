/**
 * SIGI - Ruta protegida
 * Redirige al login si el usuario no esta autenticado.
 * Opcionalmente restringe el acceso por rol.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RutaProtegida({ children, roles = [] }) {
    const { usuario, cargando } = useAuth();

    if (cargando) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <p style={{ color: '#666', fontSize: '14px' }}>Cargando...</p>
            </div>
        );
    }

    if (!usuario) {
        return <Navigate to="/login" replace />;
    }

    if (roles.length > 0 && !roles.includes(usuario.rol)) {
        return <Navigate to="/sin-acceso" replace />;
    }

    return children;
}
