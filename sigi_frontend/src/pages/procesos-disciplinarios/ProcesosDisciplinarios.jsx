/**
 * AUSENTRACK - Pagina de Procesos Disciplinarios
 * Puerto a React del panel original (KPIs, ranking por punto de venta,
 * distribucion por estado/tipo/cargo, alertas de riesgo, tabla filtrable,
 * modal de detalle/edicion, registro de nuevos casos, exportar Excel y PDF).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import api from '../../api/axios';
import { obtenerPuntosVenta } from '../../api/puntosVenta';
import {
    obtenerProcesos, crearProceso, actualizarProceso,
    obtenerEstadisticas, exportarProcesosExcel,
} from '../../api/procesosDisciplinarios';
import '../../components/layout/Layout.css';
import './ProcesosDisciplinarios.css';

const TIPOS_PROCESO = [
    { value: 'LLAMADO_ATENCION',         label: 'Llamado de Atención' },
    { value: 'CARTA_MEJORA',             label: 'Carta a la Mejora' },
    { value: 'DESCARGOS',                label: 'Descargos' },
    { value: 'SUSPENSION',               label: 'Suspensión' },
    { value: 'COMUNICADO_DISCIPLINARIO', label: 'Comunicado disciplinario' },
    { value: 'SIN_ESPECIFICAR',          label: 'Sin especificar' },
    { value: 'OTRO',                     label: 'Otro' },
];

const ESTADOS = [
    { value: 'EN_PROCESO', label: 'En Proceso' },
    { value: 'CERRADO',    label: 'Cerrado' },
    { value: 'ARCHIVADO',  label: 'Archivado' },
    { value: 'ABIERTO',    label: 'Abierto' },
    { value: 'DESISTIDO',  label: 'Desistido' },
];

const ESTADO_COLOR = { EN_PROCESO: '#B8752A', CERRADO: '#2F6F5E', ARCHIVADO: '#6B6F76', ABIERTO: '#A83E3E', DESISTIDO: '#6B6F76' };

const formVacio = {
    colaborador: '', nombre: '', cedula: '', cargo: '', punto_venta: '', punto_venta_fk: '',
    fecha_ingreso: '', antiguedad: '',
    tipo_proceso: 'LLAMADO_ATENCION', fecha_actuacion: '',
    motivo: '', responsable_hr: '', estado: 'EN_PROCESO',
    resultado: '', observaciones: '',
};

function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}
function labelTipo(v) { return TIPOS_PROCESO.find(t => t.value === v)?.label || v; }
function labelEstado(v) { return ESTADOS.find(e => e.value === v)?.label || v; }

function descargarBlob(blob, nombre) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', nombre);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

export default function ProcesosDisciplinarios() {
    const [procesos, setProcesos]         = useState([]);
    const [puntosVenta, setPuntosVenta]   = useState([]);
    const [stats, setStats]               = useState(null);
    const [cargando, setCargando]         = useState(true);
    const [error, setError]               = useState('');

    const [filtros, setFiltros] = useState({ search: '', estado: '', tipo_proceso: '', punto_venta: '', cargo: '' });

    const [detalle, setDetalle]           = useState(null);   // proceso seleccionado (ver/editar)
    const [editando, setEditando]         = useState(false);
    const [editForm, setEditForm]         = useState(null);
    const [guardandoEdit, setGuardandoEdit] = useState(false);
    const [saveMsg, setSaveMsg]           = useState(false);

    const [modalNuevo, setModalNuevo]     = useState(false);
    const [nuevoForm, setNuevoForm]       = useState(formVacio);
    const [guardandoNuevo, setGuardandoNuevo] = useState(false);
    const [errorNuevo, setErrorNuevo]     = useState('');
    const [buscarColab, setBuscarColab]   = useState('');
    const [resultadosColab, setResultadosColab] = useState([]);
    const [colabSeleccionado, setColabSeleccionado] = useState(null);
    const [buscandoColab, setBuscandoColab] = useState(false);

    const [exportando, setExportando]     = useState('');
    const [imprimiendo, setImprimiendo]   = useState(false);

    const [modalImportar, setModalImportar] = useState(false);
    const [archivoImport, setArchivoImport]  = useState(null);
    const [importando, setImportando]        = useState(false);
    const [resultadoImport, setResultadoImport] = useState(null);
    const [errorImport, setErrorImport]      = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = {};
            Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
            const [procRes, statsRes] = await Promise.all([
                obtenerProcesos(params),
                obtenerEstadisticas(),
            ]);
            setProcesos(procRes.data);
            setStats(statsRes.data);
        } catch {
            setError('No se pudieron cargar los procesos disciplinarios.');
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => {
        obtenerPuntosVenta({ activo: true }).then(res => setPuntosVenta(res.data)).catch(() => {});
    }, []);

    function handleFiltro(e) {
        setFiltros({ ...filtros, [e.target.name]: e.target.value });
    }
    function limpiarFiltros() {
        setFiltros({ search: '', estado: '', tipo_proceso: '', punto_venta: '', cargo: '' });
    }
    function toggleFiltroPunto(punto) {
        setFiltros(f => ({ ...f, punto_venta: f.punto_venta === punto ? '' : punto }));
    }

    // ---- Detalle / edicion ----
    function abrirDetalle(p) {
        setDetalle(p);
        setEditando(false);
        setSaveMsg(false);
    }
    function cerrarDetalle() {
        setDetalle(null);
        setEditando(false);
    }
    function iniciarEdicion() {
        setEditForm({
            estado: detalle.estado,
            resultado: detalle.resultado || '',
            observaciones: detalle.observaciones || '',
        });
        setEditando(true);
        setSaveMsg(false);
    }
    async function guardarEdicion() {
        setGuardandoEdit(true);
        try {
            const res = await actualizarProceso(detalle.id, editForm);
            setDetalle(res.data);
            setEditando(false);
            setSaveMsg(true);
            await cargar();
        } catch {
            setError('No se pudo guardar el cambio. Intenta de nuevo.');
        } finally {
            setGuardandoEdit(false);
        }
    }

    // ---- Nuevo caso ----
    function abrirNuevo() {
        setNuevoForm(formVacio);
        setErrorNuevo('');
        setBuscarColab('');
        setResultadosColab([]);
        setColabSeleccionado(null);
        setModalNuevo(true);
    }
    function handleNuevoField(e) {
        setNuevoForm({ ...nuevoForm, [e.target.name]: e.target.value });
    }

    // Autocompletado de colaborador (debounce simple)
    useEffect(() => {
        if (!modalNuevo || colabSeleccionado) return;
        if (buscarColab.trim().length < 2) { setResultadosColab([]); return; }
        setBuscandoColab(true);
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/colaboradores/buscar/', { params: { q: buscarColab.trim() } });
                setResultadosColab(res.data);
            } catch {
                setResultadosColab([]);
            } finally {
                setBuscandoColab(false);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [buscarColab, modalNuevo, colabSeleccionado]);

    function seleccionarColaborador(c) {
        setColabSeleccionado(c);
        setResultadosColab([]);
        setBuscarColab(`${c.nombre} — ${c.cedula}`);
        setNuevoForm({
            ...nuevoForm,
            colaborador: c.id_colaborador,
            nombre: c.nombre, cedula: c.cedula,
            cargo: c.cargo || '', punto_venta: c.area || '',
        });
    }
    function limpiarColaborador() {
        setColabSeleccionado(null);
        setBuscarColab('');
        setResultadosColab([]);
        setNuevoForm({ ...nuevoForm, colaborador: '', nombre: '', cedula: '', cargo: '', punto_venta: '', punto_venta_fk: '' });
    }

    async function submitNuevo() {
        const requeridos = colabSeleccionado
            ? ['fecha_actuacion', 'responsable_hr', 'motivo']
            : ['nombre', 'cedula', 'cargo', 'punto_venta_fk', 'fecha_actuacion', 'responsable_hr', 'motivo'];
        for (const campo of requeridos) {
            if (!nuevoForm[campo]?.trim()) {
                setErrorNuevo('Completa todos los campos obligatorios (*).');
                return;
            }
        }
        setGuardandoNuevo(true);
        setErrorNuevo('');
        try {
            const payload = {
                ...nuevoForm,
                colaborador: colabSeleccionado ? colabSeleccionado.id_colaborador : null,
                nombre: colabSeleccionado ? nuevoForm.nombre : nuevoForm.nombre.toUpperCase(),
                cargo: colabSeleccionado ? nuevoForm.cargo : nuevoForm.cargo.toUpperCase(),
                antiguedad: nuevoForm.antiguedad || null,
                fecha_ingreso: nuevoForm.fecha_ingreso || null,
            };
            await crearProceso(payload);
            setModalNuevo(false);
            await cargar();
        } catch (err) {
            const detalleErr = err.response?.data;
            setErrorNuevo(detalleErr ? JSON.stringify(detalleErr) : 'No se pudo guardar el caso.');
        } finally {
            setGuardandoNuevo(false);
        }
    }

    // ---- Exportar ----
    async function handleExportExcel() {
        setExportando('excel');
        try {
            const params = {};
            Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
            const res = await exportarProcesosExcel(params);
            descargarBlob(res.data, `procesos-disciplinarios-${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch {
            setError('Error al generar el archivo Excel.');
        } finally {
            setExportando('');
        }
    }
    function handleExportPdf() {
        setImprimiendo(true);
        setTimeout(() => {
            window.print();
            setImprimiendo(false);
        }, 50);
    }

    // ---- Importar Excel ----
    function abrirImportar() {
        setArchivoImport(null);
        setResultadoImport(null);
        setErrorImport('');
        setModalImportar(true);
    }
    function handleArchivoImport(e) {
        const f = e.target.files[0];
        if (!f) return;
        if (!f.name.endsWith('.xlsx')) { setErrorImport('Solo se aceptan archivos .xlsx'); return; }
        setArchivoImport(f);
        setErrorImport('');
        setResultadoImport(null);
    }
    async function handleImportar() {
        if (!archivoImport) { setErrorImport('Selecciona un archivo Excel primero.'); return; }
        setImportando(true);
        setErrorImport('');
        setResultadoImport(null);
        try {
            const formData = new FormData();
            formData.append('archivo', archivoImport);
            const res = await api.post('/procesos-disciplinarios/importar/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResultadoImport(res.data);
            if (res.data.exitosos > 0) await cargar();
        } catch (err) {
            setErrorImport(err.response?.data?.error || 'Error al procesar el archivo.');
        } finally {
            setImportando(false);
        }
    }
    async function descargarPlantillaImport() {
        try {
            const res = await api.get('/procesos-disciplinarios/plantilla/', { responseType: 'blob' });
            descargarBlob(res.data, 'plantilla_procesos_disciplinarios.xlsx');
        } catch {
            setErrorImport('No se pudo descargar la plantilla.');
        }
    }

    // ---- Datos derivados para charts ----
    const dataEstado = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.distribucion_estado).map(([k, v]) => ({ name: labelEstado(k), value: v, key: k }));
    }, [stats]);

    const dataTipo = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.distribucion_tipo_proceso)
            .map(([k, v]) => ({ name: labelTipo(k), value: v }))
            .sort((a, b) => b.value - a.value);
    }, [stats]);

    const dataCargo = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.distribucion_cargo)
            .map(([k, v]) => ({ name: k, value: v }))
            .sort((a, b) => b.value - a.value);
    }, [stats]);

    const maxRanking = stats?.ranking_punto_venta?.[0]?.cantidad || 1;

    return (
        <Layout>
            <div className="pd-page">
                <div className="pd-header-row">
                    <div>
                        <h1 className="pd-titulo">Control de Procesos Disciplinarios</h1>
                        <p className="pd-subtitulo">Gestión Humana · Información confidencial</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span className="pd-confidencial">🔒 Acceso restringido — Equipo GH</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="pd-btn pd-btn-ghost" onClick={abrirImportar}>⬆ Importar Excel</button>
                            <button className="pd-btn pd-btn-primary" onClick={abrirNuevo}>+ Registrar caso</button>
                        </div>
                    </div>
                </div>

                {error && <p className="pd-form-error">{error}</p>}

                {/* KPIs */}
                {stats && (
                    <div className="pd-kpis">
                        <div className="pd-kpi"><div className="num">{stats.kpis.total}</div><div className="lbl">Procesos registrados</div></div>
                        <div className="pd-kpi warn"><div className="num">{stats.kpis.activos}</div><div className="lbl">Casos activos</div></div>
                        <div className="pd-kpi accent"><div className="num">{stats.kpis.cerrados}</div><div className="lbl">Casos cerrados</div></div>
                        <div className="pd-kpi"><div className="num">{stats.kpis.archivados}</div><div className="lbl">Casos archivados</div></div>
                        <div className="pd-kpi"><div className="num">{stats.kpis.colaboradores}</div><div className="lbl">Colaboradores involucrados</div></div>
                    </div>
                )}

                <div className="pd-grid-2">
                    {/* Ranking por punto de venta */}
                    <div className="pd-panel">
                        <h2>Casos por punto de venta</h2>
                        <p className="pd-sub">Ordenado de mayor a menor volumen — clic para filtrar la tabla</p>
                        {stats?.ranking_punto_venta.map(r => (
                            <div
                                key={r.punto_venta}
                                className={'pd-rank-row' + (filtros.punto_venta === r.punto_venta ? ' active' : '')}
                                onClick={() => toggleFiltroPunto(r.punto_venta)}
                            >
                                <div className="pd-rank-name">{r.punto_venta}</div>
                                <div className="pd-rank-track">
                                    <div className="pd-rank-fill" style={{ width: `${(r.cantidad / maxRanking) * 100}%` }} />
                                </div>
                                <div className="pd-rank-count">{r.cantidad}</div>
                            </div>
                        ))}
                    </div>

                    {/* Distribucion por estado */}
                    <div className="pd-panel">
                        <h2>Distribución por estado</h2>
                        <p className="pd-sub">{stats?.kpis.total || 0} procesos registrados</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={dataEstado} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                                    {dataEstado.map((d, i) => <Cell key={i} fill={ESTADO_COLOR[d.key] || '#999'} />)}
                                </Pie>
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 11.5 }} />
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="pd-grid-2">
                    <div className="pd-panel">
                        <h2>Tipo de proceso disciplinario</h2>
                        <p className="pd-sub">Carta a la mejora, llamado de atención y otros</p>
                        <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={dataTipo} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid stroke="#E1DED4" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#2F6F5E" radius={[0, 6, 6, 0]} maxBarSize={26} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="pd-panel">
                        <h2>Cargos con más procesos</h2>
                        <p className="pd-sub">Rol del colaborador dentro de la operación</p>
                        <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={dataCargo}>
                                <CartesianGrid stroke="#E1DED4" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#B8752A" radius={[6, 6, 0, 0]} maxBarSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Alertas de riesgo */}
                <div className="pd-alert-grid">
                    <div className="pd-panel pd-alert-panel risk-high">
                        <h2>⚠ Casos estancados</h2>
                        <p className="pd-sub">En Proceso o Abierto hace más de {stats?.umbral_dias_estancado ?? 15} días sin actualización</p>
                        {stats?.estancados.length === 0 && <p className="pd-alert-empty">Ningún caso activo lleva más de {stats?.umbral_dias_estancado} días sin cierre.</p>}
                        {stats?.estancados.map(e => (
                            <div className="pd-alert-item" key={e.id}>
                                <div>
                                    <div className="who">{e.nombre}</div>
                                    <div className="where">{e.punto_venta} · {e.tipo_proceso}</div>
                                </div>
                                <span className={'pd-alert-tag ' + (e.dias >= 30 ? 'high' : 'mid')}>{e.dias} días</span>
                            </div>
                        ))}
                    </div>
                    <div className="pd-panel pd-alert-panel risk-mid">
                        <h2>↻ Colaboradores reincidentes</h2>
                        <p className="pd-sub">Con 2 o más procesos disciplinarios registrados</p>
                        {stats?.reincidentes.length === 0 && <p className="pd-alert-empty">No hay colaboradores con más de un proceso registrado.</p>}
                        {stats?.reincidentes.map(r => (
                            <div className="pd-alert-item" key={r.cedula}>
                                <div>
                                    <div className="who">{r.nombre}</div>
                                    <div className="where">{r.punto_venta} · {r.tipos}</div>
                                </div>
                                <span className={'pd-alert-tag ' + (r.cantidad >= 3 ? 'high' : 'mid')}>{r.cantidad} casos</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabla */}
                <div className="pd-panel">
                    <h2>Registro consolidado</h2>
                    <p className="pd-sub">Filtra, busca y haz clic en un caso para ver el detalle completo</p>

                    <div className="pd-filters">
                        <input type="text" name="search" placeholder="Buscar por nombre, cédula o motivo…" value={filtros.search} onChange={handleFiltro} />
                        <select name="estado" value={filtros.estado} onChange={handleFiltro}>
                            <option value="">Estado (todos)</option>
                            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                        <select name="tipo_proceso" value={filtros.tipo_proceso} onChange={handleFiltro}>
                            <option value="">Tipo de proceso (todos)</option>
                            {TIPOS_PROCESO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input type="text" name="punto_venta" placeholder="Punto de venta" value={filtros.punto_venta} onChange={handleFiltro} style={{ maxWidth: 160 }} />
                        <input type="text" name="cargo" placeholder="Cargo" value={filtros.cargo} onChange={handleFiltro} style={{ maxWidth: 160 }} />
                        <button className="pd-btn pd-btn-ghost" onClick={limpiarFiltros}>Limpiar filtros</button>
                    </div>

                    <div className="pd-result-row">
                        <p className="pd-result-count">{cargando ? 'Cargando…' : `${procesos.length} proceso(s) encontrados`}</p>
                        <div className="pd-export-bar">
                            <button className="pd-btn pd-btn-ghost" onClick={handleExportExcel} disabled={exportando === 'excel'}>
                                {exportando === 'excel' ? 'Exportando…' : '⬇ Exportar a Excel'}
                            </button>
                            <button className="pd-btn pd-btn-ghost" onClick={handleExportPdf}>🖶 Generar reporte PDF</button>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Punto de venta</th>
                                    <th>Tipo de proceso</th>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                    <th>Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {procesos.length === 0 && !cargando && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No se encontraron procesos con estos filtros.</td></tr>
                                )}
                                {procesos.map(p => (
                                    <tr key={p.id} onClick={() => abrirDetalle(p)} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                                            <div style={{ fontSize: 11.3, color: '#6B6F76' }}>{p.cargo}</div>
                                        </td>
                                        <td>{p.punto_venta}</td>
                                        <td>{labelTipo(p.tipo_proceso)}</td>
                                        <td style={{ color: '#6B6F76' }}>{fmtFecha(p.fecha_actuacion)}</td>
                                        <td><span className={`pd-badge ${p.estado}`}>{labelEstado(p.estado)}</span></td>
                                        <td className="pd-motivo-cell">{p.motivo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal detalle / edicion */}
            {detalle && (
                <Modal titulo={detalle.nombre} onCerrar={cerrarDetalle}>
                    {!editando ? (
                        <>
                            <p style={{ margin: '-8px 0 14px', fontSize: 12.5, color: '#6B6F76' }}>{detalle.cargo} · {detalle.punto_venta}</p>
                            <div className="pd-field-grid">
                                <div className="pd-field"><div className="k">Cédula</div><div className="v">{detalle.cedula}</div></div>
                                <div className="pd-field"><div className="k">Antigüedad</div><div className="v">{detalle.antiguedad != null ? `${detalle.antiguedad} años` : '—'}</div></div>
                                <div className="pd-field"><div className="k">Fecha de ingreso</div><div className="v">{fmtFecha(detalle.fecha_ingreso)}</div></div>
                                <div className="pd-field"><div className="k">Fecha de actuación</div><div className="v">{fmtFecha(detalle.fecha_actuacion)}</div></div>
                                <div className="pd-field"><div className="k">Tipo de proceso</div><div className="v">{labelTipo(detalle.tipo_proceso)}</div></div>
                                <div className="pd-field"><div className="k">Estado</div><div className="v"><span className={`pd-badge ${detalle.estado}`}>{labelEstado(detalle.estado)}</span></div></div>
                                <div className="pd-field"><div className="k">Responsable HR</div><div className="v">{detalle.responsable_hr}</div></div>
                                <div className="pd-field"><div className="k">Resultado / Sanción</div><div className="v">{detalle.resultado || '—'}</div></div>
                            </div>
                            <div className="pd-block"><div className="k">Motivo / Descripción</div><div className="v">{detalle.motivo}</div></div>
                            {detalle.observaciones && <div className="pd-block"><div className="k">Observaciones</div><div className="v">{detalle.observaciones}</div></div>}
                            <button className="pd-edit-toggle" onClick={iniciarEdicion}>✎ Editar estado, resultado y observaciones</button>
                        </>
                    ) : (
                        <>
                            <div className="pd-form-grid">
                                <div className="pd-form-field">
                                    <label>Estado del proceso</label>
                                    <select value={editForm.estado} onChange={e => setEditForm({ ...editForm, estado: e.target.value })}>
                                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                                    </select>
                                </div>
                                <div className="pd-form-field">
                                    <label>Resultado / Sanción</label>
                                    <input type="text" value={editForm.resultado} onChange={e => setEditForm({ ...editForm, resultado: e.target.value })} placeholder="Ej: Sanción de 2 días" />
                                </div>
                                <div className="pd-form-field full">
                                    <label>Observaciones</label>
                                    <textarea value={editForm.observaciones} onChange={e => setEditForm({ ...editForm, observaciones: e.target.value })} placeholder="Notas de seguimiento…" />
                                </div>
                            </div>
                            <div className="pd-form-actions">
                                <button className="pd-btn pd-btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                                <button className="pd-btn pd-btn-primary" onClick={guardarEdicion} disabled={guardandoEdit}>
                                    {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                                </button>
                            </div>
                        </>
                    )}
                    {saveMsg && !editando && <p className="pd-save-msg">Cambios guardados correctamente.</p>}
                </Modal>
            )}

            {/* Modal nuevo caso */}
            {modalNuevo && (
                <Modal titulo="Registrar nuevo caso" onCerrar={() => setModalNuevo(false)}>
                    {errorNuevo && <p className="pd-form-error">{errorNuevo}</p>}

                    <div className="pd-form-field" style={{ marginBottom: 14, position: 'relative' }}>
                        <label>Buscar colaborador existente (recomendado)</label>
                        <input
                            type="text"
                            placeholder="Escribe el nombre o la cédula…"
                            value={buscarColab}
                            disabled={!!colabSeleccionado}
                            onChange={e => setBuscarColab(e.target.value)}
                        />
                        {colabSeleccionado && (
                            <button type="button" className="pd-edit-toggle" style={{ marginTop: 6 }} onClick={limpiarColaborador}>
                                ✕ Quitar selección y escribir manualmente
                            </button>
                        )}
                        {!colabSeleccionado && buscandoColab && <p style={{ fontSize: 11.5, color: '#6B6F76', margin: '4px 0 0' }}>Buscando…</p>}
                        {!colabSeleccionado && resultadosColab.length > 0 && (
                            <div style={{
                                position: 'absolute', zIndex: 20, background: '#fff', border: '1px solid #E1DED4',
                                borderRadius: 8, marginTop: 4, width: '100%', maxHeight: 200, overflowY: 'auto',
                                boxShadow: '0 6px 16px rgba(27,33,29,.12)',
                            }}>
                                {resultadosColab.map(c => (
                                    <div
                                        key={c.id_colaborador}
                                        onClick={() => seleccionarColaborador(c)}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.8, borderBottom: '1px solid #F0EFEA' }}
                                        onMouseDown={e => e.preventDefault()}
                                    >
                                        <strong>{c.nombre}</strong> — {c.cedula}
                                        <div style={{ fontSize: 11, color: '#6B6F76' }}>{c.cargo} · {c.area}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!colabSeleccionado && buscarColab.trim().length >= 2 && !buscandoColab && resultadosColab.length === 0 && (
                            <p style={{ fontSize: 11.5, color: '#6B6F76', margin: '4px 0 0' }}>Sin coincidencias — puedes escribir los datos manualmente abajo.</p>
                        )}
                    </div>

                    <div className="pd-form-grid">
                        <div className="pd-form-field"><label>Nombre del colaborador *</label><input name="nombre" value={nuevoForm.nombre} onChange={handleNuevoField} disabled={!!colabSeleccionado} /></div>
                        <div className="pd-form-field"><label>Cédula *</label><input name="cedula" value={nuevoForm.cedula} onChange={handleNuevoField} disabled={!!colabSeleccionado} /></div>
                        <div className="pd-form-field"><label>Cargo *</label><input name="cargo" value={nuevoForm.cargo} onChange={handleNuevoField} disabled={!!colabSeleccionado} /></div>
                        <div className="pd-form-field">
                            <label>Punto de venta / Área *</label>
                            <select
                                name="punto_venta_fk"
                                value={nuevoForm.punto_venta_fk}
                                disabled={!!colabSeleccionado}
                                onChange={e => {
                                    const pv = puntosVenta.find(p => String(p.id) === e.target.value);
                                    setNuevoForm({ ...nuevoForm, punto_venta_fk: e.target.value, punto_venta: pv ? pv.nombre : '' });
                                }}
                            >
                                <option value="">Seleccionar…</option>
                                {puntosVenta.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                        <div className="pd-form-field"><label>Fecha de ingreso</label><input type="date" name="fecha_ingreso" value={nuevoForm.fecha_ingreso} onChange={handleNuevoField} /></div>
                        <div className="pd-form-field"><label>Antigüedad (años)</label><input type="number" min="0" name="antiguedad" value={nuevoForm.antiguedad} onChange={handleNuevoField} /></div>
                        <div className="pd-form-field">
                            <label>Tipo de proceso *</label>
                            <select name="tipo_proceso" value={nuevoForm.tipo_proceso} onChange={handleNuevoField}>
                                {TIPOS_PROCESO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="pd-form-field"><label>Fecha de la actuación *</label><input type="date" name="fecha_actuacion" value={nuevoForm.fecha_actuacion} onChange={handleNuevoField} /></div>
                        <div className="pd-form-field"><label>Responsable HR *</label><input name="responsable_hr" value={nuevoForm.responsable_hr} onChange={handleNuevoField} /></div>
                        <div className="pd-form-field">
                            <label>Estado del proceso</label>
                            <select name="estado" value={nuevoForm.estado} onChange={handleNuevoField}>
                                {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                            </select>
                        </div>
                        <div className="pd-form-field"><label>Resultado / Sanción</label><input name="resultado" placeholder="Opcional" value={nuevoForm.resultado} onChange={handleNuevoField} /></div>
                        <div className="pd-form-field full"><label>Motivo / Descripción *</label><textarea name="motivo" placeholder="Redactar en 3ra persona, sin juicios de valor" value={nuevoForm.motivo} onChange={handleNuevoField} /></div>
                        <div className="pd-form-field full"><label>Observaciones</label><textarea name="observaciones" placeholder="Opcional" value={nuevoForm.observaciones} onChange={handleNuevoField} /></div>
                    </div>
                    <div className="pd-form-actions">
                        <button className="pd-btn pd-btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
                        <button className="pd-btn pd-btn-primary" onClick={submitNuevo} disabled={guardandoNuevo}>
                            {guardandoNuevo ? 'Guardando…' : 'Guardar caso'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal importar Excel */}
            {modalImportar && (
                <Modal titulo="Importar procesos desde Excel" onCerrar={() => setModalImportar(false)}>
                    <p style={{ fontSize: 12.5, color: '#6B6F76', margin: '-6px 0 12px' }}>
                        Columnas obligatorias: <strong>nombre, cedula, tipo_proceso, fecha_actuacion, motivo, responsable_hr</strong>.
                        Las demás son opcionales.
                    </p>
                    <button className="pd-btn pd-btn-ghost" onClick={descargarPlantillaImport} style={{ marginBottom: 14 }}>
                        ⬇ Descargar plantilla de ejemplo
                    </button>

                    <label style={{ display: 'block', cursor: 'pointer' }}>
                        <input type="file" accept=".xlsx" onChange={handleArchivoImport} style={{ display: 'none' }} />
                        <div style={{
                            border: '1.5px dashed #E1DED4', borderRadius: 10, padding: '22px 14px',
                            textAlign: 'center', fontSize: 12.8, color: archivoImport ? '#2F6F5E' : '#6B6F76',
                        }}>
                            {archivoImport ? `✓ ${archivoImport.name}` : '📂 Clic para seleccionar archivo Excel (.xlsx)'}
                        </div>
                    </label>

                    {errorImport && <p className="pd-form-error" style={{ marginTop: 10 }}>{errorImport}</p>}

                    {resultadoImport && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{
                                background: resultadoImport.exitosos > 0 ? '#E7F1EC' : '#EEEEF0',
                                color: resultadoImport.exitosos > 0 ? '#2F6F5E' : '#6B6F76',
                                padding: '8px 12px', borderRadius: 8, fontSize: 12.8, fontWeight: 600,
                            }}>
                                {resultadoImport.exitosos} proceso(s) importados correctamente
                            </div>
                            {resultadoImport.errores.length > 0 && (
                                <div style={{ marginTop: 10, maxHeight: 160, overflowY: 'auto' }}>
                                    <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>{resultadoImport.errores.length} aviso(s):</p>
                                    {resultadoImport.errores.map((e, i) => (
                                        <div key={i} style={{ fontSize: 11.5, color: '#A83E3E', padding: '3px 0' }}>{e}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pd-form-actions">
                        <button className="pd-btn pd-btn-ghost" onClick={() => setModalImportar(false)}>Cerrar</button>
                        <button className="pd-btn pd-btn-primary" onClick={handleImportar} disabled={importando || !archivoImport}>
                            {importando ? 'Importando…' : 'Importar'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Reporte imprimible (oculto salvo al imprimir) */}
            {imprimiendo && stats && (
                <div className="pd-print-only">
                    <h2>Control de Procesos Disciplinarios</h2>
                    <p className="pd-print-sub">
                        Reporte generado el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })} · Confidencial — uso interno de Gestión Humana
                    </p>
                    <div className="pd-print-kpis">
                        <div className="pd-print-kpi"><b>{stats.kpis.total}</b><span>Total procesos</span></div>
                        <div className="pd-print-kpi"><b>{stats.kpis.activos}</b><span>Activos</span></div>
                        <div className="pd-print-kpi"><b>{stats.kpis.cerrados}</b><span>Cerrados</span></div>
                        <div className="pd-print-kpi"><b>{stats.estancados.length}</b><span>Estancados (+{stats.umbral_dias_estancado} días)</span></div>
                        <div className="pd-print-kpi"><b>{procesos.length}</b><span>Filas en este reporte</span></div>
                    </div>
                    <table>
                        <thead><tr><th>Colaborador</th><th>Punto de venta</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Motivo</th></tr></thead>
                        <tbody>
                            {procesos.map(p => (
                                <tr key={p.id}>
                                    <td>{p.nombre}</td><td>{p.punto_venta}</td><td>{labelTipo(p.tipo_proceso)}</td>
                                    <td>{fmtFecha(p.fecha_actuacion)}</td><td>{labelEstado(p.estado)}</td><td>{p.motivo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
}
