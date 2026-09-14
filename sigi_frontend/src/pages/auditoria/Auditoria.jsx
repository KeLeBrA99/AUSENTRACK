/**
 * AUSENTRACK - Pagina de Auditoria
 */

import { useState } from 'react';
import Layout from '../../components/layout/Layout';
import Tabla from '../../components/ui/Tabla';
import { obtenerAuditoria } from '../../api/usuarios';
import '../../components/layout/Layout.css';

const ACCIONES = [
    { value: '',       label: 'Todas las acciones' },
    { value: 'CREATE', label: 'Creacion' },
    { value: 'UPDATE', label: 'Actualizacion' },
    { value: 'DELETE', label: 'Eliminacion' },
    { value: 'LOGIN',  label: 'Inicio de sesion' },
    { value: 'LOGOUT', label: 'Cierre de sesion' },
];

export default function Auditoria() {
    const [registros, setRegistros] = useState([]);
    const [cargando, setCargando]   = useState(false);
    const [error, setError]         = useState('');
    const [filtros, setFiltros]     = useState({
        accion: '', tabla: '', fecha_desde: '', fecha_hasta: ''
    });

    async function cargar() {
        setCargando(true);
        setError('');
        try {
            const params = {};
            if (filtros.accion)       params.accion       = filtros.accion;
            if (filtros.tabla)        params.tabla        = filtros.tabla;
            if (filtros.fecha_desde)  params.fecha_desde  = filtros.fecha_desde;
            if (filtros.fecha_hasta)  params.fecha_hasta  = filtros.fecha_hasta;
            const res = await obtenerAuditoria(params);
            setRegistros(res.data);
        } catch {
            setError('No se pudo cargar el registro de auditoria.');
        } finally {
            setCargando(false);
        }
    }

    function handleFiltro(e) {
        setFiltros({ ...filtros, [e.target.name]: e.target.value });
    }

    function claseAccion(accion) {
        return {
            CREATE: 'badge-activo',
            UPDATE: 'badge-cobro',
            DELETE: 'badge-inactivo',
            LOGIN:  'badge-eps',
            LOGOUT: 'badge-empleador',
        }[accion] || '';
    }

    const columnas = [
        { key: 'fecha',      label: 'Fecha y hora' },
        { key: 'usuario',    label: 'Usuario' },
        { key: 'accion',     label: 'Accion', render: (v) => (
            <span className={`badge ${claseAccion(v)}`}>{v}</span>
        )},
        { key: 'tabla',      label: 'Modulo' },
        { key: 'id_registro', label: 'ID registro' },
        { key: 'detalle',    label: 'Detalle' },
        { key: 'ip',         label: 'IP' },
    ];

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Auditoria</h1>
                    <p className="pagina-subtitulo">Registro de actividad del sistema</p>
                </div>
            </div>

            <div className="filtros">
                <select name="accion" value={filtros.accion} onChange={handleFiltro}>
                    {ACCIONES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <input
                    name="tabla"
                    placeholder="Filtrar por modulo..."
                    value={filtros.tabla}
                    onChange={handleFiltro}
                />
                <input type="date" name="fecha_desde" value={filtros.fecha_desde} onChange={handleFiltro} title="Desde" />
                <input type="date" name="fecha_hasta" value={filtros.fecha_hasta} onChange={handleFiltro} title="Hasta" />
                <button className="btn-primario" onClick={cargar} disabled={cargando}>
                    {cargando ? 'Cargando...' : 'Consultar'}
                </button>
            </div>

            {error && <div className="alerta-error">{error}</div>}

            {registros.length > 0 ? (
                <>
                    <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                        {registros.length} registros encontrados
                    </p>
                    <Tabla columnas={columnas} datos={registros} />
                </>
            ) : (
                !cargando && (
                    <div style={{ background: 'white', borderRadius: 8, padding: 40, textAlign: 'center', color: '#888', fontSize: 13, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                        <p>Selecciona los filtros y presiona <strong>Consultar</strong> para ver el registro de actividad.</p>
                    </div>
                )
            )}
        </Layout>
    );
}
