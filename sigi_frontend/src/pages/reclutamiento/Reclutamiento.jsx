/**
 * AUSENTRACK - Pagina de Reclutamiento y Seleccion
 * Vacantes + pipeline de candidatos tipo kanban (arrastrar entre etapas).
 */

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import { formatearErrorAPI } from '../../utils/errores';
import { obtenerPuntosVenta } from '../../api/puntosVenta';
import {
    obtenerVacantes, obtenerVacante, crearVacante, actualizarVacante,
    obtenerCandidatos, crearCandidato, actualizarCandidato,
    obtenerEstadisticasReclutamiento,
} from '../../api/reclutamiento';
import '../../components/layout/Layout.css';
import './Reclutamiento.css';

const ESTADOS_VACANTE = [
    { value: 'ABIERTA',  label: 'Abierta' },
    { value: 'PAUSADA',  label: 'Pausada' },
    { value: 'CERRADA',  label: 'Cerrada' },
    { value: 'CUBIERTA', label: 'Cubierta' },
];

const ETAPAS = [
    { value: 'POSTULADO',       label: 'Postulado' },
    { value: 'ENTREVISTA_RH',   label: 'Entrevista RH' },
    { value: 'ENTREVISTA_JEFE', label: 'Entrevista Jefe' },
    { value: 'PRUEBAS',         label: 'Pruebas' },
    { value: 'OFERTA',          label: 'Oferta' },
    { value: 'CONTRATADO',      label: 'Contratado' },
    { value: 'RECHAZADO',       label: 'Rechazado' },
    { value: 'DESISTIO',        label: 'Desistió' },
];

const formVacanteVacio = {
    cargo: '', punto_venta_fk: '', salario_ofrecido: '', descripcion: '', requisitos: '',
    responsable_hr: '', estado: 'ABIERTA', fecha_apertura: '', vacantes_disponibles: 1,
};
const formCandidatoVacio = {
    nombre: '', cedula: '', telefono: '', email: '', fecha_postulacion: '',
    fuente: '', notas: '', responsable_hr: '',
};

function labelEstado(v) { return ESTADOS_VACANTE.find(e => e.value === v)?.label || v; }
function labelEtapa(v) { return ETAPAS.find(e => e.value === v)?.label || v; }
function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}

