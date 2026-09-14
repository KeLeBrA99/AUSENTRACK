/**
 * AUSENTRACK - Pagina de gestion de usuarios
 */

import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import Tabla from '../../components/ui/Tabla';
import Modal from '../../components/ui/Modal';
import { obtenerUsuarios, crearUsuario, actualizarUsuario, desactivarUsuario } from '../../api/usuarios';
import '../../components/layout/Layout.css';

const ROLES = [
    { value: 'ADMIN',          label: 'Administrador' },
    { value: 'TALENTO_HUMANO', label: 'Talento Humano' },
    { value: 'NOMINA',         label: 'Nomina' },
];

const formVacio = { nombre: '', email: '', password: '', rol: 'TALENTO_HUMANO', activo: true };

export default function Usuarios() {
    const [usuarios, setUsuarios]   = useState([]);
    const [cargando, setCargando]   = useState(true);
    const [modal, setModal]         = useState(false);
    const [form, setForm]           = useState(formVacio);
    const [editando, setEditando]   = useState(null);
    const [error, setError]         = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => { cargar(); }, []);

    async function cargar() {
        setCargando(true);
        try {
            const res = await obtenerUsuarios();
            setUsuarios(res.data);
        } catch {
            setError('No se pudieron cargar los usuarios.');
        } finally {
            setCargando(false);
        }
    }

    function abrirCrear() {
        setForm(formVacio);
        setEditando(null);
        setError('');
        setModal(true);
    }

    function abrirEditar(u) {
        setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: u.activo });
        setEditando(u.id_usuario);
        setError('');
        setModal(true);
    }

    function handleChange(e) {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm({ ...form, [e.target.name]: val });
    }

    async function handleGuardar(e) {
        e.preventDefault();
        if (!form.nombre || !form.email) { setError('Nombre y email son obligatorios.'); return; }
        if (!editando && !form.password) { setError('La contrasena es obligatoria para nuevos usuarios.'); return; }

        setGuardando(true);
        setError('');
        try {
            const payload = { nombre: form.nombre, email: form.email, rol: form.rol, activo: form.activo };
            if (form.password) payload.password = form.password;

            if (editando) {
                await actualizarUsuario(editando, payload);
            } else {
                await crearUsuario({ ...payload, password: form.password });
            }
            setModal(false);
            cargar();
        } catch (err) {
            const data = err.response?.data;
            const msg  = data?.email?.[0] || data?.detail || 'Error al guardar el usuario.';
            setError(msg);
        } finally {
            setGuardando(false);
        }
    }

    async function handleDesactivar(id) {
        if (!window.confirm('Deseas desactivar este usuario?')) return;
        try {
            await desactivarUsuario(id);
            cargar();
        } catch {
            alert('No se pudo desactivar el usuario.');
        }
    }

    const columnas = [
        { key: 'nombre',     label: 'Nombre' },
        { key: 'email',      label: 'Email' },
        { key: 'rol',        label: 'Rol', render: (v) => {
            const r = ROLES.find((r) => r.value === v);
            return r ? r.label : v;
        }},
        { key: 'activo',     label: 'Estado', render: (v) => (
            <span className={`badge ${v ? 'badge-activo' : 'badge-inactivo'}`}>
                {v ? 'Activo' : 'Inactivo'}
            </span>
        )},
        { key: 'created_at', label: 'Creado', render: (v) => v ? v.split('T')[0] : '-' },
    ];

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Usuarios</h1>
                    <p className="pagina-subtitulo">Gestion de accesos al sistema</p>
                </div>
                <button className="btn-primario" onClick={abrirCrear}>+ Nuevo usuario</button>
            </div>

            {error && <div className="alerta-error">{error}</div>}

            {cargando ? (
                <p style={{ color: '#888', fontSize: 13 }}>Cargando...</p>
            ) : (
                <Tabla
                    columnas={columnas}
                    datos={usuarios}
                    acciones={(fila) => (
                        <>
                            <button className="btn-editar"   onClick={() => abrirEditar(fila)}>Editar</button>
                            <button className="btn-eliminar" onClick={() => handleDesactivar(fila.id_usuario)}>Desactivar</button>
                        </>
                    )}
                />
            )}

            {modal && (
                <Modal titulo={editando ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={() => setModal(false)}>
                    <form onSubmit={handleGuardar}>
                        {error && <div className="alerta-error">{error}</div>}
                        <div className="form-grid">
                            <div className="form-field form-grid-full">
                                <label>Nombre completo</label>
                                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre completo" />
                            </div>
                            <div className="form-field form-grid-full">
                                <label>Email</label>
                                <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" />
                            </div>
                            <div className="form-field">
                                <label>{editando ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena'}</label>
                                <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Contrasena" />
                            </div>
                            <div className="form-field">
                                <label>Rol</label>
                                <select name="rol" value={form.rol} onChange={handleChange}>
                                    {ROLES.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                            {editando && (
                                <div className="form-field form-grid-full" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} id="activo" />
                                    <label htmlFor="activo" style={{ marginBottom: 0 }}>Usuario activo</label>
                                </div>
                            )}
                        </div>
                        <div className="form-acciones">
                            <button type="button" className="btn-secundario" onClick={() => setModal(false)}>Cancelar</button>
                            <button type="submit" className="btn-primario" disabled={guardando}>
                                {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </Layout>
    );
}
