"""
AUSENTRACK - Rutas de Puntos de Venta
"""
from django.urls import path
from . import views

urlpatterns = [
    path('',              views.ListarPuntosVentaView.as_view(),            name='listar_puntos_venta'),
    path('crear/',        views.CrearPuntoVentaView.as_view(),              name='crear_punto_venta'),
    path('cobertura/',    views.CoberturaPuntosVentaView.as_view(),         name='cobertura_puntos_venta'),
    path('plantilla/',    views.DescargarPlantillaPuntosVentaView.as_view(), name='plantilla_puntos_venta'),
    path('importar/',     views.ImportarPuntosVentaView.as_view(),          name='importar_puntos_venta'),
    path('<int:pk>/',     views.DetallePuntoVentaView.as_view(),            name='detalle_punto_venta'),
]
