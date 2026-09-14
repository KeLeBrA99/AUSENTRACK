/**
 * AUSENTRACK - Servicios API para Dotación y EPP
 */

import api from './axios';

export const obtenerElementos      = (filtros) => api.get('/dotacion/elementos/', { params: filtros });
export const crearElemento         = (data)     => api.post('/dotacion/elementos/crear/', data);
export const actualizarElemento    = (id, data) => api.patch(`/dotacion/elementos/${id}/`, data);

export const obtenerInventario     = (filtros) => api.get('/dotacion/inventario/', { params: filtros });
export const crearInventario       = (data)     => api.post('/dotacion/inventario/crear/', data);
export const actualizarInventario  = (id, data) => api.patch(`/dotacion/inventario/${id}/`, data);

export const obtenerEntregas       = (filtros) => api.get('/dotacion/entregas/', { params: filtros });
export const crearEntrega          = (data)     => api.post('/dotacion/entregas/crear/', data);

export const obtenerRequisitos     = (filtros) => api.get('/dotacion/requisitos/', { params: filtros });
export const crearRequisito        = (data)     => api.post('/dotacion/requisitos/crear/', data);
export const eliminarRequisito     = (id)       => api.delete(`/dotacion/requisitos/${id}/`);

export const obtenerPendientesDotacion   = () => api.get('/dotacion/pendientes/');
export const obtenerEstadisticasDotacion = () => api.get('/dotacion/estadisticas/');
