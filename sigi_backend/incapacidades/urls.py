"""
AUSENTRACK - URLs de incapacidades
"""

from django.urls import path
from . import views
from .estadisticas import EstadisticasDashboardView

urlpatterns = [
    path('',                                views.ListarIncapacidadesView.as_view(),   name='listar_incapacidades'),
    path('crear/',                          views.CrearIncapacidadView.as_view(),       name='crear_incapacidad'),
    path('alertas/',                        views.AlertasView.as_view(),                name='alertas'),
    path('reporte/',                        views.ReporteAusentismoView.as_view(),      name='reporte_ausentismo'),
    path('estadisticas/',                   EstadisticasDashboardView.as_view(),        name='estadisticas_dashboard'),
    path('<int:id_incapacidad>/',           views.DetalleIncapacidadView.as_view(),     name='detalle_incapacidad'),
    path('<int:id_incapacidad>/estado/',    views.CambiarEstadoView.as_view(),          name='cambiar_estado'),
    path('<int:id_incapacidad>/prorroga/',  views.CrearProrrogaView.as_view(),          name='crear_prorroga'),
    path('<int:id_incapacidad>/prorrogas/', views.HistorialProrrogasView.as_view(),     name='historial_prorrogas'),
    path('<int:id_incapacidad>/documento/', views.SubirDocumentoView.as_view(),         name='documento_incapacidad'),
    path('historial/<int:id_colaborador>/', views.HistorialColaboradorView.as_view(),   name='historial_colaborador'),
]
