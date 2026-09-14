"""
AUSENTRACK - Rutas de Reclutamiento y Selección
"""
from django.urls import path
from . import views

urlpatterns = [
    path('vacantes/',                views.ListarVacantesView.as_view(),          name='listar_vacantes'),
    path('vacantes/crear/',          views.CrearVacanteView.as_view(),            name='crear_vacante'),
    path('vacantes/<int:pk>/',       views.DetalleVacanteView.as_view(),          name='detalle_vacante'),

    path('candidatos/',              views.ListarCandidatosView.as_view(),        name='listar_candidatos'),
    path('candidatos/crear/',        views.CrearCandidatoView.as_view(),          name='crear_candidato'),
    path('candidatos/<int:pk>/',     views.DetalleCandidatoView.as_view(),        name='detalle_candidato'),

    path('estadisticas/',            views.EstadisticasReclutamientoView.as_view(), name='estadisticas_reclutamiento'),
]
