/**
 * AUSENTRACK - Formulario de registro y edicion de incapacidades
 */

import { useState, useEffect } from 'react';
import { buscarColaborador } from '../../api/colaboradores';
import { obtenerEntidades } from '../../api/colaboradores';
import { crearIncapacidad, actualizarIncapacidad } from '../../api/incapacidades';
import '../../components/layout/Layout.css';

const formVacio = {
    colaborador:       '',
    entidad_emisora:   '',
    incapacidad_padre: '',
    tipo:              'ENFERMEDAD_GENERAL',
    fecha_inicio:      '',
    fecha_fin:         '',
    diagnostico:       '',
    observaciones:     '',
};

function calcularDias(inicio, fin) {
    if (!inicio || !fin) return 0;
    const d1   = new Date(inicio);
    const d2   = new Date(fin);
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
}

function calcularResponsable(tipo, dias) {
    if (['ACCIDENTE_LABORAL', 'ENFERMEDAD_LABORAL'].includes(tipo)) return 'ARL';
    if (['MATERNIDAD', 'PATERNIDAD'].includes(tipo)) return 'EPS';
    if (tipo === 'ENFERMEDAD_GENERAL') return dias <= 2 ? 'Empleador' : 'EPS';
    return 'EPS';
}

export default function FormIncapacidad({ incapacidad, onGuardado, onCancelar }) {
    const [form, setForm]                           = useState(formVacio);
    const [entidades, setEntidades]                 = useState([]);
    const [busqueda, setBusqueda]                   = useState('');
    const [resultados, setResultados]               = useState([]);
    const [colaboradorNombre, setColaboradorNombre] = useState('');
    const [error, setError]                         = useState('');
    const [guardando, setGuardando]                 = useState(false);
    const [buscando, setBuscando]                   = useState(false);

    const dias        = calcularDias(form.fecha_inicio, form.fecha_fin);
    const responsable = calcularResponsable(form.tipo, dias);

    useEffect(() => {
        obtenerEntidades().then((res) => setEntidades(res.data)).catch(() => {});
        if (incapacidad) {
            // colaborador puede venir como ID directo o como colaborador_id segun el serializer
            const colId = incapacidad.colaborador_id ?? incapacidad.colaborador ?? '';
            const entId = incapacidad.entidad_emisora_id ?? incapacidad.entidad_emisora ?? '';
            setForm({
                colaborador:       colId,
                entidad_emisora:   entId,
                incapacidad_padre: incapacidad.incapacidad_padre || '',
                tipo:              incapacidad.tipo              || 'ENFERMEDAD_GENERAL',
                fecha_inicio:      incapacidad.fecha_inicio      || '',
                fecha_fin:         incapacidad.fecha_fin         || '',
                diagnostico:       incapacidad.diagnostico       || '',
                observaciones:     incapacidad.observaciones     || '',
            });
            setColaboradorNombre(incapacidad.colaborador_nombre || '');
        }
    }, []);

    async function handleBuscarColaborador(e) {
        const valor = e.target.value;
        setBusqueda(valor);
        if (valor.length < 2) { setResultados([]); return; }
        setBuscando(true);
        try {
            const res = await buscarColaborador(valor);
            setResultados(res.data);
        } catch { setResultados([]); }
        finally { setBuscando(false); }
    }

    function seleccionarColaborador(c) {
        setForm({ ...form, colaborador: c.id_colaborador });
        setColaboradorNombre(`${c.nombre} — ${c.cedula}`);
        setBusqueda('');
        setResultados([]);
    }

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function handleGuardar(e) {
        e.preventDefault();
        // Acepta cualquier valor truthy o el numero 0
        if (!form.colaborador && !incapacidad) {
           setError('Debes seleccionar un colaborador.');
           return;
        } 
        if (!form.fecha_inicio || !form.fecha_fin) { setError('Las fechas son obligatorias.'); return; }
        if (dias <= 0) { setError('La fecha de fin debe ser posterior a la fecha de inicio.'); return; }

        setGuardando(true);
        setError('');
        try {
            const payload = {
                ...form,
                colaborador:       form.colaborador       || incapacidad?.colaborador_id || incapacidad?.colaborador,
                entidad_emisora:   form.entidad_emisora   || null,
                incapacidad_padre: form.incapacidad_padre || null,
                diagnostico:       form.diagnostico       || null,
                observaciones:     form.observaciones     || null,
            };
            if (incapacidad) {
                await actualizarIncapacidad(incapacidad.id_incapacidad, payload);
            } else {
                await crearIncapacidad(payload);
            }
            onGuardado();
        } catch (err) {
            const data = err.response?.data;
            const msg  = data?.non_field_errors?.[0] || data?.colaborador?.[0] || data?.detail || 'Error al guardar la incapacidad.';
            setError(msg);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <form onSubmit={handleGuardar}>
            {error && <div className="alerta-error">{error}</div>}

            {/* Buscador de colaborador */}
            <div className="form-field" style={{ marginBottom: 16, position: 'relative' }}>
                <label>Colaborador</label>
                {colaboradorNombre ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input value={colaboradorNombre} readOnly style={{ flex: 1, background: '#f0f4f8' }} />
                        {!incapacidad && (
                            <button type="button" className="btn-secundario" style={{ padding: '9px 12px' }}
                                onClick={() => { setColaboradorNombre(''); setForm({ ...form, colaborador: '' }); }}>
                                Cambiar
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <input
                            value={busqueda}
                            onChange={handleBuscarColaborador}
                            placeholder="Buscar por nombre o cedula..."
                            autoComplete="off"
                        />
                        {buscando && <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>Buscando...</p>}
                        {resultados.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                background: 'white', border: '1px solid #d0d7e2',
                                borderRadius: 5, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}>
                                {resultados.map((c) => (
                                    <div key={c.id_colaborador}
                                        onClick={() => seleccionarColaborador(c)}
                                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0f0f0' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f9ff'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                    >
                                        <strong>{c.nombre}</strong> — {c.cedula}
                                        {c.cargo && <span style={{ color: '#888', marginLeft: 6 }}>{c.cargo}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="form-grid">
                <div className="form-field">
                    <label>Tipo de incapacidad</label>
                    <select name="tipo" value={form.tipo} onChange={handleChange}>
                        <option value="ENFERMEDAD_GENERAL">Enfermedad General</option>
                        <option value="ACCIDENTE_LABORAL">Accidente Laboral</option>
                        <option value="ENFERMEDAD_LABORAL">Enfermedad Laboral</option>
                        <option value="MATERNIDAD">Licencia Maternidad</option>
                        <option value="PATERNIDAD">Licencia Paternidad</option>
                    </select>
                </div>

                <div className="form-field">
                    <label>Entidad emisora</label>
                    <select name="entidad_emisora" value={form.entidad_emisora} onChange={handleChange}>
                        <option value="">Sin entidad emisora</option>
                        {entidades.map((e) => (
                            <option key={e.id_entidad} value={e.id_entidad}>
                                {e.tipo} - {e.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-field">
                    <label>Fecha de inicio</label>
                    <input type="date" name="fecha_inicio" value={form.fecha_inicio} onChange={handleChange} />
                </div>

                <div className="form-field">
                    <label>Fecha de fin</label>
                    <input type="date" name="fecha_fin" value={form.fecha_fin} onChange={handleChange} />
                </div>

                {dias > 0 && (
                    <div className="form-grid-full" style={{
                        background: '#f0f4f8', borderRadius: 6, padding: '10px 14px',
                        fontSize: 13, display: 'flex', gap: 24
                    }}>
                        <span><strong>Dias:</strong> {dias}</span>
                        <span><strong>Responsable de pago:</strong> {responsable}</span>
                    </div>
                )}

                <div className="form-field form-grid-full">
                    <label>Diagnostico (codigo CIE-10 o descripcion)</label>
                    <input
                        name="diagnostico"
                        value={form.diagnostico}
                        onChange={handleChange}
                        placeholder="Ej: J06 - Infeccion aguda de las vias respiratorias"
                    />
                </div>

                <div className="form-field form-grid-full">
                    <label>Observaciones</label>
                    <textarea
                        name="observaciones"
                        value={form.observaciones}
                        onChange={handleChange}
                        placeholder="Observaciones adicionales..."
                        rows={3}
                        style={{ padding: '9px 11px', border: '1px solid #d0d7e2', borderRadius: 5, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                </div>
            </div>

            <div className="form-acciones">
                <button type="button" className="btn-secundario" onClick={onCancelar}>Cancelar</button>
                <button type="submit" className="btn-primario" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </form>
    );
}