/**
 * AUSENTRACK - Servicios API para usuarios y auditoria
 */

import api from './axios';

export const obtenerUsuarios   = ()          => api.get('/auth/usuarios/');
export const crearUsuario      = (data)      => api.post('/auth/usuarios/crear/', data);
export const actualizarUsuario = (id, data)  => api.patch(`/auth/usuarios/${id}/`, data);
export const desactivarUsuario = (id)        => api.delete(`/auth/usuarios/${id}/`);
export const obtenerAuditoria  = (filtros)   => api.get('/auth/auditoria/', { params: filtros });
