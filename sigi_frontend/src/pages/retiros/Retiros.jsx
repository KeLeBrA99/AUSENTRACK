/**
 * AUSENTRACK - Pagina de Retiros (offboarding)
 * Al registrar un retiro, el colaborador queda marcado automaticamente
 * como retirado en el sistema (sincronizado desde el backend).
 */

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import api from '../../api/axios';
import { formatearErrorAPI } from '../../utils/errores';
import { obtenerRetiros, crearRetiro, actualizarRetiro, obtenerEstadisticasRetiros } from '../../api/retiros';
import '../../components/layout/Layout.css';
import './Retiros.css';

const TIPOS = [
    { value: 'RENUNCIA_VOLUNTARIA', label: 'Renuncia voluntaria' },
    { value: 'DESPIDO_CON_JUSTA_CAUSA', label: 'Despido con justa causa' },
    { value: 'DESPIDO_SIN_JUSTA_CAUSA', label: 'Despido sin justa causa' },
    { value: 'TERMINACION_CONTRATO', label: 'Terminación de contrato' },
    { value: 'MUTUO_ACUERDO', label: 'Mutuo acuerdo' },
    { value: 'ABANDONO_PUESTO', label: 'Abandono del puesto' },
    { value: 'OTRO', label: 'Otro' },
];

const ESTADOS_LIQ = [
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'EN_PROCESO', label: 'En proceso' },
    { value: 'PAGADA', label: 'Pagada' },
];

function labelTipo(v) { return TIPOS.find(t => t.value === v)?.label || v; }
function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
}

const formVacio = {
    colaborador: '', tipo_retiro: 'RENUNCIA_VOLUNTARIA', motivo: '',
    fecha_retiro: '', ultimo_dia_laborado: '', responsable_hr: '',
    devolucion_dotacion: false, devolucion_equipos: false,
    paz_y_salvo_emitido: false, carta_laboral_entregada: false,
    estado_liquidacion: 'PENDIENTE',
};

