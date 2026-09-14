/**
 * AUSENTRACK - Servicios API para retiros (offboarding)
 */

import api from './axios';

export const obtenerRetiros    = (filtros) => api.get('/retiros/', { params: filtros });
export const obtenerRetiro     = (id)       => api.get(`/retiros/${id}/`);
export const crearRetiro       = (data)     => api.post('/retiros/crear/', data);
export const actualizarRetiro  = (id, data) => api.patch(`/retiros/${id}/`, data);
export const obtenerEstadisticasRetiros = () => api.get('/retiros/estadisticas/');
