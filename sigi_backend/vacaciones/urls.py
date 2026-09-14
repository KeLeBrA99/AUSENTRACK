"""
AUSENTRACK - Rutas de Vacaciones
"""
from django.urls import path
from . import views

urlpatterns = [
    path('',                 views.ListarSolicitudesView.as_view(),   name='listar_solicitudes_vacaciones'),
    path('crear/',           views.CrearSolicitudView.as_view(),      name='crear_solicitud_vacaciones'),
    path('saldos/',          views.SaldosGeneralesView.as_view(),     name='saldos_vacaciones'),
    path('estadisticas/',    views.EstadisticasVacacionesView.as_view(), name='estadisticas_vacaciones'),
    path('saldo/<int:id_colaborador>/', views.SaldoColaboradorView.as_view(), name='saldo_colaborador_vacaciones'),
    path('<int:pk>/',        views.DetalleSolicitudView.as_view(),    name='detalle_solicitud_vacaciones'),
    path('<int:pk>/aprobar/',  views.AprobarSolicitudView.as_view(),  name='aprobar_solicitud_vacaciones'),
    path('<int:pk>/rechazar/', views.RechazarSolicitudView.as_view(), name='rechazar_solicitud_vacaciones'),
    path('<int:pk>/cancelar/', views.CancelarSolicitudView.as_view(), name='cancelar_solicitud_vacaciones'),
    path('<int:pk>/disfrutada/', views.MarcarDisfrutadaView.as_view(), name='disfrutada_solicitud_vacaciones'),
    path('webhook-jotform/', views.WebhookJotformVacacionesView.as_view(), name='webhook_jotform_vacaciones'),
]
