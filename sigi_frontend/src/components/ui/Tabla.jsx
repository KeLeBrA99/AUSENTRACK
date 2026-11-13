/**
 * AUSENTRACK - Componente de tabla reutilizable
 *
 * Muestra las filas por paginas para que la pantalla no se vuelva lenta cuando
 * el listado crece. Dos modos:
 *
 *  - Por defecto: recibe todos los `datos` y los reparte en paginas en el
 *    navegador (25 por pagina; se cambia con `porPagina`).
 *  - `paginacion={{ pagina, total, porPagina, onCambiar }}`: el servidor ya
 *    entrega una sola pagina en `datos`; la tabla solo pinta los controles.
 */

import { useState } from 'react';
import './Tabla.css';

export default function Tabla({ columnas, datos, acciones, porPagina = 25, paginacion }) {
    const [paginaLocal, setPaginaLocal] = useState(1);

    const enServidor   = !!paginacion;
    const tamano       = enServidor ? paginacion.porPagina : porPagina;
    const total        = enServidor ? paginacion.total : datos.length;
    const totalPaginas = Math.max(1, Math.ceil(total / tamano));
    // Si los datos cambian (un filtro, un borrado) y quedan menos paginas, se
    // muestra la ultima que exista en lugar de una pagina vacia.
    const pagina       = Math.min(enServidor ? paginacion.pagina : paginaLocal, totalPaginas);
    const irA          = enServidor ? paginacion.onCambiar : setPaginaLocal;

    const filas   = enServidor ? datos : datos.slice((pagina - 1) * tamano, pagina * tamano);
    const primera = total === 0 ? 0 : (pagina - 1) * tamano + 1;
    const ultima  = Math.min(pagina * tamano, total);

    return (
        <>
            <div className="tabla-wrapper">
                <table className="tabla">
                    <thead>
                        <tr>
                            {columnas.map((col) => (
                                <th key={col.key}>{col.label}</th>
                            ))}
                            {acciones && <th>Acciones</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filas.length === 0 ? (
                            <tr>
                                <td colSpan={columnas.length + (acciones ? 1 : 0)} className="tabla-vacia">
                                    No hay registros para mostrar.
                                </td>
                            </tr>
                        ) : (
                            filas.map((fila, i) => (
                                <tr key={i}>
                                    {columnas.map((col) => (
                                        <td key={col.key}>
                                            {col.render ? col.render(fila[col.key], fila) : fila[col.key] ?? '-'}
                                        </td>
                                    ))}
                                    {acciones && (
                                        <td className="tabla-acciones">
                                            {acciones(fila)}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPaginas > 1 && (
                <div className="tabla-paginacion">
                    <span className="tabla-paginacion-info">
                        {primera}–{ultima} de {total}
                    </span>
                    <div className="tabla-paginacion-botones">
                        <button type="button" onClick={() => irA(1)} disabled={pagina === 1} aria-label="Primera pagina">«</button>
                        <button type="button" onClick={() => irA(pagina - 1)} disabled={pagina === 1}>Anterior</button>
                        <span className="tabla-paginacion-actual">Pagina {pagina} de {totalPaginas}</span>
                        <button type="button" onClick={() => irA(pagina + 1)} disabled={pagina === totalPaginas}>Siguiente</button>
                        <button type="button" onClick={() => irA(totalPaginas)} disabled={pagina === totalPaginas} aria-label="Ultima pagina">»</button>
                    </div>
                </div>
            )}
        </>
    );
}
