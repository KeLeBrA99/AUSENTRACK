/**
 * AUSENTRACK - Componente de subida y visualizacion de documento de incapacidad
 */

import { useState } from 'react';
import { subirDocumento, eliminarDocumento, descargarDocumento } from '../../api/incapacidades';
import './DocumentoIncapacidad.css';

export default function DocumentoIncapacidad({ incapacidad, onActualizado }) {
    const [archivo, setArchivo]     = useState(null);
    const [cargando, setCargando]   = useState(false);
    const [error, setError]         = useState('');
    const [exito, setExito]         = useState('');

    // Se guarda en estado propio para reflejar de inmediato lo que se sube o
    // se elimina, sin depender de que la pantalla de atras recargue la fila.
    const [documentoUrl, setDocumentoUrl] = useState(incapacidad.documento_url || null);

    const tieneDocumento = !!documentoUrl;
    const esPDF          = tieneDocumento && documentoUrl.toLowerCase().endsWith('.pdf');

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
            const res = await subirDocumento(incapacidad.id_incapacidad, formData);
            setDocumentoUrl(res.data.documento_url);
            setExito('Documento subido correctamente.');
            setArchivo(null);
            onActualizado();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al subir el documento.');
        } finally {
            setCargando(false);
        }
    }

    async function handleVer() {
        setError('');
        // La pestaña se abre ANTES de pedir el archivo: si se abre despues de
        // esperar la respuesta, el navegador la trata como ventana emergente
        // y la bloquea.
        const pestana = window.open('', '_blank');
        try {
            const res = await descargarDocumento(incapacidad.id_incapacidad);
            const url = URL.createObjectURL(res.data);
            if (pestana) pestana.location.href = url;
            else window.location.assign(url);
            setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
        } catch {
            if (pestana) pestana.close();
            setError('No se pudo abrir el documento.');
        }
    }

    async function handleEliminar() {
        if (!window.confirm('Deseas eliminar el documento?')) return;
        setCargando(true);
        setError('');
        try {
            await eliminarDocumento(incapacidad.id_incapacidad);
            setDocumentoUrl(null);
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
                            {documentoUrl.split('/').pop()}
                        </span>
                        <div className="documento-acciones">
                            <button type="button" className="btn-ver-doc" onClick={handleVer}>
                                Ver documento
                            </button>
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
