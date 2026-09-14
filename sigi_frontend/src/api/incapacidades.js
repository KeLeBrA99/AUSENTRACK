/**
 * AUSENTRACK - Servicios API para incapacidades
 */

import api from './axios';

export const obtenerIncapacidades  = (filtros)      => api.get('/incapacidades/', { params: filtros });
export const obtenerIncapacidad    = (id)            => api.get(`/incapacidades/${id}/`);
export const crearIncapacidad      = (data)          => api.post('/incapacidades/crear/', data);
export const actualizarIncapacidad = (id, data)      => api.patch(`/incapacidades/${id}/`, data);
export const cambiarEstado         = (id, estado)    => api.post(`/incapacidades/${id}/estado/`, { estado });
export const obtenerHistorial      = (idColaborador) => api.get(`/incapacidades/historial/${idColaborador}/`);
export const obtenerAlertas        = ()              => api.get('/incapacidades/alertas/');

export const crearProrroga       = (id, data) => api.post(`/incapacidades/${id}/prorroga/`, data);
export const obtenerProrrogas    = (id)       => api.get(`/incapacidades/${id}/prorrogas/`);

export const subirDocumento   = (id, formData) => api.post(`/incapacidades/${id}/documento/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const eliminarDocumento = (id)           => api.delete(`/incapacidades/${id}/documento/`);
