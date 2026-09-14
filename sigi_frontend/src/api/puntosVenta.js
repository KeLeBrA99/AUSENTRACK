/**
 * AUSENTRACK - Servicios API para puntos de venta
 */

import api from './axios';

export const obtenerPuntosVenta   = (filtros) => api.get('/puntos-venta/', { params: filtros });
export const crearPuntoVenta      = (data)     => api.post('/puntos-venta/crear/', data);
export const actualizarPuntoVenta = (id, data) => api.patch(`/puntos-venta/${id}/`, data);
export const eliminarPuntoVenta   = (id)       => api.delete(`/puntos-venta/${id}/`);
export const obtenerCoberturaPuntosVenta = () => api.get('/puntos-venta/cobertura/');
