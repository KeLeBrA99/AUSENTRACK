/**
 * AUSENTRACK - Modal de importacion masiva de colaboradores desde Excel
 */

import { useState } from 'react';
import api from '../../api/axios';
import '../../components/layout/Layout.css';
import './ImportarExcel.css';

export default function ImportarExcel({ onImportado, onCerrar }) {
    const [archivo, setArchivo]     = useState(null);
    const [resultado, setResultado] = useState(null);
    const [cargando, setCargando]   = useState(false);
    const [error, setError]         = useState('');

    function handleArchivo(e) {
        const f = e.target.files[0];
        if (!f) return;
        if (!f.name.endsWith('.xlsx')) { setError('Solo se aceptan archivos .xlsx'); return; }
        setArchivo(f);
        setError('');
        setResultado(null);
    }

    async function handleImportar() {
        if (!archivo) { setError('Selecciona un archivo Excel primero.'); return; }
        setCargando(true);
        setError('');
        setResultado(null);
        try {
            const formData = new FormData();
            formData.append('archivo', archivo);
            const res = await api.post('/colaboradores/importar/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResultado(res.data);
            if (res.data.exitosos > 0) onImportado();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al procesar el archivo.');
        } finally {
            setCargando(false);
        }
    }

    async function descargarPlantilla() {
        try {
            const res = await api.get('/colaboradores/plantilla/', { responseType: 'blob' });
            const url  = URL.createObjectURL(res.data);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = 'plantilla_colaboradores.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('No se pudo descargar la plantilla.');
        }
    }

    return (
        <div>
            <div className="importar-instrucciones">
                <p className="importar-titulo-seccion">Columnas del Excel:</p>
                <div className="importar-columnas">
                    <span className="col-requerida">cedula</span>
                    <span className="col-requerida">nombre</span>
                    <span className="col-opcional">cargo</span>
                    <span className="col-opcional">area</span>
                    <span className="col-opcional">fecha_ingreso</span>
                    <span className="col-opcional">nit_empresa</span>
                    <span className="col-opcional">nit_eps</span>
                    <span className="col-opcional">nit_arl</span>
                </div>
                <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
                    En <strong>azul oscuro</strong> son obligatorias. Fechas en formato YYYY-MM-DD o DD/MM/YYYY.
                </p>
                <button className="btn-plantilla" onClick={descargarPlantilla}>
                    Descargar plantilla CSV de ejemplo
                </button>
            </div>

            <div className="importar-upload">
                <label className="upload-label">
                    <input type="file" accept=".xlsx" onChange={handleArchivo} style={{ display: 'none' }} />
                    <div className="upload-area">
                        {archivo ? (
                            <>
                                <span className="upload-icono">✓</span>
                                <span className="upload-nombre">{archivo.name}</span>
                            </>
                        ) : (
                            <>
                                <span className="upload-icono">📂</span>
                                <span>Clic para seleccionar archivo Excel (.xlsx)</span>
                            </>
                        )}
                    </div>
                </label>
            </div>

            {error && <div className="alerta-error">{error}</div>}

            {resultado && (
                <div className="importar-resultado">
                    <div className={`resultado-header ${resultado.exitosos > 0 ? 'resultado-ok' : 'resultado-vacio'}`}>
                        <strong>{resultado.exitosos}</strong> colaboradores importados correctamente
                    </div>
                    {resultado.errores.length > 0 && (
                        <div className="resultado-errores">
                            <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                                {resultado.errores.length} filas con problemas:
                            </p>
                            {resultado.errores.map((e, i) => (
                                <div key={i} className="error-item">{e}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="form-acciones">
                <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
                <button className="btn-primario" onClick={handleImportar} disabled={cargando || !archivo}>
                    {cargando ? 'Importando...' : 'Importar'}
                </button>
            </div>
        </div>
    );
}