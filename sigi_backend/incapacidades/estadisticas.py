"""
AUSENTRACK - Endpoints de estadisticas para el dashboard
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from datetime import date, timedelta

from authentication.permissions import EsNomina
from .models import Incapacidad


class EstadisticasDashboardView(APIView):
    """
    GET /api/incapacidades/estadisticas/
    Retorna todas las estadisticas necesarias para el dashboard.
    """
    permission_classes = [IsAuthenticated, EsNomina]

    def get(self, request):
        hoy            = date.today()
        inicio_mes     = hoy.replace(day=1)
        hace_6_meses   = (hoy - timedelta(days=180)).replace(day=1)

        # Tarjetas resumen
        total_activas  = Incapacidad.objects.filter(estado='ACTIVA').count()
        total_en_cobro = Incapacidad.objects.filter(estado='EN_COBRO').count()
        dias_mes_actual = Incapacidad.objects.filter(
            fecha_inicio__gte=inicio_mes
        ).aggregate(total=Sum('dias'))['total'] or 0

        total_colaboradores_con_inc = Incapacidad.objects.filter(
            estado__in=['ACTIVA', 'EN_COBRO']
        ).values('colaborador').distinct().count()

        # Incapacidades por tipo
        por_tipo = list(
            Incapacidad.objects.values('tipo').annotate(
                cantidad=Count('id_incapacidad'),
                dias_total=Sum('dias')
            ).order_by('-cantidad')
        )
        tipo_labels = {
            'ENFERMEDAD_GENERAL': 'Enf. General',
            'ACCIDENTE_LABORAL':  'Acc. Laboral',
            'ENFERMEDAD_LABORAL': 'Enf. Laboral',
            'MATERNIDAD':         'Maternidad',
            'PATERNIDAD':         'Paternidad',
        }
        for item in por_tipo:
            item['tipo_label'] = tipo_labels.get(item['tipo'], item['tipo'])

        # Incapacidades por estado
        por_estado = list(
            Incapacidad.objects.values('estado').annotate(
                cantidad=Count('id_incapacidad')
            ).order_by('-cantidad')
        )
        estado_labels = {
            'ACTIVA': 'Activa', 'EN_COBRO': 'En Cobro',
            'PAGADA': 'Pagada', 'CERRADA': 'Cerrada'
        }
        for item in por_estado:
            item['estado_label'] = estado_labels.get(item['estado'], item['estado'])

        # Tendencia mensual (ultimos 6 meses)
        tendencia = list(
            Incapacidad.objects.filter(
                fecha_inicio__gte=hace_6_meses
            ).annotate(
                mes=TruncMonth('fecha_inicio')
            ).values('mes').annotate(
                cantidad=Count('id_incapacidad'),
                dias=Sum('dias')
            ).order_by('mes')
        )
        for item in tendencia:
            item['mes_label'] = item['mes'].strftime('%b %Y')
            item['mes'] = item['mes'].isoformat()

        # Por responsable de pago
        por_responsable = list(
            Incapacidad.objects.values('responsable_pago').annotate(
                cantidad=Count('id_incapacidad'),
                dias_total=Sum('dias')
            )
        )
        resp_labels = {'EMPLEADOR': 'Empleador', 'EPS': 'EPS', 'ARL': 'ARL'}
        for item in por_responsable:
            item['responsable_label'] = resp_labels.get(item['responsable_pago'], item['responsable_pago'])

        # Top 5 colaboradores con mas dias
        top_colaboradores = list(
            Incapacidad.objects.values(
                'colaborador__nombre', 'colaborador__area'
            ).annotate(
                total_dias=Sum('dias'),
                total_inc=Count('id_incapacidad')
            ).order_by('-total_dias')[:5]
        )

        return Response({
            'resumen': {
                'activas':                  total_activas,
                'en_cobro':                 total_en_cobro,
                'dias_mes_actual':          dias_mes_actual,
                'colaboradores_con_inc':    total_colaboradores_con_inc,
            },
            'por_tipo':         por_tipo,
            'por_estado':       por_estado,
            'tendencia_mensual': tendencia,
            'por_responsable':  por_responsable,
            'top_colaboradores': top_colaboradores,
        })