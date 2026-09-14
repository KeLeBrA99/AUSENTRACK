/**
 * AUSENTRACK - Pagina de Vacaciones
 * Solicitudes con aprobacion/rechazo, y saldo de dias causados por
 * colaborador (15 dias habiles de ley por año trabajado).
 */

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import api from '../../api/axios';
import { formatearErrorAPI } from '../../utils/errores';
import {
    obtenerSolicitudes, crearSolicitud, aprobarSolicitud, rechazarSolicitud,
    cancelarSolicitud, marcarDisfrutada, obtenerSaldosGenerales, obtenerEstadisticasVacaciones,
} from '../../api/vacaciones';
import '../../components/layout/Layout.css';
import './Vacaciones.css';

const ESTADOS = [
    { value: 'SOLICITADA', label: 'Solicitada' },
    { value: 'APROBADA',   label: 'Aprobada' },
    { value: 'RECHAZADA',  label: 'Rechazada' },
    { value: 'DISFRUTADA', label: 'Disfrutada' },
    { value: 'CANCELADA',  label: 'Cancelada' },
];

function labelEstado(v) { return ESTADOS.find(e => e.value === v)?.label || v; }
function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
}
function calcularDiasHabiles(inicioStr, finStr) {
    if (!inicioStr || !finStr) return 0;
    const inicio = new Date(inicioStr + 'T00:00:00');
    const fin = new Date(finStr + 'T00:00:00');
    if (fin < inicio) return 0;
    let dias = 0;
    const actual = new Date(inicio);
    while (actual <= fin) {
        const dia = actual.getDay();
        if (dia !== 0 && dia !== 6) dias++;
        actual.setDate(actual.getDate() + 1);
    }
    return dias;
}

const formVacio = { colaborador: '', tipo_solicitud: 'VACACIONES', fecha_inicio: '', fecha_fin: '', responsable_hr: '', observaciones: '', autorizar_sin_saldo: false };

