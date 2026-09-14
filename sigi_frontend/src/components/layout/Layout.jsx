/**
 * AUSENTRACK - Layout principal con sidebar
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import pokeLogo from '../../assets/poke-logo.png';
import './Layout.css';

const menuItems = [
    { path: '/dashboard',      label: 'Dashboard',      roles: ['ADMIN'] },
    { path: '/colaboradores',  label: 'Colaboradores',  roles: ['ADMIN', 'TALENTO_HUMANO', 'NOMINA'] },
    { path: '/entidades',      label: 'Seguridad Social',      roles: ['ADMIN'] },
    { seccion: 'SST', path: '/incapacidades',  label: 'Incapacidades',  roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { seccion: 'SST', path: '/dotacion', label: 'Dotación y EPP', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/procesos-disciplinarios', label: 'Procesos Disciplinarios', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/reclutamiento', label: 'Reclutamiento', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/contratos', label: 'Contratos', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/evaluaciones', label: 'Evaluaciones', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/capacitaciones', label: 'Capacitaciones', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/puntos-venta', label: 'Puntos de Venta', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/vacaciones', label: 'Vacaciones', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/retiros', label: 'Retiros', roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/reportes',       label: 'Reportes',       roles: ['ADMIN', 'TALENTO_HUMANO', 'NOMINA'] },
    { path: '/usuarios',       label: 'Usuarios',       roles: ['ADMIN'] },
    { path: '/auditoria',      label: 'Auditoria',      roles: ['ADMIN'] },
];

export default function Layout({ children }) {
    const { usuario, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        try {
            await logout();
        } catch {
            // El cierre de sesion nunca debe bloquear la salida del usuario.
        }
        navigate('/login');
    }

    const itemsVisibles = menuItems.filter((item) =>
        item.roles.includes(usuario?.rol)
    );

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <img src={pokeLogo} alt="Poke" className="sidebar-logo-img" />
                    <span className="sidebar-titulo">AUSENTRACK</span>
                    <span className="sidebar-subtitulo">Gestión de Talento Humano</span>
                </div>

                <nav className="sidebar-nav">
                    {itemsVisibles.map((item, idx) => (
                        <div key={item.path}>
                            {item.seccion && itemsVisibles[idx - 1]?.seccion !== item.seccion && (
                                <div className="sidebar-seccion-titulo">{item.seccion}</div>
                            )}
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    'sidebar-link' + (isActive ? ' sidebar-link-activo' : '')
                                }
                            >
                                {item.label}
                            </NavLink>
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-usuario">
                        <span className="sidebar-nombre">{usuario?.nombre}</span>
                        <span className="sidebar-rol">{usuario?.rol?.replace('_', ' ')}</span>
                    </div>
                    <NavLink to="/perfil" className="sidebar-perfil-link">
                        Mi perfil
                    </NavLink>
                    <button className="sidebar-logout" onClick={handleLogout}>
                        Cerrar sesion
                    </button>
                </div>
            </aside>

            <main className="layout-main">
                {children}
            </main>
        </div>
    );
}
