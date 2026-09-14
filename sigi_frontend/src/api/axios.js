/**
 * AUSENTRACK - Configuracion de Axios
 * Instancia base para todas las peticiones a la API
 */

import axios from 'axios';

/**
 * URL base de la API. Se puede configurar con la variable de entorno
 * REACT_APP_API_URL (en el archivo .env del frontend). Si no se define,
 * usa localhost:8000 para desarrollo local.
 *
 * Al desplegar, define en .env:
 *   REACT_APP_API_URL=https://tu-servidor.com/api
 */
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor de peticiones: agrega el token JWT a cada solicitud
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor de respuestas: maneja token expirado automaticamente
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refresh = localStorage.getItem('refresh_token');
                const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
                    refresh,
                });
                const nuevoToken = response.data.access;
                localStorage.setItem('access_token', nuevoToken);
                original.headers.Authorization = `Bearer ${nuevoToken}`;
                return api(original);
            } catch {
                localStorage.clear();
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;
