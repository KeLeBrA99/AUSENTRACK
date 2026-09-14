/**
 * AUSENTRACK - Formateo de errores de API
 * Convierte la respuesta de error de Django REST Framework (que llega como
 * un objeto {campo: [mensajes]}) en un texto legible en español, en vez de
 * mostrar el JSON crudo al usuario.
 */

export function formatearErrorAPI(err, mensajePorDefecto = 'Ocurrió un error. Intenta de nuevo.') {
    const data = err?.response?.data;
    if (!data) return mensajePorDefecto;

    // Error simple: {"detail": "..."} o {"error": "..."}
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.error) return data.error;

    // Error por campo: {"fecha_fin": ["Este campo es obligatorio."], ...}
    if (typeof data === 'object') {
        const mensajes = [];
        for (const [campo, valor] of Object.entries(data)) {
            const texto = Array.isArray(valor) ? valor.join(' ') : String(valor);
            mensajes.push(campo === 'non_field_errors' ? texto : `${texto}`);
        }
        if (mensajes.length > 0) return mensajes.join(' ');
    }

    return mensajePorDefecto;
}