export default function Vacaciones() {
    const [tab, setTab] = useState('solicitudes');

    const [solicitudes, setSolicitudes] = useState([]);
    const [saldos, setSaldos]           = useState([]);
    const [stats, setStats]             = useState(null);
    const [cargando, setCargando]       = useState(true);
    const [error, setError]             = useState('');

    const [filtros, setFiltros] = useState({ estado: '', search: '' });

    const [modalNuevo, setModalNuevo]   = useState(false);
    const [nuevoForm, setNuevoForm]     = useState(formVacio);
    const [guardandoNuevo, setGuardandoNuevo] = useState(false);
    const [errorNuevo, setErrorNuevo]   = useState('');
    const [buscarColab, setBuscarColab] = useState('');
    const [resultadosColab, setResultadosColab] = useState([]);
    const [colabSeleccionado, setColabSeleccionado] = useState(null);

    const [detalle, setDetalle]         = useState(null);
    const [modalResp, setModalResp]     = useState(null); // 'aprobar' | 'rechazar'
    const [respForm, setRespForm]       = useState({ aprobado_por: '', motivo_rechazo: '' });
    const [guardandoResp, setGuardandoResp] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = {};
            Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
            const [sRes, saldosRes, statsRes] = await Promise.all([
                obtenerSolicitudes(params),
                obtenerSaldosGenerales(),
                obtenerEstadisticasVacaciones(),
            ]);
            setSolicitudes(sRes.data);
            setSaldos(saldosRes.data);
            setStats(statsRes.data);
        } catch {
            setError('No se pudo cargar la información de vacaciones.');
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => { cargar(); }, [cargar]);

    function handleFiltro(e) { setFiltros({ ...filtros, [e.target.name]: e.target.value }); }

    // ---- Nueva solicitud ----
    function abrirNuevo() {
        setNuevoForm(formVacio);
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

    async function submitNuevo() {
        if (!colabSeleccionado) { setErrorNuevo('Selecciona un colaborador de la lista.'); return; }
        if (!nuevoForm.fecha_inicio || !nuevoForm.fecha_fin || !nuevoForm.responsable_hr) {
            setErrorNuevo('Completa todos los campos obligatorios.');
            return;
        }
        setGuardandoNuevo(true);
        setErrorNuevo('');
        try {
            await crearSolicitud(nuevoForm);
            setModalNuevo(false);
            await cargar();
        } catch (err) {
            setErrorNuevo(formatearErrorAPI(err, 'No se pudo crear la solicitud.'));
        } finally {
            setGuardandoNuevo(false);
        }
    }

    // ---- Detalle y respuesta ----
    function abrirDetalle(s) { setDetalle(s); }
    function abrirResponder(tipo) {
        setRespForm({ aprobado_por: '', motivo_rechazo: '' });
        setModalResp(tipo);
    }
    async function submitRespuesta() {
        if (!respForm.aprobado_por.trim()) return;
        setGuardandoResp(true);
        try {
            if (modalResp === 'aprobar') {
                await aprobarSolicitud(detalle.id, { aprobado_por: respForm.aprobado_por });
            } else {
                await rechazarSolicitud(detalle.id, respForm);
            }
            setModalResp(null);
            setDetalle(null);
            await cargar();
        } catch {
            setError('No se pudo procesar la respuesta.');
        } finally {
            setGuardandoResp(false);
        }
    }
    async function handleCancelar() {
        try {
            await cancelarSolicitud(detalle.id);
            setDetalle(null);
            await cargar();
        } catch {
            setError('No se pudo cancelar la solicitud.');
        }
    }
    async function handleMarcarDisfrutada() {
        try {
            await marcarDisfrutada(detalle.id);
            setDetalle(null);
            await cargar();
        } catch {
            setError('No se pudo actualizar la solicitud.');
        }
    }

    const diasEstimados = calcularDiasHabiles(nuevoForm.fecha_inicio, nuevoForm.fecha_fin);

    return (
        <Layout>
            <div className="vc-page">
                <div className="vc-header-row">
                    <div>
                        <h1 className="vc-titulo">Vacaciones</h1>
                        <p className="vc-subtitulo">Solicitudes, aprobación y saldo de días por colaborador</p>
                    </div>
                    <button className="vc-btn vc-btn-primary" onClick={abrirNuevo}>+ Nueva solicitud</button>
                </div>

                {error && <p className="vc-form-error">{error}</p>}

                {stats && (
                    <div className="vc-kpis">
                        <div className="vc-kpi warn"><div className="num">{stats.kpis.solicitudes_pendientes}</div><div className="lbl">Pendientes de aprobar</div></div>
                        <div className="vc-kpi"><div className="num">{stats.kpis.en_disfrute_actualmente}</div><div className="lbl">De vacaciones ahora mismo</div></div>
                        <div className="vc-kpi"><div className="num">{stats.kpis.dias_tomados_este_anio}</div><div className="lbl">Días tomados este año</div></div>
                        <div className="vc-kpi warn"><div className="num">{stats.kpis.colaboradores_saldo_alto}</div><div className="lbl">Con saldo acumulado alto (+30d)</div></div>
                    </div>
                )}

                {stats?.saldos_altos?.length > 0 && (
                    <div className="vc-panel">
                        <h2>⚠ Saldo acumulado alto</h2>
                        <p className="vc-sub">Colaboradores con 30 días o más sin tomar — riesgo de pasivo laboral</p>
                        {stats.saldos_altos.map(s => (
                            <div className="vc-alert-item" key={s.id_colaborador}>
                                <span>{s.nombre}</span>
                                <strong style={{ color: '#B8752A' }}>{s.saldo_disponible} días</strong>
                            </div>
                        ))}
                    </div>
                )}

                {stats?.proximas_vacaciones?.length > 0 && (
                    <div className="vc-panel">
                        <h2>Próximas vacaciones aprobadas</h2>
                        {stats.proximas_vacaciones.map(p => (
                            <div className="vc-alert-item" key={p.id}>
                                <span>{p.colaborador}</span>
                                <span>{fmtFecha(p.fecha_inicio)} — {fmtFecha(p.fecha_fin)} ({p.dias_habiles}d)</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="vc-tabs">
                    <div className={'vc-tab' + (tab === 'solicitudes' ? ' activo' : '')} onClick={() => setTab('solicitudes')}>Solicitudes</div>
                    <div className={'vc-tab' + (tab === 'saldos' ? ' activo' : '')} onClick={() => setTab('saldos')}>Saldos por colaborador</div>
                </div>

                {tab === 'solicitudes' && (
                    <div className="vc-panel">
                        <h2>Registro de solicitudes</h2>
                        <p className="vc-sub">Haz clic en una solicitud para aprobarla, rechazarla o gestionarla</p>

                        <div className="vc-filters">
                            <input type="text" name="search" placeholder="Buscar por nombre o cédula…" value={filtros.search} onChange={handleFiltro} />
                            <select name="estado" value={filtros.estado} onChange={handleFiltro}>
                                <option value="">Estado (todos)</option>
                                {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                            </select>
                        </div>

                        <p style={{ fontSize: 12, color: '#6B6F76', marginBottom: 10 }}>
                            {cargando ? 'Cargando…' : `${solicitudes.length} solicitud(es)`}
                        </p>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                                <thead>
                                    <tr>
                                        <th>Colaborador</th>
                                        <th>Desde</th>
                                        <th>Hasta</th>
                                        <th>Días</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!cargando && solicitudes.length === 0 && (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No hay solicitudes con estos filtros.</td></tr>
                                    )}
                                    {solicitudes.map(s => (
                                        <tr key={s.id} onClick={() => abrirDetalle(s)} style={{ cursor: 'pointer' }}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{s.colaborador_nombre}</div>
                                                <div style={{ fontSize: 11.3, color: '#6B6F76' }}>{s.colaborador_cedula}</div>
                                            </td>
                                            <td style={{ color: '#6B6F76' }}>{fmtFecha(s.fecha_inicio)}</td>
                                            <td style={{ color: '#6B6F76' }}>{fmtFecha(s.fecha_fin)}</td>
                                            <td>{s.dias_habiles}</td>
                                            <td><span className={`vc-badge ${s.estado}`}>{labelEstado(s.estado)}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'saldos' && (
                    <div className="vc-panel">
                        <h2>Saldo de vacaciones por colaborador</h2>
                        <p className="vc-sub">15 días hábiles causados por cada año trabajado (1.25 días/mes) — ordenado de mayor a menor saldo</p>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                                <thead>
                                    <tr>
                                        <th>Colaborador</th>
                                        <th>Punto de venta</th>
                                        <th>Causados</th>
                                        <th>Consumidos</th>
                                        <th>Pendientes aprobar</th>
                                        <th>Saldo disponible</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saldos.map(s => {
                                        const pct = s.dias_causados > 0 ? Math.min(100, (s.saldo_disponible / s.dias_causados) * 100) : 0;
                                        return (
                                            <tr key={s.id_colaborador}>
                                                <td style={{ fontWeight: 600 }}>{s.nombre}</td>
                                                <td style={{ color: '#6B6F76' }}>{s.punto_venta || '—'}</td>
                                                <td>{s.dias_causados}</td>
                                                <td>{s.dias_consumidos}</td>
                                                <td>{s.dias_pendientes_aprobacion}</td>
                                                <td style={{ minWidth: 110 }}>
                                                    <strong>{s.saldo_disponible}</strong>
                                                    <div className="vc-saldo-barra-track">
                                                        <div className="vc-saldo-barra-fill" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal nueva solicitud */}
            {modalNuevo && (
                <Modal titulo="Nueva solicitud de vacaciones" onCerrar={() => setModalNuevo(false)}>
                    {errorNuevo && <p className="vc-form-error">{errorNuevo}</p>}

                    <div className="vc-form-field" style={{ marginBottom: 14, position: 'relative' }}>
                        <label>Colaborador *</label>
                        <input
                            type="text" placeholder="Escribe el nombre o la cédula…"
                            value={buscarColab} disabled={!!colabSeleccionado}
                            onChange={e => setBuscarColab(e.target.value)}
                        />
                        {colabSeleccionado && (
                            <button type="button" className="vc-btn vc-btn-ghost vc-btn-sm" style={{ marginTop: 6 }} onClick={limpiarColaborador}>✕ Cambiar colaborador</button>
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

                    <div className="vc-form-grid">
                        <div className="vc-form-field"><label>Fecha de inicio *</label><input type="date" value={nuevoForm.fecha_inicio} onChange={e => setNuevoForm({ ...nuevoForm, fecha_inicio: e.target.value })} /></div>
                        <div className="vc-form-field"><label>Fecha de fin *</label><input type="date" value={nuevoForm.fecha_fin} onChange={e => setNuevoForm({ ...nuevoForm, fecha_fin: e.target.value })} /></div>
                        <div className="vc-form-field full">
                            <label>Días hábiles estimados</label>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#2E75B6' }}>{diasEstimados} día(s)</div>
                        </div>
                        <div className="vc-form-field full">
                            <label>Tipo de solicitud</label>
                            <select value={nuevoForm.tipo_solicitud} onChange={e => setNuevoForm({ ...nuevoForm, tipo_solicitud: e.target.value })}>
                                <option value="VACACIONES">Vacaciones</option>
                                <option value="PERMISO_NO_REMUNERADO">Permiso no remunerado</option>
                                <option value="PERMISO_REMUNERADO">Permiso remunerado</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>
                        <div className="vc-form-field full"><label>Responsable HR *</label><input value={nuevoForm.responsable_hr} onChange={e => setNuevoForm({ ...nuevoForm, responsable_hr: e.target.value })} /></div>
                        <div className="vc-form-field full"><label>Observaciones</label><textarea value={nuevoForm.observaciones} onChange={e => setNuevoForm({ ...nuevoForm, observaciones: e.target.value })} /></div>
                        {nuevoForm.tipo_solicitud === 'VACACIONES' && (
                            <div className="full">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.8, color: '#4B554E' }}>
                                    <input type="checkbox" checked={nuevoForm.autorizar_sin_saldo}
                                        onChange={e => setNuevoForm({ ...nuevoForm, autorizar_sin_saldo: e.target.checked })} />
                                    Autorizar aunque no tenga saldo suficiente (vacaciones anticipadas)
                                </label>
                            </div>
                        )}
                    </div>
                    <div className="vc-form-actions">
                        <button className="vc-btn vc-btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
                        <button className="vc-btn vc-btn-primary" onClick={submitNuevo} disabled={guardandoNuevo}>
                            {guardandoNuevo ? 'Guardando…' : 'Crear solicitud'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal detalle */}
            {detalle && (
                <Modal titulo={detalle.colaborador_nombre} onCerrar={() => setDetalle(null)}>
                    <div className="vc-field-grid">
                        <div className="vc-field"><div className="k">Cédula</div><div className="v">{detalle.colaborador_cedula}</div></div>
                        <div className="vc-field"><div className="k">Cargo</div><div className="v">{detalle.colaborador_cargo}</div></div>
                        <div className="vc-field"><div className="k">Desde</div><div className="v">{fmtFecha(detalle.fecha_inicio)}</div></div>
                        <div className="vc-field"><div className="k">Hasta</div><div className="v">{fmtFecha(detalle.fecha_fin)}</div></div>
                        <div className="vc-field"><div className="k">Días hábiles</div><div className="v">{detalle.dias_habiles}</div></div>
                        <div className="vc-field"><div className="k">Estado</div><div className="v"><span className={`vc-badge ${detalle.estado}`}>{labelEstado(detalle.estado)}</span></div></div>
                        {detalle.aprobado_por && <div className="vc-field"><div className="k">Gestionado por</div><div className="v">{detalle.aprobado_por}</div></div>}
                    </div>
                    {detalle.observaciones && <p style={{ fontSize: 13, color: '#4B554E' }}>{detalle.observaciones}</p>}
                    {detalle.motivo_rechazo && <p style={{ fontSize: 12.5, color: '#A83E3E' }}>Motivo de rechazo: {detalle.motivo_rechazo}</p>}

                    <div className="vc-detalle-actions">
                        {detalle.estado === 'SOLICITADA' && (
                            <>
                                <button className="vc-btn vc-btn-success vc-btn-sm" onClick={() => abrirResponder('aprobar')}>✓ Aprobar</button>
                                <button className="vc-btn vc-btn-danger vc-btn-sm" onClick={() => abrirResponder('rechazar')}>✕ Rechazar</button>
                            </>
                        )}
                        {detalle.estado === 'APROBADA' && (
                            <>
                                <button className="vc-btn vc-btn-primary vc-btn-sm" onClick={handleMarcarDisfrutada}>Marcar como disfrutada</button>
                                <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={handleCancelar}>Cancelar solicitud</button>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            {/* Modal responder (aprobar/rechazar) */}
            {modalResp && (
                <Modal titulo={modalResp === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud'} onCerrar={() => setModalResp(null)}>
                    <div className="vc-form-grid">
                        <div className="vc-form-field full"><label>Tu nombre (quien aprueba/rechaza) *</label><input value={respForm.aprobado_por} onChange={e => setRespForm({ ...respForm, aprobado_por: e.target.value })} /></div>
                        {modalResp === 'rechazar' && (
                            <div className="vc-form-field full"><label>Motivo del rechazo</label><textarea value={respForm.motivo_rechazo} onChange={e => setRespForm({ ...respForm, motivo_rechazo: e.target.value })} /></div>
                        )}
                    </div>
                    <div className="vc-form-actions">
                        <button className="vc-btn vc-btn-ghost" onClick={() => setModalResp(null)}>Cancelar</button>
                        <button className={modalResp === 'aprobar' ? 'vc-btn vc-btn-success' : 'vc-btn vc-btn-danger'} onClick={submitRespuesta} disabled={guardandoResp}>
                            {guardandoResp ? 'Guardando…' : modalResp === 'aprobar' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
                        </button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}
