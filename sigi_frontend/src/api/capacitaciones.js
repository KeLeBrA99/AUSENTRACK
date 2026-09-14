/**
 * AUSENTRACK - Servicios API para capacitaciones e inducción
 */

import api from './axios';

export const obtenerCapacitaciones     = (filtros) => api.get('/capacitaciones/', { params: filtros });
export const obtenerCapacitacion       = (id)       => api.get(`/capacitaciones/${id}/`);
export const crearCapacitacion         = (data)     => api.post('/capacitaciones/crear/', data);
export const actualizarCapacitacion    = (id, data) => api.patch(`/capacitaciones/${id}/`, data);
export const eliminarCapacitacion      = (id)       => api.delete(`/capacitaciones/${id}/`);
export const inscribirParticipante     = (id, data) => api.post(`/capacitaciones/${id}/inscribir/`, data);
export const actualizarParticipante    = (id, data) => api.patch(`/capacitaciones/participantes/${id}/`, data);
export const eliminarParticipante      = (id)       => api.delete(`/capacitaciones/participantes/${id}/eliminar/`);
export const obtenerEstadisticasCapacitaciones = () => api.get('/capacitaciones/estadisticas/');
