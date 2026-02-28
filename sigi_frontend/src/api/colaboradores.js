/**
 * AUSENTRACK - Servicios API para colaboradores y entidades
 */

import api from './axios';

// Entidades
export const obtenerEntidades  = (tipo) => api.get('/colaboradores/entidades/', { params: tipo ? { tipo } : {} });
export const crearEntidad      = (data) => api.post('/colaboradores/entidades/crear/', data);
export const actualizarEntidad = (id, data) => api.patch(`/colaboradores/entidades/${id}/`, data);
export const eliminarEntidad   = (id) => api.delete(`/colaboradores/entidades/${id}/`);

// Empresas
export const obtenerEmpresas = () => api.get('/colaboradores/empresas/');

// Colaboradores
export const obtenerColaboradores = (filtros) => api.get('/colaboradores/', { params: filtros });
export const obtenerColaborador   = (id) => api.get(`/colaboradores/${id}/`);
export const crearColaborador     = (data) => api.post('/colaboradores/crear/', data);
export const actualizarColaborador = (id, data) => api.patch(`/colaboradores/${id}/`, data);
export const desactivarColaborador = (id) => api.delete(`/colaboradores/${id}/`);
export const buscarColaborador     = (q) => api.get('/colaboradores/buscar/', { params: { q } });
