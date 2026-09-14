/**
 * AUSENTRACK - Dashboard principal con graficas
 * Vista consolidada de los 4 modulos: Colaboradores, Incapacidades,
 * Procesos Disciplinarios y Reclutamiento. Cada seccion se carga y se
 * muestra de forma independiente para que la falta de datos en un
 * modulo no bloquee la vista de los demas.
 */

import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import Layout from '../../components/layout/Layout';
import api from '../../api/axios';
import '../../components/layout/Layout.css';
import './Dashboard.css';

const COLORES_TIPO = ['#1A1A1A', '#2E75B6', '#4BACC6', '#70AD47', '#FFC000', '#A83E3E', '#8064A2', '#2F6F5E', '#B8752A', '#6A8EAE'];
const COLORES_ESTADO = {
    ACTIVA: '#70AD47', EN_COBRO: '#FFC000', PAGADA: '#4BACC6', CERRADA: '#A5A5A5'
};
const COLORES_RESP = { EMPLEADOR: '#1A1A1A', EPS: '#2E75B6', ARL: '#ED7D31' };

/**
 * Agrupa las categorias mas pequeñas de un pie chart en "Otros" para que no
 * queden decenas de porciones diminutas peleandose por espacio y colores.
 */
function agruparCategoriasPequenas(items, campoNombre, campoValor, maxCategorias = 6) {
    if (items.length <= maxCategorias) return items;
    const ordenado = [...items].sort((a, b) => b[campoValor] - a[campoValor]);
    const principales = ordenado.slice(0, maxCategorias - 1);
    const resto = ordenado.slice(maxCategorias - 1);
    const sumaResto = resto.reduce((acc, it) => acc + it[campoValor], 0);
    return [...principales, { [campoNombre]: `Otros (${resto.length})`, [campoValor]: sumaResto }];
}
const COLOR_PD_ESTADO = { EN_PROCESO: '#B8752A', CERRADO: '#2F6F5E', ARCHIVADO: '#6B6F76', ABIERTO: '#A83E3E', DESISTIDO: '#6B6F76' };

function SinDatos({ children }) {
    return <p className="sin-datos">{children || 'Sin datos todavía'}</p>;
}

