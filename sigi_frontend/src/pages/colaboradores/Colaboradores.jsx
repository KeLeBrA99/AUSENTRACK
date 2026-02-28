/**
 * AUSENTRACK - Pagina de gestion de Colaboradores
 */

import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import Tabla from '../../components/ui/Tabla';
import Modal from '../../components/ui/Modal';
import {
    obtenerColaboradores,
    crearColaborador,
    actualizarColaborador,
    desactivarColaborador,
} from '../../api/colaboradores';
import { obtenerEntidades, obtenerEmpresas } from '../../api/colaboradores';
import ImportarExcel from './ImportarExcel';
import '../../components/layout/Layout.css';

const formVacio = {
    cedula: '', nombre: '', cargo: '', area: '',
    fecha_ingreso: '', empresa: '', eps: '', arl: '',
};

export default function Colaboradores() {
    const [colaboradores, setColaboradores] = useState([]);
    const [empresas, setEmpresas]           = useState([]);
    const [listaEps, setListaEps]           = useState([]);
    const [listaArl, setListaArl]           = useState([]);
    const [cargando, setCargando]           = useState(true);
    const [modal, setModal]                 = useState(false);
    const [modalImportar, setModalImportar] = useState(false);
    const [form, setForm]                   = useState(formVacio);
    const [editando, setEditando]           = useState(null);
    const [error, setError]                 = useState('');
    const [guardando, setGuardando]         = useState(false);

    const [filtros, setFiltros] = useState({ nombre: '', cedula: '', area: '' });

    useEffect(() => {
        cargarDatosBase();
    }, []);

    useEffect(() => {
        cargar();
    }, [filtros]);

    async function cargarDatosBase() {
        try {
            const [empRes, epsRes, arlRes] = await Promise.all([
                obtenerEmpresas(),
                obtenerEntidades('EPS'),
                obtenerEntidades('ARL'),
            ]);
            setEmpresas(empRes.data);
            setListaEps(epsRes.data);
            setListaArl(arlRes.data);
        } catch {
            setError('No se pudieron cargar los datos de configuracion.');
        }
    }

    async function cargar() {
        setCargando(true);
        try {
            const params = {};
            if (filtros.nombre) params.nombre = filtros.nombre;
            if (filtros.cedula) params.cedula = filtros.cedula;
            if (filtros.area)   params.area   = filtros.area;
            const res = await obtenerColaboradores(params);
            setColaboradores(res.data);
        } catch {
            setError('No se pudieron cargar los colaboradores.');
        } finally {
            setCargando(false);
        }
    }

    function handleFiltro(e) {
        setFiltros({ ...filtros, [e.target.name]: e.target.value });
    }

    function abrirCrear() {
        setForm({
            ...formVacio,
            empresa: empresas[0]?.id_empresa || '',
        });
        setEditando(null);
        setError('');
        setModal(true);
    }

    function abrirEditar(c) {
        setForm({
            cedula:        c.cedula,
            nombre:        c.nombre,
            cargo:         c.cargo || '',
            area:          c.area || '',
            fecha_ingreso: c.fecha_ingreso,
            empresa:       c.empresa || '',
            eps:           c.eps || '',
            arl:           c.arl || '',
        });
        setEditando(c.id_colaborador);
        setError('');
        setModal(true);
    }

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function handleGuardar(e) {
        e.preventDefault();
        if (!form.cedula || !form.nombre || !form.fecha_ingreso || !form.empresa) {
            setError('Cedula, nombre, fecha de ingreso y empresa son obligatorios.');
            return;
        }
        setGuardando(true);
        setError('');
        try {
            const payload = {
                ...form,
                eps: form.eps || null,
                arl: form.arl || null,
            };
            if (editando) {
                await actualizarColaborador(editando, payload);
            } else {
                await crearColaborador(payload);
            }
            setModal(false);
            cargar();
        } catch (err) {
            const msg = err.response?.data?.cedula?.[0] || 'Ocurrio un error al guardar.';
            setError(msg);
        } finally {
            setGuardando(false);
        }
    }

    async function handleDesactivar(id) {
        if (!window.confirm('Deseas desactivar este colaborador?')) return;
        try {
            await desactivarColaborador(id);
            cargar();
        } catch {
            alert('No se pudo desactivar el colaborador.');
        }
    }

    const columnas = [
        { key: 'cedula',         label: 'Cedula' },
        { key: 'nombre',         label: 'Nombre' },
        { key: 'cargo',          label: 'Cargo' },
        { key: 'area',           label: 'Area' },
        { key: 'eps_nombre',     label: 'EPS' },
        { key: 'arl_nombre',     label: 'ARL' },
        { key: 'fecha_ingreso',  label: 'Ingreso' },
        { key: 'activo', label: 'Estado', render: (v) => (
            <span className={`badge ${v ? 'badge-activo' : 'badge-inactivo'}`}>
                {v ? 'Activo' : 'Inactivo'}
            </span>
        )},
    ];

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Colaboradores</h1>
                    <p className="pagina-subtitulo">Registro y gestion del personal</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-secundario" onClick={() => setModalImportar(true)}>
                        Importar Excel
                    </button>
                    <button className="btn-primario" onClick={abrirCrear}>
                        + Nuevo colaborador
                    </button>
                </div>
            </div>

            <div className="filtros">
                <input
                    name="nombre"
                    placeholder="Buscar por nombre..."
                    value={filtros.nombre}
                    onChange={handleFiltro}
                />
                <input
                    name="cedula"
                    placeholder="Buscar por cedula..."
                    value={filtros.cedula}
                    onChange={handleFiltro}
                />
                <input
                    name="area"
                    placeholder="Filtrar por area..."
                    value={filtros.area}
                    onChange={handleFiltro}
                />
            </div>

            {error && <div className="alerta-error">{error}</div>}

            {cargando ? (
                <p style={{ color: '#888', fontSize: 13 }}>Cargando...</p>
            ) : (
                <Tabla
                    columnas={columnas}
                    datos={colaboradores}
                    acciones={(fila) => (
                        <>
                            <button className="btn-editar" onClick={() => abrirEditar(fila)}>Editar</button>
                            <button className="btn-eliminar" onClick={() => handleDesactivar(fila.id_colaborador)}>Desactivar</button>
                        </>
                    )}
                />
            )}

            {modal && (
                <Modal
                    titulo={editando ? 'Editar colaborador' : 'Nuevo colaborador'}
                    onCerrar={() => setModal(false)}
                >
                    <form onSubmit={handleGuardar}>
                        {error && <div className="alerta-error">{error}</div>}
                        <div className="form-grid">
                            <div className="form-field">
                                <label>Cedula</label>
                                <input
                                    name="cedula"
                                    value={form.cedula}
                                    onChange={handleChange}
                                    placeholder="Numero de cedula"
                                    disabled={!!editando}
                                />
                            </div>
                            <div className="form-field">
                                <label>Nombre completo</label>
                                <input
                                    name="nombre"
                                    value={form.nombre}
                                    onChange={handleChange}
                                    placeholder="Nombre completo"
                                />
                            </div>
                            <div className="form-field">
                                <label>Cargo</label>
                                <input
                                    name="cargo"
                                    value={form.cargo}
                                    onChange={handleChange}
                                    placeholder="Cargo"
                                />
                            </div>
                            <div className="form-field">
                                <label>Area</label>
                                <input
                                    name="area"
                                    value={form.area}
                                    onChange={handleChange}
                                    placeholder="Area o departamento"
                                />
                            </div>
                            <div className="form-field">
                                <label>Fecha de ingreso</label>
                                <input
                                    type="date"
                                    name="fecha_ingreso"
                                    value={form.fecha_ingreso}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-field">
                                <label>Empresa</label>
                                <select name="empresa" value={form.empresa} onChange={handleChange}>
                                    <option value="">Seleccionar empresa</option>
                                    {empresas.map((e) => (
                                        <option key={e.id_empresa} value={e.id_empresa}>
                                            {e.razon_social}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-field">
                                <label>EPS</label>
                                <select name="eps" value={form.eps} onChange={handleChange}>
                                    <option value="">Sin EPS asignada</option>
                                    {listaEps.map((e) => (
                                        <option key={e.id_entidad} value={e.id_entidad}>
                                            {e.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-field">
                                <label>ARL</label>
                                <select name="arl" value={form.arl} onChange={handleChange}>
                                    <option value="">Sin ARL asignada</option>
                                    {listaArl.map((e) => (
                                        <option key={e.id_entidad} value={e.id_entidad}>
                                            {e.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-acciones">
                            <button type="button" className="btn-secundario" onClick={() => setModal(false)}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primario" disabled={guardando}>
                                {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {modalImportar && (
                <Modal titulo="Importar colaboradores desde Excel" onCerrar={() => setModalImportar(false)}>
                    <ImportarExcel
                        onImportado={() => { cargar(); }}
                        onCerrar={() => setModalImportar(false)}
                    />
                </Modal>
            )}
        </Layout>
    );
}
