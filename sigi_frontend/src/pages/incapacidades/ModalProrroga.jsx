/**
 * AUSENTRACK - Modal de prorroga de incapacidad
 */

import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { crearProrroga, obtenerProrrogas } from '../../api/incapacidades';
import './ModalProrroga.css';

export default function ModalProrroga({ incapacidad, onCerrar, onGuardado }) {
    const [historial, setHistorial]   = useState(null);
    const [form, setForm]             = useState({ fecha_inicio: '', fecha_fin: '', diagnostico: incapacidad.diagnostico || '', observaciones: '' });
    const [error, setError]           = useState('');
    const [exito, setExito]           = useState('');
    const [guardando, setGuardando]   = useState(false);
    const [tab, setTab]               = useState('nueva'); // 'nueva' | 'historial'

    useEffect(() => { cargarHistorial(); }, []);

    async function cargarHistorial() {
        try {
            const res = await obtenerProrrogas(incapacidad.id_incapacidad);
            setHistorial(res.data);
        } catch { setHistorial(null); }
    }

    async function handleGuardar(e) {
        e.preventDefault();
        setError('');
        setExito('');
        if (!form.fecha_inicio || !form.fecha_fin) { setError('Las fechas son obligatorias.'); return; }
        setGuardando(true);
        try {
            const res = await crearProrroga(incapacidad.id_incapacidad, form);
            setExito(res.data.mensaje);
            cargarHistorial();
            setTab('historial');
            onGuardado();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al crear la prorroga.');
        } finally {
            setGuardando(false);
        }
    }

    const puedeProrroga = historial ? historial.puede_prorrogar : true;

    return (
        <Modal titulo={`Prorroga — ${incapacidad.colaborador_nombre}`} onCerrar={onCerrar}>
            {/* Info incapacidad original */}
            <div className="prorroga-info-original">
                <div className="prorroga-info-item">
                    <span>Incapacidad original</span>
                    <strong>#{incapacidad.id_incapacidad} · {incapacidad.tipo_display}</strong>
                </div>
                <div className="prorroga-info-item">
                    <span>Periodo</span>
                    <strong>{incapacidad.fecha_inicio} → {incapacidad.fecha_fin}</strong>
                </div>
                {historial && (
                    <div className="prorroga-barra-container">
                        <div className="prorroga-barra-label">
                            <span>Dias acumulados: <strong>{historial.dias_totales}</strong> de 540</span>
                            <span>Restantes: <strong>{historial.dias_restantes}</strong></span>
                        </div>
                        <div className="prorroga-barra">
                            <div
                                className={`prorroga-barra-fill ${historial.dias_totales > 400 ? 'critico' : historial.dias_totales > 270 ? 'advertencia' : ''}`}
                                style={{ width: `${Math.min((historial.dias_totales / 540) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="prorroga-tabs">
                <button className={`prorroga-tab ${tab === 'nueva' ? 'activo' : ''}`} onClick={() => setTab('nueva')}>
                    Nueva prorroga
                </button>
                <button className={`prorroga-tab ${tab === 'historial' ? 'activo' : ''}`} onClick={() => setTab('historial')}>
                    Historial ({historial?.cadena?.length || 0})
                </button>
            </div>

            {/* Tab: Nueva prorroga */}
            {tab === 'nueva' && (
                <form onSubmit={handleGuardar}>
                    {!puedeProrroga && (
                        <div className="alerta-error">Esta incapacidad ha alcanzado el limite de 540 dias. No se pueden crear mas prorrogas.</div>
                    )}
                    {puedeProrroga && (
                        <>
                            <div className="form-grid">
                                <div className="form-field">
                                    <label>Fecha inicio prorroga</label>
                                    <input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
                                </div>
                                <div className="form-field">
                                    <label>Fecha fin prorroga</label>
                                    <input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
                                </div>
                                <div className="form-field form-grid-full">
                                    <label>Diagnostico actualizado</label>
                                    <input value={form.diagnostico} onChange={(e) => setForm({ ...form, diagnostico: e.target.value })} placeholder="Codigo CIE-10 o descripcion" />
                                </div>
                                <div className="form-field form-grid-full">
                                    <label>Observaciones</label>
                                    <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={2} placeholder="Observaciones de la prorroga..." />
                                </div>
                            </div>
                            {error  && <div className="alerta-error">{error}</div>}
                            {exito  && <div className="alerta-exito">{exito}</div>}
                            <div className="form-acciones">
                                <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
                                <button type="submit" className="btn-primario" disabled={guardando}>
                                    {guardando ? 'Guardando...' : 'Crear prorroga'}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            )}

            {/* Tab: Historial */}
            {tab === 'historial' && historial && (
                <div className="prorroga-historial">
                    {historial.cadena.map((item, i) => (
                        <div key={item.id} className={`prorroga-item ${item.es_prorroga ? 'es-prorroga' : 'es-original'}`}>
                            <div className="prorroga-item-header">
                                <span className={`badge ${item.es_prorroga ? 'badge-cobro' : 'badge-activo'}`}>
                                    {item.es_prorroga ? `Prorroga ${item.nivel}` : 'Original'}
                                </span>
                                <span className="prorroga-item-dias">{item.dias} dias</span>
                            </div>
                            <div className="prorroga-item-body">
                                <span>{item.fecha_inicio} → {item.fecha_fin}</span>
                                {item.diagnostico && <span className="prorroga-diagnostico">{item.diagnostico}</span>}
                            </div>
                        </div>
                    ))}
                    <div className="prorroga-total">
                        Total acumulado: <strong>{historial.dias_totales} dias</strong> · Restantes: <strong>{historial.dias_restantes}</strong>
                    </div>
                </div>
            )}
        </Modal>
    );
}
