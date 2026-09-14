/**
 * AUSENTRACK - Pagina de perfil de usuario
 */

import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import api from '../../api/axios';
import '../../components/layout/Layout.css';
import './Perfil.css';

const ROL_LABELS = {
    ADMIN: 'Administrador',
    TALENTO_HUMANO: 'Talento Humano',
    NOMINA: 'Nomina',
};

export default function Perfil() {
    const [perfil, setPerfil]         = useState(null);
    const [formPass, setFormPass]     = useState({ password_actual: '', password_nuevo: '', password_confirmar: '' });
    const [msgPerfil, setMsgPerfil]   = useState('');
    const [msgPass, setMsgPass]       = useState('');
    const [errorPass, setErrorPass]   = useState('');
    const [guardando, setGuardando]   = useState(false);

    useEffect(() => {
        api.get('/auth/perfil/').then((res) => setPerfil(res.data)).catch(() => {});
    }, []);

    async function handleGuardarNombre(e) {
        e.preventDefault();
        setMsgPerfil('');
        try {
            await api.patch('/auth/perfil/', { nombre: perfil.nombre });
            setMsgPerfil('Nombre actualizado correctamente.');
        } catch {
            setMsgPerfil('Error al actualizar el nombre.');
        }
    }

    async function handleCambiarPassword(e) {
        e.preventDefault();
        setErrorPass('');
        setMsgPass('');
        if (formPass.password_nuevo !== formPass.password_confirmar) {
            setErrorPass('Las contrasenas nuevas no coinciden.');
            return;
        }
        if (formPass.password_nuevo.length < 8) {
            setErrorPass('La contrasena debe tener al menos 8 caracteres.');
            return;
        }
        setGuardando(true);
        try {
            await api.post('/auth/password/', {
                password_actual: formPass.password_actual,
                password_nuevo:  formPass.password_nuevo,
            });
            setMsgPass('Contrasena cambiada correctamente.');
            setFormPass({ password_actual: '', password_nuevo: '', password_confirmar: '' });
        } catch (err) {
            setErrorPass(err.response?.data?.detail || 'Error al cambiar la contrasena.');
        } finally {
            setGuardando(false);
        }
    }

    if (!perfil) return <Layout><p style={{ padding: 40, color: '#888' }}>Cargando...</p></Layout>;

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Mi Perfil</h1>
                    <p className="pagina-subtitulo">Configuracion de tu cuenta</p>
                </div>
            </div>

            <div className="perfil-grid">
                {/* Tarjeta de informacion */}
                <div className="perfil-card">
                    <div className="perfil-avatar">
                        {perfil.nombre?.charAt(0).toUpperCase()}
                    </div>
                    <div className="perfil-info-items">
                        <div className="perfil-info-item">
                            <span className="perfil-info-label">Nombre</span>
                            <span className="perfil-info-valor">{perfil.nombre}</span>
                        </div>
                        <div className="perfil-info-item">
                            <span className="perfil-info-label">Email</span>
                            <span className="perfil-info-valor">{perfil.email}</span>
                        </div>
                        <div className="perfil-info-item">
                            <span className="perfil-info-label">Rol</span>
                            <span className="badge badge-activo">{ROL_LABELS[perfil.rol] || perfil.rol}</span>
                        </div>
                        <div className="perfil-info-item">
                            <span className="perfil-info-label">Miembro desde</span>
                            <span className="perfil-info-valor">{perfil.created_at?.split('T')[0]}</span>
                        </div>
                    </div>
                </div>

                <div className="perfil-formularios">
                    {/* Cambiar nombre */}
                    <div className="perfil-seccion">
                        <h3 className="perfil-seccion-titulo">Actualizar nombre</h3>
                        <form onSubmit={handleGuardarNombre}>
                            <div className="form-field">
                                <label>Nombre completo</label>
                                <input
                                    value={perfil.nombre}
                                    onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })}
                                    placeholder="Tu nombre completo"
                                />
                            </div>
                            {msgPerfil && <div className="alerta-exito">{msgPerfil}</div>}
                            <button type="submit" className="btn-primario">Guardar nombre</button>
                        </form>
                    </div>

                    {/* Cambiar contraseña */}
                    <div className="perfil-seccion">
                        <h3 className="perfil-seccion-titulo">Cambiar contrasena</h3>
                        <form onSubmit={handleCambiarPassword}>
                            <div className="form-field">
                                <label>Contrasena actual</label>
                                <input
                                    type="password"
                                    value={formPass.password_actual}
                                    onChange={(e) => setFormPass({ ...formPass, password_actual: e.target.value })}
                                    placeholder="Contrasena actual"
                                />
                            </div>
                            <div className="form-field">
                                <label>Nueva contrasena</label>
                                <input
                                    type="password"
                                    value={formPass.password_nuevo}
                                    onChange={(e) => setFormPass({ ...formPass, password_nuevo: e.target.value })}
                                    placeholder="Minimo 8 caracteres"
                                />
                            </div>
                            <div className="form-field">
                                <label>Confirmar nueva contrasena</label>
                                <input
                                    type="password"
                                    value={formPass.password_confirmar}
                                    onChange={(e) => setFormPass({ ...formPass, password_confirmar: e.target.value })}
                                    placeholder="Repite la nueva contrasena"
                                />
                            </div>
                            {errorPass && <div className="alerta-error">{errorPass}</div>}
                            {msgPass   && <div className="alerta-exito">{msgPass}</div>}
                            <button type="submit" className="btn-primario" disabled={guardando}>
                                {guardando ? 'Cambiando...' : 'Cambiar contrasena'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
