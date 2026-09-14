/**
 * AUSENTRACK - Pagina de Capacitaciones e Induccion
 * Cursos/capacitaciones con control de asistencia, y alerta de induccion
 * pendiente para colaboradores nuevos.
 */

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import { formatearErrorAPI } from '../../utils/errores';
import api from '../../api/axios';
import { obtenerPuntosVenta } from '../../api/puntosVenta';
import {
    obtenerCapacitaciones, obtenerCapacitacion, crearCapacitacion,
    inscribirParticipante, actualizarParticipante, eliminarParticipante,
    obtenerEstadisticasCapacitaciones,
} from '../../api/capacitaciones';
import '../../components/layout/Layout.css';
import './Capacitaciones.css';

const TIPOS = [
    { value: 'INDUCCION',            label: 'Inducción' },
    { value: 'CAPACITACION_TECNICA', label: 'Capacitación Técnica' },
    { value: 'SEGURIDAD_SALUD',      label: 'Seguridad y Salud en el Trabajo' },
    { value: 'LIDERAZGO',            label: 'Liderazgo' },
    { value: 'SERVICIO_CLIENTE',     label: 'Servicio al Cliente' },
    { value: 'OTRO',                 label: 'Otro' },
];
const MODALIDADES = [
    { value: 'PRESENCIAL', label: 'Presencial' },
    { value: 'VIRTUAL',    label: 'Virtual' },
    { value: 'MIXTA',      label: 'Mixta' },
];
const ESTADOS = [
    { value: 'PROGRAMADA', label: 'Programada' },
    { value: 'EN_CURSO',   label: 'En Curso' },
    { value: 'FINALIZADA', label: 'Finalizada' },
    { value: 'CANCELADA',  label: 'Cancelada' },
];
const ESTADOS_ASISTENCIA = [
    { value: 'INSCRITO',   label: 'Inscrito' },
    { value: 'ASISTIO',    label: 'Asistió' },
    { value: 'NO_ASISTIO', label: 'No asistió' },
    { value: 'COMPLETADO', label: 'Completado' },
];

function labelTipo(v) { return TIPOS.find(t => t.value === v)?.label || v; }
function labelEstado(v) { return ESTADOS.find(e => e.value === v)?.label || v; }
function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}

const formVacio = {
    titulo: '', tipo: 'CAPACITACION_TECNICA', descripcion: '', instructor: '',
    modalidad: 'PRESENCIAL', fecha_inicio: '', fecha_fin: '', duracion_horas: '2',
    punto_venta: '', punto_venta_fk: '', cupo_maximo: '', responsable_hr: '', estado: 'PROGRAMADA',
};

