"""
AUSENTRACK - Rutas de Capacitaciones e Inducción
"""
from django.urls import path
from . import views

urlpatterns = [
    path('',                          views.ListarCapacitacionesView.as_view(),     name='listar_capacitaciones'),
    path('crear/',                    views.CrearCapacitacionView.as_view(),        name='crear_capacitacion'),
    path('estadisticas/',             views.EstadisticasCapacitacionesView.as_view(), name='estadisticas_capacitaciones'),
    path('<int:pk>/',                 views.DetalleCapacitacionView.as_view(),      name='detalle_capacitacion'),
    path('<int:pk>/inscribir/',       views.InscribirParticipanteView.as_view(),    name='inscribir_participante'),
    path('participantes/<int:pk>/',   views.ActualizarParticipanteView.as_view(),   name='actualizar_participante'),
    path('participantes/<int:pk>/eliminar/', views.EliminarParticipanteView.as_view(), name='eliminar_participante'),
]
