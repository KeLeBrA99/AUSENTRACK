/**
 * SIGI - Componente de tabla reutilizable
 */

import './Tabla.css';

export default function Tabla({ columnas, datos, acciones }) {
    return (
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
                    {datos.length === 0 ? (
                        <tr>
                            <td colSpan={columnas.length + (acciones ? 1 : 0)} className="tabla-vacia">
                                No hay registros para mostrar.
                            </td>
                        </tr>
                    ) : (
                        datos.map((fila, i) => (
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
    );
}
