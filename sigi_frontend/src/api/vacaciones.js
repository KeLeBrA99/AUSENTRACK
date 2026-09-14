/**
 * AUSENTRACK - Servicios API para vacaciones
 */

import api from './axios';

export const obtenerSolicitudes    = (filtros) => api.get('/vacaciones/', { params: filtros });
export const crearSolicitud        = (data)     => api.post('/vacaciones/crear/', data);
export const actualizarSolicitud   = (id, data) => api.patch(`/vacaciones/${id}/`, data);
export const eliminarSolicitud     = (id)       => api.delete(`/vacaciones/${id}/`);
export const aprobarSolicitud      = (id, data) => api.post(`/vacaciones/${id}/aprobar/`, data);
export const rechazarSolicitud     = (id, data) => api.post(`/vacaciones/${id}/rechazar/`, data);
export const cancelarSolicitud     = (id)       => api.post(`/vacaciones/${id}/cancelar/`);
export const marcarDisfrutada      = (id)       => api.post(`/vacaciones/${id}/disfrutada/`);
export const obtenerSaldoColaborador = (id)     => api.get(`/vacaciones/saldo/${id}/`);
export const obtenerSaldosGenerales  = ()       => api.get('/vacaciones/saldos/');
export const obtenerEstadisticasVacaciones = () => api.get('/vacaciones/estadisticas/');
