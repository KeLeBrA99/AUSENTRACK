"""
AUSENTRACK - Rutas de Contratos
"""
from django.urls import path
from . import views

urlpatterns = [
    path('',                views.ListarContratosView.as_view(),        name='listar_contratos'),
    path('crear/',          views.CrearContratoView.as_view(),          name='crear_contrato'),
    path('estadisticas/',   views.EstadisticasContratosView.as_view(),  name='estadisticas_contratos'),
    path('<int:pk>/',       views.DetalleContratoView.as_view(),        name='detalle_contrato'),
    path('<int:pk>/renovar/',  views.RenovarContratoView.as_view(),     name='renovar_contrato'),
    path('<int:pk>/terminar/', views.TerminarContratoView.as_view(),    name='terminar_contrato'),
    path('<int:pk>/pdf/',      views.GenerarPdfContratoView.as_view(),  name='pdf_contrato'),
]
