"""
AUSENTRACK - Vistas de Dotación y EPP (SST)
"""
from datetime import date
from dateutil.relativedelta import relativedelta
from django.db.models import Q
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import ElementoDotacion, InventarioElemento, EntregaDotacion, RequisitoElemento
from .serializers import (
    ElementoDotacionSerializer, InventarioElementoSerializer,
    EntregaDotacionSerializer, RequisitoElementoSerializer,
)


# ── CATALOGO DE ELEMENTOS ─────────────────────────────────────────────────────

class ListarElementosView(generics.ListAPIView):
    serializer_class   = ElementoDotacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs = ElementoDotacion.objects.prefetch_related('inventario')
        categoria = self.request.query_params.get('categoria')
        activo = self.request.query_params.get('activo')
        if categoria:
            qs = qs.filter(categoria=categoria)
        if activo is not None:
            qs = qs.filter(activo=activo.lower() == 'true')
        return qs


class CrearElementoView(generics.CreateAPIView):
    serializer_class   = ElementoDotacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        elemento = serializer.save()
        registrar_auditoria(self.request.user, 'CREATE', 'elemento_dotacion', elemento.id,
                             detalle=f'Elemento creado: {elemento.nombre}', request=self.request)


class DetalleElementoView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = ElementoDotacion.objects.all()
    serializer_class   = ElementoDotacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_destroy(self, instance):
        instance.activo = False
        instance.save(update_fields=['activo'])


# ── INVENTARIO ────────────────────────────────────────────────────────────────

class ListarInventarioView(generics.ListAPIView):
    serializer_class   = InventarioElementoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs = InventarioElemento.objects.select_related('elemento')
        bajo_stock = self.request.query_params.get('bajo_stock')
        if bajo_stock == 'true':
            qs = [i for i in qs if i.cantidad_disponible <= i.stock_minimo]
        return qs


class CrearInventarioView(generics.CreateAPIView):
    serializer_class   = InventarioElementoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]


class DetalleInventarioView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = InventarioElemento.objects.select_related('elemento')
    serializer_class   = InventarioElementoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]


# ── ENTREGAS ──────────────────────────────────────────────────────────────────

class ListarEntregasView(generics.ListAPIView):
    serializer_class   = EntregaDotacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs = EntregaDotacion.objects.select_related('colaborador').prefetch_related('detalles__elemento')
        colaborador = self.request.query_params.get('colaborador')
        tipo = self.request.query_params.get('tipo_entrega')
        search = self.request.query_params.get('search')
        if colaborador:
            qs = qs.filter(colaborador_id=colaborador)
        if tipo:
            qs = qs.filter(tipo_entrega=tipo)
        if search:
            qs = qs.filter(Q(colaborador__nombre__icontains=search) | Q(colaborador__cedula__icontains=search))
        return qs


class CrearEntregaView(generics.CreateAPIView):
    serializer_class   = EntregaDotacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        entrega = serializer.save()
        registrar_auditoria(self.request.user, 'CREATE', 'entrega_dotacion', entrega.id,
                             detalle=f'Entrega registrada: {entrega.colaborador.nombre}', request=self.request)


class DetalleEntregaView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = EntregaDotacion.objects.select_related('colaborador').prefetch_related('detalles__elemento')
    serializer_class   = EntregaDotacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]


# ── MATRIZ DE RIESGOS (REQUISITOS POR CARGO) ─────────────────────────────────

class ListarRequisitosView(generics.ListAPIView):
    serializer_class   = RequisitoElementoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs = RequisitoElemento.objects.select_related('elemento', 'punto_venta')
        cargo = self.request.query_params.get('cargo')
        if cargo:
            qs = qs.filter(cargo__icontains=cargo)
        return qs


class CrearRequisitoView(generics.CreateAPIView):
    serializer_class   = RequisitoElementoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        req = serializer.save()
        registrar_auditoria(self.request.user, 'CREATE', 'requisito_elemento', req.id,
                             detalle=f'Requisito creado: {req.cargo} -> {req.elemento.nombre}', request=self.request)


