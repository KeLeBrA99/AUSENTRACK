/**
 * AUSENTRACK - Dashboard principal con graficas
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

const COLORES_TIPO = ['#1F3864', '#2E75B6', '#4BACC6', '#70AD47', '#FFC000'];
const COLORES_ESTADO = {
    ACTIVA: '#70AD47', EN_COBRO: '#FFC000', PAGADA: '#4BACC6', CERRADA: '#A5A5A5'
};
const COLORES_RESP = { EMPLEADOR: '#1F3864', EPS: '#2E75B6', ARL: '#ED7D31' };

export default function Dashboard() {
    const [datos, setDatos]       = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        api.get('/incapacidades/estadisticas/')
            .then((res) => setDatos(res.data))
            .catch(() => {})
            .finally(() => setCargando(false));
    }, []);

    if (cargando) return (
        <Layout>
            <div style={{ padding: 40, color: '#888', fontSize: 13 }}>Cargando estadisticas...</div>
        </Layout>
    );

    if (!datos) return (
        <Layout>
            <div style={{ padding: 40, color: '#888', fontSize: 13 }}>No hay datos disponibles.</div>
        </Layout>
    );

    const { resumen, por_tipo, por_estado, tendencia_mensual, por_responsable, top_colaboradores } = datos;

    return (
        <Layout>
            <div className="pagina-header">
                <div>
                    <h1 className="pagina-titulo">Dashboard</h1>
                    <p className="pagina-subtitulo">Resumen general del sistema de ausentismo</p>
                </div>
            </div>

            {/* Tarjetas resumen */}
            <div className="dashboard-cards">
                <div className="dashboard-card">
                    <span className="card-valor">{resumen.activas}</span>
                    <span className="card-label">Incapacidades activas</span>
                </div>
                <div className="dashboard-card">
                    <span className="card-valor">{resumen.en_cobro}</span>
                    <span className="card-label">En cobro</span>
                </div>
                <div className="dashboard-card">
                    <span className="card-valor">{resumen.dias_mes_actual}</span>
                    <span className="card-label">Dias de ausentismo este mes</span>
                </div>
                <div className="dashboard-card">
                    <span className="card-valor">{resumen.colaboradores_con_inc}</span>
                    <span className="card-label">Colaboradores con incapacidad activa</span>
                </div>
            </div>

            {/* Fila 1: Tendencia + Tipos */}
            <div className="dashboard-fila">
                <div className="dashboard-grafica grande">
                    <h3 className="grafica-titulo">Tendencia mensual de incapacidades</h3>
                    {tendencia_mensual.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={tendencia_mensual}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="mes_label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="cantidad" name="Casos" stroke="#1F3864" strokeWidth={2} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="dias" name="Dias" stroke="#ED7D31" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <p className="sin-datos">Sin datos en los ultimos 6 meses</p>}
                </div>

                <div className="dashboard-grafica pequena">
                    <h3 className="grafica-titulo">Por tipo de incapacidad</h3>
                    {por_tipo.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={por_tipo} dataKey="cantidad" nameKey="tipo_label"
                                    cx="50%" cy="50%" outerRadius={80} label={({ tipo_label, percent }) =>
                                        `${tipo_label} ${(percent * 100).toFixed(0)}%`
                                    } labelLine={false}>
                                    {por_tipo.map((_, i) => (
                                        <Cell key={i} fill={COLORES_TIPO[i % COLORES_TIPO.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v, n) => [v, n]} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="sin-datos">Sin datos</p>}
                </div>
            </div>

            {/* Fila 2: Por responsable + Estados */}
            <div className="dashboard-fila">
                <div className="dashboard-grafica mediana">
                    <h3 className="grafica-titulo">Dias de ausentismo por responsable de pago</h3>
                    {por_responsable.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={por_responsable} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="responsable_label" tick={{ fontSize: 11 }} width={70} />
                                <Tooltip />
                                <Bar dataKey="dias_total" name="Dias" radius={[0, 4, 4, 0]}>
                                    {por_responsable.map((item, i) => (
                                        <Cell key={i} fill={COLORES_RESP[item.responsable_pago] || '#1F3864'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="sin-datos">Sin datos</p>}
                </div>

                <div className="dashboard-grafica mediana">
                    <h3 className="grafica-titulo">Distribucion por estado</h3>
                    {por_estado.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={por_estado}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="estado_label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="cantidad" name="Casos" radius={[4, 4, 0, 0]}>
                                    {por_estado.map((item, i) => (
                                        <Cell key={i} fill={COLORES_ESTADO[item.estado] || '#1F3864'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="sin-datos">Sin datos</p>}
                </div>
            </div>

            {/* Top colaboradores */}
            {top_colaboradores.length > 0 && (
                <div className="dashboard-grafica grande" style={{ marginTop: 0 }}>
                    <h3 className="grafica-titulo">Top 5 colaboradores con mas dias de ausentismo</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={top_colaboradores}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="colaborador__nombre" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v, n) => [v, n]} />
                            <Bar dataKey="total_dias" name="Total dias" fill="#1F3864" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Layout>
    );
}