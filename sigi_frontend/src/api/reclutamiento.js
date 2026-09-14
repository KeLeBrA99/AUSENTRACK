/**
 * AUSENTRACK - Servicios API para reclutamiento y selección
 */

import api from './axios';

export const obtenerVacantes       = (filtros) => api.get('/reclutamiento/vacantes/', { params: filtros });
export const obtenerVacante        = (id)       => api.get(`/reclutamiento/vacantes/${id}/`);
export const crearVacante          = (data)     => api.post('/reclutamiento/vacantes/crear/', data);
export const actualizarVacante     = (id, data) => api.patch(`/reclutamiento/vacantes/${id}/`, data);
export const eliminarVacante       = (id)       => api.delete(`/reclutamiento/vacantes/${id}/`);

export const obtenerCandidatos     = (filtros)  => api.get('/reclutamiento/candidatos/', { params: filtros });
export const crearCandidato        = (data)     => api.post('/reclutamiento/candidatos/crear/', data);
export const actualizarCandidato   = (id, data) => api.patch(`/reclutamiento/candidatos/${id}/`, data);
export const eliminarCandidato     = (id)       => api.delete(`/reclutamiento/candidatos/${id}/`);

export const obtenerEstadisticasReclutamiento = () => api.get('/reclutamiento/estadisticas/');
