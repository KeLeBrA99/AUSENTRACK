/**
 * AUSENTRACK - Pagina de Dotacion y EPP (SST)
 * 3 pilares: catalogo/inventario, entregas con descuento automatico de
 * stock, y matriz de riesgos (que elemento requiere cada cargo).
 */

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import api from '../../api/axios';
import { formatearErrorAPI } from '../../utils/errores';
import {
    obtenerElementos, crearElemento,
    crearInventario,
    obtenerEntregas, crearEntrega,
    obtenerRequisitos, crearRequisito, eliminarRequisito,
    obtenerPendientesDotacion, obtenerEstadisticasDotacion,
} from '../../api/dotacion';
import { obtenerPuntosVenta } from '../../api/puntosVenta';
import '../../components/layout/Layout.css';
import './Dotacion.css';

function fmtFecha(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
}

export default function Dotacion() {
    const [tab, setTab] = useState('inventario');
    const [stats, setStats] = useState(null);
    const [pendientes, setPendientes] = useState(null);
    const [error, setError] = useState('');

    const [elementos, setElementos] = useState([]);
    const [entregas, setEntregas] = useState([]);
    const [requisitos, setRequisitos] = useState([]);
    const [puntosVenta, setPuntosVenta] = useState([]);
    const [cargando, setCargando] = useState(true);

    const cargarTodo = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const [elRes, entRes, reqRes, pvRes, statsRes, pendRes] = await Promise.all([
                obtenerElementos({}),
                obtenerEntregas({}),
                obtenerRequisitos({}),
                obtenerPuntosVenta({ activo: true }),
                obtenerEstadisticasDotacion(),
                obtenerPendientesDotacion(),
            ]);
            setElementos(elRes.data);
            setEntregas(entRes.data);
            setRequisitos(reqRes.data);
            setPuntosVenta(pvRes.data);
            setStats(statsRes.data);
            setPendientes(pendRes.data);
        } catch {
            setError('No se pudo cargar la información de dotación.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargarTodo(); }, [cargarTodo]);

    // ---- Nuevo elemento ----
    const [modalElemento, setModalElemento] = useState(false);
    const [elementoForm, setElementoForm] = useState({ nombre: '', categoria: 'UNIFORME', usa_talla: true, vida_util_meses: '' });
    const [guardandoElemento, setGuardandoElemento] = useState(false);
    const [errorElemento, setErrorElemento] = useState('');

    function abrirElemento() {
        setElementoForm({ nombre: '', categoria: 'UNIFORME', usa_talla: true, vida_util_meses: '' });
        setErrorElemento('');
        setModalElemento(true);
    }
    async function submitElemento() {
        if (!elementoForm.nombre.trim()) { setErrorElemento('El nombre es obligatorio.'); return; }
        setGuardandoElemento(true);
        setErrorElemento('');
        try {
            await crearElemento({ ...elementoForm, vida_util_meses: elementoForm.vida_util_meses || null });
            setModalElemento(false);
            await cargarTodo();
        } catch (err) {
            setErrorElemento(formatearErrorAPI(err, 'No se pudo crear el elemento.'));
        } finally {
            setGuardandoElemento(false);
        }
    }

    // ---- Cargar stock ----
    const [modalStock, setModalStock] = useState(null);
    const [stockForm, setStockForm] = useState({ talla: '', cantidad_disponible: '', stock_minimo: 5 });
    const [guardandoStock, setGuardandoStock] = useState(false);
    const [errorStock, setErrorStock] = useState('');

    function abrirStock(elemento) {
        setModalStock(elemento);
        setStockForm({ talla: '', cantidad_disponible: '', stock_minimo: 5 });
        setErrorStock('');
    }
    async function submitStock() {
        setGuardandoStock(true);
        setErrorStock('');
        try {
            await crearInventario({
                elemento: modalStock.id, talla: stockForm.talla,
                cantidad_disponible: Number(stockForm.cantidad_disponible) || 0,
                stock_minimo: Number(stockForm.stock_minimo) || 0,
            });
            setModalStock(null);
            await cargarTodo();
        } catch (err) {
            setErrorStock(formatearErrorAPI(err, 'No se pudo cargar el stock.'));
        } finally {
            setGuardandoStock(false);
        }
    }

    // ---- Nueva entrega ----
    const [modalEntrega, setModalEntrega] = useState(false);
    const [entregaForm, setEntregaForm] = useState({ tipo_entrega: 'INGRESO', fecha_entrega: '', responsable_hr: '', firma_recibido: false, observaciones: '' });
    const [detallesEntrega, setDetallesEntrega] = useState([{ elemento: '', talla: '', cantidad: 1 }]);
    const [buscarColab, setBuscarColab] = useState('');
    const [resultadosColab, setResultadosColab] = useState([]);
    const [colabSeleccionado, setColabSeleccionado] = useState(null);
    const [guardandoEntrega, setGuardandoEntrega] = useState(false);
    const [errorEntrega, setErrorEntrega] = useState('');

    function abrirEntrega() {
        setEntregaForm({ tipo_entrega: 'INGRESO', fecha_entrega: '', responsable_hr: '', firma_recibido: false, observaciones: '' });
        setDetallesEntrega([{ elemento: '', talla: '', cantidad: 1 }]);
        setBuscarColab('');
        setResultadosColab([]);
        setColabSeleccionado(null);
        setErrorEntrega('');
        setModalEntrega(true);
    }
    useEffect(() => {
        if (!modalEntrega || colabSeleccionado) return;
        if (buscarColab.trim().length < 2) { setResultadosColab([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await api.get('/colaboradores/buscar/', { params: { q: buscarColab.trim() } });
                setResultadosColab(res.data);
            } catch { setResultadosColab([]); }
        }, 350);
        return () => clearTimeout(t);
    }, [buscarColab, modalEntrega, colabSeleccionado]);

    function agregarLineaDetalle() {
        setDetallesEntrega([...detallesEntrega, { elemento: '', talla: '', cantidad: 1 }]);
    }
    function quitarLineaDetalle(idx) {
        setDetallesEntrega(detallesEntrega.filter((_, i) => i !== idx));
    }
    function actualizarLineaDetalle(idx, campo, valor) {
        const nuevas = [...detallesEntrega];
        nuevas[idx] = { ...nuevas[idx], [campo]: valor };
        setDetallesEntrega(nuevas);
    }

    async function submitEntrega() {
        if (!colabSeleccionado) { setErrorEntrega('Selecciona un colaborador.'); return; }
        if (!entregaForm.fecha_entrega || !entregaForm.responsable_hr) { setErrorEntrega('Completa fecha y responsable.'); return; }
        const detallesValidos = detallesEntrega.filter(d => d.elemento);
        if (detallesValidos.length === 0) { setErrorEntrega('Agrega al menos un elemento.'); return; }

        setGuardandoEntrega(true);
        setErrorEntrega('');
        try {
            await crearEntrega({
                colaborador: colabSeleccionado.id_colaborador,
                ...entregaForm,
                detalles: detallesValidos.map(d => ({ elemento: d.elemento, talla: d.talla, cantidad: Number(d.cantidad) || 1 })),
            });
            setModalEntrega(false);
            await cargarTodo();
        } catch (err) {
            setErrorEntrega(formatearErrorAPI(err, 'No se pudo registrar la entrega.'));
        } finally {
            setGuardandoEntrega(false);
        }
    }

    // ---- Matriz de requisitos ----
    const [modalRequisito, setModalRequisito] = useState(false);
    const [requisitoForm, setRequisitoForm] = useState({ cargo: '', punto_venta: '', elemento: '', obligatorio: true });
    const [guardandoRequisito, setGuardandoRequisito] = useState(false);
    const [errorRequisito, setErrorRequisito] = useState('');

    function abrirRequisito() {
        setRequisitoForm({ cargo: '', punto_venta: '', elemento: '', obligatorio: true });
        setErrorRequisito('');
        setModalRequisito(true);
    }
    async function submitRequisito() {
        if (!requisitoForm.cargo.trim() || !requisitoForm.elemento) { setErrorRequisito('Completa el cargo y el elemento.'); return; }
        setGuardandoRequisito(true);
        setErrorRequisito('');
        try {
            await crearRequisito({ ...requisitoForm, punto_venta: requisitoForm.punto_venta || null });
            setModalRequisito(false);
            await cargarTodo();
        } catch (err) {
            setErrorRequisito(formatearErrorAPI(err, 'No se pudo crear el requisito.'));
        } finally {
            setGuardandoRequisito(false);
        }
    }
    async function handleEliminarRequisito(id) {
        if (!window.confirm('¿Eliminar este requisito de la matriz?')) return;
        try {
            await eliminarRequisito(id);
            await cargarTodo();
        } catch {
            setError('No se pudo eliminar el requisito.');
        }
    }

    return (
        <Layout>
            <div className="dt-page">
                <div className="dt-header-row">
                    <div>
                        <h1 className="dt-titulo">Dotación y EPP</h1>
                        <p className="dt-subtitulo">SST — Inventario, entregas con constancia y matriz de riesgos por cargo</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="dt-btn dt-btn-ghost" onClick={abrirElemento}>+ Elemento</button>
                        <button className="dt-btn dt-btn-primary" onClick={abrirEntrega}>+ Registrar entrega</button>
                    </div>
                </div>

                {error && <p className="dt-form-error">{error}</p>}

                {stats && (
                    <div className="dt-kpis">
                        <div className="dt-kpi"><div className="num">{stats.kpis.elementos_catalogados}</div><div className="lbl">Elementos catalogados</div></div>
                        <div className="dt-kpi"><div className="num">{stats.kpis.entregas_este_mes}</div><div className="lbl">Entregas este mes</div></div>
                        <div className="dt-kpi warn"><div className="num">{stats.kpis.elementos_bajo_stock}</div><div className="lbl">Elementos en bajo stock</div></div>
                        <div className="dt-kpi warn"><div className="num">{stats.kpis.entregas_sin_firma}</div><div className="lbl">Entregas sin firma</div></div>
                    </div>
                )}

                {stats?.bajo_stock?.length > 0 && (
                    <div className="dt-panel">
                        <h2>⚠ Bajo stock</h2>
                        {stats.bajo_stock.map((b, i) => (
                            <div className="dt-alert-item" key={i}>
                                <span>{b.elemento}{b.talla ? ` (talla ${b.talla})` : ''}</span>
                                <strong style={{ color: '#B8752A' }}>{b.cantidad_disponible} / mín. {b.stock_minimo}</strong>
                            </div>
                        ))}
                    </div>
                )}

                {pendientes?.pendientes?.length > 0 && (
                    <div className="dt-panel">
                        <h2>Colaboradores con dotación pendiente</h2>
                        <p className="dt-sub">Según la matriz de riesgos, les falta al menos un elemento requerido para su cargo</p>
                        {pendientes.pendientes.map(p => (
                            <div className="dt-alert-item" key={p.id_colaborador}>
                                <span>{p.nombre} · {p.cargo} · {p.punto_venta || '—'}</span>
                                <span className="faltantes">{p.faltantes.map(f => f.elemento).join(', ')}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="dt-tabs">
                    <div className={'dt-tab' + (tab === 'inventario' ? ' activo' : '')} onClick={() => setTab('inventario')}>Catálogo e Inventario</div>
                    <div className={'dt-tab' + (tab === 'entregas' ? ' activo' : '')} onClick={() => setTab('entregas')}>Entregas</div>
                    <div className={'dt-tab' + (tab === 'matriz' ? ' activo' : '')} onClick={() => setTab('matriz')}>Matriz de Riesgos</div>
                </div>

                {tab === 'inventario' && (
                    <div className="dt-panel">
                        <h2>Catálogo de dotación y EPP</h2>
                        <p className="dt-sub">Haz clic en "Cargar stock" para registrar unidades disponibles, por talla si aplica</p>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                                <thead>
                                    <tr><th>Elemento</th><th>Categoría</th><th>Vigencia</th><th>Stock total</th><th>Detalle por talla</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {!cargando && elementos.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No hay elementos en el catálogo.</td></tr>
                                    )}
                                    {elementos.map(el => (
                                        <tr key={el.id}>
                                            <td style={{ fontWeight: 600 }}>{el.nombre}</td>
                                            <td><span className={`dt-badge ${el.categoria}`}>{el.categoria_display}</span></td>
                                            <td style={{ color: '#6B6F76' }}>{el.vida_util_meses ? `${el.vida_util_meses} meses` : 'Sin vencimiento'}</td>
                                            <td>{el.stock_total}</td>
                                            <td style={{ fontSize: 11.5, color: '#6B6F76' }}>
                                                {el.inventario.length === 0 ? '—' : el.inventario.map(i => `${i.talla || 'Única'}: ${i.cantidad_disponible}`).join(' · ')}
                                            </td>
                                            <td><button className="dt-btn dt-btn-ghost dt-btn-sm" onClick={() => abrirStock(el)}>Cargar stock</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'entregas' && (
                    <div className="dt-panel">
                        <h2>Entregas registradas</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                                <thead>
                                    <tr><th>Colaborador</th><th>Tipo</th><th>Fecha</th><th>Elementos</th><th>Firma</th></tr>
                                </thead>
                                <tbody>
                                    {!cargando && entregas.length === 0 && (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No hay entregas registradas.</td></tr>
                                    )}
                                    {entregas.map(e => (
                                        <tr key={e.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{e.colaborador_nombre}</div>
                                                <div style={{ fontSize: 11.3, color: '#6B6F76' }}>{e.colaborador_cedula}</div>
                                            </td>
                                            <td>{e.tipo_entrega_display}</td>
                                            <td style={{ color: '#6B6F76' }}>{fmtFecha(e.fecha_entrega)}</td>
                                            <td style={{ fontSize: 11.5 }}>{e.detalles.map(d => `${d.elemento_nombre}${d.talla ? ' (' + d.talla + ')' : ''} x${d.cantidad}`).join(', ')}</td>
                                            <td>{e.firma_recibido ? <span style={{ color: '#2F6F5E', fontWeight: 700 }}>✓</span> : <span style={{ color: '#A83E3E', fontWeight: 700 }}>Pendiente</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'matriz' && (
                    <div className="dt-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2>Matriz de riesgos</h2>
                                <p className="dt-sub">Qué elemento requiere cada cargo — opcionalmente restringido a un punto de venta</p>
                            </div>
                            <button className="dt-btn dt-btn-primary dt-btn-sm" onClick={abrirRequisito}>+ Nuevo requisito</button>
                        </div>
                        <div style={{ overflowX: 'auto', marginTop: 10 }}>
                            <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                                <thead>
                                    <tr><th>Cargo</th><th>Punto de venta</th><th>Elemento requerido</th><th>Obligatorio</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {!cargando && requisitos.length === 0 && (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#6B6F76' }}>No hay requisitos definidos todavía.</td></tr>
                                    )}
                                    {requisitos.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 600 }}>{r.cargo}</td>
                                            <td style={{ color: '#6B6F76' }}>{r.punto_venta_nombre || 'Todos los puntos'}</td>
                                            <td>{r.elemento_nombre}</td>
                                            <td>{r.obligatorio ? 'Sí' : 'No'}</td>
                                            <td><button className="dt-btn-danger-sm" onClick={() => handleEliminarRequisito(r.id)}>Eliminar</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {modalElemento && (
                <Modal titulo="Nuevo elemento de dotación/EPP" onCerrar={() => setModalElemento(false)}>
                    {errorElemento && <p className="dt-form-error">{errorElemento}</p>}
                    <div className="dt-form-grid">
                        <div className="dt-form-field full"><label>Nombre *</label><input value={elementoForm.nombre} onChange={e => setElementoForm({ ...elementoForm, nombre: e.target.value })} placeholder="Ej: Casco de seguridad, Camisa uniforme" /></div>
                        <div className="dt-form-field">
                            <label>Categoría</label>
                            <select value={elementoForm.categoria} onChange={e => setElementoForm({ ...elementoForm, categoria: e.target.value })}>
                                <option value="UNIFORME">Uniforme / Dotación</option>
                                <option value="EPP">Elemento de Protección Personal</option>
                            </select>
                        </div>
                        <div className="dt-form-field"><label>Vigencia (meses)</label><input type="number" min="0" value={elementoForm.vida_util_meses} onChange={e => setElementoForm({ ...elementoForm, vida_util_meses: e.target.value })} placeholder="Vacío = sin vencimiento" /></div>
                        <div className="full"><label className="dt-checkbox-row"><input type="checkbox" checked={elementoForm.usa_talla} onChange={e => setElementoForm({ ...elementoForm, usa_talla: e.target.checked })} /> Maneja tallas (ropa, botas, etc.)</label></div>
                    </div>
                    <div className="dt-form-actions">
                        <button className="dt-btn dt-btn-ghost" onClick={() => setModalElemento(false)}>Cancelar</button>
                        <button className="dt-btn dt-btn-primary" onClick={submitElemento} disabled={guardandoElemento}>{guardandoElemento ? 'Guardando…' : 'Guardar'}</button>
                    </div>
                </Modal>
            )}

            {modalStock && (
                <Modal titulo={`Cargar stock — ${modalStock.nombre}`} onCerrar={() => setModalStock(null)}>
                    {errorStock && <p className="dt-form-error">{errorStock}</p>}
                    <div className="dt-form-grid">
                        {modalStock.usa_talla && (
                            <div className="dt-form-field"><label>Talla</label><input value={stockForm.talla} onChange={e => setStockForm({ ...stockForm, talla: e.target.value })} placeholder="S, M, L, 38, 40…" /></div>
                        )}
                        <div className="dt-form-field"><label>Cantidad disponible *</label><input type="number" min="0" value={stockForm.cantidad_disponible} onChange={e => setStockForm({ ...stockForm, cantidad_disponible: e.target.value })} /></div>
                        <div className="dt-form-field"><label>Stock mínimo (alerta)</label><input type="number" min="0" value={stockForm.stock_minimo} onChange={e => setStockForm({ ...stockForm, stock_minimo: e.target.value })} /></div>
                    </div>
                    <div className="dt-form-actions">
                        <button className="dt-btn dt-btn-ghost" onClick={() => setModalStock(null)}>Cancelar</button>
                        <button className="dt-btn dt-btn-primary" onClick={submitStock} disabled={guardandoStock}>{guardandoStock ? 'Guardando…' : 'Guardar'}</button>
                    </div>
                </Modal>
            )}

            {modalEntrega && (
                <Modal titulo="Registrar entrega de dotación/EPP" onCerrar={() => setModalEntrega(false)}>
                    {errorEntrega && <p className="dt-form-error">{errorEntrega}</p>}

                    <div className="dt-form-field" style={{ marginBottom: 14, position: 'relative' }}>
                        <label>Colaborador *</label>
                        <input type="text" placeholder="Escribe el nombre o la cédula…" value={buscarColab} disabled={!!colabSeleccionado} onChange={e => setBuscarColab(e.target.value)} />
                        {colabSeleccionado && (
                            <button type="button" className="dt-btn dt-btn-ghost dt-btn-sm" style={{ marginTop: 6 }} onClick={() => { setColabSeleccionado(null); setBuscarColab(''); }}>✕ Cambiar colaborador</button>
                        )}
                        {!colabSeleccionado && resultadosColab.length > 0 && (
                            <div style={{ position: 'absolute', zIndex: 20, background: '#fff', border: '1px solid #E1DED4', borderRadius: 8, marginTop: 4, width: '100%', maxHeight: 200, overflowY: 'auto', boxShadow: '0 6px 16px rgba(27,33,29,.12)' }}>
                                {resultadosColab.map(c => (
                                    <div key={c.id_colaborador} onClick={() => { setColabSeleccionado(c); setResultadosColab([]); setBuscarColab(`${c.nombre} — ${c.cedula}`); }}
                                        onMouseDown={ev => ev.preventDefault()}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.8, borderBottom: '1px solid #F0EFEA' }}>
                                        <strong>{c.nombre}</strong> — {c.cedula}
                                        <div style={{ fontSize: 11, color: '#6B6F76' }}>{c.cargo}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="dt-form-grid">
                        <div className="dt-form-field">
                            <label>Tipo de entrega</label>
                            <select value={entregaForm.tipo_entrega} onChange={e => setEntregaForm({ ...entregaForm, tipo_entrega: e.target.value })}>
                                <option value="INGRESO">Ingreso (dotación inicial)</option>
                                <option value="PERIODICA">Entrega periódica (ley)</option>
                                <option value="REPOSICION">Reposición por desgaste/daño</option>
                            </select>
                        </div>
                        <div className="dt-form-field"><label>Fecha de entrega *</label><input type="date" value={entregaForm.fecha_entrega} onChange={e => setEntregaForm({ ...entregaForm, fecha_entrega: e.target.value })} /></div>
                        <div className="dt-form-field full"><label>Responsable HR *</label><input value={entregaForm.responsable_hr} onChange={e => setEntregaForm({ ...entregaForm, responsable_hr: e.target.value })} /></div>
                    </div>

                    <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: '10px 0 8px' }}>Elementos entregados</h3>
                    {detallesEntrega.map((d, idx) => (
                        <div className="dt-detalle-row" key={idx}>
                            <div className="dt-form-field">
                                <label>Elemento</label>
                                <select value={d.elemento} onChange={e => actualizarLineaDetalle(idx, 'elemento', e.target.value)}>
                                    <option value="">Seleccionar…</option>
                                    {elementos.map(el => <option key={el.id} value={el.id}>{el.nombre}</option>)}
                                </select>
                            </div>
                            <div className="dt-form-field"><label>Talla</label><input value={d.talla} onChange={e => actualizarLineaDetalle(idx, 'talla', e.target.value)} /></div>
                            <div className="dt-form-field"><label>Cantidad</label><input type="number" min="1" value={d.cantidad} onChange={e => actualizarLineaDetalle(idx, 'cantidad', e.target.value)} /></div>
                            <button className="dt-btn-danger-sm" onClick={() => quitarLineaDetalle(idx)} disabled={detallesEntrega.length === 1}>✕</button>
                        </div>
                    ))}
                    <button className="dt-btn dt-btn-ghost dt-btn-sm" onClick={agregarLineaDetalle} style={{ marginBottom: 12 }}>+ Agregar elemento</button>

                    <label className="dt-checkbox-row" style={{ marginBottom: 12 }}>
                        <input type="checkbox" checked={entregaForm.firma_recibido} onChange={e => setEntregaForm({ ...entregaForm, firma_recibido: e.target.checked })} /> Constancia de recibido firmada
                    </label>

                    <div className="dt-form-actions">
                        <button className="dt-btn dt-btn-ghost" onClick={() => setModalEntrega(false)}>Cancelar</button>
                        <button className="dt-btn dt-btn-primary" onClick={submitEntrega} disabled={guardandoEntrega}>{guardandoEntrega ? 'Guardando…' : 'Registrar entrega'}</button>
                    </div>
                </Modal>
            )}

            {modalRequisito && (
                <Modal titulo="Nuevo requisito de la matriz" onCerrar={() => setModalRequisito(false)}>
                    {errorRequisito && <p className="dt-form-error">{errorRequisito}</p>}
                    <div className="dt-form-grid">
                        <div className="dt-form-field full"><label>Cargo * (debe coincidir con el cargo del colaborador)</label><input value={requisitoForm.cargo} onChange={e => setRequisitoForm({ ...requisitoForm, cargo: e.target.value })} placeholder="Ej: Auxiliar de cocina" /></div>
                        <div className="dt-form-field">
                            <label>Punto de venta</label>
                            <select value={requisitoForm.punto_venta} onChange={e => setRequisitoForm({ ...requisitoForm, punto_venta: e.target.value })}>
                                <option value="">Todos los puntos</option>
                                {puntosVenta.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                        <div className="dt-form-field">
                            <label>Elemento requerido *</label>
                            <select value={requisitoForm.elemento} onChange={e => setRequisitoForm({ ...requisitoForm, elemento: e.target.value })}>
                                <option value="">Seleccionar…</option>
                                {elementos.map(el => <option key={el.id} value={el.id}>{el.nombre}</option>)}
                            </select>
                        </div>
                        <div className="full"><label className="dt-checkbox-row"><input type="checkbox" checked={requisitoForm.obligatorio} onChange={e => setRequisitoForm({ ...requisitoForm, obligatorio: e.target.checked })} /> Es obligatorio</label></div>
                    </div>
                    <div className="dt-form-actions">
                        <button className="dt-btn dt-btn-ghost" onClick={() => setModalRequisito(false)}>Cancelar</button>
                        <button className="dt-btn dt-btn-primary" onClick={submitRequisito} disabled={guardandoRequisito}>{guardandoRequisito ? 'Guardando…' : 'Guardar'}</button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}
