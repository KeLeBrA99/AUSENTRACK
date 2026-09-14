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
    retirarColaborador,
    reactivarColaborador,
} from '../../api/colaboradores';
import { obtenerEntidades, obtenerEmpresas } from '../../api/colaboradores';
import { obtenerPuntosVenta } from '../../api/puntosVenta';
import ImportarExcel from './ImportarExcel';
import '../../components/layout/Layout.css';

const formVacio = {
    cedula: '', nombre: '', cargo: '', punto_venta: '',
    fecha_ingreso: '', empresa: '', eps: '', arl: '', caja_compensacion: '', fondo_pension: '',
};

export default function Colaboradores() {
    const [colaboradores, setColaboradores] = useState([]);
    const [pagina, setPagina] = useState(1);
    const [totalRegistros, setTotalRegistros] = useState(0);
    const [haySiguiente, setHaySiguiente] = useState(false);
    const [hayAnterior, setHayAnterior] = useState(false);
    const [empresas, setEmpresas]           = useState([]);
    const [listaEps, setListaEps]           = useState([]);
    const [listaArl, setListaArl]           = useState([]);
    const [listaCcf, setListaCcf]           = useState([]);
    const [listaAfp, setListaAfp]           = useState([]);
    const [puntosVenta, setPuntosVenta]     = useState([]);
    const [cargando, setCargando]           = useState(true);
    const [modal, setModal]                 = useState(false);
    const [modalImportar, setModalImportar] = useState(false);
    const [form, setForm]                   = useState(formVacio);
    const [editando, setEditando]           = useState(null);
    const [error, setError]                 = useState('');
    const [guardando, setGuardando]         = useState(false);

    const [filtros, setFiltros] = useState({ nombre: '', cedula: '', punto_venta: '', estado: 'activo' });
    const [modalRetiro, setModalRetiro] = useState(null); // colaborador a retirar
    const [motivoRetiro, setMotivoRetiro] = useState('');

    useEffect(() => {
        cargarDatosBase();
    }, []);

    useEffect(() => {
        cargar();
    }, [filtros, pagina]);

    async function cargarDatosBase() {
        try {
            const [empRes, epsRes, arlRes, pvRes, ccfRes, afpRes] = await Promise.all([
                obtenerEmpresas(),
                obtenerEntidades('EPS'),
                obtenerEntidades('ARL'),
                obtenerPuntosVenta({ activo: true }),
                obtenerEntidades('CCF'),
                obtenerEntidades('AFP'),
            ]);
            setEmpresas(empRes.data);
            setListaEps(epsRes.data);
            setListaArl(arlRes.data);
            setPuntosVenta(pvRes.data);
            setListaCcf(ccfRes.data);
            setListaAfp(afpRes.data);
        } catch {
            setError('No se pudieron cargar los datos de configuracion.');
        }
    }

    async function cargar() {
        setCargando(true);
        try {
            const params = { page: pagina };
            if (filtros.nombre) params.nombre = filtros.nombre;
            if (filtros.cedula) params.cedula = filtros.cedula;
            if (filtros.punto_venta) params.punto_venta = filtros.punto_venta;
            if (filtros.estado) params.estado = filtros.estado;
            const res = await obtenerColaboradores(params);
            setColaboradores(res.data.results);
            setTotalRegistros(res.data.count);
            setHaySiguiente(!!res.data.next);
            setHayAnterior(!!res.data.previous);
        } catch {
            setError('No se pudieron cargar los colaboradores.');
        } finally {
            setCargando(false);
        }
    }

    function handleFiltro(e) {
        setFiltros({ ...filtros, [e.target.name]: e.target.value });
        setPagina(1);
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
            punto_venta:   c.punto_venta || '',
            fecha_ingreso: c.fecha_ingreso,
            empresa:       c.empresa || '',
            eps:           c.eps || '',
            arl:           c.arl || '',
            caja_compensacion: c.caja_compensacion || '',
            fondo_pension: c.fondo_pension || '',
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
                punto_venta: form.punto_venta || null,
                eps: form.eps || null,
                arl: form.arl || null,
                caja_compensacion: form.caja_compensacion || null,
                fondo_pension: form.fondo_pension || null,
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

    function abrirRetiro(colaborador) {
        setModalRetiro(colaborador);
        setMotivoRetiro('');
    }

    async function confirmarRetiro() {
        try {
            await retirarColaborador(modalRetiro.id_colaborador, { motivo_retiro: motivoRetiro });
            setModalRetiro(null);
            cargar();
        } catch {
            alert('No se pudo retirar al colaborador.');
        }
    }

    async function handleReactivar(id) {
        if (!window.confirm('¿Deseas reactivar a este colaborador?')) return;
        try {
            await reactivarColaborador(id);
            cargar();
        } catch {
            alert('No se pudo reactivar al colaborador.');
        }
    }

    const columnas = [
        { key: 'cedula',         label: 'Cedula' },
        { key: 'nombre',         label: 'Nombre' },
        { key: 'cargo',          label: 'Cargo' },
        { key: 'punto_venta_nombre', label: 'Punto de Venta' },
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
                <select
                    name="punto_venta"
                    value={filtros.punto_venta}
                    onChange={handleFiltro}
                >
                    <option value="">Todos los puntos de venta</option>
                    {puntosVenta.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                </select>
                <select
                    name="estado"
                    value={filtros.estado}
                    onChange={handleFiltro}
                >
                    <option value="">Todos (activos y retirados)</option>
                    <option value="activo">Solo activos</option>
                    <option value="retirado">Solo retirados</option>
                </select>
            </div>

            {error && <div className="alerta-error">{error}</div>}

            {cargando ? (
                <p style={{ color: '#888', fontSize: 13 }}>Cargando...</p>
            ) : (
                <>
                <Tabla
                    columnas={columnas}
                    datos={colaboradores}
                    acciones={(fila) => (
                        <>
                            <button className="btn-editar" onClick={() => abrirEditar(fila)}>Editar</button>
                            {fila.activo ? (
                                <button className="btn-eliminar" onClick={() => abrirRetiro(fila)}>Retirar</button>
                            ) : (
                                <button className="btn-editar" onClick={() => handleReactivar(fila.id_colaborador)}>Reactivar</button>
                            )}
                        </>
                    )}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12.5, color: '#6B6F76' }}>
                    <span>
                        {totalRegistros > 0
                            ? `Mostrando ${(pagina - 1) * 50 + 1}–${Math.min(pagina * 50, totalRegistros)} de ${totalRegistros}`
                            : 'Sin resultados'}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secundario" onClick={() => setPagina(p => p - 1)} disabled={!hayAnterior}>← Anterior</button>
                        <span style={{ padding: '6px 4px' }}>Página {pagina}</span>
                        <button className="btn-secundario" onClick={() => setPagina(p => p + 1)} disabled={!haySiguiente}>Siguiente →</button>
                    </div>
                </div>
                </>
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
                                <label>Punto de venta</label>
                                <select name="punto_venta" value={form.punto_venta} onChange={handleChange}>
                                    <option value="">Sin asignar</option>
                                    {puntosVenta.map((p) => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
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
                            <div className="form-field">
                                <label>Caja de Compensación</label>
                                <select name="caja_compensacion" value={form.caja_compensacion} onChange={handleChange}>
                                    <option value="">Sin caja asignada</option>
                                    {listaCcf.map((e) => (
                                        <option key={e.id_entidad} value={e.id_entidad}>
                                            {e.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-field">
                                <label>Fondo de Pensión</label>
                                <select name="fondo_pension" value={form.fondo_pension} onChange={handleChange}>
                                    <option value="">Sin fondo asignado</option>
                                    {listaAfp.map((e) => (
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
            {modalRetiro && (
                <Modal titulo={`Retirar a ${modalRetiro.nombre}`} onCerrar={() => setModalRetiro(null)}>
                    <p style={{ fontSize: 13, color: '#4B554E', marginBottom: 14 }}>
                        El colaborador quedará marcado como retirado, pero su historial (incapacidades, contratos, evaluaciones) se conserva.
                    </p>
                    <div className="form-field">
                        <label>Motivo del retiro (opcional)</label>
                        <textarea
                            value={motivoRetiro}
                            onChange={(e) => setMotivoRetiro(e.target.value)}
                            placeholder="Ej: Renuncia voluntaria, terminación de contrato..."
                            style={{ width: '100%', minHeight: 70 }}
                        />
                    </div>
                    <div className="form-acciones" style={{ marginTop: 14 }}>
                        <button className="btn-secundario" onClick={() => setModalRetiro(null)}>Cancelar</button>
                        <button className="btn-eliminar" onClick={confirmarRetiro}>Confirmar retiro</button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}
