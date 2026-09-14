/**
 * AUSENTRACK - Pagina de Contratos
 * Generacion de contratos, control de vencimientos y renovaciones,
 * todo vinculado a la ficha real del colaborador.
 */

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import { formatearErrorAPI } from '../../utils/errores';
import api from '../../api/axios';
import {
    obtenerContratos, crearContrato, actualizarContrato,
    renovarContrato, terminarContrato, descargarPdfContrato,
    obtenerEstadisticasContratos,
} from '../../api/contratos';
import '../../components/layout/Layout.css';
import './Contratos.css';

const TIPOS_CONTRATO = [
    { value: 'INDEFINIDO',           label: 'Término Indefinido' },
    { value: 'FIJO',                 label: 'Término Fijo' },
    { value: 'OBRA_LABOR',           label: 'Obra o Labor' },
    { value: 'APRENDIZAJE',          label: 'Contrato de Aprendizaje' },
    { value: 'PRESTACION_SERVICIOS', label: 'Prestación de Servicios' },
];

const ESTADOS = [
    { value: 'VIGENTE',   label: 'Vigente' },
    { value: 'VENCIDO',   label: 'Vencido' },
    { value: 'TERMINADO', label: 'Terminado' },
    { value: 'RENOVADO',  label: 'Renovado' },
];

const formVacio = {
    colaborador: '', tipo_contrato: 'FIJO', cargo: '', punto_venta: '',
    salario: '', fecha_inicio: '', fecha_fin: '', responsable_hr: '', observaciones: '',
};

function labelTipo(v) { return TIPOS_CONTRATO.find(t => t.value === v)?.label || v; }
function labelEstado(v) { return ESTADOS.find(e => e.value === v)?.label || v; }
function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}
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

