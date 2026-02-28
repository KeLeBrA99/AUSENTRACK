/**
 * AUSENTRACK - Layout principal con sidebar
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const menuItems = [
    { path: '/dashboard',      label: 'Dashboard',      roles: ['ADMIN'] },
    { path: '/colaboradores',  label: 'Colaboradores',  roles: ['ADMIN', 'TALENTO_HUMANO', 'NOMINA'] },
    { path: '/entidades',      label: 'EPS / ARL',      roles: ['ADMIN'] },
    { path: '/incapacidades',  label: 'Incapacidades',  roles: ['ADMIN', 'TALENTO_HUMANO'] },
    { path: '/reportes',       label: 'Reportes',       roles: ['ADMIN', 'TALENTO_HUMANO', 'NOMINA'] },
    { path: '/usuarios',       label: 'Usuarios',       roles: ['ADMIN'] },
    { path: '/auditoria',      label: 'Auditoria',      roles: ['ADMIN'] },
];

export default function Layout({ children }) {
    const { usuario, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    const itemsVisibles = menuItems.filter((item) =>
        item.roles.includes(usuario?.rol)
    );

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <span className="sidebar-titulo">AUSENTRACK</span>
                    <span className="sidebar-subtitulo">Gestion de Incapacidades</span>
                </div>

                <nav className="sidebar-nav">
                    {itemsVisibles.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                'sidebar-link' + (isActive ? ' sidebar-link-activo' : '')
                            }
                        >
                            {item.label}
                        </NavLink>
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