export default function Reclutamiento() {
    const [vacantes, setVacantes]           = useState([]);
    const [stats, setStats]                 = useState(null);
    const [puntosVenta, setPuntosVenta]     = useState([]);
    const [cargando, setCargando]           = useState(true);
    const [error, setError]                 = useState('');

    const [filtroEstado, setFiltroEstado]   = useState('ABIERTA');
    const [filtroSearch, setFiltroSearch]   = useState('');

    const [vacanteSelId, setVacanteSelId]   = useState(null);
    const [vacanteDetalle, setVacanteDetalle] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const [modalNuevaVacante, setModalNuevaVacante] = useState(false);
    const [formVacante, setFormVacante]     = useState(formVacanteVacio);
    const [guardandoVacante, setGuardandoVacante] = useState(false);
    const [errorVacante, setErrorVacante]   = useState('');

    const [modalNuevoCandidato, setModalNuevoCandidato] = useState(false);
    const [formCandidato, setFormCandidato] = useState(formCandidatoVacio);
    const [guardandoCandidato, setGuardandoCandidato] = useState(false);
    const [errorCandidato, setErrorCandidato] = useState('');

    const [candidatoDetalle, setCandidatoDetalle] = useState(null);
    const [editandoCandidato, setEditandoCandidato] = useState(false);
    const [editCandForm, setEditCandForm]   = useState(null);
    const [guardandoEdit, setGuardandoEdit] = useState(false);

    const [dragId, setDragId]               = useState(null);
    const [dragOverEtapa, setDragOverEtapa] = useState(null);

    const cargarVacantes = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = {};
            if (filtroEstado) params.estado = filtroEstado;
            if (filtroSearch) params.search = filtroSearch;
            const [vRes, sRes] = await Promise.all([
                obtenerVacantes(params),
                obtenerEstadisticasReclutamiento(),
            ]);
            setVacantes(vRes.data);
            setStats(sRes.data);
        } catch {
            setError('No se pudieron cargar las vacantes.');
        } finally {
            setCargando(false);
        }
    }, [filtroEstado, filtroSearch]);

    useEffect(() => { cargarVacantes(); }, [cargarVacantes]);
    useEffect(() => {
        obtenerPuntosVenta({ activo: true }).then(res => setPuntosVenta(res.data)).catch(() => {});
    }, []);

    const cargarDetalleVacante = useCallback(async (id) => {
        setCargandoDetalle(true);
        try {
            const res = await obtenerVacante(id);
            setVacanteDetalle(res.data);
        } catch {
            setError('No se pudo cargar el detalle de la vacante.');
        } finally {
            setCargandoDetalle(false);
        }
    }, []);

    useEffect(() => {
        if (vacanteSelId) cargarDetalleVacante(vacanteSelId);
        else setVacanteDetalle(null);
    }, [vacanteSelId, cargarDetalleVacante]);

    function seleccionarVacante(v) {
        setVacanteSelId(v.id === vacanteSelId ? null : v.id);
    }

    // ---- Nueva vacante ----
    function abrirNuevaVacante() {
        setFormVacante(formVacanteVacio);
        setErrorVacante('');
        setModalNuevaVacante(true);
    }
    async function submitVacante() {
        const requeridos = ['cargo', 'punto_venta_fk', 'responsable_hr', 'fecha_apertura'];
        for (const c of requeridos) {
            if (!formVacante[c]?.toString().trim()) {
                setErrorVacante('Completa todos los campos obligatorios (*).');
                return;
            }
        }
        setGuardandoVacante(true);
        setErrorVacante('');
        try {
            await crearVacante({
                ...formVacante,
                salario_ofrecido: formVacante.salario_ofrecido || null,
                vacantes_disponibles: Number(formVacante.vacantes_disponibles) || 1,
            });
            setModalNuevaVacante(false);
            await cargarVacantes();
        } catch (err) {
            setErrorVacante(formatearErrorAPI(err, 'No se pudo crear la vacante.'));
        } finally {
            setGuardandoVacante(false);
        }
    }

    // ---- Nuevo candidato ----
    function abrirNuevoCandidato() {
        setFormCandidato(formCandidatoVacio);
        setErrorCandidato('');
        setModalNuevoCandidato(true);
    }
    async function submitCandidato() {
        const requeridos = ['nombre', 'cedula', 'fecha_postulacion', 'responsable_hr'];
        for (const c of requeridos) {
            if (!formCandidato[c]?.trim()) {
                setErrorCandidato('Completa todos los campos obligatorios (*).');
                return;
            }
        }
        setGuardandoCandidato(true);
        setErrorCandidato('');
        try {
            await crearCandidato({ ...formCandidato, vacante: vacanteSelId, etapa: 'POSTULADO' });
            setModalNuevoCandidato(false);
            await cargarDetalleVacante(vacanteSelId);
            await cargarVacantes();
        } catch (err) {
            setErrorCandidato(formatearErrorAPI(err, 'No se pudo registrar el candidato.'));
        } finally {
            setGuardandoCandidato(false);
        }
    }

    // ---- Detalle / edicion de candidato ----
    function abrirDetalleCandidato(c) {
        setCandidatoDetalle(c);
        setEditandoCandidato(false);
    }
    function iniciarEdicionCandidato() {
        setEditCandForm({
            etapa: candidatoDetalle.etapa,
            notas: candidatoDetalle.notas || '',
            motivo_rechazo: candidatoDetalle.motivo_rechazo || '',
            telefono: candidatoDetalle.telefono || '',
            email: candidatoDetalle.email || '',
        });
        setEditandoCandidato(true);
    }
    async function guardarEdicionCandidato() {
        setGuardandoEdit(true);
        try {
            await actualizarCandidato(candidatoDetalle.id, editCandForm);
            setCandidatoDetalle(null);
            setEditandoCandidato(false);
            await cargarDetalleVacante(vacanteSelId);
            await cargarVacantes();
        } catch {
            setError('No se pudo guardar el cambio.');
        } finally {
            setGuardandoEdit(false);
        }
    }

    // ---- Drag and drop del kanban ----
    function onDragStart(e, candidatoId) {
        setDragId(candidatoId);
        e.dataTransfer.effectAllowed = 'move';
    }
    function onDragOverCol(e, etapa) {
        e.preventDefault();
        setDragOverEtapa(etapa);
    }
    async function onDropCol(e, etapa) {
        e.preventDefault();
        setDragOverEtapa(null);
        if (!dragId) return;
        const candidato = vacanteDetalle.candidatos.find(c => c.id === dragId);
        if (!candidato || candidato.etapa === etapa) { setDragId(null); return; }
        try {
            await actualizarCandidato(dragId, { etapa });
            await cargarDetalleVacante(vacanteSelId);
            await cargarVacantes();
        } catch {
            setError('No se pudo mover el candidato de etapa.');
        } finally {
            setDragId(null);
        }
    }

    return (
        <Layout>
            <div className="rc-page">
                <div className="rc-header-row">
                    <div>
                        <h1 className="rc-titulo">Reclutamiento y Selección</h1>
                        <p className="rc-subtitulo">Vacantes activas y pipeline de candidatos</p>
                    </div>
                    <button className="rc-btn rc-btn-primary" onClick={abrirNuevaVacante}>+ Nueva vacante</button>
                </div>

                {error && <p className="rc-form-error">{error}</p>}

                {stats && (
                    <div className="rc-kpis">
                        <div className="rc-kpi accent"><div className="num">{stats.kpis.vacantes_abiertas}</div><div className="lbl">Vacantes abiertas</div></div>
                        <div className="rc-kpi"><div className="num">{stats.kpis.total_vacantes}</div><div className="lbl">Vacantes totales</div></div>
                        <div className="rc-kpi"><div className="num">{stats.kpis.total_candidatos}</div><div className="lbl">Candidatos en proceso</div></div>
                        <div className="rc-kpi warn"><div className="num">{stats.kpis.contratados}</div><div className="lbl">Contratados</div></div>
                    </div>
                )}

                {/* Listado de vacantes */}
                <div className="rc-panel">
                    <h2>Vacantes</h2>
                    <p className="rc-sub">Selecciona una vacante para ver su pipeline de candidatos</p>

                    <div className="rc-filters">
                        <input type="text" placeholder="Buscar por cargo o punto de venta…" value={filtroSearch} onChange={e => setFiltroSearch(e.target.value)} />
                        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                            <option value="">Estado (todos)</option>
                            {ESTADOS_VACANTE.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                    </div>

                    {cargando && <p className="rc-sub">Cargando…</p>}
                    {!cargando && vacantes.length === 0 && <p className="rc-sub">No hay vacantes con estos filtros.</p>}

                    <div className="rc-vacantes-grid">
                        {vacantes.map(v => (
                            <div
                                key={v.id}
                                className={'rc-vacante-card' + (vacanteSelId === v.id ? ' selected' : '')}
                                onClick={() => seleccionarVacante(v)}
                            >
                                <div className="cargo">{v.cargo}</div>
                                <div className="punto">{v.punto_venta_fk_nombre || v.punto_venta || 'Sin punto de venta'}</div>
                                <div className="meta-row">
                                    <span className="salario">{v.salario_ofrecido ? `$${Number(v.salario_ofrecido).toLocaleString('es-CO')}` : '—'}</span>
                                    <span className={`rc-estado-pill ${v.estado}`}>{labelEstado(v.estado)}</span>
                                </div>
                                <div className="candidatos-count">{v.total_candidatos} candidato(s) · {v.candidatos_contratados} contratado(s)</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pipeline / Kanban de la vacante seleccionada */}
                {vacanteSelId && (
                    <div className="rc-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                            <div>
                                <h2>Pipeline: {vacanteDetalle?.cargo}</h2>
                                <p className="rc-sub">Arrastra las tarjetas entre columnas para cambiar de etapa</p>
                            </div>
                            <button className="rc-btn rc-btn-primary" onClick={abrirNuevoCandidato}>+ Postular candidato</button>
                        </div>

                        {cargandoDetalle && <p className="rc-sub">Cargando pipeline…</p>}

                        {vacanteDetalle && !cargandoDetalle && (
                            <div className="rc-kanban">
                                {ETAPAS.map(etapa => {
                                    const candidatosEtapa = vacanteDetalle.candidatos.filter(c => c.etapa === etapa.value);
                                    return (
                                        <div
                                            key={etapa.value}
                                            className={'rc-kanban-col' + (dragOverEtapa === etapa.value ? ' drop-target' : '')}
                                            onDragOver={e => onDragOverCol(e, etapa.value)}
                                            onDragLeave={() => setDragOverEtapa(null)}
                                            onDrop={e => onDropCol(e, etapa.value)}
                                        >
                                            <div className="rc-kanban-col-header">
                                                <span className="rc-kanban-col-title">{etapa.label}</span>
                                                <span className="rc-kanban-col-count">{candidatosEtapa.length}</span>
                                            </div>
                                            {candidatosEtapa.length === 0 && <div className="rc-kanban-empty">—</div>}
                                            {candidatosEtapa.map(c => (
                                                <div
                                                    key={c.id}
                                                    className={'rc-kanban-card' + (dragId === c.id ? ' dragging' : '')}
                                                    draggable
                                                    onDragStart={e => onDragStart(e, c.id)}
                                                    onClick={() => abrirDetalleCandidato(c)}
                                                >
                                                    <div className="nombre">{c.nombre}</div>
                                                    <div className="cedula">{c.cedula}</div>
                                                    {c.colaborador_nombre && (
                                                        <div style={{ fontSize: 10.5, color: '#2F6F5E', fontWeight: 600, marginTop: 4 }}>
                                                            ✓ Ya es colaborador
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Vacantes con mas tiempo abiertas */}
                {stats?.vacantes_mas_antiguas?.length > 0 && (
                    <div className="rc-panel">
                        <h2>⚠ Vacantes más antiguas</h2>
                        <p className="rc-sub">Posibles cuellos de botella en el proceso de selección</p>
                        {stats.vacantes_mas_antiguas.map(v => (
                            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E1DED4', fontSize: 12.8 }}>
                                <span>{v.cargo} · {v.punto_venta_fk_nombre || v.punto_venta}</span>
                                <strong>{v.dias_abierta} días</strong>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal nueva vacante */}
            {modalNuevaVacante && (
                <Modal titulo="Registrar nueva vacante" onCerrar={() => setModalNuevaVacante(false)}>
                    {errorVacante && <p className="rc-form-error">{errorVacante}</p>}
                    <div className="rc-form-grid">
                        <div className="rc-form-field"><label>Cargo *</label><input value={formVacante.cargo} onChange={e => setFormVacante({ ...formVacante, cargo: e.target.value })} /></div>
                        <div className="rc-form-field">
                            <label>Punto de venta *</label>
                            <select value={formVacante.punto_venta_fk} onChange={e => setFormVacante({ ...formVacante, punto_venta_fk: e.target.value })}>
                                <option value="">Seleccionar…</option>
                                {puntosVenta.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                        <div className="rc-form-field"><label>Salario ofrecido</label><input type="number" value={formVacante.salario_ofrecido} onChange={e => setFormVacante({ ...formVacante, salario_ofrecido: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Vacantes disponibles</label><input type="number" min="1" value={formVacante.vacantes_disponibles} onChange={e => setFormVacante({ ...formVacante, vacantes_disponibles: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Fecha de apertura *</label><input type="date" value={formVacante.fecha_apertura} onChange={e => setFormVacante({ ...formVacante, fecha_apertura: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Responsable HR *</label><input value={formVacante.responsable_hr} onChange={e => setFormVacante({ ...formVacante, responsable_hr: e.target.value })} /></div>
                        <div className="rc-form-field full"><label>Descripción</label><textarea value={formVacante.descripcion} onChange={e => setFormVacante({ ...formVacante, descripcion: e.target.value })} /></div>
                        <div className="rc-form-field full"><label>Requisitos</label><textarea value={formVacante.requisitos} onChange={e => setFormVacante({ ...formVacante, requisitos: e.target.value })} /></div>
                    </div>
                    <div className="rc-form-actions">
                        <button className="rc-btn rc-btn-ghost" onClick={() => setModalNuevaVacante(false)}>Cancelar</button>
                        <button className="rc-btn rc-btn-primary" onClick={submitVacante} disabled={guardandoVacante}>
                            {guardandoVacante ? 'Guardando…' : 'Crear vacante'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal nuevo candidato */}
            {modalNuevoCandidato && (
                <Modal titulo="Postular candidato" onCerrar={() => setModalNuevoCandidato(false)}>
                    {errorCandidato && <p className="rc-form-error">{errorCandidato}</p>}
                    <div className="rc-form-grid">
                        <div className="rc-form-field"><label>Nombre completo *</label><input value={formCandidato.nombre} onChange={e => setFormCandidato({ ...formCandidato, nombre: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Cédula *</label><input value={formCandidato.cedula} onChange={e => setFormCandidato({ ...formCandidato, cedula: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Teléfono</label><input value={formCandidato.telefono} onChange={e => setFormCandidato({ ...formCandidato, telefono: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Email</label><input type="email" value={formCandidato.email} onChange={e => setFormCandidato({ ...formCandidato, email: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Fecha de postulación *</label><input type="date" value={formCandidato.fecha_postulacion} onChange={e => setFormCandidato({ ...formCandidato, fecha_postulacion: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Fuente</label><input placeholder="Ej: Computrabajo, referido" value={formCandidato.fuente} onChange={e => setFormCandidato({ ...formCandidato, fuente: e.target.value })} /></div>
                        <div className="rc-form-field"><label>Responsable HR *</label><input value={formCandidato.responsable_hr} onChange={e => setFormCandidato({ ...formCandidato, responsable_hr: e.target.value })} /></div>
                        <div className="rc-form-field full"><label>Notas</label><textarea value={formCandidato.notas} onChange={e => setFormCandidato({ ...formCandidato, notas: e.target.value })} /></div>
                    </div>
                    <div className="rc-form-actions">
                        <button className="rc-btn rc-btn-ghost" onClick={() => setModalNuevoCandidato(false)}>Cancelar</button>
                        <button className="rc-btn rc-btn-primary" onClick={submitCandidato} disabled={guardandoCandidato}>
                            {guardandoCandidato ? 'Guardando…' : 'Postular'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal detalle / edicion de candidato */}
            {candidatoDetalle && (
                <Modal titulo={candidatoDetalle.nombre} onCerrar={() => setCandidatoDetalle(null)}>
                    {!editandoCandidato ? (
                        <>
                            <div className="rc-field-grid">
                                <div className="rc-field"><div className="k">Cédula</div><div className="v">{candidatoDetalle.cedula}</div></div>
                                <div className="rc-field"><div className="k">Etapa</div><div className="v">{labelEtapa(candidatoDetalle.etapa)}</div></div>
                                <div className="rc-field"><div className="k">Teléfono</div><div className="v">{candidatoDetalle.telefono || '—'}</div></div>
                                <div className="rc-field"><div className="k">Email</div><div className="v">{candidatoDetalle.email || '—'}</div></div>
                                <div className="rc-field"><div className="k">Fecha de postulación</div><div className="v">{fmtFecha(candidatoDetalle.fecha_postulacion)}</div></div>
                                <div className="rc-field"><div className="k">Fuente</div><div className="v">{candidatoDetalle.fuente || '—'}</div></div>
                                <div className="rc-field"><div className="k">Colaborador vinculado</div><div className="v">{candidatoDetalle.colaborador_nombre ? `✓ ${candidatoDetalle.colaborador_nombre}` : '—'}</div></div>
                            </div>
                            {candidatoDetalle.notas && <div className="rc-block"><div className="k">Notas</div><div className="v">{candidatoDetalle.notas}</div></div>}
                            {candidatoDetalle.motivo_rechazo && <div className="rc-block"><div className="k">Motivo de rechazo</div><div className="v">{candidatoDetalle.motivo_rechazo}</div></div>}
                            <button className="rc-edit-toggle" onClick={iniciarEdicionCandidato}>✎ Editar etapa, contacto y notas</button>
                        </>
                    ) : (
                        <>
                            <div className="rc-form-grid">
                                <div className="rc-form-field">
                                    <label>Etapa</label>
                                    <select value={editCandForm.etapa} onChange={e => setEditCandForm({ ...editCandForm, etapa: e.target.value })}>
                                        {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                                    </select>
                                </div>
                                <div className="rc-form-field"><label>Teléfono</label><input value={editCandForm.telefono} onChange={e => setEditCandForm({ ...editCandForm, telefono: e.target.value })} /></div>
                                <div className="rc-form-field"><label>Email</label><input value={editCandForm.email} onChange={e => setEditCandForm({ ...editCandForm, email: e.target.value })} /></div>
                                {editCandForm.etapa === 'RECHAZADO' && (
                                    <div className="rc-form-field full"><label>Motivo de rechazo</label><input value={editCandForm.motivo_rechazo} onChange={e => setEditCandForm({ ...editCandForm, motivo_rechazo: e.target.value })} /></div>
                                )}
                                <div className="rc-form-field full"><label>Notas</label><textarea value={editCandForm.notas} onChange={e => setEditCandForm({ ...editCandForm, notas: e.target.value })} /></div>
                            </div>
                            <div className="rc-form-actions">
                                <button className="rc-btn rc-btn-ghost" onClick={() => setEditandoCandidato(false)}>Cancelar</button>
                                <button className="rc-btn rc-btn-primary" onClick={guardarEdicionCandidato} disabled={guardandoEdit}>
                                    {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                                </button>
                            </div>
                        </>
                    )}
                </Modal>
            )}
        </Layout>
    );
}
