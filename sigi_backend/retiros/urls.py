"""
AUSENTRACK - Rutas de Retiros
"""
from django.urls import path
from . import views

urlpatterns = [
    path('',               views.ListarRetirosView.as_view(),       name='listar_retiros'),
    path('crear/',         views.CrearRetiroView.as_view(),         name='crear_retiro'),
    path('estadisticas/',  views.EstadisticasRetirosView.as_view(), name='estadisticas_retiros'),
    path('<int:pk>/',      views.DetalleRetiroView.as_view(),       name='detalle_retiro'),
]
