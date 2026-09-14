/**
 * AUSENTRACK - Pagina de Puntos de Venta
 * Personal requerido vs. personal real por sede, con importacion masiva
 * por Excel y deteccion de colaboradores con "area" que no coincide con
 * ningun punto de venta registrado.
 */

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import Modal from '../../components/ui/Modal';
import api from '../../api/axios';
import { formatearErrorAPI } from '../../utils/errores';
import {
    obtenerPuntosVenta, crearPuntoVenta, actualizarPuntoVenta,
    obtenerCoberturaPuntosVenta,
} from '../../api/puntosVenta';
import '../../components/layout/Layout.css';
import './PuntosVenta.css';

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

const formVacio = { nombre: '', personal_requerido: 1, direccion: '', telefono: '', notas: '' };

export default function PuntosVenta() {
    const [cobertura, setCobertura]   = useState(null);
    const [cargando, setCargando]     = useState(true);
    const [error, setError]           = useState('');
    const [search, setSearch]         = useState('');

    const [modalNuevo, setModalNuevo]   = useState(false);
    const [nuevoForm, setNuevoForm]     = useState(formVacio);
    const [editandoId, setEditandoId]   = useState(null);
    const [guardandoNuevo, setGuardandoNuevo] = useState(false);
    const [errorNuevo, setErrorNuevo]   = useState('');

    const [modalImportar, setModalImportar]     = useState(false);
    const [archivoImport, setArchivoImport]     = useState(null);
    const [importando, setImportando]           = useState(false);
    const [resultadoImport, setResultadoImport] = useState(null);
    const [errorImport, setErrorImport]         = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const res = await obtenerCoberturaPuntosVenta();
            setCobertura(res.data);
        } catch {
            setError('No se pudo cargar la información de puntos de venta.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // ---- Nuevo / editar punto ----
    function abrirNuevo() {
        setNuevoForm(formVacio);
        setEditandoId(null);
        setErrorNuevo('');
        setModalNuevo(true);
    }
    function abrirEditar(p) {
        setNuevoForm({ nombre: p.nombre, personal_requerido: p.personal_requerido, direccion: '', telefono: '', notas: '' });
        setEditandoId(p.id);
        setErrorNuevo('');
        setModalNuevo(true);
    }
    async function submitNuevo() {
        if (!nuevoForm.nombre.trim()) { setErrorNuevo('El nombre es obligatorio.'); return; }
        setGuardandoNuevo(true);
        setErrorNuevo('');
        try {
            if (editandoId) {
                await actualizarPuntoVenta(editandoId, nuevoForm);
            } else {
                await crearPuntoVenta(nuevoForm);
            }
            setModalNuevo(false);
            await cargar();
        } catch (err) {
            setErrorNuevo(formatearErrorAPI(err, 'No se pudo guardar el punto de venta.'));
        } finally {
            setGuardandoNuevo(false);
        }
    }

    // ---- Importar ----
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
        try {
            const formData = new FormData();
            formData.append('archivo', archivoImport);
            const res = await api.post('/puntos-venta/importar/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResultadoImport(res.data);
            await cargar();
        } catch (err) {
            setErrorImport(err.response?.data?.error || 'Error al procesar el archivo.');
        } finally {
            setImportando(false);
        }
    }
    async function descargarPlantilla() {
        try {
            const res = await api.get('/puntos-venta/plantilla/', { responseType: 'blob' });
            descargarBlob(res.data, 'plantilla_puntos_venta.xlsx');
        } catch {
            setErrorImport('No se pudo descargar la plantilla.');
        }
    }

    const puntosFiltrados = cobertura?.puntos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase())) || [];

    return (
        <Layout>
            <div className="pv-page">
                <div className="pv-header-row">
                    <div>
                        <h1 className="pv-titulo">Puntos de Venta</h1>
                        <p className="pv-subtitulo">Personal requerido vs. personal real por sede</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="pv-btn pv-btn-ghost" onClick={abrirImportar}>⬆ Importar Excel</button>
                        <button className="pv-btn pv-btn-primary" onClick={abrirNuevo}>+ Nuevo punto</button>
                    </div>
                </div>

                {error && <p className="pv-form-error">{error}</p>}

                {cobertura && (
                    <div className="pv-kpis">
                        <div className="pv-kpi"><div className="num">{cobertura.kpis.total_puntos}</div><div className="lbl">Puntos de venta</div></div>
                        <div className="pv-kpi"><div className="num">{cobertura.kpis.personal_actual_total}/{cobertura.kpis.personal_requerido_total}</div><div className="lbl">Personal actual / requerido</div></div>
                        <div className="pv-kpi danger"><div className="num">{cobertura.kpis.puntos_con_falta}</div><div className="lbl">Puntos con falta de personal</div></div>
                        <div className="pv-kpi warn"><div className="num">{cobertura.kpis.puntos_con_exceso}</div><div className="lbl">Puntos con exceso</div></div>
                    </div>
                )}

                {cobertura?.colaboradores_sin_punto_valido?.length > 0 && (
                    <div className="pv-panel riesgo">
                        <h2>⚠ Colaboradores con punto de venta no reconocido</h2>
                        <p className="pv-sub">Su "área" no coincide con ningún punto de venta registrado — puede ser un error de digitación o un punto que falta crear</p>
                        {cobertura.colaboradores_sin_punto_valido.map(c => (
                            <div className="pv-alert-item" key={c.id_colaborador}>
                                <span>{c.nombre}</span>
                                <span style={{ color: '#B8752A', fontWeight: 600 }}>"{c.area}"</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pv-panel">
                    <h2>Cobertura por punto de venta</h2>
                    <p className="pv-sub">Ordenado de mayor a menor déficit de personal</p>

                    <div className="pv-filters">
                        <input type="text" placeholder="Buscar punto de venta…" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>

                    {cargando && <p className="pv-sub">Cargando…</p>}
                    {!cargando && puntosFiltrados.length === 0 && <p className="pv-sub">No hay puntos de venta que coincidan.</p>}

                    <div style={{ overflowX: 'auto' }}>
                        <table className="tabla" style={{ width: '100%', fontSize: 12.8 }}>
                            <thead>
                                <tr>
                                    <th>Punto de venta</th>
                                    <th>Requerido</th>
                                    <th>Actual</th>
                                    <th>Cobertura</th>
                                    <th>Diferencia</th>
                                    <th>Estado</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {puntosFiltrados.map(p => {
                                    const pct = p.personal_requerido > 0 ? Math.min(100, (p.personal_actual / p.personal_requerido) * 100) : 100;
                                    const color = p.estado === 'FALTA' ? '#A83E3E' : p.estado === 'EXCESO' ? '#B8752A' : '#4F8B5B';
                                    return (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                                            <td>{p.personal_requerido}</td>
                                            <td>{p.personal_actual}</td>
                                            <td style={{ minWidth: 110 }}>
                                                <div className="pv-barra-track">
                                                    <div className="pv-barra-fill" style={{ width: `${pct}%`, background: color }} />
                                                </div>
                                            </td>
                                            <td>
                                                <span className={'pv-diff ' + (p.diferencia < 0 ? 'neg' : p.diferencia > 0 ? 'pos' : 'zero')}>
                                                    {p.diferencia > 0 ? `+${p.diferencia}` : p.diferencia}
                                                </span>
                                            </td>
                                            <td><span className={`pv-badge ${p.estado}`}>{p.estado}</span></td>
                                            <td><button className="pv-btn pv-btn-ghost pv-btn-sm" onClick={() => abrirEditar(p)}>Editar</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal nuevo/editar punto */}
            {modalNuevo && (
                <Modal titulo={editandoId ? 'Editar punto de venta' : 'Nuevo punto de venta'} onCerrar={() => setModalNuevo(false)}>
                    {errorNuevo && <p className="pv-form-error">{errorNuevo}</p>}
                    <div className="pv-form-grid">
                        <div className="pv-form-field"><label>Nombre *</label><input value={nuevoForm.nombre} onChange={e => setNuevoForm({ ...nuevoForm, nombre: e.target.value })} /></div>
                        <div className="pv-form-field"><label>Personal requerido *</label><input type="number" min="0" value={nuevoForm.personal_requerido} onChange={e => setNuevoForm({ ...nuevoForm, personal_requerido: e.target.value })} /></div>
                        <div className="pv-form-field"><label>Dirección</label><input value={nuevoForm.direccion} onChange={e => setNuevoForm({ ...nuevoForm, direccion: e.target.value })} /></div>
                        <div className="pv-form-field"><label>Teléfono</label><input value={nuevoForm.telefono} onChange={e => setNuevoForm({ ...nuevoForm, telefono: e.target.value })} /></div>
                        <div className="pv-form-field full"><label>Notas</label><textarea value={nuevoForm.notas} onChange={e => setNuevoForm({ ...nuevoForm, notas: e.target.value })} /></div>
                    </div>
                    <div className="pv-form-actions">
                        <button className="pv-btn pv-btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
                        <button className="pv-btn pv-btn-primary" onClick={submitNuevo} disabled={guardandoNuevo}>
                            {guardandoNuevo ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Modal importar */}
            {modalImportar && (
                <Modal titulo="Importar puntos de venta desde Excel" onCerrar={() => setModalImportar(false)}>
                    <p style={{ fontSize: 12.5, color: '#6B6F76', margin: '-6px 0 12px' }}>
                        Columnas obligatorias: <strong>nombre, personal_requerido</strong>. Si un punto ya existe (aunque esté
                        escrito distinto, ej. "Poke2" vs "Poke 2"), se actualiza en vez de duplicarse.
                    </p>
                    <button className="pv-btn pv-btn-ghost" onClick={descargarPlantilla} style={{ marginBottom: 14 }}>
                        ⬇ Descargar plantilla
                    </button>

                    <label style={{ display: 'block', cursor: 'pointer' }}>
                        <input type="file" accept=".xlsx" onChange={handleArchivoImport} style={{ display: 'none' }} />
                        <div style={{
                            border: '1.5px dashed #E1DED4', borderRadius: 10, padding: '22px 14px',
                            textAlign: 'center', fontSize: 12.8, color: archivoImport ? '#4F8B5B' : '#6B6F76',
                        }}>
                            {archivoImport ? `✓ ${archivoImport.name}` : '📂 Clic para seleccionar archivo Excel (.xlsx)'}
                        </div>
                    </label>

                    {errorImport && <p className="pv-form-error" style={{ marginTop: 10 }}>{errorImport}</p>}

                    {resultadoImport && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{ background: '#E7F1EC', color: '#2F6F5E', padding: '8px 12px', borderRadius: 8, fontSize: 12.8, fontWeight: 600 }}>
                                {resultadoImport.creados} creados, {resultadoImport.actualizados} actualizados
                            </div>
                            {resultadoImport.errores?.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                    {resultadoImport.errores.map((e, i) => (
                                        <div key={i} style={{ fontSize: 11.5, color: '#A83E3E', padding: '3px 0' }}>{e}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pv-form-actions">
                        <button className="pv-btn pv-btn-ghost" onClick={() => setModalImportar(false)}>Cerrar</button>
                        <button className="pv-btn pv-btn-primary" onClick={handleImportar} disabled={importando || !archivoImport}>
                            {importando ? 'Importando…' : 'Importar'}
                        </button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}
