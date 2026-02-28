/**
 * AUSENTRACK - Pagina principal de Incapacidades
 */

import { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import Tabla from '../../components/ui/Tabla';
import Modal from '../../components/ui/Modal';
import FormIncapacidad from './FormIncapacidad';
import ModalProrroga from './ModalProrroga';
import DocumentoIncapacidad from './DocumentoIncapacidad';
import { obtenerIncapacidades, cambiarEstado, obtenerAlertas } from '../../api/incapacidades';
import { useAuth } from '../../context/AuthContext';
import '../../components/layout/Layout.css';
import './Incapacidades.css';

const ESTADOS = [
    { value: '',         label: 'Todos los estados' },
    { value: 'ACTIVA',   label: 'Activa' },
    { value: 'EN_COBRO', label: 'En Cobro' },
    { value: 'PAGADA',   label: 'Pagada' },
    { value: 'CERRADA',  label: 'Cerrada' },
];

const TIPOS = [
    { value: '',                   label: 'Todos los tipos' },
    { value: 'ENFERMEDAD_GENERAL', label: 'Enfermedad General' },
    { value: 'ACCIDENTE_LABORAL',  label: 'Accidente Laboral' },
    { value: 'ENFERMEDAD_LABORAL', label: 'Enfermedad Laboral' },
    { value: 'MATERNIDAD',         label: 'Licencia Maternidad' },
    { value: 'PATERNIDAD',         label: 'Licencia Paternidad' },
];

export default function Incapacidades() {
    const { usuario } = useAuth();
    const puedeEditar = ['ADMIN', 'TALENTO_HUMANO'].includes(usuario?.rol);

    const [incapacidades, setIncapacidades] = useState([]);
    const [alertas, setAlertas]             = useState({ proximas_a_vencer: [], mas_de_180_dias: [] });
    const [cargando, setCargando]           = useState(true);
    const [error, setError]                 = useState('');
    const [modalForm, setModalForm]         = useState(false);
    const [modalEstado, setModalEstado]       = useState(false);
    const [modalProrroga, setModalProrroga]   = useState(false);
    const [modalDocumento, setModalDocumento] = useState(false);
    const [seleccionada, setSeleccionada]   = useState(null);
    const [nuevoEstado, setNuevoEstado]     = useState('');
    const [guardando, setGuardando]         = useState(false);

    const [filtros, setFiltros] = useState({
        buscar: '', tipo: '', estado: '',
        fecha_inicio_desde: '', fecha_inicio_hasta: ''
    });

    useEffect(() => {
        cargar();
        if (puedeEditar) cargarAlertas();
    }, [filtros]);

    async function cargar() {
        setCargando(true);
        setError('');
        try {
            const params = {};
            if (filtros.buscar)             params.buscar             = filtros.buscar;
            if (filtros.tipo)               params.tipo               = filtros.tipo;
            if (filtros.estado)             params.estado             = filtros.estado;
            if (filtros.fecha_inicio_desde) params.fecha_inicio_desde = filtros.fecha_inicio_desde;
            if (filtros.fecha_inicio_hasta) params.fecha_inicio_hasta = filtros.fecha_inicio_hasta;
            const res = await obtenerIncapacidades(params);
            setIncapacidades(res.data);
        } catch {
            setError('No se pudieron cargar las incapacidades.');
        } finally {
            setCargando(false);
        }
    }

    async function cargarAlertas() {
        try {
            const res = await obtenerAlertas();
            setAlertas(res.data);
        } catch { /* no bloquear la pagina */ }
    }

    function handleFiltro(e) {
        setFiltros({ ...filtros, [e.target.name]: e.target.value });
    }

    function abrirNueva() {
        setSeleccionada(null);
        setModalForm(true);
    }

    function abrirEditar(inc) {
        setSeleccionada(inc);
        setModalForm(true);
    }

    function abrirProrroga(inc) {
        setSeleccionada(inc);
        setModalProrroga(true);
    }

    function abrirDocumento(inc) {
        setSeleccionada(inc);
        setModalDocumento(true);
    }

    function abrirCambiarEstado(inc) {
        setSeleccionada(inc);
        setNuevoEstado(inc.estado);
        setModalEstado(true);
    }

    async function handleGuardarEstado() {
        setGuardando(true);
        try {
            await cambiarEstado(seleccionada.id_incapacidad, nuevoEstado);
            setModalEstado(false);
            cargar();
        } catch {
            setError('No se pudo actualizar el estado.');
        } finally {
            setGuardando(false);
        }
    }

    function claseEstado(estado) {
        return { ACTIVA: 'badge-activo', EN_COBRO: 'badge-cobro', PAGADA: 'badge-pagada', CERRADA: 'badge-inactivo' }[estado] || '';
    }

    function claseResponsable(resp) {
        return { EMPLEADOR: 'badge-empleador', EPS: 'badge-eps', ARL: 'badge-arl' }[resp] || '';
    }

    const columnas = [
        { key: 'colaborador_nombre',      label: 'Colaborador' },
        { key: 'tipo_display',            label: 'Tipo' },
        { key: 'fecha_inicio',            label: 'Inicio' },
        { key: 'fecha_fin',               label: 'Fin' },
        { key: 'dias',                    label: 'Dias', render: (v) => <strong>{v}</strong> },
        { key: 'responsable_display',     label: 'Responsable', render: (v, f) => (
            <span className={`badge ${claseResponsable(f.responsable_pago)}`}>{v}</span>
        )},
        { key: 'estado_display',          label: 'Estado', render: (v, f) => (
            <span className={`badge ${claseEstado(f.estado)}`}>{v}</span>
        )},
    ];

    const totalAlertas = alertas.proximas_a_vencer.length + alertas.mas_de_180_dias.length;

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Incapacidades</h1>
                    <p className="pagina-subtitulo">Registro y seguimiento de incapacidades laborales</p>
                </div>
                {puedeEditar && (
                    <button className="btn-primario" onClick={abrirNueva}>
                        + Nueva incapacidad
                    </button>
                )}
            </div>

            {puedeEditar && totalAlertas > 0 && (
                <div className="panel-alertas">
                    <p className="alertas-titulo">Alertas activas ({totalAlertas})</p>
                    {alertas.proximas_a_vencer.map((a) => (
                        <div key={a.id_incapacidad} className="alerta-item alerta-amarilla">
                            {a.colaborador__nombre} — vence el {a.fecha_fin}
                        </div>
                    ))}
                    {alertas.mas_de_180_dias.map((a) => (
                        <div key={a.id_incapacidad} className="alerta-item alerta-roja">
                            {a.colaborador__nombre} — {a.dias} dias acumulados (supera 180 dias)
                        </div>
                    ))}
                </div>
            )}

            <div className="filtros">
                <input
                    name="buscar"
                    placeholder="Nombre o cedula..."
                    value={filtros.buscar}
                    onChange={handleFiltro}
                />
                <select name="tipo" value={filtros.tipo} onChange={handleFiltro}>
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select name="estado" value={filtros.estado} onChange={handleFiltro}>
                    {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
                <input type="date" name="fecha_inicio_desde" value={filtros.fecha_inicio_desde} onChange={handleFiltro} title="Desde" />
                <input type="date" name="fecha_inicio_hasta" value={filtros.fecha_inicio_hasta} onChange={handleFiltro} title="Hasta" />
            </div>

            {error && <div className="alerta-error">{error}</div>}

            {cargando ? (
                <p style={{ color: '#888', fontSize: 13 }}>Cargando...</p>
            ) : (
                <Tabla
                    columnas={columnas}
                    datos={incapacidades}
                    acciones={puedeEditar ? (fila) => (
                        <>
                            <button className="btn-editar"   onClick={() => abrirEditar(fila)}>Editar</button>
                            <button className="btn-prorroga" onClick={() => abrirProrroga(fila)}>Prorroga</button>
                            <button className="btn-documento" onClick={() => abrirDocumento(fila)}>
                                {fila.documento_url ? '📄 Doc' : '📎 Doc'}
                            </button>
                            <button className="btn-estado"   onClick={() => abrirCambiarEstado(fila)}>Estado</button>
                        </>
                    ) : null}
                />
            )}

            {modalForm && (
                <Modal
                    titulo={seleccionada ? 'Editar incapacidad' : 'Nueva incapacidad'}
                    onCerrar={() => setModalForm(false)}
                >
                    <FormIncapacidad
                        incapacidad={seleccionada}
                        onGuardado={() => { setModalForm(false); cargar(); }}
                        onCancelar={() => setModalForm(false)}
                    />
                </Modal>
            )}

            {modalEstado && seleccionada && (
                <Modal titulo="Cambiar estado" onCerrar={() => setModalEstado(false)}>
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 13, color: '#555' }}>
                            Colaborador: <strong>{seleccionada.colaborador_nombre}</strong>
                        </p>
                        <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
                            Estado actual: <strong>{seleccionada.estado_display}</strong>
                        </p>
                    </div>
                    <div className="form-field" style={{ marginBottom: 20 }}>
                        <label>Nuevo estado</label>
                        <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                            {ESTADOS.filter((e) => e.value).map((e) => (
                                <option key={e.value} value={e.value}>{e.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-acciones">
                        <button className="btn-secundario" onClick={() => setModalEstado(false)}>Cancelar</button>
                        <button className="btn-primario" onClick={handleGuardarEstado} disabled={guardando}>
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </Modal>
            )}
            {modalDocumento && seleccionada && (
                <Modal titulo={`Documento — ${seleccionada.colaborador_nombre}`} onCerrar={() => setModalDocumento(false)}>
                    <DocumentoIncapacidad
                        incapacidad={seleccionada}
                        onActualizado={() => { cargar(); }}
                    />
                </Modal>
            )}

            {modalProrroga && seleccionada && (
                <ModalProrroga
                    incapacidad={seleccionada}
                    onCerrar={() => setModalProrroga(false)}
                    onGuardado={() => cargar()}
                />
            )}
        </Layout>
    );
}