/**
 * SIGI - Componente Modal reutilizable
 */

import './Modal.css';

export default function Modal({ titulo, children, onCerrar }) {
    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{titulo}</h3>
                    <button className="modal-cerrar" onClick={onCerrar}>x</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}
