/**
 * AUSENTRACK - Servicios API para contratos
 */

import api from './axios';

export const obtenerContratos      = (filtros) => api.get('/contratos/', { params: filtros });
export const obtenerContrato       = (id)       => api.get(`/contratos/${id}/`);
export const crearContrato         = (data)     => api.post('/contratos/crear/', data);
export const actualizarContrato    = (id, data) => api.patch(`/contratos/${id}/`, data);
export const eliminarContrato      = (id)       => api.delete(`/contratos/${id}/`);
export const renovarContrato       = (id, data) => api.post(`/contratos/${id}/renovar/`, data);
export const terminarContrato      = (id, data) => api.post(`/contratos/${id}/terminar/`, data);
export const descargarPdfContrato  = (id)       => api.get(`/contratos/${id}/pdf/`, { responseType: 'blob' });
export const obtenerEstadisticasContratos = () => api.get('/contratos/estadisticas/');
