"""
AUSENTRACK - Rutas de Evaluaciones de Desempeño
"""
from django.urls import path
from . import views

urlpatterns = [
    path('',                     views.ListarEvaluacionesView.as_view(),      name='listar_evaluaciones'),
    path('crear/',               views.CrearEvaluacionView.as_view(),         name='crear_evaluacion'),
    path('crear-invitacion/',    views.CrearInvitacionEvaluacionView.as_view(), name='crear_invitacion_evaluacion'),
    path('publica/<uuid:token>/', views.EvaluacionPublicaView.as_view(),      name='evaluacion_publica'),
    path('criterios-estandar/',  views.CriteriosEstandarView.as_view(),       name='criterios_estandar'),
    path('estadisticas/',        views.EstadisticasEvaluacionesView.as_view(), name='estadisticas_evaluaciones'),
    path('<int:pk>/',            views.DetalleEvaluacionView.as_view(),       name='detalle_evaluacion'),
]
