"""
AUSENTRACK - URLs de colaboradores
"""

from django.urls import path
from . import views

urlpatterns = [
    # Empresas
    path('empresas/',                   views.ListarEmpresasView.as_view(),        name='listar_empresas'),
    # Entidades
    path('entidades/',                  views.ListarEntidadesView.as_view(),       name='listar_entidades'),
    path('entidades/crear/',            views.CrearEntidadView.as_view(),          name='crear_entidad'),
    path('entidades/<int:id_entidad>/', views.DetalleEntidadView.as_view(),        name='detalle_entidad'),
    # Colaboradores
    path('',                            views.ListarColaboradoresView.as_view(),   name='listar_colaboradores'),
    path('crear/',                      views.CrearColaboradorView.as_view(),      name='crear_colaborador'),
    path('importar/',                   views.ImportarColaboradoresView.as_view(), name='importar_colaboradores'),
    path('plantilla/',                  views.DescargarPlantillaView.as_view(),    name='plantilla_colaboradores'),
    path('buscar/',                     views.BuscarColaboradorView.as_view(),     name='buscar_colaborador'),
    path('estadisticas/',               views.EstadisticasColaboradoresView.as_view(), name='estadisticas_colaboradores'),
    path('<int:id_colaborador>/retirar/',   views.RetirarColaboradorView.as_view(),   name='retirar_colaborador'),
    path('<int:id_colaborador>/reactivar/', views.ReactivarColaboradorView.as_view(), name='reactivar_colaborador'),
    path('<int:id_colaborador>/',       views.DetalleColaboradorView.as_view(),    name='detalle_colaborador'),
]