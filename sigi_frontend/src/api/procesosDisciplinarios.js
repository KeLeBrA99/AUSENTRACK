/**
 * AUSENTRACK - Servicios API para procesos disciplinarios
 */

import api from './axios';

export const obtenerProcesos       = (filtros) => api.get('/procesos-disciplinarios/', { params: filtros });
export const obtenerProceso        = (id)       => api.get(`/procesos-disciplinarios/${id}/`);
export const crearProceso          = (data)     => api.post('/procesos-disciplinarios/crear/', data);
export const actualizarProceso     = (id, data) => api.patch(`/procesos-disciplinarios/${id}/`, data);
export const eliminarProceso       = (id)       => api.delete(`/procesos-disciplinarios/${id}/`);
export const obtenerEstadisticas   = (filtros)  => api.get('/procesos-disciplinarios/estadisticas/', { params: filtros });
export const exportarProcesosExcel = (filtros)  => api.get('/procesos-disciplinarios/exportar/', { params: filtros, responseType: 'blob' });