export default function Dashboard() {
    const [incapacidades, setIncapacidades] = useState(null);
    const [colaboradores, setColaboradores]  = useState(null);
    const [procesosDisc, setProcesosDisc]    = useState(null);
    const [reclutamiento, setReclutamiento]  = useState(null);
    const [cobertura, setCobertura]          = useState(null);
    const [cargando, setCargando]            = useState(true);
    const [errores, setErrores]              = useState({});

    useEffect(() => {
        const cargar = async (nombre, url, setter) => {
            try {
                const res = await api.get(url);
                setter(res.data);
            } catch {
                setErrores(prev => ({ ...prev, [nombre]: true }));
            }
        };
        Promise.all([
            cargar('incapacidades', '/incapacidades/estadisticas/', setIncapacidades),
            cargar('colaboradores', '/colaboradores/estadisticas/', setColaboradores),
            cargar('procesos', '/procesos-disciplinarios/estadisticas/', setProcesosDisc),
            cargar('reclutamiento', '/reclutamiento/estadisticas/', setReclutamiento),
            cargar('cobertura', '/puntos-venta/cobertura/', setCobertura),
        ]).finally(() => setCargando(false));
    }, []);

    if (cargando) return (
        <Layout>
            <div style={{ padding: 40, color: '#888', fontSize: 13 }}>Cargando estadísticas...</div>
        </Layout>
    );

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Dashboard</h1>
                    <p className="pagina-subtitulo">Resumen general de talento humano</p>
                </div>
            </div>

            {/* ===== COLABORADORES ===== */}
            <h2 className="dashboard-seccion-titulo">Colaboradores</h2>
            {errores.colaboradores && <SinDatos>No se pudo cargar este módulo.</SinDatos>}
            {colaboradores && (
                <>
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <span className="card-valor">{colaboradores.activos}</span>
                            <span className="card-label">Colaboradores activos</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{colaboradores.retirados}</span>
                            <span className="card-label">Retirados</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{colaboradores.puntos_de_venta}</span>
                            <span className="card-label">Puntos de venta con personal</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{colaboradores.total}</span>
                            <span className="card-label">Total histórico</span>
                        </div>
                    </div>

                    <div className="dashboard-fila">
                        <div className="dashboard-grafica grande">
                            <h3 className="grafica-titulo">Colaboradores por punto de venta</h3>
                            {colaboradores.por_punto_venta.length > 0 ? (
                                <ResponsiveContainer width="100%" height={Math.max(220, colaboradores.por_punto_venta.length * 26)}>
                                    <BarChart data={colaboradores.por_punto_venta} layout="vertical" margin={{ left: 10, right: 16 }} barCategoryGap={6}>
                                        <defs>
                                            <linearGradient id="gradPuntoVenta" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#3D6D47" />
                                                <stop offset="100%" stopColor="#6FBF7F" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="punto_venta" tick={{ fontSize: 10.5 }} width={90} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(79,139,91,0.08)' }}
                                            contentStyle={{ borderRadius: 8, border: '1px solid #E1DED4', fontSize: 12.5 }}
                                        />
                                        <Bar dataKey="cantidad" name="Colaboradores" fill="url(#gradPuntoVenta)" radius={[0, 6, 6, 0]} maxBarSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Aún no hay colaboradores con punto de venta asignado.</SinDatos>}
                        </div>

                        <div className="dashboard-grafica pequena">
                            <h3 className="grafica-titulo">Top cargos</h3>
                            {colaboradores.por_cargo.length > 0 ? (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie data={agruparCategoriasPequenas(colaboradores.por_cargo, 'cargo', 'cantidad')} dataKey="cantidad" nameKey="cargo"
                                            cx="50%" cy="50%" outerRadius={80} labelLine={false}
                                            label={({ percent }) => percent >= 0.06 ? `${(percent * 100).toFixed(0)}%` : ''}>
                                            {agruparCategoriasPequenas(colaboradores.por_cargo, 'cargo', 'cantidad').map((_, i) => <Cell key={i} fill={COLORES_TIPO[i % COLORES_TIPO.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v, n, p) => [v, p.payload.cargo]} />
                                        <Legend wrapperStyle={{ fontSize: 10.5 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Sin datos de cargos.</SinDatos>}
                        </div>
                    </div>
                </>
            )}

            {/* ===== INCAPACIDADES ===== */}
            <h2 className="dashboard-seccion-titulo">Incapacidades</h2>
            {errores.incapacidades && <SinDatos>No se pudo cargar este módulo.</SinDatos>}
            {incapacidades && (
                <>
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <span className="card-valor">{incapacidades.resumen.activas}</span>
                            <span className="card-label">Incapacidades activas</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{incapacidades.resumen.en_cobro}</span>
                            <span className="card-label">En cobro</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{incapacidades.resumen.dias_mes_actual}</span>
                            <span className="card-label">Días de ausentismo este mes</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{incapacidades.resumen.colaboradores_con_inc}</span>
                            <span className="card-label">Colaboradores con incapacidad activa</span>
                        </div>
                    </div>

                    <div className="dashboard-fila">
                        <div className="dashboard-grafica grande">
                            <h3 className="grafica-titulo">Tendencia mensual de incapacidades</h3>
                            {incapacidades.tendencia_mensual.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={incapacidades.tendencia_mensual}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="mes_label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="cantidad" name="Casos" stroke="#1A1A1A" strokeWidth={2} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="dias" name="Días" stroke="#ED7D31" strokeWidth={2} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Sin datos en los últimos 6 meses.</SinDatos>}
                        </div>

                        <div className="dashboard-grafica pequena">
                            <h3 className="grafica-titulo">Por tipo de incapacidad</h3>
                            {incapacidades.por_tipo.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={incapacidades.por_tipo} dataKey="cantidad" nameKey="tipo_label"
                                            cx="50%" cy="50%" outerRadius={80} label={({ tipo_label, percent }) => `${tipo_label} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                            {incapacidades.por_tipo.map((_, i) => <Cell key={i} fill={COLORES_TIPO[i % COLORES_TIPO.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v, n) => [v, n]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Aún no hay incapacidades registradas.</SinDatos>}
                        </div>
                    </div>

                    <div className="dashboard-fila">
                        <div className="dashboard-grafica mediana">
                            <h3 className="grafica-titulo">Días de ausentismo por responsable de pago</h3>
                            {incapacidades.por_responsable.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={incapacidades.por_responsable} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="responsable_label" tick={{ fontSize: 11 }} width={70} />
                                        <Tooltip />
                                        <Bar dataKey="dias_total" name="Días" radius={[0, 4, 4, 0]}>
                                            {incapacidades.por_responsable.map((item, i) => <Cell key={i} fill={COLORES_RESP[item.responsable_pago] || '#1A1A1A'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Sin datos.</SinDatos>}
                        </div>

                        <div className="dashboard-grafica mediana">
                            <h3 className="grafica-titulo">Distribución por estado</h3>
                            {incapacidades.por_estado.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={incapacidades.por_estado}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="estado_label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="cantidad" name="Casos" radius={[4, 4, 0, 0]}>
                                            {incapacidades.por_estado.map((item, i) => <Cell key={i} fill={COLORES_ESTADO[item.estado] || '#1A1A1A'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Sin datos.</SinDatos>}
                        </div>
                    </div>
                </>
            )}

            {/* ===== PROCESOS DISCIPLINARIOS ===== */}
            <h2 className="dashboard-seccion-titulo">Procesos Disciplinarios</h2>
            {errores.procesos && <SinDatos>No se pudo cargar este módulo.</SinDatos>}
            {procesosDisc && (
                <>
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <span className="card-valor">{procesosDisc.kpis.total}</span>
                            <span className="card-label">Procesos registrados</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{procesosDisc.kpis.activos}</span>
                            <span className="card-label">Casos activos</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{procesosDisc.estancados.length}</span>
                            <span className="card-label">Casos estancados</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{procesosDisc.reincidentes.length}</span>
                            <span className="card-label">Colaboradores reincidentes</span>
                        </div>
                    </div>

                    <div className="dashboard-fila">
                        <div className="dashboard-grafica grande">
                            <h3 className="grafica-titulo">Procesos por punto de venta</h3>
                            {procesosDisc.ranking_punto_venta.length > 0 ? (
                                <ResponsiveContainer width="100%" height={Math.max(220, procesosDisc.ranking_punto_venta.length * 22)}>
                                    <BarChart data={procesosDisc.ranking_punto_venta} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="punto_venta" tick={{ fontSize: 10.5 }} width={90} />
                                        <Tooltip />
                                        <Bar dataKey="cantidad" name="Procesos" fill="#A83E3E" radius={[0, 4, 4, 0]} maxBarSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Aún no hay procesos registrados.</SinDatos>}
                        </div>

                        <div className="dashboard-grafica pequena">
                            <h3 className="grafica-titulo">Por estado</h3>
                            {Object.keys(procesosDisc.distribucion_estado).length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={Object.entries(procesosDisc.distribucion_estado).map(([k, v]) => ({ estado: k, cantidad: v }))}
                                            dataKey="cantidad" nameKey="estado" cx="50%" cy="50%" outerRadius={80}
                                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}
                                        >
                                            {Object.keys(procesosDisc.distribucion_estado).map((k, i) => <Cell key={i} fill={COLOR_PD_ESTADO[k] || '#999'} />)}
                                        </Pie>
                                        <Tooltip formatter={(v, n, p) => [v, p.payload.estado]} />
                                        <Legend wrapperStyle={{ fontSize: 10.5 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Sin datos.</SinDatos>}
                        </div>
                    </div>
                </>
            )}

            {/* ===== RECLUTAMIENTO ===== */}
            <h2 className="dashboard-seccion-titulo">Reclutamiento</h2>
            {errores.reclutamiento && <SinDatos>No se pudo cargar este módulo.</SinDatos>}
            {reclutamiento && (
                <>
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <span className="card-valor">{reclutamiento.kpis.vacantes_abiertas}</span>
                            <span className="card-label">Vacantes abiertas</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{reclutamiento.kpis.total_candidatos}</span>
                            <span className="card-label">Candidatos en proceso</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{reclutamiento.kpis.contratados}</span>
                            <span className="card-label">Contratados</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{reclutamiento.vacantes_mas_antiguas.length}</span>
                            <span className="card-label">Vacantes con demora</span>
                        </div>
                    </div>

                    <div className="dashboard-fila">
                        <div className="dashboard-grafica mediana">
                            <h3 className="grafica-titulo">Candidatos por etapa del pipeline</h3>
                            {Object.keys(reclutamiento.candidatos_por_etapa).length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={Object.entries(reclutamiento.candidatos_por_etapa).map(([k, v]) => ({ etapa: k, cantidad: v }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="etapa" tick={{ fontSize: 9.5 }} interval={0} angle={-20} textAnchor="end" height={55} />
                                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="cantidad" name="Candidatos" fill="#2F6F5E" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Aún no hay candidatos postulados.</SinDatos>}
                        </div>

                        <div className="dashboard-grafica mediana">
                            <h3 className="grafica-titulo">Vacantes abiertas por punto de venta</h3>
                            {reclutamiento.vacantes_por_punto_venta.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={reclutamiento.vacantes_por_punto_venta}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="punto_venta" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={55} />
                                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="cantidad" name="Vacantes" fill="#B8752A" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>No hay vacantes abiertas actualmente.</SinDatos>}
                        </div>
                    </div>
                </>
            )}

            {/* ===== PUNTOS DE VENTA ===== */}
            <h2 className="dashboard-seccion-titulo">Puntos de Venta</h2>
            {errores.cobertura && <SinDatos>No se pudo cargar este módulo.</SinDatos>}
            {cobertura && (
                <>
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <span className="card-valor">{cobertura.kpis.total_puntos}</span>
                            <span className="card-label">Puntos de venta</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor">{cobertura.kpis.personal_actual_total}/{cobertura.kpis.personal_requerido_total}</span>
                            <span className="card-label">Personal actual / requerido</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor" style={{ color: cobertura.kpis.puntos_con_falta > 0 ? '#A83E3E' : '#1A1A1A' }}>{cobertura.kpis.puntos_con_falta}</span>
                            <span className="card-label">Puntos con falta de personal</span>
                        </div>
                        <div className="dashboard-card">
                            <span className="card-valor" style={{ color: cobertura.kpis.puntos_con_exceso > 0 ? '#B8752A' : '#1A1A1A' }}>{cobertura.kpis.puntos_con_exceso}</span>
                            <span className="card-label">Puntos con exceso</span>
                        </div>
                    </div>

                    <div className="dashboard-fila">
                        <div className="dashboard-grafica grande">
                            <h3 className="grafica-titulo">Puntos con mayor déficit de personal</h3>
                            {cobertura.puntos.filter(p => p.diferencia < 0).length > 0 ? (
                                <ResponsiveContainer width="100%" height={Math.max(200, cobertura.puntos.filter(p => p.diferencia < 0).length * 26)}>
                                    <BarChart
                                        data={cobertura.puntos.filter(p => p.diferencia < 0).slice(0, 12)}
                                        layout="vertical" margin={{ left: 10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10.5 }} width={90} />
                                        <Tooltip formatter={(v, n, p) => [`${p.payload.personal_actual} de ${p.payload.personal_requerido} requeridos`, 'Personal']} />
                                        <Bar dataKey="personal_actual" name="Personal actual" fill="#A83E3E" radius={[0, 6, 6, 0]} maxBarSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <SinDatos>Todos los puntos de venta tienen el personal completo. 🎉</SinDatos>}
                        </div>

                        <div className="dashboard-grafica pequena">
                            <h3 className="grafica-titulo">Colaboradores con punto no reconocido</h3>
                            {cobertura.colaboradores_sin_punto_valido.length > 0 ? (
                                <div style={{ fontSize: 12.5 }}>
                                    {cobertura.colaboradores_sin_punto_valido.map(c => (
                                        <div key={c.id_colaborador} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #E1DED4' }}>
                                            <span>{c.nombre}</span>
                                            <span style={{ color: '#B8752A', fontWeight: 600 }}>"{c.area}"</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <SinDatos>Todos los colaboradores tienen un punto de venta válido. ✓</SinDatos>}
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
}
