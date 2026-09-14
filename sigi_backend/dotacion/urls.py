"""
AUSENTRACK - Rutas de Dotación y EPP
"""
from django.urls import path
from . import views

urlpatterns = [
    # Catalogo de elementos
    path('elementos/',           views.ListarElementosView.as_view(),  name='listar_elementos_dotacion'),
    path('elementos/crear/',     views.CrearElementoView.as_view(),    name='crear_elemento_dotacion'),
    path('elementos/<int:pk>/',  views.DetalleElementoView.as_view(),  name='detalle_elemento_dotacion'),

    # Inventario
    path('inventario/',          views.ListarInventarioView.as_view(), name='listar_inventario_dotacion'),
    path('inventario/crear/',    views.CrearInventarioView.as_view(),  name='crear_inventario_dotacion'),
    path('inventario/<int:pk>/', views.DetalleInventarioView.as_view(), name='detalle_inventario_dotacion'),

    # Entregas
    path('entregas/',            views.ListarEntregasView.as_view(),   name='listar_entregas_dotacion'),
    path('entregas/crear/',      views.CrearEntregaView.as_view(),     name='crear_entrega_dotacion'),
    path('entregas/<int:pk>/',   views.DetalleEntregaView.as_view(),   name='detalle_entrega_dotacion'),

    # Matriz de riesgos (requisitos por cargo)
    path('requisitos/',          views.ListarRequisitosView.as_view(), name='listar_requisitos_dotacion'),
    path('requisitos/crear/',    views.CrearRequisitoView.as_view(),   name='crear_requisito_dotacion'),
    path('requisitos/<int:pk>/', views.DetalleRequisitoView.as_view(), name='detalle_requisito_dotacion'),

    # Pendientes y estadisticas
    path('pendientes/',          views.PendientesDotacionView.as_view(), name='pendientes_dotacion'),
    path('estadisticas/',        views.EstadisticasDotacionView.as_view(), name='estadisticas_dotacion'),
]
