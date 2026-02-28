/**
 * AUSENTRACK - Servicio API para reportes
 */

import api from './axios';

export const obtenerReporte = (filtros) =>
    api.get('/incapacidades/reporte/', { params: { ...filtros, formato: 'json' } });

export const descargarExcel = (filtros) =>
    api.get('/incapacidades/reporte/', {
        params: { ...filtros, formato: 'excel' },
        responseType: 'blob',
    });

export const descargarPDF = (filtros) =>
    api.get('/incapacidades/reporte/', {
        params: { ...filtros, formato: 'pdf' },
        responseType: 'blob',
    });
