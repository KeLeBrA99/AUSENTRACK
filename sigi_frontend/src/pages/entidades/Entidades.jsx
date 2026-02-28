/**
 * SIGI - Pagina de gestion de Entidades (EPS / ARL)
 */

import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import Tabla from '../../components/ui/Tabla';
import Modal from '../../components/ui/Modal';
import { obtenerEntidades, crearEntidad, actualizarEntidad, eliminarEntidad } from '../../api/colaboradores';
import '../../components/layout/Layout.css';

const formVacio = { tipo: 'EPS', nombre: '', nit: '', telefono: '', plataforma_url: '' };

export default function Entidades() {
    const [entidades, setEntidades]     = useState([]);
    const [filtroTipo, setFiltroTipo]   = useState('');
    const [cargando, setCargando]       = useState(true);
    const [modal, setModal]             = useState(false);
    const [form, setForm]               = useState(formVacio);
    const [editando, setEditando]       = useState(null);
    const [error, setError]             = useState('');
    const [guardando, setGuardando]     = useState(false);

    useEffect(() => {
        cargar();
    }, [filtroTipo]);

    async function cargar() {
        setCargando(true);
        try {
            const res = await obtenerEntidades(filtroTipo || null);
            setEntidades(res.data);
        } catch {
            setError('No se pudieron cargar las entidades.');
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

    function abrirEditar(entidad) {
        setForm({
            tipo:           entidad.tipo,
            nombre:         entidad.nombre,
            nit:            entidad.nit || '',
            telefono:       entidad.telefono || '',
            plataforma_url: entidad.plataforma_url || '',
        });
        setEditando(entidad.id_entidad);
        setError('');
        setModal(true);
    }

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function handleGuardar(e) {
        e.preventDefault();
        if (!form.nombre.trim()) {
            setError('El nombre es obligatorio.');
            return;
        }
        setGuardando(true);
        setError('');
        try {
            if (editando) {
                await actualizarEntidad(editando, form);
            } else {
                await crearEntidad(form);
            }
            setModal(false);
            cargar();
        } catch (err) {
            setError('Ocurrio un error al guardar. Verifica los datos.');
        } finally {
            setGuardando(false);
        }
    }

    async function handleEliminar(id) {
        if (!window.confirm('Deseas desactivar esta entidad?')) return;
        try {
            await eliminarEntidad(id);
            cargar();
        } catch {
            alert('No se pudo desactivar la entidad.');
        }
    }

    const columnas = [
        { key: 'tipo',   label: 'Tipo', render: (v) => (
            <span className={`badge badge-${v.toLowerCase()}`}>{v}</span>
        )},
        { key: 'nombre',   label: 'Nombre' },
        { key: 'nit',      label: 'NIT' },
        { key: 'telefono', label: 'Telefono' },
        { key: 'activo',   label: 'Estado', render: (v) => (
            <span className={`badge ${v ? 'badge-activo' : 'badge-inactivo'}`}>
                {v ? 'Activa' : 'Inactiva'}
            </span>
        )},
    ];

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">EPS / ARL</h1>
                    <p className="pagina-subtitulo">Gestion de entidades de seguridad social</p>
                </div>
                <button className="btn-primario" onClick={abrirCrear}>
                    + Nueva entidad
                </button>
            </div>

            <div className="filtros">
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                    <option value="">Todos los tipos</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                </select>
            </div>

            {cargando ? (
                <p style={{ color: '#888', fontSize: 13 }}>Cargando...</p>
            ) : (
                <Tabla
                    columnas={columnas}
                    datos={entidades}
                    acciones={(fila) => (
                        <>
                            <button className="btn-editar" onClick={() => abrirEditar(fila)}>Editar</button>
                            <button className="btn-eliminar" onClick={() => handleEliminar(fila.id_entidad)}>Desactivar</button>
                        </>
                    )}
                />
            )}

            {modal && (
                <Modal titulo={editando ? 'Editar entidad' : 'Nueva entidad'} onCerrar={() => setModal(false)}>
                    <form onSubmit={handleGuardar}>
                        {error && <div className="alerta-error">{error}</div>}
                        <div className="form-grid">
                            <div className="form-field">
                                <label>Tipo</label>
                                <select name="tipo" value={form.tipo} onChange={handleChange}>
                                    <option value="EPS">EPS</option>
                                    <option value="ARL">ARL</option>
                                </select>
                            </div>
                            <div className="form-field">
                                <label>Nombre</label>
                                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre de la entidad" />
                            </div>
                            <div className="form-field">
                                <label>NIT</label>
                                <input name="nit" value={form.nit} onChange={handleChange} placeholder="NIT" />
                            </div>
                            <div className="form-field">
                                <label>Telefono</label>
                                <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="Telefono" />
                            </div>
                            <div className="form-field form-grid-full">
                                <label>URL plataforma de radicacion</label>
                                <input name="plataforma_url" value={form.plataforma_url} onChange={handleChange} placeholder="https://..." />
                            </div>
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
