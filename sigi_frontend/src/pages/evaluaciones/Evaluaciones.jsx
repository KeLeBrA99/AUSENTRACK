/**
 * AUSENTRACK - Pagina de Evaluaciones de Desempeño
 * Evaluaciones por criterios estandar (1-5), vinculadas al colaborador real.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import { formatearErrorAPI } from '../../utils/errores';
import api from '../../api/axios';
import {
    obtenerEvaluaciones, crearEvaluacion, actualizarEvaluacion,
    obtenerCriteriosEstandar, obtenerEstadisticasEvaluaciones, crearInvitacionEvaluacion,
} from '../../api/evaluaciones';
import '../../components/layout/Layout.css';
import './Evaluaciones.css';

const TIPOS = [
    { value: 'PERIODO_PRUEBA', label: 'Periodo de Prueba' },
    { value: 'JEFE_DIRECTO',   label: 'Evaluación de Jefe Directo' },
    { value: 'AUTOEVALUACION', label: 'Autoevaluación' },
    { value: 'DESEMPENO_360',  label: 'Evaluación 360°' },
];
const ESTADOS = [
    { value: 'BORRADOR',   label: 'Borrador' },
    { value: 'COMPLETADA', label: 'Completada' },
    { value: 'ENTREGADA_COLABORADOR', label: 'Entregada al colaborador' },
];

function labelTipo(v) { return TIPOS.find(t => t.value === v)?.label || v; }
function labelEstado(v) { return ESTADOS.find(e => e.value === v)?.label || v; }
function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}
function claseP(puntaje) {
    if (puntaje == null) return '';
    return `p${Math.max(1, Math.min(5, Math.round(puntaje)))}`;
}

function Estrellas({ valor, onChange }) {
    return (
        <div className="ev-star-group">
            {[1, 2, 3, 4, 5].map(n => (
                <span key={n} className={'ev-star' + (n <= valor ? ' filled' : '')} onClick={() => onChange(n)}>★</span>
            ))}
        </div>
    );
}

const formVacio = (criteriosEstandar) => ({
    colaborador: '', periodo: '', tipo_evaluacion: 'JEFE_DIRECTO',
    fecha_evaluacion: '', evaluador: '', responsable_hr: '', estado: 'COMPLETADA',
    criterios: criteriosEstandar.map(c => ({ criterio: c, puntaje: 0, comentario: '' })),
    fortalezas: '', areas_mejora: '', plan_accion: '',
});

export default function Evaluaciones() {
    const [evaluaciones, setEvaluaciones] = useState([]);
    const [stats, setStats]               = useState(null);
    const [criteriosEstandar, setCriteriosEstandar] = useState([]);
    const [cargando, setCargando]         = useState(true);
    const [error, setError]               = useState('');

    const [filtros, setFiltros] = useState({ periodo: '', estado: '', tipo_evaluacion: '', search: '' });

    const [modalNuevo, setModalNuevo]     = useState(false);
    const [nuevoForm, setNuevoForm]       = useState(null);
    const [guardandoNuevo, setGuardandoNuevo] = useState(false);
    const [errorNuevo, setErrorNuevo]     = useState('');
    const [buscarColab, setBuscarColab]   = useState('');
    const [resultadosColab, setResultadosColab] = useState([]);
    const [colabSeleccionado, setColabSeleccionado] = useState(null);

    const [modalInvitacion, setModalInvitacion] = useState(false);
    const [invitacionForm, setInvitacionForm] = useState(null);
    const [buscarColabInv, setBuscarColabInv] = useState('');
    const [resultadosColabInv, setResultadosColabInv] = useState([]);
    const [colabSeleccionadoInv, setColabSeleccionadoInv] = useState(null);
    const [guardandoInvitacion, setGuardandoInvitacion] = useState(false);
    const [errorInvitacion, setErrorInvitacion] = useState('');
    const [linkGenerado, setLinkGenerado] = useState('');

    const [detalle, setDetalle]           = useState(null);
    const [editando, setEditando]         = useState(false);
    const [editForm, setEditForm]         = useState(null);
    const [guardandoEdit, setGuardandoEdit] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = {};
            Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
            const [eRes, sRes] = await Promise.all([obtenerEvaluaciones(params), obtenerEstadisticasEvaluaciones()]);
            setEvaluaciones(eRes.data);
            setStats(sRes.data);
        } catch {
            setError('No se pudieron cargar las evaluaciones.');
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => {
        obtenerCriteriosEstandar().then(res => setCriteriosEstandar(res.data.criterios)).catch(() => {});
    }, []);

    function handleFiltro(e) { setFiltros({ ...filtros, [e.target.name]: e.target.value }); }

    // ---- Enviar por link (autoevaluación externa) ----
    function abrirInvitacion() {
        setInvitacionForm({ periodo: '', tipo_evaluacion: 'AUTOEVALUACION', fecha_evaluacion: '', evaluador: '', responsable_hr: '' });
        setBuscarColabInv('');
        setResultadosColabInv([]);
        setColabSeleccionadoInv(null);
        setErrorInvitacion('');
        setLinkGenerado('');
        setModalInvitacion(true);
    }

    useEffect(() => {
        if (!modalInvitacion || colabSeleccionadoInv) return;
        if (buscarColabInv.trim().length < 2) { setResultadosColabInv([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/colaboradores/buscar/', { params: { q: buscarColabInv.trim() } });
                setResultadosColabInv(res.data);
            } catch { setResultadosColabInv([]); }
        }, 350);
        return () => clearTimeout(t);
    }, [buscarColabInv, modalInvitacion, colabSeleccionadoInv]);

    function seleccionarColaboradorInv(c) {
        setColabSeleccionadoInv(c);
        setResultadosColabInv([]);
        setBuscarColabInv(`${c.nombre} — ${c.cedula}`);
        setInvitacionForm({ ...invitacionForm, evaluador: invitacionForm.evaluador || c.nombre });
    }

    async function submitInvitacion() {
        if (!colabSeleccionadoInv) { setErrorInvitacion('Selecciona un colaborador de la lista.'); return; }
        if (!invitacionForm.periodo || !invitacionForm.fecha_evaluacion || !invitacionForm.evaluador || !invitacionForm.responsable_hr) {
            setErrorInvitacion('Completa todos los campos.');
            return;
        }
        setGuardandoInvitacion(true);
        setErrorInvitacion('');
        try {
            const res = await crearInvitacionEvaluacion({
                colaborador: colabSeleccionadoInv.id_colaborador,
                periodo: invitacionForm.periodo,
                tipo_evaluacion: invitacionForm.tipo_evaluacion,
                fecha_evaluacion: invitacionForm.fecha_evaluacion,
                evaluador: invitacionForm.evaluador,
                responsable_hr: invitacionForm.responsable_hr,
            });
            const link = `${window.location.origin}/evaluar/${res.data.token_publico}`;
            setLinkGenerado(link);
            await cargar();
        } catch (err) {
            setErrorInvitacion(formatearErrorAPI(err, 'No se pudo generar el link.'));
        } finally {
            setGuardandoInvitacion(false);
        }
    }

    function copiarLink() {
        navigator.clipboard.writeText(linkGenerado);
    }

    // ---- Nueva evaluación ----
    function abrirNuevo() {
        setNuevoForm(formVacio(criteriosEstandar));
        setBuscarColab('');
        setResultadosColab([]);
        setColabSeleccionado(null);
        setErrorNuevo('');
        setModalNuevo(true);
    }

    useEffect(() => {
        if (!modalNuevo || colabSeleccionado) return;
        if (buscarColab.trim().length < 2) { setResultadosColab([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/colaboradores/buscar/', { params: { q: buscarColab.trim() } });
                setResultadosColab(res.data);
            } catch { setResultadosColab([]); }
        }, 350);
        return () => clearTimeout(t);
    }, [buscarColab, modalNuevo, colabSeleccionado]);

    function seleccionarColaborador(c) {
        setColabSeleccionado(c);
        setResultadosColab([]);
        setBuscarColab(`${c.nombre} — ${c.cedula}`);
        setNuevoForm({ ...nuevoForm, colaborador: c.id_colaborador });
    }
    function limpiarColaborador() {
        setColabSeleccionado(null);
        setBuscarColab('');
        setNuevoForm({ ...nuevoForm, colaborador: '' });
    }

    function setCriterioPuntaje(idx, puntaje) {
        const nuevos = [...nuevoForm.criterios];
        nuevos[idx] = { ...nuevos[idx], puntaje };
        setNuevoForm({ ...nuevoForm, criterios: nuevos });
    }

    async function submitNuevo() {
        if (!colabSeleccionado) { setErrorNuevo('Selecciona un colaborador de la lista.'); return; }
        if (!nuevoForm.periodo || !nuevoForm.fecha_evaluacion || !nuevoForm.evaluador || !nuevoForm.responsable_hr) {
            setErrorNuevo('Completa todos los campos obligatorios.');
            return;
        }
        if (nuevoForm.criterios.some(c => !c.puntaje)) {
            setErrorNuevo('Califica todos los criterios (mínimo 1 estrella).');
            return;
        }
        setGuardandoNuevo(true);
        setErrorNuevo('');
        try {
            await crearEvaluacion(nuevoForm);
            setModalNuevo(false);
            await cargar();
        } catch (err) {
            setErrorNuevo(formatearErrorAPI(err, 'No se pudo crear la evaluación.'));
        } finally {
            setGuardandoNuevo(false);
        }
    }

    // ---- Detalle / edición ----
    function abrirDetalle(ev) { setDetalle(ev); setEditando(false); }
    function iniciarEdicion() {
        setEditForm({
            criterios: detalle.criterios.map(c => ({ ...c })),
            fortalezas: detalle.fortalezas || '', areas_mejora: detalle.areas_mejora || '',
            plan_accion: detalle.plan_accion || '', estado: detalle.estado,
        });
        setEditando(true);
    }
    function setEditCriterioPuntaje(idx, puntaje) {
        const nuevos = [...editForm.criterios];
        nuevos[idx] = { ...nuevos[idx], puntaje };
        setEditForm({ ...editForm, criterios: nuevos });
    }
    async function guardarEdicion() {
        setGuardandoEdit(true);
        try {
            const res = await actualizarEvaluacion(detalle.id, editForm);
            setDetalle(res.data);
            setEditando(false);
            await cargar();
        } catch {
            setError('No se pudo guardar el cambio.');
        } finally {
            setGuardandoEdit(false);
        }
    }

    return (
        <Layout>
            <div className="ev-page">
                <div className="ev-header-row">
                    <div>
                        <h1 className="ev-titulo">Evaluaciones de Desempeño</h1>
                        <p className="ev-subtitulo">Calificación por criterios, seguimiento por periodo</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="ev-btn ev-btn-ghost" onClick={abrirInvitacion}>🔗 Enviar por link</button>
                        <button className="ev-btn ev-btn-primary" onClick={abrirNuevo}>+ Nueva evaluación</button>
                    </div>
                </div>

                {error && <p className="ev-form-error">{error}</p>}

                {stats && (
                    <div className="ev-kpis">
                        <div className="ev-kpi accent"><div className="num">{stats.kpis.promedio_general ?? '—'}</div><div className="lbl">Promedio general</div></div>
                        <div className="ev-kpi"><div className="num">{stats.kpis.total_evaluaciones}</div><div className="lbl">Evaluaciones realizadas</div></div>
                        <div className="ev-kpi"><div className="num">{stats.kpis.colaboradores_evaluados}</div><div className="lbl">Colaboradores evaluados</div></div>
                        <div className="ev-kpi warn"><div className="num">{stats.kpis.colaboradores_sin_evaluar}</div><div className="lbl">Sin evaluar aún</div></div>
                    </div>
                )}

                {stats && (
                    <div className="ev-grid-2">
                        <div className="ev-panel">
                            <h2>Top 5 mejor calificados</h2>
                            <p className="ev-sub">Según su evaluación más reciente</p>
                            {stats.top5.length === 0 && <p className="ev-sub">Aún no hay evaluaciones registradas.</p>}
                            {stats.top5.map((r, i) => (
                                <div className="ev-rank-item" key={i}>
                                    <div><div className="who">{r.colaborador}</div><div className="cargo">{r.cargo}</div></div>
                                    <span className={'ev-rank-score ' + (r.puntaje >= 3.5 ? 'alto' : 'bajo')}>{r.puntaje.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="ev-panel">
                            <h2>Promedio por criterio</h2>
                            <p className="ev-sub">Comparativo general de la empresa</p>
                            {stats.promedio_por_criterio.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={stats.promedio_por_criterio} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="criterio" tick={{ fontSize: 10.5 }} width={130} />
                                        <Tooltip />
                                        <Bar dataKey="promedio" fill="#6A3FA0" radius={[0, 4, 4, 0]} maxBarSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="ev-sub">Sin datos.</p>}
                        </div>
                    </div>
                )}

                <div className="ev-panel">
                    <h2>Registro de evaluaciones</h2>
                    <p className="ev-sub">Haz clic en una evaluación para ver el detalle completo</p>

                    <div className="ev-filters">
                        <input type="text" name="search" placeholder="Buscar por nombre o cédula…" value={filtros.search} onChange={handleFiltro} />
                        <input type="text" name="periodo" placeholder="Periodo (ej: 2026-S1)" value={filtros.periodo} onChange={handleFiltro} style={{ maxWidth: 160 }} />
                        <select name="estado" value={filtros.estado} onChange={handleFiltro}>
                            <option value="">Estado (todos)</option>
                            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                        <select name="tipo_evaluacion" value={filtros.tipo_evaluacion} onChange={handleFiltro}>
                            <option value="">Tipo (todos)</option>
                            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>

                    <p style={{ fontSize: 12, color: '#6B6F76', marginBottom: 10 }}>
                        {cargando ? 'Cargando…' : `${evaluaciones.length} evaluación(es)`}
                    </p>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Periodo</th>
                                    <th>Tipo</th>
                                    <th>Fecha</th>
                                    <th>Puntaje</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!cargando && evaluaciones.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No hay evaluaciones con estos filtros.</td></tr>
                                )}
                                {evaluaciones.map(ev => (
                                    <tr key={ev.id} onClick={() => abrirDetalle(ev)} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{ev.colaborador_nombre}</div>
                                            <div style={{ fontSize: 11.3, color: '#6B6F76' }}>{ev.colaborador_cedula}</div>
                                        </td>
                                        <td>{ev.periodo}</td>
                                        <td>{labelTipo(ev.tipo_evaluacion)}</td>
                                        <td style={{ color: '#6B6F76' }}>{fmtFecha(ev.fecha_evaluacion)}</td>
                                        <td><span className={`ev-puntaje-pill ${claseP(ev.puntaje_final)}`}>{ev.puntaje_final ?? '—'}</span></td>
                                        <td><span className={`ev-badge ${ev.estado}`}>{labelEstado(ev.estado)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal nueva evaluación */}
            {modalNuevo && nuevoForm && (
                <Modal titulo="Nueva evaluación de desempeño" onCerrar={() => setModalNuevo(false)}>
                    {errorNuevo && <p className="ev-form-error">{errorNuevo}</p>}

                    <div className="ev-form-field" style={{ marginBottom: 14, position: 'relative' }}>
                        <label>Colaborador *</label>
                        <input
                            type="text" placeholder="Escribe el nombre o la cédula…"
                            value={buscarColab} disabled={!!colabSeleccionado}
                            onChange={e => setBuscarColab(e.target.value)}
                        />
                        {colabSeleccionado && (
                            <button type="button" className="ev-btn ev-btn-ghost ev-btn-sm" style={{ marginTop: 6 }} onClick={limpiarColaborador}>✕ Cambiar colaborador</button>
                        )}
                        {!colabSeleccionado && resultadosColab.length > 0 && (
                            <div style={{
                                position: 'absolute', zIndex: 20, background: '#fff', border: '1px solid #E1DED4',
                                borderRadius: 8, marginTop: 4, width: '100%', maxHeight: 200, overflowY: 'auto',
                                boxShadow: '0 6px 16px rgba(27,33,29,.12)',
                            }}>
                                {resultadosColab.map(c => (
                                    <div key={c.id_colaborador} onClick={() => seleccionarColaborador(c)}
                                        onMouseDown={e => e.preventDefault()}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.8, borderBottom: '1px solid #F0EFEA' }}>
                                        <strong>{c.nombre}</strong> — {c.cedula}
                                        <div style={{ fontSize: 11, color: '#6B6F76' }}>{c.cargo} · {c.area}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="ev-form-grid">
                        <div className="ev-form-field"><label>Periodo *</label><input placeholder="Ej: 2026-S1" value={nuevoForm.periodo} onChange={e => setNuevoForm({ ...nuevoForm, periodo: e.target.value })} /></div>
                        <div className="ev-form-field">
                            <label>Tipo de evaluación</label>
                            <select value={nuevoForm.tipo_evaluacion} onChange={e => setNuevoForm({ ...nuevoForm, tipo_evaluacion: e.target.value })}>
                                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="ev-form-field"><label>Fecha de evaluación *</label><input type="date" value={nuevoForm.fecha_evaluacion} onChange={e => setNuevoForm({ ...nuevoForm, fecha_evaluacion: e.target.value })} /></div>
                        <div className="ev-form-field"><label>Evaluador *</label><input value={nuevoForm.evaluador} onChange={e => setNuevoForm({ ...nuevoForm, evaluador: e.target.value })} /></div>
                        <div className="ev-form-field"><label>Responsable HR *</label><input value={nuevoForm.responsable_hr} onChange={e => setNuevoForm({ ...nuevoForm, responsable_hr: e.target.value })} /></div>
                        <div className="ev-form-field">
                            <label>Estado</label>
                            <select value={nuevoForm.estado} onChange={e => setNuevoForm({ ...nuevoForm, estado: e.target.value })}>
                                {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ margin: '14px 0' }}>
                        <label style={{ display: 'block', fontSize: 10.3, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B6F76', fontWeight: 600, marginBottom: 6 }}>Criterios de evaluación *</label>
                        {nuevoForm.criterios.map((c, idx) => (
                            <div className="ev-criterio-row" key={c.criterio}>
                                <div className="ev-criterio-nombre">{c.criterio}</div>
                                <Estrellas valor={c.puntaje} onChange={p => setCriterioPuntaje(idx, p)} />
                            </div>
                        ))}
                    </div>

                    <div className="ev-form-grid">
                        <div className="ev-form-field full"><label>Fortalezas</label><textarea value={nuevoForm.fortalezas} onChange={e => setNuevoForm({ ...nuevoForm, fortalezas: e.target.value })} /></div>
                        <div className="ev-form-field full"><label>Áreas de mejora</label><textarea value={nuevoForm.areas_mejora} onChange={e => setNuevoForm({ ...nuevoForm, areas_mejora: e.target.value })} /></div>
                        <div className="ev-form-field full"><label>Plan de acción</label><textarea value={nuevoForm.plan_accion} onChange={e => setNuevoForm({ ...nuevoForm, plan_accion: e.target.value })} /></div>
                    </div>

                    <div className="ev-form-actions">
                        <button className="ev-btn ev-btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
                        <button className="ev-btn ev-btn-primary" onClick={submitNuevo} disabled={guardandoNuevo}>
                            {guardandoNuevo ? 'Guardando…' : 'Guardar evaluación'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal detalle */}
            {detalle && (
                <Modal titulo={detalle.colaborador_nombre} onCerrar={() => setDetalle(null)}>
                    {!editando ? (
                        <>
                            <div className="ev-field-grid">
                                <div className="ev-field"><div className="k">Cédula</div><div className="v">{detalle.colaborador_cedula}</div></div>
                                <div className="ev-field"><div className="k">Cargo</div><div className="v">{detalle.colaborador_cargo}</div></div>
                                <div className="ev-field"><div className="k">Periodo</div><div className="v">{detalle.periodo}</div></div>
                                <div className="ev-field"><div className="k">Tipo</div><div className="v">{labelTipo(detalle.tipo_evaluacion)}</div></div>
                                <div className="ev-field"><div className="k">Fecha</div><div className="v">{fmtFecha(detalle.fecha_evaluacion)}</div></div>
                                <div className="ev-field"><div className="k">Evaluador</div><div className="v">{detalle.evaluador}</div></div>
                                <div className="ev-field"><div className="k">Puntaje final</div><div className="v"><span className={`ev-puntaje-pill ${claseP(detalle.puntaje_final)}`}>{detalle.puntaje_final}</span></div></div>
                                <div className="ev-field"><div className="k">Estado</div><div className="v"><span className={`ev-badge ${detalle.estado}`}>{labelEstado(detalle.estado)}</span></div></div>
                            </div>

                            <ResponsiveContainer width="100%" height={Math.max(120, detalle.criterios.length * 34)}>
                                <BarChart data={detalle.criterios} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="criterio" tick={{ fontSize: 10.5 }} width={140} />
                                    <Tooltip />
                                    <Bar dataKey="puntaje" radius={[0, 4, 4, 0]} maxBarSize={18}>
                                        {detalle.criterios.map((c, i) => <Cell key={i} fill={c.puntaje >= 4 ? '#2F6F5E' : c.puntaje >= 3 ? '#B8752A' : '#A83E3E'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>

                            {detalle.fortalezas && <div className="ev-block" style={{ marginTop: 14 }}><div className="k">Fortalezas</div><div className="v">{detalle.fortalezas}</div></div>}
                            {detalle.areas_mejora && <div className="ev-block"><div className="k">Áreas de mejora</div><div className="v">{detalle.areas_mejora}</div></div>}
                            {detalle.plan_accion && <div className="ev-block"><div className="k">Plan de acción</div><div className="v">{detalle.plan_accion}</div></div>}

                            <button className="ev-btn ev-btn-ghost ev-btn-sm" onClick={iniciarEdicion} style={{ marginTop: 8 }}>✎ Editar calificación y notas</button>
                        </>
                    ) : (
                        <>
                            <div style={{ margin: '4px 0 14px' }}>
                                {editForm.criterios.map((c, idx) => (
                                    <div className="ev-criterio-row" key={c.criterio}>
                                        <div className="ev-criterio-nombre">{c.criterio}</div>
                                        <Estrellas valor={c.puntaje} onChange={p => setEditCriterioPuntaje(idx, p)} />
                                    </div>
                                ))}
                            </div>
                            <div className="ev-form-grid">
                                <div className="ev-form-field">
                                    <label>Estado</label>
                                    <select value={editForm.estado} onChange={e => setEditForm({ ...editForm, estado: e.target.value })}>
                                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                                    </select>
                                </div>
                                <div className="ev-form-field full"><label>Fortalezas</label><textarea value={editForm.fortalezas} onChange={e => setEditForm({ ...editForm, fortalezas: e.target.value })} /></div>
                                <div className="ev-form-field full"><label>Áreas de mejora</label><textarea value={editForm.areas_mejora} onChange={e => setEditForm({ ...editForm, areas_mejora: e.target.value })} /></div>
                                <div className="ev-form-field full"><label>Plan de acción</label><textarea value={editForm.plan_accion} onChange={e => setEditForm({ ...editForm, plan_accion: e.target.value })} /></div>
                            </div>
                            <div className="ev-form-actions">
                                <button className="ev-btn ev-btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                                <button className="ev-btn ev-btn-primary" onClick={guardarEdicion} disabled={guardandoEdit}>
                                    {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                                </button>
                            </div>
                        </>
                    )}
                </Modal>
            )}

            {/* Modal enviar por link */}
            {modalInvitacion && (
                <Modal titulo="Enviar autoevaluación por link" onCerrar={() => setModalInvitacion(false)}>
                    {!linkGenerado ? (
                        <>
                            {errorInvitacion && <p className="ev-form-error">{errorInvitacion}</p>}
                            <p style={{ fontSize: 12.5, color: '#6B6F76', margin: '-6px 0 12px' }}>
                                Se genera un link único que el colaborador puede abrir sin necesidad de iniciar sesión, para calificarse a sí mismo. Al enviarlo, los resultados llegan directo a esta plataforma.
                            </p>

                            <div className="ev-form-field" style={{ marginBottom: 14, position: 'relative' }}>
                                <label>Colaborador *</label>
                                <input
                                    type="text" placeholder="Escribe el nombre o la cédula…"
                                    value={buscarColabInv} disabled={!!colabSeleccionadoInv}
                                    onChange={e => setBuscarColabInv(e.target.value)}
                                />
                                {colabSeleccionadoInv && (
                                    <button type="button" className="ev-btn ev-btn-ghost ev-btn-sm" style={{ marginTop: 6 }} onClick={() => { setColabSeleccionadoInv(null); setBuscarColabInv(''); }}>✕ Cambiar colaborador</button>
                                )}
                                {!colabSeleccionadoInv && resultadosColabInv.length > 0 && (
                                    <div style={{
                                        position: 'absolute', zIndex: 20, background: '#fff', border: '1px solid #E1DED4',
                                        borderRadius: 8, marginTop: 4, width: '100%', maxHeight: 200, overflowY: 'auto',
                                        boxShadow: '0 6px 16px rgba(27,33,29,.12)',
                                    }}>
                                        {resultadosColabInv.map(c => (
                                            <div key={c.id_colaborador} onClick={() => seleccionarColaboradorInv(c)}
                                                onMouseDown={e => e.preventDefault()}
                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.8, borderBottom: '1px solid #F0EFEA' }}>
                                                <strong>{c.nombre}</strong> — {c.cedula}
                                                <div style={{ fontSize: 11, color: '#6B6F76' }}>{c.cargo}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="ev-form-grid">
                                <div className="ev-form-field"><label>Periodo *</label><input placeholder="Ej: 2026-S2" value={invitacionForm.periodo} onChange={e => setInvitacionForm({ ...invitacionForm, periodo: e.target.value })} /></div>
                                <div className="ev-form-field"><label>Fecha *</label><input type="date" value={invitacionForm.fecha_evaluacion} onChange={e => setInvitacionForm({ ...invitacionForm, fecha_evaluacion: e.target.value })} /></div>
                                <div className="ev-form-field"><label>Evaluador (quien la llena) *</label><input value={invitacionForm.evaluador} onChange={e => setInvitacionForm({ ...invitacionForm, evaluador: e.target.value })} /></div>
                                <div className="ev-form-field"><label>Responsable HR *</label><input value={invitacionForm.responsable_hr} onChange={e => setInvitacionForm({ ...invitacionForm, responsable_hr: e.target.value })} /></div>
                            </div>

                            <div className="ev-form-actions">
                                <button className="ev-btn ev-btn-ghost" onClick={() => setModalInvitacion(false)}>Cancelar</button>
                                <button className="ev-btn ev-btn-primary" onClick={submitInvitacion} disabled={guardandoInvitacion}>
                                    {guardandoInvitacion ? 'Generando…' : 'Generar link'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p style={{ fontSize: 13, color: '#2F6F5E', fontWeight: 600, marginBottom: 10 }}>✓ Link generado correctamente</p>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                <input readOnly value={linkGenerado} style={{ flex: 1, fontSize: 12.5, padding: '8px 10px', borderRadius: 7, border: '1px solid #E1DED4', background: '#F6F5F1' }} />
                                <button className="ev-btn ev-btn-ghost ev-btn-sm" onClick={copiarLink}>Copiar</button>
                            </div>
                            <p style={{ fontSize: 12, color: '#6B6F76' }}>Envía este link al colaborador (WhatsApp, correo, etc.). Solo se puede usar una vez.</p>
                            <div className="ev-form-actions">
                                <button className="ev-btn ev-btn-primary" onClick={() => setModalInvitacion(false)}>Cerrar</button>
                            </div>
                        </>
                    )}
                </Modal>
            )}
        </Layout>
    );
}