export default function Contratos() {
    const [contratos, setContratos]   = useState([]);
    const [stats, setStats]           = useState(null);
    const [cargando, setCargando]     = useState(true);
    const [error, setError]           = useState('');

    const [filtros, setFiltros] = useState({ estado: '', tipo_contrato: '', search: '' });

    const [modalNuevo, setModalNuevo]   = useState(false);
    const [nuevoForm, setNuevoForm]     = useState(formVacio);
    const [guardandoNuevo, setGuardandoNuevo] = useState(false);
    const [errorNuevo, setErrorNuevo]   = useState('');
    const [buscarColab, setBuscarColab] = useState('');
    const [resultadosColab, setResultadosColab] = useState([]);
    const [colabSeleccionado, setColabSeleccionado] = useState(null);

    const [detalle, setDetalle]         = useState(null);
    const [editando, setEditando]       = useState(false);
    const [editForm, setEditForm]       = useState(null);
    const [guardandoEdit, setGuardandoEdit] = useState(false);

    const [modalRenovar, setModalRenovar] = useState(false);
    const [renovarForm, setRenovarForm]   = useState({ fecha_inicio: '', fecha_fin: '', salario: '', responsable_hr: '', observaciones: '' });
    const [guardandoRenovar, setGuardandoRenovar] = useState(false);

    const [modalTerminar, setModalTerminar] = useState(false);
    const [terminarForm, setTerminarForm]   = useState({ fecha_terminacion: '', motivo_terminacion: '' });
    const [guardandoTerminar, setGuardandoTerminar] = useState(false);

    const [descargando, setDescargando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = {};
            Object.entries(filtros).forEach(([k, v]) => { if (v) params[k] = v; });
            const [cRes, sRes] = await Promise.all([obtenerContratos(params), obtenerEstadisticasContratos()]);
            setContratos(cRes.data);
            setStats(sRes.data);
        } catch {
            setError('No se pudieron cargar los contratos.');
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => { cargar(); }, [cargar]);

    function handleFiltro(e) { setFiltros({ ...filtros, [e.target.name]: e.target.value }); }

    // ---- Nuevo contrato ----
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
        setNuevoForm({
            ...nuevoForm, colaborador: c.id_colaborador,
            cargo: c.cargo || '', punto_venta: c.area || '',
        });
    }
    function limpiarColaborador() {
        setColabSeleccionado(null);
        setBuscarColab('');
        setNuevoForm({ ...nuevoForm, colaborador: '' });
    }

    async function submitNuevo() {
        if (!colabSeleccionado) { setErrorNuevo('Selecciona un colaborador de la lista.'); return; }
        const requeridos = ['cargo', 'salario', 'fecha_inicio', 'responsable_hr'];
        for (const c of requeridos) {
            if (!nuevoForm[c]?.toString().trim()) { setErrorNuevo('Completa todos los campos obligatorios.'); return; }
        }
        if (nuevoForm.tipo_contrato !== 'INDEFINIDO' && !nuevoForm.fecha_fin) {
            setErrorNuevo('La fecha de fin es obligatoria para este tipo de contrato.');
            return;
        }
        setGuardandoNuevo(true);
        setErrorNuevo('');
        try {
            await crearContrato({ ...nuevoForm, fecha_fin: nuevoForm.fecha_fin || null });
            setModalNuevo(false);
            await cargar();
        } catch (err) {
            setErrorNuevo(formatearErrorAPI(err, 'No se pudo crear el contrato.'));
        } finally {
            setGuardandoNuevo(false);
        }
    }

    // ---- Detalle / edicion ----
    function abrirDetalle(c) { setDetalle(c); setEditando(false); }
    function iniciarEdicion() {
        setEditForm({
            salario: detalle.salario, fecha_fin: detalle.fecha_fin || '',
            observaciones: detalle.observaciones || '', responsable_hr: detalle.responsable_hr,
        });
        setEditando(true);
    }
    async function guardarEdicion() {
        setGuardandoEdit(true);
        try {
            const res = await actualizarContrato(detalle.id, editForm);
            setDetalle(res.data);
            setEditando(false);
            await cargar();
        } catch {
            setError('No se pudo guardar el cambio.');
        } finally {
            setGuardandoEdit(false);
        }
    }

    // ---- Renovar ----
    function abrirRenovar() {
        setRenovarForm({
            fecha_inicio: '', fecha_fin: '', salario: detalle.salario,
            responsable_hr: detalle.responsable_hr, observaciones: '',
        });
        setModalRenovar(true);
    }
    async function submitRenovar() {
        if (!renovarForm.fecha_inicio || !renovarForm.responsable_hr) return;
        setGuardandoRenovar(true);
        try {
            await renovarContrato(detalle.id, renovarForm);
            setModalRenovar(false);
            setDetalle(null);
            await cargar();
        } catch {
            setError('No se pudo renovar el contrato.');
        } finally {
            setGuardandoRenovar(false);
        }
    }

    // ---- Terminar ----
    function abrirTerminar() {
        setTerminarForm({ fecha_terminacion: '', motivo_terminacion: '' });
        setModalTerminar(true);
    }
    async function submitTerminar() {
        setGuardandoTerminar(true);
        try {
            const res = await terminarContrato(detalle.id, terminarForm);
            setDetalle(res.data);
            setModalTerminar(false);
            await cargar();
        } catch {
            setError('No se pudo terminar el contrato.');
        } finally {
            setGuardandoTerminar(false);
        }
    }

    // ---- PDF ----
    async function handleDescargarPdf(id, cedula) {
        setDescargando(true);
        try {
            const res = await descargarPdfContrato(id);
            descargarBlob(res.data, `contrato_${cedula}.pdf`);
        } catch {
            setError('No se pudo generar el PDF.');
        } finally {
            setDescargando(false);
        }
    }

    return (
        <Layout>
            <div className="ct-page">
                <div className="ct-header-row">
                    <div>
                        <h1 className="ct-titulo">Contratos</h1>
                        <p className="ct-subtitulo">Generación, vencimientos y renovaciones</p>
                    </div>
                    <button className="ct-btn ct-btn-primary" onClick={abrirNuevo}>+ Nuevo contrato</button>
                </div>

                {error && <p className="ct-form-error">{error}</p>}

                {stats && (
                    <div className="ct-kpis">
                        <div className="ct-kpi"><div className="num">{stats.kpis.vigentes}</div><div className="lbl">Contratos vigentes</div></div>
                        <div className="ct-kpi warn"><div className="num">{stats.kpis.proximos_a_vencer_30d}</div><div className="lbl">Vencen en 30 días</div></div>
                        <div className="ct-kpi danger"><div className="num">{stats.kpis.vencidos}</div><div className="lbl">Vencidos</div></div>
                        <div className="ct-kpi"><div className="num">{stats.kpis.terminados}</div><div className="lbl">Terminados</div></div>
                    </div>
                )}

                {stats?.proximos_a_vencer?.length > 0 && (
                    <div className="ct-panel">
                        <h2>⚠ Próximos a vencer</h2>
                        <p className="ct-sub">Contratos vigentes que vencen en los próximos 30 días</p>
                        {stats.proximos_a_vencer.map(p => (
                            <div className="ct-alert-item" key={p.id}>
                                <div>
                                    <div className="who">{p.colaborador}</div>
                                    <div className="where">{p.cargo} · {p.punto_venta}</div>
                                </div>
                                <span className={'ct-alert-tag ' + (p.dias_restantes <= 7 ? 'critico' : 'medio')}>{p.dias_restantes} días</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="ct-panel">
                    <h2>Registro de contratos</h2>
                    <p className="ct-sub">Haz clic en un contrato para ver el detalle, renovarlo o terminarlo</p>

                    <div className="ct-filters">
                        <input type="text" name="search" placeholder="Buscar por nombre o cédula…" value={filtros.search} onChange={handleFiltro} />
                        <select name="estado" value={filtros.estado} onChange={handleFiltro}>
                            <option value="">Estado (todos)</option>
                            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                        <select name="tipo_contrato" value={filtros.tipo_contrato} onChange={handleFiltro}>
                            <option value="">Tipo (todos)</option>
                            {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>

                    <p style={{ fontSize: 12, color: '#6B6F76', marginBottom: 10 }}>
                        {cargando ? 'Cargando…' : `${contratos.length} contrato(s)`}
                    </p>

                    <div style={{ overflowX: 'auto' }}>
                        <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Tipo</th>
                                    <th>Cargo</th>
                                    <th>Inicio</th>
                                    <th>Fin</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!cargando && contratos.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No hay contratos con estos filtros.</td></tr>
                                )}
                                {contratos.map(c => (
                                    <tr key={c.id} onClick={() => abrirDetalle(c)} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{c.colaborador_nombre}</div>
                                            <div style={{ fontSize: 11.3, color: '#6B6F76' }}>{c.colaborador_cedula}</div>
                                        </td>
                                        <td>{labelTipo(c.tipo_contrato)}</td>
                                        <td>{c.cargo}</td>
                                        <td style={{ color: '#6B6F76' }}>{fmtFecha(c.fecha_inicio)}</td>
                                        <td style={{ color: '#6B6F76' }}>{c.fecha_fin ? fmtFecha(c.fecha_fin) : 'Indefinido'}</td>
                                        <td><span className={`ct-badge ${c.estado}`}>{labelEstado(c.estado)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal nuevo contrato */}
            {modalNuevo && (
                <Modal titulo="Nuevo contrato" onCerrar={() => setModalNuevo(false)}>
                    {errorNuevo && <p className="ct-form-error">{errorNuevo}</p>}

                    <div className="ct-form-field" style={{ marginBottom: 14, position: 'relative' }}>
                        <label>Colaborador *</label>
                        <input
                            type="text" placeholder="Escribe el nombre o la cédula…"
                            value={buscarColab} disabled={!!colabSeleccionado}
                            onChange={e => setBuscarColab(e.target.value)}
                        />
                        {colabSeleccionado && (
                            <button type="button" className="ct-btn ct-btn-ghost ct-btn-sm" style={{ marginTop: 6 }} onClick={limpiarColaborador}>✕ Cambiar colaborador</button>
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

                    <div className="ct-form-grid">
                        <div className="ct-form-field">
                            <label>Tipo de contrato *</label>
                            <select value={nuevoForm.tipo_contrato} onChange={e => setNuevoForm({ ...nuevoForm, tipo_contrato: e.target.value })}>
                                {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="ct-form-field"><label>Cargo *</label><input value={nuevoForm.cargo} onChange={e => setNuevoForm({ ...nuevoForm, cargo: e.target.value })} /></div>
                        <div className="ct-form-field">
                            <label>Punto de venta</label>
                            <input value={nuevoForm.punto_venta} disabled placeholder="Se toma del colaborador seleccionado" />
                        </div>
                        <div className="ct-form-field"><label>Salario *</label><input type="number" value={nuevoForm.salario} onChange={e => setNuevoForm({ ...nuevoForm, salario: e.target.value })} /></div>
                        <div className="ct-form-field"><label>Fecha de inicio *</label><input type="date" value={nuevoForm.fecha_inicio} onChange={e => setNuevoForm({ ...nuevoForm, fecha_inicio: e.target.value })} /></div>
                        {nuevoForm.tipo_contrato !== 'INDEFINIDO' && (
                            <div className="ct-form-field"><label>Fecha de fin *</label><input type="date" value={nuevoForm.fecha_fin} onChange={e => setNuevoForm({ ...nuevoForm, fecha_fin: e.target.value })} /></div>
                        )}
                        <div className="ct-form-field"><label>Responsable HR *</label><input value={nuevoForm.responsable_hr} onChange={e => setNuevoForm({ ...nuevoForm, responsable_hr: e.target.value })} /></div>
                        <div className="ct-form-field full"><label>Observaciones</label><textarea value={nuevoForm.observaciones} onChange={e => setNuevoForm({ ...nuevoForm, observaciones: e.target.value })} /></div>
                    </div>
                    <div className="ct-form-actions">
                        <button className="ct-btn ct-btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
                        <button className="ct-btn ct-btn-primary" onClick={submitNuevo} disabled={guardandoNuevo}>
                            {guardandoNuevo ? 'Guardando…' : 'Crear contrato'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal detalle */}
            {detalle && (
                <Modal titulo={detalle.colaborador_nombre} onCerrar={() => setDetalle(null)}>
                    {!editando ? (
                        <>
                            <div className="ct-field-grid">
                                <div className="ct-field"><div className="k">Cédula</div><div className="v">{detalle.colaborador_cedula}</div></div>
                                <div className="ct-field"><div className="k">Tipo</div><div className="v">{labelTipo(detalle.tipo_contrato)}</div></div>
                                <div className="ct-field"><div className="k">Cargo</div><div className="v">{detalle.cargo}</div></div>
                                <div className="ct-field"><div className="k">Punto de venta</div><div className="v">{detalle.punto_venta || '—'}</div></div>
                                <div className="ct-field"><div className="k">Salario</div><div className="v">${Number(detalle.salario).toLocaleString('es-CO')}</div></div>
                                <div className="ct-field"><div className="k">Estado</div><div className="v"><span className={`ct-badge ${detalle.estado}`}>{labelEstado(detalle.estado)}</span></div></div>
                                <div className="ct-field"><div className="k">Fecha inicio</div><div className="v">{fmtFecha(detalle.fecha_inicio)}</div></div>
                                <div className="ct-field"><div className="k">Fecha fin</div><div className="v">{detalle.fecha_fin ? fmtFecha(detalle.fecha_fin) : 'Indefinido'}</div></div>
                                {detalle.dias_para_vencer !== null && detalle.dias_para_vencer !== undefined && (
                                    <div className="ct-field"><div className="k">Días para vencer</div><div className="v">{detalle.dias_para_vencer}</div></div>
                                )}
                                <div className="ct-field"><div className="k">Responsable HR</div><div className="v">{detalle.responsable_hr}</div></div>
                            </div>
                            {detalle.observaciones && <p style={{ fontSize: 13, color: '#4B554E' }}>{detalle.observaciones}</p>}
                            {detalle.estado === 'TERMINADO' && detalle.motivo_terminacion && (
                                <p style={{ fontSize: 12.5, color: '#A83E3E' }}>Motivo de terminación: {detalle.motivo_terminacion}</p>
                            )}

                            <div className="ct-detalle-actions">
                                <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => handleDescargarPdf(detalle.id, detalle.colaborador_cedula)} disabled={descargando}>
                                    {descargando ? 'Generando…' : '⬇ Descargar PDF'}
                                </button>
                                {detalle.estado === 'VIGENTE' && (
                                    <>
                                        <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={iniciarEdicion}>✎ Editar</button>
                                        <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={abrirRenovar}>↻ Renovar</button>
                                        <button className="ct-btn ct-btn-danger ct-btn-sm" onClick={abrirTerminar}>Terminar contrato</button>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="ct-form-grid">
                                <div className="ct-form-field"><label>Salario</label><input type="number" value={editForm.salario} onChange={e => setEditForm({ ...editForm, salario: e.target.value })} /></div>
                                <div className="ct-form-field"><label>Fecha de fin</label><input type="date" value={editForm.fecha_fin} onChange={e => setEditForm({ ...editForm, fecha_fin: e.target.value })} /></div>
                                <div className="ct-form-field"><label>Responsable HR</label><input value={editForm.responsable_hr} onChange={e => setEditForm({ ...editForm, responsable_hr: e.target.value })} /></div>
                                <div className="ct-form-field full"><label>Observaciones</label><textarea value={editForm.observaciones} onChange={e => setEditForm({ ...editForm, observaciones: e.target.value })} /></div>
                            </div>
                            <div className="ct-form-actions">
                                <button className="ct-btn ct-btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                                <button className="ct-btn ct-btn-primary" onClick={guardarEdicion} disabled={guardandoEdit}>
                                    {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                                </button>
                            </div>
                        </>
                    )}
                </Modal>
            )}

            {/* Modal renovar */}
            {modalRenovar && (
                <Modal titulo="Renovar contrato" onCerrar={() => setModalRenovar(false)}>
                    <p style={{ fontSize: 12.5, color: '#6B6F76', margin: '-6px 0 12px' }}>
                        Se creará un contrato nuevo vinculado al actual, y el actual quedará marcado como "Renovado".
                    </p>
                    <div className="ct-form-grid">
                        <div className="ct-form-field"><label>Nueva fecha de inicio *</label><input type="date" value={renovarForm.fecha_inicio} onChange={e => setRenovarForm({ ...renovarForm, fecha_inicio: e.target.value })} /></div>
                        <div className="ct-form-field"><label>Nueva fecha de fin</label><input type="date" value={renovarForm.fecha_fin} onChange={e => setRenovarForm({ ...renovarForm, fecha_fin: e.target.value })} /></div>
                        <div className="ct-form-field"><label>Salario</label><input type="number" value={renovarForm.salario} onChange={e => setRenovarForm({ ...renovarForm, salario: e.target.value })} /></div>
                        <div className="ct-form-field"><label>Responsable HR *</label><input value={renovarForm.responsable_hr} onChange={e => setRenovarForm({ ...renovarForm, responsable_hr: e.target.value })} /></div>
                        <div className="ct-form-field full"><label>Observaciones</label><textarea value={renovarForm.observaciones} onChange={e => setRenovarForm({ ...renovarForm, observaciones: e.target.value })} /></div>
                    </div>
                    <div className="ct-form-actions">
                        <button className="ct-btn ct-btn-ghost" onClick={() => setModalRenovar(false)}>Cancelar</button>
                        <button className="ct-btn ct-btn-primary" onClick={submitRenovar} disabled={guardandoRenovar}>
                            {guardandoRenovar ? 'Renovando…' : 'Confirmar renovación'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal terminar */}
            {modalTerminar && (
                <Modal titulo="Terminar contrato" onCerrar={() => setModalTerminar(false)}>
                    <div className="ct-form-grid">
                        <div className="ct-form-field"><label>Fecha de terminación</label><input type="date" value={terminarForm.fecha_terminacion} onChange={e => setTerminarForm({ ...terminarForm, fecha_terminacion: e.target.value })} /></div>
                        <div className="ct-form-field full"><label>Motivo</label><textarea value={terminarForm.motivo_terminacion} onChange={e => setTerminarForm({ ...terminarForm, motivo_terminacion: e.target.value })} /></div>
                    </div>
                    <div className="ct-form-actions">
                        <button className="ct-btn ct-btn-ghost" onClick={() => setModalTerminar(false)}>Cancelar</button>
                        <button className="ct-btn ct-btn-danger" onClick={submitTerminar} disabled={guardandoTerminar}>
                            {guardandoTerminar ? 'Guardando…' : 'Confirmar terminación'}
                        </button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}