export default function Retiros() {
    const [retiros, setRetiros] = useState([]);
    const [pagina, setPagina] = useState(1);
    const [totalRegistros, setTotalRegistros] = useState(0);
    const [haySiguiente, setHaySiguiente] = useState(false);
    const [hayAnterior, setHayAnterior] = useState(false);
    const [stats, setStats]     = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError]     = useState('');

    const [filtros, setFiltros] = useState({ tipo_retiro: '', estado_liquidacion: '', search: '' });

    const [modalNuevo, setModalNuevo]   = useState(false);
    const [nuevoForm, setNuevoForm]     = useState(formVacio);
    const [guardandoNuevo, setGuardandoNuevo] = useState(false);
    const [errorNuevo, setErrorNuevo]   = useState('');
    const [buscarColab, setBuscarColab] = useState('');
    const [resultadosColab, setResultadosColab] = useState([]);
    const [colabSeleccionado, setColabSeleccionado] = useState(null);

    const [detalle, setDetalle]         = useState(null);
    const [editForm, setEditForm]       = useState(null);
    const [guardandoEdit, setGuardandoEdit] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = { page: pagina };
            Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
            const [rRes, statsRes] = await Promise.all([
                obtenerRetiros(params),
                obtenerEstadisticasRetiros(),
            ]);
            setRetiros(rRes.data.results || rRes.data);
            setTotalRegistros(rRes.data.count ?? (rRes.data.length || 0));
            setHaySiguiente(!!rRes.data.next);
            setHayAnterior(!!rRes.data.previous);
            setStats(statsRes.data);
        } catch {
            setError('No se pudo cargar la información de retiros.');
        } finally {
            setCargando(false);
        }
    }, [filtros, pagina]);

    useEffect(() => { cargar(); }, [cargar]);

    function handleFiltro(e) { setFiltros({ ...filtros, [e.target.name]: e.target.value }); setPagina(1); }

    // ---- Nuevo retiro ----
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

    async function submitNuevo() {
        if (!colabSeleccionado) { setErrorNuevo('Selecciona un colaborador de la lista.'); return; }
        if (!nuevoForm.fecha_retiro || !nuevoForm.responsable_hr) {
            setErrorNuevo('Completa la fecha de retiro y el responsable.');
            return;
        }
        setGuardandoNuevo(true);
        setErrorNuevo('');
        try {
            const payload = { ...nuevoForm, ultimo_dia_laborado: nuevoForm.ultimo_dia_laborado || null };
            await crearRetiro(payload);
            setModalNuevo(false);
            await cargar();
        } catch (err) {
            setErrorNuevo(formatearErrorAPI(err, 'No se pudo registrar el retiro.'));
        } finally {
            setGuardandoNuevo(false);
        }
    }

    // ---- Detalle / edición de checklist y liquidación ----
    function abrirDetalle(r) {
        setDetalle(r);
        setEditForm({
            devolucion_dotacion: r.devolucion_dotacion,
            devolucion_equipos: r.devolucion_equipos,
            paz_y_salvo_emitido: r.paz_y_salvo_emitido,
            carta_laboral_entregada: r.carta_laboral_entregada,
            estado_liquidacion: r.estado_liquidacion,
            fecha_liquidacion: r.fecha_liquidacion || '',
            entrevista_realizada: r.entrevista_realizada,
            entrevista_notas: r.entrevista_notas || '',
            observaciones: r.observaciones || '',
        });
    }
    async function guardarEdicion() {
        setGuardandoEdit(true);
        try {
            const payload = { ...editForm, fecha_liquidacion: editForm.fecha_liquidacion || null };
            await actualizarRetiro(detalle.id, payload);
            setDetalle(null);
            await cargar();
        } catch {
            setError('No se pudo actualizar el retiro.');
        } finally {
            setGuardandoEdit(false);
        }
    }

    const retirosFiltrados = retiros;

    return (
        <Layout>
            <div className="rt-page">
                <div className="rt-header-row">
                    <div>
                        <h1 className="rt-titulo">Retiros</h1>
                        <p className="rt-subtitulo">Offboarding: checklist de entrega, liquidación y entrevista de salida</p>
                    </div>
                    <button className="rt-btn rt-btn-primary" onClick={abrirNuevo}>+ Registrar retiro</button>
                </div>

                {error && <p className="rt-form-error">{error}</p>}

                {stats && (
                    <div className="rt-kpis">
                        <div className="rt-kpi"><div className="num">{stats.kpis.colaboradores_activos}</div><div className="lbl">Colaboradores activos</div></div>
                        <div className="rt-kpi"><div className="num">{stats.kpis.retiros_este_anio}</div><div className="lbl">Retiros este año</div></div>
                        <div className="rt-kpi warn"><div className="num">{stats.kpis.tasa_rotacion_pct}%</div><div className="lbl">Tasa de rotación (año)</div></div>
                        <div className="rt-kpi warn"><div className="num">{stats.kpis.pendientes_liquidacion}</div><div className="lbl">Liquidaciones pendientes</div></div>
                    </div>
                )}

                {stats?.checklist_incompleto?.length > 0 && (
                    <div className="rt-panel">
                        <h2>⚠ Checklist de entrega incompleto</h2>
                        <p className="rt-sub">Dotación, equipos o paz y salvo pendientes de confirmar</p>
                        {stats.checklist_incompleto.map(r => (
                            <div className="rt-alert-item" key={r.id}>
                                <span>{r.colaborador}</span>
                                <span style={{ color: '#6B6F76' }}>{fmtFecha(r.fecha_retiro)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {stats?.pendientes_liquidacion?.length > 0 && (
                    <div className="rt-panel">
                        <h2>Liquidaciones pendientes</h2>
                        {stats.pendientes_liquidacion.map(r => (
                            <div className="rt-alert-item" key={r.id}>
                                <span>{r.colaborador}</span>
                                <span style={{ color: '#B8752A', fontWeight: 600 }}>{fmtFecha(r.fecha_retiro)}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="rt-panel">
                    <h2>Registro de retiros</h2>
                    <p className="rt-sub">Haz clic en un retiro para actualizar el checklist, la liquidación o la entrevista de salida</p>

                    <div className="rt-filters">
                        <input type="text" name="search" placeholder="Buscar por nombre o cédula…" value={filtros.search} onChange={handleFiltro} />
                        <select name="tipo_retiro" value={filtros.tipo_retiro} onChange={handleFiltro}>
                            <option value="">Tipo (todos)</option>
                            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select name="estado_liquidacion" value={filtros.estado_liquidacion} onChange={handleFiltro}>
                            <option value="">Liquidación (todas)</option>
                            {ESTADOS_LIQ.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                    </div>

                    <p style={{ fontSize: 12, color: '#6B6F76', marginBottom: 10 }}>
                        {cargando ? 'Cargando…' : `${retirosFiltrados.length} retiro(s)`}
                    </p>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Punto de venta</th>
                                    <th>Tipo</th>
                                    <th>Fecha retiro</th>
                                    <th>Liquidación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!cargando && retirosFiltrados.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No hay retiros con estos filtros.</td></tr>
                                )}
                                {retirosFiltrados.map(r => (
                                    <tr key={r.id} onClick={() => abrirDetalle(r)} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.colaborador_nombre}</div>
                                            <div style={{ fontSize: 11.3, color: '#6B6F76' }}>{r.colaborador_cedula}</div>
                                        </td>
                                        <td style={{ color: '#6B6F76' }}>{r.punto_venta_nombre || '—'}</td>
                                        <td>{r.tipo_retiro_display}</td>
                                        <td style={{ color: '#6B6F76' }}>{fmtFecha(r.fecha_retiro)}</td>
                                        <td><span className={`rt-badge ${r.estado_liquidacion}`}>{r.estado_liquidacion_display}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12.5, color: '#6B6F76' }}>
                        <span>
                            {totalRegistros > 0
                                ? `Mostrando ${(pagina - 1) * 50 + 1}–${Math.min(pagina * 50, totalRegistros)} de ${totalRegistros}`
                                : 'Sin resultados'}
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setPagina(p => p - 1)} disabled={!hayAnterior}>← Anterior</button>
                            <span>Página {pagina}</span>
                            <button className="rt-btn rt-btn-ghost rt-btn-sm" onClick={() => setPagina(p => p + 1)} disabled={!haySiguiente}>Siguiente →</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal registrar retiro */}
            {modalNuevo && (
                <Modal titulo="Registrar retiro" onCerrar={() => setModalNuevo(false)}>
                    {errorNuevo && <p className="rt-form-error">{errorNuevo}</p>}

                    <div className="rt-form-field" style={{ marginBottom: 14, position: 'relative' }}>
                        <label>Colaborador *</label>
                        <input
                            type="text" placeholder="Escribe el nombre o la cédula…"
                            value={buscarColab} disabled={!!colabSeleccionado}
                            onChange={e => setBuscarColab(e.target.value)}
                        />
                        {colabSeleccionado && (
                            <button type="button" className="rt-btn rt-btn-ghost rt-btn-sm" style={{ marginTop: 6 }} onClick={() => { setColabSeleccionado(null); setBuscarColab(''); }}>✕ Cambiar colaborador</button>
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

                    <div className="rt-form-grid">
                        <div className="rt-form-field">
                            <label>Tipo de retiro *</label>
                            <select value={nuevoForm.tipo_retiro} onChange={e => setNuevoForm({ ...nuevoForm, tipo_retiro: e.target.value })}>
                                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="rt-form-field"><label>Fecha de retiro *</label><input type="date" value={nuevoForm.fecha_retiro} onChange={e => setNuevoForm({ ...nuevoForm, fecha_retiro: e.target.value })} /></div>
                        <div className="rt-form-field"><label>Último día laborado</label><input type="date" value={nuevoForm.ultimo_dia_laborado} onChange={e => setNuevoForm({ ...nuevoForm, ultimo_dia_laborado: e.target.value })} /></div>
                        <div className="rt-form-field"><label>Responsable HR *</label><input value={nuevoForm.responsable_hr} onChange={e => setNuevoForm({ ...nuevoForm, responsable_hr: e.target.value })} /></div>
                        <div className="rt-form-field full"><label>Motivo</label><textarea value={nuevoForm.motivo} onChange={e => setNuevoForm({ ...nuevoForm, motivo: e.target.value })} /></div>

                        <div className="full" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={nuevoForm.devolucion_dotacion} onChange={e => setNuevoForm({ ...nuevoForm, devolucion_dotacion: e.target.checked })} /> Devolvió dotación / uniforme</label>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={nuevoForm.devolucion_equipos} onChange={e => setNuevoForm({ ...nuevoForm, devolucion_equipos: e.target.checked })} /> Devolvió equipos / llaves / accesos</label>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={nuevoForm.paz_y_salvo_emitido} onChange={e => setNuevoForm({ ...nuevoForm, paz_y_salvo_emitido: e.target.checked })} /> Paz y salvo emitido</label>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={nuevoForm.carta_laboral_entregada} onChange={e => setNuevoForm({ ...nuevoForm, carta_laboral_entregada: e.target.checked })} /> Carta laboral entregada</label>
                        </div>
                    </div>

                    <div className="rt-form-actions">
                        <button className="rt-btn rt-btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
                        <button className="rt-btn rt-btn-primary" onClick={submitNuevo} disabled={guardandoNuevo}>
                            {guardandoNuevo ? 'Guardando…' : 'Registrar retiro'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal detalle / edición */}
            {detalle && editForm && (
                <Modal titulo={detalle.colaborador_nombre} onCerrar={() => setDetalle(null)}>
                    <div className="rt-field-grid">
                        <div className="rt-field"><div className="k">Cédula</div><div className="v">{detalle.colaborador_cedula}</div></div>
                        <div className="rt-field"><div className="k">Tipo de retiro</div><div className="v">{labelTipo(detalle.tipo_retiro)}</div></div>
                        <div className="rt-field"><div className="k">Fecha de retiro</div><div className="v">{fmtFecha(detalle.fecha_retiro)}</div></div>
                        <div className="rt-field"><div className="k">Punto de venta</div><div className="v">{detalle.punto_venta_nombre || '—'}</div></div>
                    </div>

                    <h2 style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 10px' }}>Checklist de entrega y liquidación</h2>
                    <div className="rt-form-grid">
                        <div className="full" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={editForm.devolucion_dotacion} onChange={e => setEditForm({ ...editForm, devolucion_dotacion: e.target.checked })} /> Devolvió dotación / uniforme</label>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={editForm.devolucion_equipos} onChange={e => setEditForm({ ...editForm, devolucion_equipos: e.target.checked })} /> Devolvió equipos / llaves / accesos</label>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={editForm.paz_y_salvo_emitido} onChange={e => setEditForm({ ...editForm, paz_y_salvo_emitido: e.target.checked })} /> Paz y salvo emitido</label>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={editForm.carta_laboral_entregada} onChange={e => setEditForm({ ...editForm, carta_laboral_entregada: e.target.checked })} /> Carta laboral entregada</label>
                        </div>
                        <div className="rt-form-field">
                            <label>Estado de liquidación</label>
                            <select value={editForm.estado_liquidacion} onChange={e => setEditForm({ ...editForm, estado_liquidacion: e.target.value })}>
                                {ESTADOS_LIQ.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                            </select>
                        </div>
                        <div className="rt-form-field"><label>Fecha de liquidación</label><input type="date" value={editForm.fecha_liquidacion} onChange={e => setEditForm({ ...editForm, fecha_liquidacion: e.target.value })} /></div>

                        <div className="full" style={{ marginTop: 6 }}>
                            <label className="rt-checkbox-row"><input type="checkbox" checked={editForm.entrevista_realizada} onChange={e => setEditForm({ ...editForm, entrevista_realizada: e.target.checked })} /> Entrevista de salida realizada</label>
                        </div>
                        <div className="rt-form-field full"><label>Notas de la entrevista</label><textarea value={editForm.entrevista_notas} onChange={e => setEditForm({ ...editForm, entrevista_notas: e.target.value })} /></div>
                        <div className="rt-form-field full"><label>Observaciones</label><textarea value={editForm.observaciones} onChange={e => setEditForm({ ...editForm, observaciones: e.target.value })} /></div>
                    </div>

                    <div className="rt-form-actions">
                        <button className="rt-btn rt-btn-ghost" onClick={() => setDetalle(null)}>Cancelar</button>
                        <button className="rt-btn rt-btn-primary" onClick={guardarEdicion} disabled={guardandoEdit}>
                            {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}
