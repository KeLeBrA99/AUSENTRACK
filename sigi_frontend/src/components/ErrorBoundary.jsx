/**
 * AUSENTRACK - ErrorBoundary
 *
 * Atrapa cualquier error de renderizado de React para que un fallo en una
 * pantalla no tumbe TODA la aplicacion (que era lo que pasaba antes: un
 * error dejaba al usuario con la pantalla roja y sin poder hacer nada).
 *
 * Debe ser un componente de clase: React solo soporta captura de errores
 * mediante componentDidCatch/getDerivedStateFromError en clases.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hayError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hayError: true, error };
    }

    componentDidCatch(error, info) {
        // Queda en la consola del navegador para poder diagnosticarlo,
        // pero sin romper la experiencia del usuario.
        console.error('Error capturado por ErrorBoundary:', error, info);
    }

    handleReintentar = () => {
        this.setState({ hayError: false, error: null });
    };

    render() {
        if (!this.state.hayError) {
            return this.props.children;
        }

        return (
            <div style={{
                minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}>
                <div style={{
                    background: '#fff', border: '1px solid #E1DED4', borderRadius: 12,
                    padding: '28px 26px', maxWidth: 460, boxShadow: '0 6px 24px rgba(0,0,0,0.07)',
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
                        Algo salió mal en esta pantalla
                    </h2>
                    <p style={{ fontSize: 13.5, color: '#4B554E', lineHeight: 1.5, margin: '0 0 18px' }}>
                        El resto de la plataforma sigue funcionando. Puedes reintentar o volver al
                        inicio; tu sesión no se cerró.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={this.handleReintentar}
                            style={{
                                background: '#4F8B5B', color: '#fff', border: 'none', borderRadius: 8,
                                padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}>
                            Reintentar
                        </button>
                        <button
                            onClick={() => { window.location.href = '/dashboard'; }}
                            style={{
                                background: '#fff', color: '#4B554E', border: '1px solid #E1DED4',
                                borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}>
                            Ir al inicio
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
