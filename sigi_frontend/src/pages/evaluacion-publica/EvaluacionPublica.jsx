/**
 * AUSENTRACK - Formulario publico de autoevaluacion
 * No requiere inicio de sesion. Se accede mediante un link con token unico
 * generado desde el modulo interno de Evaluaciones ("Enviar por link").
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { obtenerEvaluacionPublica, enviarEvaluacionPublica } from '../../api/evaluaciones';
import './EvaluacionPublica.css';

function Estrellas({ valor, onChange }) {
    return (
        <div className="ep-star-group">
            {[1, 2, 3, 4, 5].map(n => (
                <span key={n} className={'ep-star' + (n <= valor ? ' filled' : '')} onClick={() => onChange(n)}>★</span>
            ))}
        </div>
    );
}

export default function EvaluacionPublica() {
    const { token } = useParams();
    const [cargando, setCargando] = useState(true);
    const [error, setError]       = useState('');
    const [datos, setDatos]       = useState(null);
    const [criterios, setCriterios] = useState([]);
    const [fortalezas, setFortalezas]     = useState('');
    const [areasMejora, setAreasMejora]   = useState('');
    const [planAccion, setPlanAccion]     = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado]   = useState(false);

    useEffect(() => {
        obtenerEvaluacionPublica(token)
            .then(res => {
                setDatos(res.data);
                setCriterios(res.data.criterios.map(c => ({ ...c, puntaje: c.puntaje || 0 })));
            })
            .catch(err => {
                setError(err.response?.data?.error || 'No se pudo cargar este formulario.');
            })
            .finally(() => setCargando(false));
    }, [token]);

    function setPuntaje(idx, valor) {
        const nuevos = [...criterios];
        nuevos[idx] = { ...nuevos[idx], puntaje: valor };
        setCriterios(nuevos);
    }

    async function handleEnviar() {
        if (criterios.some(c => !c.puntaje)) {
            setError('Por favor califica todos los criterios antes de enviar.');
            return;
        }
        setEnviando(true);
        setError('');
        try {
            await enviarEvaluacionPublica(token, {
                criterios: criterios.map(c => ({ criterio: c.criterio, puntaje: c.puntaje })),
                fortalezas, areas_mejora: areasMejora, plan_accion: planAccion,
            });
            setEnviado(true);
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo enviar la evaluación. Intenta de nuevo.');
        } finally {
            setEnviando(false);
        }
    }

    if (cargando) {
        return <div className="ep-page"><div className="ep-card"><p>Cargando…</p></div></div>;
    }

    if (error && !datos) {
        return (
            <div className="ep-page">
                <div className="ep-card">
                    <h2>No se pudo abrir este formulario</h2>
                    <p className="ep-error">{error}</p>
                    <p style={{ fontSize: 12.5, color: '#6B6F76' }}>
                        Es posible que el link ya haya sido utilizado, o que haya expirado. Contacta a Talento Humano si crees que esto es un error.
                    </p>
                </div>
            </div>
        );
    }

    if (enviado) {
        return (
            <div className="ep-page">
                <div className="ep-card">
                    <h2>¡Gracias, {datos.colaborador_nombre}!</h2>
                    <p>Tu evaluación fue enviada correctamente. Ya puedes cerrar esta ventana.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ep-page">
            <div className="ep-card">
                <h1 className="ep-titulo">Autoevaluación de Desempeño</h1>
                <p className="ep-sub">{datos.colaborador_nombre} · Periodo {datos.periodo}</p>

                {error && <p className="ep-error">{error}</p>}

                <div className="ep-criterios">
                    {criterios.map((c, idx) => (
                        <div className="ep-criterio-row" key={c.criterio}>
                            <div className="ep-criterio-nombre">{c.criterio}</div>
                            <Estrellas valor={c.puntaje} onChange={v => setPuntaje(idx, v)} />
                        </div>
                    ))}
                </div>

                <div className="ep-form-field">
                    <label>¿Qué consideras que son tus fortalezas?</label>
                    <textarea value={fortalezas} onChange={e => setFortalezas(e.target.value)} />
                </div>
                <div className="ep-form-field">
                    <label>¿En qué te gustaría mejorar?</label>
                    <textarea value={areasMejora} onChange={e => setAreasMejora(e.target.value)} />
                </div>
                <div className="ep-form-field">
                    <label>¿Qué acciones planeas tomar para mejorar?</label>
                    <textarea value={planAccion} onChange={e => setPlanAccion(e.target.value)} />
                </div>

                <button className="ep-btn" onClick={handleEnviar} disabled={enviando}>
                    {enviando ? 'Enviando…' : 'Enviar evaluación'}
                </button>
            </div>
        </div>
    );
}
