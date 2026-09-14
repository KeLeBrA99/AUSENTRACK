/**
 * SIGI - Contexto de autenticacion
 * Maneja el estado global del usuario autenticado
 */

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            cargarPerfil();
        } else {
            setCargando(false);
        }
    }, []);

    async function cargarPerfil() {
        try {
            const response = await api.get('/auth/perfil/');
            setUsuario(response.data);
        } catch {
            localStorage.clear();
        } finally {
            setCargando(false);
        }
    }

    async function login(email, password) {
        const response = await api.post('/auth/login/', { email, password });
        const { access, refresh, usuario: datos } = response.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        setUsuario(datos);
        return datos;
    }

    async function logout() {
        const refresh = localStorage.getItem('refresh_token');

        // Se cierra la sesion localmente PRIMERO: asi el usuario siempre sale,
        // sin importar si el servidor responde, si el token ya vencio o si no
        // hay conexion. Nunca debe quedar atascado por un error de red.
        localStorage.clear();
        setUsuario(null);

        // Aviso al servidor para invalidar el refresh token (best-effort).
        // No se usa await ni se propaga el error: es informativo, no critico.
        if (refresh) {
            api.post('/auth/logout/', { refresh }).catch(() => {});
        }
    }

    return (
        <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
