"""
AUSENTRACK - Vistas de Evaluaciones de Desempeño
"""
import uuid
from django.db.models import Q, Avg
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import EvaluacionDesempeno, CRITERIOS_ESTANDAR
from .serializers import (
    EvaluacionDesempenoSerializer, EvaluacionListSerializer,
    CrearInvitacionSerializer, EvaluacionPublicaLecturaSerializer, EvaluacionPublicaEnvioSerializer,
)


class CriteriosEstandarView(APIView):
    """
    GET /api/evaluaciones/criterios-estandar/
    Lista de criterios sugeridos para armar el formulario en el frontend.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        return Response({'criterios': CRITERIOS_ESTANDAR})


class ListarEvaluacionesView(generics.ListAPIView):
    """
    GET /api/evaluaciones/
    Filtros: ?colaborador=&periodo=&estado=&tipo_evaluacion=&search=
    """
    serializer_class   = EvaluacionListSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs = EvaluacionDesempeno.objects.select_related('colaborador')

        colaborador = self.request.query_params.get('colaborador')
        periodo     = self.request.query_params.get('periodo')
        estado      = self.request.query_params.get('estado')
        tipo        = self.request.query_params.get('tipo_evaluacion')
        search      = self.request.query_params.get('search')

        if colaborador:
            qs = qs.filter(colaborador_id=colaborador)
        if periodo:
            qs = qs.filter(periodo__iexact=periodo)
        if estado:
            qs = qs.filter(estado=estado)
        if tipo:
            qs = qs.filter(tipo_evaluacion=tipo)
        if search:
            qs = qs.filter(Q(colaborador__nombre__icontains=search) | Q(colaborador__cedula__icontains=search))
        return qs


class CrearEvaluacionView(generics.CreateAPIView):
    serializer_class   = EvaluacionDesempenoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        ev = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'evaluacion_desempeno', ev.id,
            detalle=f'Evaluación creada: {ev.colaborador.nombre} ({ev.periodo}) -> {ev.puntaje_final}',
            request=self.request,
        )


class DetalleEvaluacionView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = EvaluacionDesempeno.objects.select_related('colaborador')
    serializer_class   = EvaluacionDesempenoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        ev = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'evaluacion_desempeno', ev.id,
            detalle=f'Evaluación actualizada: {ev.colaborador.nombre} ({ev.periodo}) -> {ev.estado}',
            request=self.request,
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'evaluacion_desempeno', instance.id,
            detalle=f'Evaluación eliminada: {instance.colaborador.nombre}', request=self.request,
        )
        instance.delete()


# ── ESTADISTICAS ─────────────────────────────────────────────────────────────

class EstadisticasEvaluacionesView(APIView):
    """
    GET /api/evaluaciones/estadisticas/
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        from colaboradores.models import Colaborador

        qs = EvaluacionDesempeno.objects.select_related('colaborador').exclude(puntaje_final__isnull=True)
        total_evaluados = qs.values('colaborador').distinct().count()
        total_activos   = Colaborador.objects.filter(activo=True).count()

        promedio_general = qs.aggregate(p=Avg('puntaje_final'))['p']

        # Top y bottom 5 por puntaje mas reciente de cada colaborador
        ultimas = {}
        for ev in qs.order_by('colaborador_id', '-fecha_evaluacion'):
            if ev.colaborador_id not in ultimas:
                ultimas[ev.colaborador_id] = ev
        lista = sorted(ultimas.values(), key=lambda e: e.puntaje_final, reverse=True)

        top5 = [{'colaborador': e.colaborador.nombre, 'cargo': e.colaborador.cargo, 'puntaje': float(e.puntaje_final)} for e in lista[:5]]
        bottom5 = [{'colaborador': e.colaborador.nombre, 'cargo': e.colaborador.cargo, 'puntaje': float(e.puntaje_final)} for e in lista[-5:][::-1]] if len(lista) > 5 else []

        # Distribucion por rango de puntaje
        rangos = {'1-2 (Bajo)': 0, '2-3 (Regular)': 0, '3-4 (Bueno)': 0, '4-5 (Excelente)': 0}
        for e in lista:
            p = float(e.puntaje_final)
            if p < 2: rangos['1-2 (Bajo)'] += 1
            elif p < 3: rangos['2-3 (Regular)'] += 1
            elif p < 4: rangos['3-4 (Bueno)'] += 1
            else: rangos['4-5 (Excelente)'] += 1

        # Promedio por criterio (a lo largo de todas las evaluaciones)
        promedios_criterio = {}
        conteos_criterio = {}
        for ev in qs:
            for c in ev.criterios:
                nombre = c.get('criterio')
                puntaje = c.get('puntaje')
                if nombre is None or puntaje is None:
                    continue
                promedios_criterio[nombre] = promedios_criterio.get(nombre, 0) + puntaje
                conteos_criterio[nombre] = conteos_criterio.get(nombre, 0) + 1
        promedio_por_criterio = [
            {'criterio': k, 'promedio': round(v / conteos_criterio[k], 2)}
            for k, v in promedios_criterio.items()
        ]

        return Response({
            'kpis': {
                'total_evaluaciones': qs.count(),
                'colaboradores_evaluados': total_evaluados,
                'colaboradores_sin_evaluar': max(total_activos - total_evaluados, 0),
                'promedio_general': round(promedio_general, 2) if promedio_general else None,
            },
            'top5': top5,
            'bottom5': bottom5,
            'distribucion_rangos': rangos,
            'promedio_por_criterio': promedio_por_criterio,
        })


