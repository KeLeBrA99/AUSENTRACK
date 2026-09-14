/**
 * AUSENTRACK - Servicios API para evaluaciones de desempeño
 */

import api from './axios';

export const obtenerEvaluaciones      = (filtros) => api.get('/evaluaciones/', { params: filtros });
export const obtenerEvaluacion        = (id)       => api.get(`/evaluaciones/${id}/`);
export const crearEvaluacion          = (data)     => api.post('/evaluaciones/crear/', data);
export const actualizarEvaluacion     = (id, data) => api.patch(`/evaluaciones/${id}/`, data);
export const eliminarEvaluacion       = (id)       => api.delete(`/evaluaciones/${id}/`);
export const obtenerCriteriosEstandar = () => api.get('/evaluaciones/criterios-estandar/');
export const obtenerEstadisticasEvaluaciones = () => api.get('/evaluaciones/estadisticas/');
export const crearInvitacionEvaluacion = (data) => api.post('/evaluaciones/crear-invitacion/', data);

// Endpoints publicos (sin login) -- axios plano, sin los interceptores de sesion
import axios from 'axios';
import { API_BASE_URL } from './axios';
export const obtenerEvaluacionPublica = (token) => axios.get(`${API_BASE_URL}/evaluaciones/publica/${token}/`);
export const enviarEvaluacionPublica  = (token, data) => axios.post(`${API_BASE_URL}/evaluaciones/publica/${token}/`, data);
