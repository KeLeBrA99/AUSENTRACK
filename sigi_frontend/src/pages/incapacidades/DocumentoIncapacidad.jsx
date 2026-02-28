/**
 * AUSENTRACK - Componente de subida y visualizacion de documento de incapacidad
 */

import { useState } from 'react';
import { subirDocumento, eliminarDocumento } from '../../api/incapacidades';
import './DocumentoIncapacidad.css';

const API_URL = 'http://127.0.0.1:8000/media/';

export default function DocumentoIncapacidad({ incapacidad, onActualizado }) {
    const [archivo, setArchivo]     = useState(null);
    const [cargando, setCargando]   = useState(false);
    const [error, setError]         = useState('');
    const [exito, setExito]         = useState('');

    const tieneDocumento = !!incapacidad.documento_url;
    const urlDocumento   = tieneDocumento ? `${API_URL}${incapacidad.documento_url}` : null;
    const esPDF          = tieneDocumento && incapacidad.documento_url.toLowerCase().endsWith('.pdf');

    function handleArchivo(e) {
        const f = e.target.files[0];
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
            setError('Solo se permiten archivos PDF, JPG o PNG.');
            return;
        }
        if (f.size > 10 * 1024 * 1024) {
            setError('El archivo no puede superar 10MB.');
            return;
        }
        setArchivo(f);
        setError('');
    }

    async function handleSubir() {
        if (!archivo) { setError('Selecciona un archivo primero.'); return; }
        setCargando(true);
        setError('');
        setExito('');
        try {
            const formData = new FormData();
            formData.append('documento', archivo);
            await subirDocumento(incapacidad.id_incapacidad, formData);
            setExito('Documento subido correctamente.');
            setArchivo(null);
            onActualizado();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al subir el documento.');
        } finally {
            setCargando(false);
        }
    }

    async function handleEliminar() {
        if (!window.confirm('Deseas eliminar el documento?')) return;
        setCargando(true);
        setError('');
        try {
            await eliminarDocumento(incapacidad.id_incapacidad);
            setExito('Documento eliminado.');
            onActualizado();
        } catch {
            setError('Error al eliminar el documento.');
        } finally {
            setCargando(false);
        }
    }

    return (
        <div className="documento-container">
            <h4 className="documento-titulo">Documento de incapacidad</h4>

            {/* Documento actual */}
            {tieneDocumento ? (
                <div className="documento-actual">
                    <div className="documento-icono">
                        {esPDF ? '📄' : '🖼️'}
                    </div>
                    <div className="documento-info">
                        <span className="documento-nombre">
                            {incapacidad.documento_url.split('/').pop()}
                        </span>
                        <div className="documento-acciones">
                            <a href={urlDocumento} target="_blank" rel="noreferrer" className="btn-ver-doc">
                                Ver documento
                            </a>
                            <button className="btn-eliminar-doc" onClick={handleEliminar} disabled={cargando}>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="documento-vacio">
                    <span>📎</span>
                    <p>No hay documento adjunto</p>
                </div>
            )}

            {/* Subir nuevo documento */}
            <div className="documento-upload">
                <p className="documento-upload-label">
                    {tieneDocumento ? 'Reemplazar documento:' : 'Adjuntar documento:'}
                </p>
                <div className="documento-upload-row">
                    <label className="btn-seleccionar-doc">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleArchivo} style={{ display: 'none' }} />
                        {archivo ? archivo.name : 'Seleccionar archivo'}
                    </label>
                    <button className="btn-subir-doc" onClick={handleSubir} disabled={cargando || !archivo}>
                        {cargando ? 'Subiendo...' : 'Subir'}
                    </button>
                </div>
                <p className="documento-hint">PDF, JPG o PNG · Máximo 10MB</p>
            </div>

            {error && <div className="alerta-error" style={{ marginTop: 8 }}>{error}</div>}
            {exito && <div className="alerta-exito" style={{ marginTop: 8 }}>{exito}</div>}
        </div>
    );
}
