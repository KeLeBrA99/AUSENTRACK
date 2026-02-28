/**
 * AUSENTRACK - Pagina de Login
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export default function Login() {
    const { login } = useAuth();
    const navigate  = useNavigate();

    const [form, setForm]       = useState({ email: '', password: '' });
    const [error, setError]     = useState('');
    const [cargando, setCargando] = useState(false);

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.email || !form.password) {
            setError('Por favor ingresa tu correo y contrasena.');
            return;
        }
        setCargando(true);
        try {
            const usuario = await login(form.email, form.password);
            if (usuario.rol === 'ADMIN') navigate('/dashboard');
            else if (usuario.rol === 'TALENTO_HUMANO') navigate('/incapacidades');
            else navigate('/reportes');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Correo o contrasena incorrectos.';
            setError(msg);
        } finally {
            setCargando(false);
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1 className="login-titulo">AUSENTRACK</h1>
                    <p className="login-subtitulo">Gestion de Incapacidades</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Correo electronico</label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="usuario@empresa.com"
                            autoComplete="email"
                            disabled={cargando}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Contrasena</label>
                        <input
                            id="password"
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            placeholder="Ingresa tu contrasena"
                            autoComplete="current-password"
                            disabled={cargando}
                        />
                    </div>

                    {error && (
                        <div className="login-error">{error}</div>
                    )}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={cargando}
                    >
                        {cargando ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>

                <p className="login-footer">
                    Universidad Politecnico Grancolombiano — 2026
                </p>
            </div>
        </div>
    );
}