# ── LINK PUBLICO DE AUTOEVALUACION ───────────────────────────────────────────

class CrearInvitacionEvaluacionView(APIView):
    """
    POST /api/evaluaciones/crear-invitacion/
    Crea una evaluacion en blanco (criterios sin calificar) con un token
    unico, y devuelve el link publico para que el colaborador (o quien deba
    completarla) la llene sin necesidad de iniciar sesion.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request):
        serializer = CrearInvitacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        from colaboradores.models import Colaborador
        colaborador = generics.get_object_or_404(Colaborador, pk=datos['colaborador'])

        evaluacion = EvaluacionDesempeno.objects.create(
            colaborador=colaborador,
            periodo=datos['periodo'],
            tipo_evaluacion=datos['tipo_evaluacion'],
            fecha_evaluacion=datos['fecha_evaluacion'],
            evaluador=datos['evaluador'],
            responsable_hr=datos['responsable_hr'],
            criterios=[{'criterio': c, 'puntaje': None, 'comentario': ''} for c in CRITERIOS_ESTANDAR],
            estado='BORRADOR',
            token_publico=uuid.uuid4(),
        )

        registrar_auditoria(
            request.user, 'CREATE', 'evaluacion_desempeno', evaluacion.id,
            detalle=f'Invitacion de autoevaluacion creada para {colaborador.nombre}', request=request,
        )

        return Response({
            'id': evaluacion.id,
            'token_publico': str(evaluacion.token_publico),
            'colaborador_nombre': colaborador.nombre,
        }, status=status.HTTP_201_CREATED)


class EvaluacionPublicaView(APIView):
    """
    GET  /api/evaluaciones/publica/<token>/  -- muestra el formulario a llenar
    POST /api/evaluaciones/publica/<token>/  -- recibe las respuestas

    Sin autenticacion: el token UUID (dificil de adivinar) hace de contraseña
    de un solo uso. Al recibir la respuesta, el token se invalida para que el
    link no se pueda volver a usar.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'publico'

    def get(self, request, token):
        evaluacion = EvaluacionDesempeno.objects.filter(token_publico=token).select_related('colaborador').first()
        if not evaluacion:
            return Response({'error': 'Este link no es valido o ya fue utilizado.'}, status=404)
        if evaluacion.estado == 'COMPLETADA':
            return Response({'error': 'Esta evaluacion ya fue completada.'}, status=410)
        return Response(EvaluacionPublicaLecturaSerializer(evaluacion).data)

    def post(self, request, token):
        evaluacion = EvaluacionDesempeno.objects.filter(token_publico=token).first()
        if not evaluacion:
            return Response({'error': 'Este link no es valido o ya fue utilizado.'}, status=404)
        if evaluacion.estado == 'COMPLETADA':
            return Response({'error': 'Esta evaluacion ya fue completada.'}, status=410)

        serializer = EvaluacionPublicaEnvioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        evaluacion.criterios = datos['criterios']
        evaluacion.fortalezas = datos.get('fortalezas', '')
        evaluacion.areas_mejora = datos.get('areas_mejora', '')
        evaluacion.plan_accion = datos.get('plan_accion', '')
        evaluacion.estado = 'COMPLETADA'
        evaluacion.token_publico = None  # invalidar el link, ya se uso
        evaluacion.save()

        return Response({'ok': True, 'puntaje_final': evaluacion.puntaje_final}, status=200)
