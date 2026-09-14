/**
 * AUSENTRACK - Pagina de Reportes de Ausentismo
 */

import { useState } from 'react';
import Layout from '../../components/layout/Layout';
import Tabla from '../../components/ui/Tabla';
import { obtenerReporte, descargarExcel, descargarPDF } from '../../api/reportes';
import '../../components/layout/Layout.css';
import './Reportes.css';

const TIPOS = [
    { value: '',                   label: 'Todos los tipos' },
    { value: 'ENFERMEDAD_GENERAL', label: 'Enfermedad General' },
    { value: 'ACCIDENTE_LABORAL',  label: 'Accidente Laboral' },
    { value: 'ENFERMEDAD_LABORAL', label: 'Enfermedad Laboral' },
    { value: 'MATERNIDAD',         label: 'Licencia Maternidad' },
    { value: 'PATERNIDAD',         label: 'Licencia Paternidad' },
];

const ESTADOS = [
    { value: '',         label: 'Todos los estados' },
    { value: 'ACTIVA',   label: 'Activa' },
    { value: 'EN_COBRO', label: 'En Cobro' },
    { value: 'PAGADA',   label: 'Pagada' },
    { value: 'CERRADA',  label: 'Cerrada' },
];

function descargarArchivo(blob, nombre) {
    const url  = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', nombre);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

export default function Reportes() {
    const [filtros, setFiltros] = useState({
        fecha_desde: '', fecha_hasta: '', tipo: '', estado: '', area: ''
    });
    const [resultado, setResultado]     = useState(null);
    const [cargando, setCargando]       = useState(false);
    const [exportando, setExportando]   = useState('');
    const [error, setError]             = useState('');

    function handleFiltro(e) {
        setFiltros({ ...filtros, [e.target.name]: e.target.value });
    }

    async function handleGenerar() {
        setCargando(true);
        setError('');
        setResultado(null);
        try {
            const res = await obtenerReporte(filtros);
            setResultado(res.data);
        } catch {
            setError('No se pudo generar el reporte. Verifica los filtros.');
        } finally {
            setCargando(false);
        }
    }

    async function handleExcel() {
        setExportando('excel');
        try {
            const res  = await descargarExcel(filtros);
            descargarArchivo(res.data, `ausentrack_reporte_${filtros.fecha_desde || 'completo'}.xlsx`);
        } catch {
            setError('Error al generar el archivo Excel.');
        } finally {
            setExportando('');
        }
    }

    async function handlePDF() {
        setExportando('pdf');
        try {
            const res  = await descargarPDF(filtros);
            descargarArchivo(res.data, `ausentrack_reporte_${filtros.fecha_desde || 'completo'}.pdf`);
        } catch {
            setError('Error al generar el archivo PDF.');
        } finally {
            setExportando('');
        }
    }

    // Calcular resumen por tipo
    function resumenPorTipo(incapacidades) {
        const mapa = {};
        incapacidades.forEach((inc) => {
            const tipo = inc.tipo_display || inc.tipo;
            if (!mapa[tipo]) mapa[tipo] = { registros: 0, dias: 0 };
            mapa[tipo].registros += 1;
            mapa[tipo].dias      += inc.dias;
        });
        return Object.entries(mapa).map(([tipo, v]) => ({ tipo, ...v }));
    }

    const columnas = [
        { key: 'colaborador_nombre',     label: 'Colaborador' },
        { key: 'colaborador_cedula',     label: 'Cedula' },
        { key: 'tipo_display',           label: 'Tipo' },
        { key: 'fecha_inicio',           label: 'Inicio' },
        { key: 'fecha_fin',              label: 'Fin' },
        { key: 'dias',                   label: 'Dias', render: (v) => <strong>{v}</strong> },
        { key: 'responsable_display',    label: 'Responsable' },
        { key: 'estado_display',         label: 'Estado', render: (v, f) => (
            <span className={`badge ${claseEstado(f.estado)}`}>{v}</span>
        )},
        { key: 'entidad_emisora_nombre', label: 'Entidad emisora' },
    ];

    function claseEstado(estado) {
        return { ACTIVA: 'badge-activo', EN_COBRO: 'badge-cobro', PAGADA: 'badge-pagada', CERRADA: 'badge-inactivo' }[estado] || '';
    }

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Reportes</h1>
                    <p className="pagina-subtitulo">Analisis y exportacion de ausentismo laboral</p>
                </div>
            </div>

            {/* Panel de filtros */}
            <div className="reporte-filtros">
                <div className="form-field">
                    <label>Fecha desde</label>
                    <input type="date" name="fecha_desde" value={filtros.fecha_desde} onChange={handleFiltro} />
                </div>
                <div className="form-field">
                    <label>Fecha hasta</label>
                    <input type="date" name="fecha_hasta" value={filtros.fecha_hasta} onChange={handleFiltro} />
                </div>
                <div className="form-field">
                    <label>Tipo</label>
                    <select name="tipo" value={filtros.tipo} onChange={handleFiltro}>
                        {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
                <div className="form-field">
                    <label>Estado</label>
                    <select name="estado" value={filtros.estado} onChange={handleFiltro}>
                        {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                </div>
                <div className="form-field">
                    <label>Area</label>
                    <input name="area" placeholder="Filtrar por area..." value={filtros.area} onChange={handleFiltro} />
                </div>
                <div className="form-field reporte-btn-generar">
                    <label style={{ visibility: 'hidden' }}>Generar</label>
                    <button className="btn-primario" onClick={handleGenerar} disabled={cargando}>
                        {cargando ? 'Generando...' : 'Generar reporte'}
                    </button>
                </div>
            </div>

            {error && <div className="alerta-error">{error}</div>}

            {resultado && (
                <>
                    {/* Tarjetas de resumen */}
                    <div className="reporte-cards">
                        <div className="reporte-card">
                            <span className="card-valor">{resultado.total_registros}</span>
                            <span className="card-label">Total incapacidades</span>
                        </div>
                        <div className="reporte-card">
                            <span className="card-valor">{resultado.total_dias}</span>
                            <span className="card-label">Total dias de ausentismo</span>
                        </div>
                        <div className="reporte-card">
                            <span className="card-valor">
                                {resultado.total_registros > 0
                                    ? (resultado.total_dias / resultado.total_registros).toFixed(1)
                                    : 0}
                            </span>
                            <span className="card-label">Promedio dias por incapacidad</span>
                        </div>
                    </div>

                    {/* Resumen por tipo */}
                    {resultado.incapacidades.length > 0 && (
                        <div className="reporte-resumen">
                            <h3 className="reporte-resumen-titulo">Resumen por tipo</h3>
                            <div className="reporte-resumen-grid">
                                {resumenPorTipo(resultado.incapacidades).map((r) => (
                                    <div key={r.tipo} className="resumen-item">
                                        <span className="resumen-tipo">{r.tipo}</span>
                                        <span className="resumen-dato">{r.registros} casos — {r.dias} dias</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Botones de exportacion */}
                    <div className="reporte-exportar">
                        <span style={{ fontSize: 13, color: '#555', marginRight: 8 }}>Exportar:</span>
                        <button
                            className="btn-exportar btn-excel"
                            onClick={handleExcel}
                            disabled={exportando === 'excel'}
                        >
                            {exportando === 'excel' ? 'Generando...' : 'Descargar Excel'}
                        </button>
                        <button
                            className="btn-exportar btn-pdf"
                            onClick={handlePDF}
                            disabled={exportando === 'pdf'}
                        >
                            {exportando === 'pdf' ? 'Generando...' : 'Descargar PDF'}
                        </button>
                    </div>

                    {/* Tabla de resultados */}
                    <Tabla columnas={columnas} datos={resultado.incapacidades} />
                </>
            )}

            {!resultado && !cargando && (
                <div className="reporte-vacio">
                    <p>Selecciona los filtros y presiona <strong>Generar reporte</strong> para ver los resultados.</p>
                </div>
            )}
        </Layout>
    );
}
