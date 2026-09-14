"""
AUSENTRACK - Vistas de Retiros (offboarding)
"""
from django.db.models import Q
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import Retiro
from .serializers import RetiroSerializer, RetiroListSerializer


class RetirosPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class ListarRetirosView(generics.ListAPIView):
    """
    GET /api/retiros/
    Filtros: ?tipo_retiro=&estado_liquidacion=&search=
    """
    serializer_class   = RetiroListSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]
    pagination_class   = RetirosPagination

    def get_queryset(self):
        qs = Retiro.objects.select_related('colaborador', 'colaborador__punto_venta')
        tipo   = self.request.query_params.get('tipo_retiro')
        estado = self.request.query_params.get('estado_liquidacion')
        search = self.request.query_params.get('search')

        if tipo:
            qs = qs.filter(tipo_retiro=tipo)
        if estado:
            qs = qs.filter(estado_liquidacion=estado)
        if search:
            qs = qs.filter(Q(colaborador__nombre__icontains=search) | Q(colaborador__cedula__icontains=search))
        return qs


class CrearRetiroView(generics.CreateAPIView):
    """
    POST /api/retiros/crear/
    Al crear el registro de retiro, se marca automaticamente al colaborador
    como retirado (activo=False), sincronizando ambos sin doble digitacion.
    """
    serializer_class   = RetiroSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        retiro = serializer.save()
        retiro.colaborador.retirar(fecha=retiro.fecha_retiro, motivo=retiro.motivo or retiro.get_tipo_retiro_display())
        registrar_auditoria(
            self.request.user, 'CREATE', 'retiro', retiro.id,
            detalle=f'Retiro registrado: {retiro.colaborador.nombre} ({retiro.get_tipo_retiro_display()})',
            request=self.request,
        )


class DetalleRetiroView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = Retiro.objects.select_related('colaborador', 'colaborador__punto_venta')
    serializer_class   = RetiroSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        retiro = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'retiro', retiro.id,
            detalle=f'Retiro actualizado: {retiro.colaborador.nombre}', request=self.request,
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'retiro', instance.id,
            detalle=f'Retiro eliminado: {instance.colaborador.nombre}', request=self.request,
        )
        instance.delete()


class EstadisticasRetirosView(APIView):
    """
    GET /api/retiros/estadisticas/
    Indicadores de rotacion: retiros por tipo, por punto de venta, pendientes
    de liquidacion, y checklist de entrega incompleto.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        from colaboradores.models import Colaborador
        from datetime import date

        qs = Retiro.objects.select_related('colaborador', 'colaborador__punto_venta')
        hoy = date.today()
        inicio_anio = date(hoy.year, 1, 1)

        retiros_este_anio = qs.filter(fecha_retiro__gte=inicio_anio)
        total_activos = Colaborador.objects.filter(activo=True).count()
        total_historico = Colaborador.objects.count()

        # Tasa de rotacion simple: retiros del año / promedio de personal (activos + retirados este año)
        tasa_rotacion = round((retiros_este_anio.count() / total_historico) * 100, 1) if total_historico else 0

        dist_tipo = {}
        for row in retiros_este_anio.values('tipo_retiro'):
            dist_tipo[row['tipo_retiro']] = dist_tipo.get(row['tipo_retiro'], 0) + 1

        por_punto = {}
        for r in retiros_este_anio:
            key = r.colaborador.punto_venta.nombre if r.colaborador.punto_venta_id else (r.colaborador.area or 'Sin especificar')
            por_punto[key] = por_punto.get(key, 0) + 1
        ranking_puntos = sorted(por_punto.items(), key=lambda x: x[1], reverse=True)[:10]

        pendientes_liquidacion = [
            {'id': r.id, 'colaborador': r.colaborador.nombre, 'fecha_retiro': r.fecha_retiro.isoformat()}
            for r in qs.filter(estado_liquidacion='PENDIENTE').order_by('fecha_retiro')[:10]
        ]

        checklist_incompleto = [
            {'id': r.id, 'colaborador': r.colaborador.nombre, 'fecha_retiro': r.fecha_retiro.isoformat()}
            for r in qs if not r.checklist_completo()
        ][:10]

        return Response({
            'kpis': {
                'retiros_este_anio': retiros_este_anio.count(),
                'tasa_rotacion_pct': tasa_rotacion,
                'pendientes_liquidacion': qs.filter(estado_liquidacion='PENDIENTE').count(),
                'colaboradores_activos': total_activos,
            },
            'distribucion_tipo': dist_tipo,
            'ranking_punto_venta': [{'punto_venta': k, 'cantidad': v} for k, v in ranking_puntos],
            'pendientes_liquidacion': pendientes_liquidacion,
            'checklist_incompleto': checklist_incompleto,
        })
