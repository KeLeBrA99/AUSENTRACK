"""
AUSENTRACK - Rutas de Procesos Disciplinarios
"""
from django.urls import path
from . import views

urlpatterns = [
    path('',               views.ListarProcesosView.as_view(),          name='listar_procesos'),
    path('crear/',         views.CrearProcesoView.as_view(),            name='crear_proceso'),
    path('estadisticas/',  views.EstadisticasProcesosView.as_view(),    name='estadisticas_procesos'),
    path('exportar/',      views.ExportarProcesosExcelView.as_view(),   name='exportar_procesos'),
    path('importar/',      views.ImportarProcesosView.as_view(),        name='importar_procesos'),
    path('plantilla/',     views.DescargarPlantillaProcesosView.as_view(), name='plantilla_procesos'),
    path('<int:pk>/',      views.DetalleProcesoView.as_view(),          name='detalle_proceso'),
]