class DetalleRequisitoView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = RequisitoElemento.objects.select_related('elemento', 'punto_venta')
    serializer_class   = RequisitoElementoSerializer
    permission_classes = [IsAuthenticated, EsAdmin]


# ── PENDIENTES (matriz vs. entregas reales) Y ESTADISTICAS ──────────────────

class PendientesDotacionView(APIView):
    """
    GET /api/dotacion/pendientes/
    Compara, para cada colaborador activo, los elementos que su cargo (y
    punto de venta) requieren segun la matriz de riesgos, contra lo que
    realmente se le ha entregado dentro de la vigencia (vida_util_meses).
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        from colaboradores.models import Colaborador

        requisitos = list(RequisitoElemento.objects.select_related('elemento', 'punto_venta'))
        if not requisitos:
            return Response({'pendientes': [], 'total_colaboradores_revisados': 0})

        colaboradores = Colaborador.objects.filter(activo=True).select_related('punto_venta')
        hoy = date.today()

        # Se cargan TODAS las entregas de una sola vez y se agrupan por
        # colaborador en memoria. Antes se hacia una consulta por colaborador
        # (243 consultas con 241 activos); ahora son 2 en total.
        entregas_por_colaborador = {}
        for entrega in EntregaDotacion.objects.prefetch_related('detalles'):
            entregas_por_colaborador.setdefault(entrega.colaborador_id, []).append(entrega)

        pendientes = []
        for c in colaboradores:
            reqs_aplicables = [
                r for r in requisitos
                if r.cargo.strip().lower() == (c.cargo or '').strip().lower()
                and (r.punto_venta_id is None or r.punto_venta_id == c.punto_venta_id)
            ]
            if not reqs_aplicables:
                continue

            entregas_colab = entregas_por_colaborador.get(c.id_colaborador, [])

            faltantes = []
            for req in reqs_aplicables:
                limite = None
                if req.elemento.vida_util_meses:
                    limite = hoy - relativedelta(months=req.elemento.vida_util_meses)

                tiene_vigente = False
                for entrega in entregas_colab:
                    if limite and entrega.fecha_entrega < limite:
                        continue
                    if any(d.elemento_id == req.elemento_id for d in entrega.detalles.all()):
                        tiene_vigente = True
                        break

                if not tiene_vigente:
                    faltantes.append({'elemento': req.elemento.nombre, 'obligatorio': req.obligatorio})

            if faltantes:
                pendientes.append({
                    'id_colaborador': c.id_colaborador,
                    'nombre': c.nombre,
                    'cargo': c.cargo,
                    'punto_venta': c.punto_venta.nombre if c.punto_venta_id else c.area,
                    'faltantes': faltantes,
                })

        return Response({'pendientes': pendientes, 'total_colaboradores_revisados': colaboradores.count()})


class EstadisticasDotacionView(APIView):
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        hoy = date.today()
        inicio_mes = hoy.replace(day=1)

        inventario = InventarioElemento.objects.select_related('elemento')
        bajo_stock = [i for i in inventario if i.cantidad_disponible <= i.stock_minimo]

        entregas_mes = EntregaDotacion.objects.filter(fecha_entrega__gte=inicio_mes).count()
        sin_firma = EntregaDotacion.objects.filter(firma_recibido=False).count()

        return Response({
            'kpis': {
                'elementos_bajo_stock': len(bajo_stock),
                'entregas_este_mes': entregas_mes,
                'entregas_sin_firma': sin_firma,
                'elementos_catalogados': ElementoDotacion.objects.filter(activo=True).count(),
            },
            'bajo_stock': [
                {'elemento': i.elemento.nombre, 'talla': i.talla, 'cantidad_disponible': i.cantidad_disponible, 'stock_minimo': i.stock_minimo}
                for i in bajo_stock[:10]
            ],
        })