export default function Capacitaciones() {
    const [capacitaciones, setCapacitaciones] = useState([]);
    const [stats, setStats]           = useState(null);
    const [puntosVenta, setPuntosVenta] = useState([]);
    const [cargando, setCargando]     = useState(true);
    const [error, setError]           = useState('');

    const [filtros, setFiltros] = useState({ tipo: '', estado: '', modalidad: '', search: '' });

    const [modalNueva, setModalNueva]   = useState(false);
    const [nuevaForm, setNuevaForm]     = useState(formVacio);
    const [guardandoNueva, setGuardandoNueva] = useState(false);
    const [errorNueva, setErrorNueva]   = useState('');

    const [capSelId, setCapSelId]       = useState(null);
    const [capDetalle, setCapDetalle]   = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const [modalInscribir, setModalInscribir] = useState(false);
    const [buscarColab, setBuscarColab]       = useState('');
    const [resultadosColab, setResultadosColab] = useState([]);
    const [inscribiendo, setInscribiendo]     = useState(false);
    const [errorInscribir, setErrorInscribir] = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = {};
            Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
            const [cRes, sRes] = await Promise.all([obtenerCapacitaciones(params), obtenerEstadisticasCapacitaciones()]);
            setCapacitaciones(cRes.data);
            setStats(sRes.data);
        } catch {
            setError('No se pudieron cargar las capacitaciones.');
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => {
        obtenerPuntosVenta({ activo: true }).then(res => setPuntosVenta(res.data)).catch(() => {});
    }, []);

    const cargarDetalle = useCallback(async (id) => {
        setCargandoDetalle(true);
        try {
            const res = await obtenerCapacitacion(id);
            setCapDetalle(res.data);
        } catch {
            setError('No se pudo cargar el detalle.');
        } finally {
            setCargandoDetalle(false);
        }
    }, []);

    useEffect(() => {
        if (capSelId) cargarDetalle(capSelId);
        else setCapDetalle(null);
    }, [capSelId, cargarDetalle]);

    function handleFiltro(e) { setFiltros({ ...filtros, [e.target.name]: e.target.value }); }

    // ---- Nueva capacitación ----
    function abrirNueva() {
        setNuevaForm(formVacio);
        setErrorNueva('');
        setModalNueva(true);
    }
    async function submitNueva() {
        const requeridos = ['titulo', 'fecha_inicio', 'duracion_horas', 'responsable_hr'];
        for (const c of requeridos) {
            if (!nuevaForm[c]?.toString().trim()) { setErrorNueva('Completa todos los campos obligatorios.'); return; }
        }
        setGuardandoNueva(true);
        setErrorNueva('');
        try {
            const res = await crearCapacitacion({
                ...nuevaForm, fecha_fin: nuevaForm.fecha_fin || null,
                cupo_maximo: nuevaForm.cupo_maximo || null,
            });
            setModalNueva(false);
            await cargar();
            setCapSelId(res.data.id);
        } catch (err) {
            setErrorNueva(formatearErrorAPI(err, 'No se pudo crear la capacitación.'));
        } finally {
            setGuardandoNueva(false);
        }
    }

    // ---- Inscribir participante ----
    function abrirInscribir() {
        setBuscarColab('');
        setResultadosColab([]);
        setErrorInscribir('');
        setModalInscribir(true);
    }
    useEffect(() => {
        if (!modalInscribir) return;
        if (buscarColab.trim().length < 2) { setResultadosColab([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/colaboradores/buscar/', { params: { q: buscarColab.trim() } });
                setResultadosColab(res.data);
            } catch { setResultadosColab([]); }
        }, 350);
        return () => clearTimeout(t);
    }, [buscarColab, modalInscribir]);

    async function handleInscribir(colaborador) {
        setInscribiendo(true);
        setErrorInscribir('');
        try {
            await inscribirParticipante(capSelId, { colaborador: colaborador.id_colaborador });
            setBuscarColab('');
            setResultadosColab([]);
            await cargarDetalle(capSelId);
            await cargar();
        } catch (err) {
            setErrorInscribir(err.response?.data?.error || 'No se pudo inscribir al colaborador.');
        } finally {
            setInscribiendo(false);
        }
    }

    async function handleCambiarAsistencia(participanteId, estado) {
        try {
            await actualizarParticipante(participanteId, { estado_asistencia: estado });
            await cargarDetalle(capSelId);
            await cargar();
        } catch {
            setError('No se pudo actualizar la asistencia.');
        }
    }

    async function handleQuitarParticipante(participanteId) {
        try {
            await eliminarParticipante(participanteId);
            await cargarDetalle(capSelId);
            await cargar();
        } catch {
            setError('No se pudo quitar al participante.');
        }
    }

    return (
        <Layout>
            <div className="cp-page">
                <div className="cp-header-row">
                    <div>
                        <h1 className="cp-titulo">Capacitaciones e Inducción</h1>
                        <p className="cp-subtitulo">Cursos, asistencia y seguimiento de inducción</p>
                    </div>
                    <button className="cp-btn cp-btn-primary" onClick={abrirNueva}>+ Nueva capacitación</button>
                </div>

                {error && <p className="cp-form-error">{error}</p>}

                {stats && (
                    <div className="cp-kpis">
                        <div className="cp-kpi accent"><div className="num">{stats.kpis.total_horas_formacion}</div><div className="lbl">Horas de formación impartidas</div></div>
                        <div className="cp-kpi"><div className="num">{stats.kpis.colaboradores_capacitados}/{stats.kpis.total_colaboradores_activos}</div><div className="lbl">Colaboradores capacitados</div></div>
                        <div className="cp-kpi danger"><div className="num">{stats.kpis.induccion_pendiente}</div><div className="lbl">Inducción pendiente</div></div>
                    </div>
                )}

                {stats?.induccion_pendiente?.length > 0 && (
                    <div className="cp-panel riesgo">
                        <h2>⚠ Inducción pendiente</h2>
                        <p className="cp-sub">Colaboradores activos con más de 15 días de ingreso sin registro de inducción completada</p>
                        {stats.induccion_pendiente.map(p => (
                            <div className="cp-alert-item" key={p.id_colaborador}>
                                <div>
                                    <div className="who">{p.nombre}</div>
                                    <div className="where">{p.cargo} · {p.area || 'Sin área'}</div>
                                </div>
                                <span className="cp-alert-tag">{p.dias_desde_ingreso} días sin inducción</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="cp-panel">
                    <h2>Capacitaciones</h2>
                    <p className="cp-sub">Selecciona una capacitación para ver o gestionar sus participantes</p>

                    <div className="cp-filters">
                        <input type="text" name="search" placeholder="Buscar por título o instructor…" value={filtros.search} onChange={handleFiltro} />
                        <select name="tipo" value={filtros.tipo} onChange={handleFiltro}>
                            <option value="">Tipo (todos)</option>
                            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select name="estado" value={filtros.estado} onChange={handleFiltro}>
                            <option value="">Estado (todos)</option>
                            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                    </div>

                    {cargando && <p className="cp-sub">Cargando…</p>}
                    {!cargando && capacitaciones.length === 0 && <p className="cp-sub">No hay capacitaciones con estos filtros.</p>}

                    <div className="cp-cursos-grid">
                        {capacitaciones.map(c => (
                            <div key={c.id} className="cp-curso-card" onClick={() => setCapSelId(c.id === capSelId ? null : c.id)}>
                                <div className="titulo">{c.titulo}</div>
                                <div className="meta">{labelTipo(c.tipo)} · {fmtFecha(c.fecha_inicio)}</div>
                                <div className="meta-row">
                                    <span className="meta">{c.total_participantes} inscrito(s)</span>
                                    <span className={`cp-badge ${c.estado}`}>{labelEstado(c.estado)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {capSelId && (
                    <div className="cp-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                            <div>
                                <h2>Participantes: {capDetalle?.titulo}</h2>
                                <p className="cp-sub">{capDetalle?.total_participantes || 0} inscrito(s) · {capDetalle?.total_completados || 0} completado(s)</p>
                            </div>
                            <button className="cp-btn cp-btn-primary cp-btn-sm" onClick={abrirInscribir}>+ Inscribir colaborador</button>
                        </div>

                        {cargandoDetalle && <p className="cp-sub">Cargando…</p>}
                        {capDetalle && !cargandoDetalle && capDetalle.participantes.length === 0 && <p className="cp-sub">Aún no hay participantes inscritos.</p>}

                        {capDetalle && capDetalle.participantes.map(p => (
                            <div className="cp-part-row" key={p.id}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{p.colaborador_nombre}</div>
                                    <div style={{ fontSize: 11.3, color: '#6B6F76' }}>{p.colaborador_cargo} · {p.colaborador_cedula}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <select className="cp-part-select" value={p.estado_asistencia} onChange={e => handleCambiarAsistencia(p.id, e.target.value)}>
                                        {ESTADOS_ASISTENCIA.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                                    </select>
                                    <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={() => handleQuitarParticipante(p.id)}>Quitar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal nueva capacitación */}
            {modalNueva && (
                <Modal titulo="Nueva capacitación" onCerrar={() => setModalNueva(false)}>
                    {errorNueva && <p className="cp-form-error">{errorNueva}</p>}
                    <div className="cp-form-grid">
                        <div className="cp-form-field full"><label>Título *</label><input value={nuevaForm.titulo} onChange={e => setNuevaForm({ ...nuevaForm, titulo: e.target.value })} /></div>
                        <div className="cp-form-field">
                            <label>Tipo</label>
                            <select value={nuevaForm.tipo} onChange={e => setNuevaForm({ ...nuevaForm, tipo: e.target.value })}>
                                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="cp-form-field">
                            <label>Modalidad</label>
                            <select value={nuevaForm.modalidad} onChange={e => setNuevaForm({ ...nuevaForm, modalidad: e.target.value })}>
                                {MODALIDADES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div className="cp-form-field"><label>Instructor</label><input value={nuevaForm.instructor} onChange={e => setNuevaForm({ ...nuevaForm, instructor: e.target.value })} /></div>
                        <div className="cp-form-field"><label>Duración (horas) *</label><input type="number" step="0.5" value={nuevaForm.duracion_horas} onChange={e => setNuevaForm({ ...nuevaForm, duracion_horas: e.target.value })} /></div>
                        <div className="cp-form-field"><label>Fecha de inicio *</label><input type="date" value={nuevaForm.fecha_inicio} onChange={e => setNuevaForm({ ...nuevaForm, fecha_inicio: e.target.value })} /></div>
                        <div className="cp-form-field"><label>Fecha de fin</label><input type="date" value={nuevaForm.fecha_fin} onChange={e => setNuevaForm({ ...nuevaForm, fecha_fin: e.target.value })} /></div>
                        <div className="cp-form-field">
                            <label>Punto de venta</label>
                            <select
                                value={nuevaForm.punto_venta_fk}
                                onChange={e => {
                                    const pv = puntosVenta.find(p => String(p.id) === e.target.value);
                                    setNuevaForm({ ...nuevaForm, punto_venta_fk: e.target.value, punto_venta: pv ? pv.nombre : '' });
                                }}
                            >
                                <option value="">Todos los puntos</option>
                                {puntosVenta.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                        <div className="cp-form-field"><label>Cupo máximo</label><input type="number" value={nuevaForm.cupo_maximo} onChange={e => setNuevaForm({ ...nuevaForm, cupo_maximo: e.target.value })} /></div>
                        <div className="cp-form-field"><label>Responsable HR *</label><input value={nuevaForm.responsable_hr} onChange={e => setNuevaForm({ ...nuevaForm, responsable_hr: e.target.value })} /></div>
                        <div className="cp-form-field full"><label>Descripción</label><textarea value={nuevaForm.descripcion} onChange={e => setNuevaForm({ ...nuevaForm, descripcion: e.target.value })} /></div>
                    </div>
                    <div className="cp-form-actions">
                        <button className="cp-btn cp-btn-ghost" onClick={() => setModalNueva(false)}>Cancelar</button>
                        <button className="cp-btn cp-btn-primary" onClick={submitNueva} disabled={guardandoNueva}>
                            {guardandoNueva ? 'Guardando…' : 'Crear capacitación'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal inscribir */}
            {modalInscribir && (
                <Modal titulo="Inscribir colaborador" onCerrar={() => setModalInscribir(false)}>
                    {errorInscribir && <p className="cp-form-error">{errorInscribir}</p>}
                    <div className="cp-form-field" style={{ position: 'relative' }}>
                        <label>Buscar colaborador</label>
                        <input type="text" placeholder="Nombre o cédula…" value={buscarColab} onChange={e => setBuscarColab(e.target.value)} disabled={inscribiendo} />
                        {resultadosColab.length > 0 && (
                            <div style={{
                                marginTop: 6, border: '1px solid #E1DED4', borderRadius: 8, maxHeight: 240, overflowY: 'auto',
                            }}>
                                {resultadosColab.map(c => (
                                    <div key={c.id_colaborador} onClick={() => !inscribiendo && handleInscribir(c)}
                                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 12.8, borderBottom: '1px solid #F0EFEA' }}>
                                        <strong>{c.nombre}</strong> — {c.cedula}
                                        <div style={{ fontSize: 11, color: '#6B6F76' }}>{c.cargo} · {c.area}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="cp-form-actions">
                        <button className="cp-btn cp-btn-ghost" onClick={() => setModalInscribir(false)}>Cerrar</button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}
