"""
AUSENTRACK - Vistas de Capacitaciones e Inducción
"""
from datetime import date, timedelta
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import Capacitacion, ParticipanteCapacitacion
from .serializers import (
    CapacitacionSerializer, CapacitacionConParticipantesSerializer,
    ParticipanteSerializer, InscribirParticipanteSerializer,
)

DIAS_INDUCCION_LIMITE = 15  # dias desde el ingreso para considerar la induccion "pendiente/atrasada"


# ── CAPACITACIONES ───────────────────────────────────────────────────────────

class ListarCapacitacionesView(generics.ListAPIView):
    """
    GET /api/capacitaciones/
    Filtros: ?tipo=&estado=&modalidad=&search=
    """
    serializer_class   = CapacitacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs = Capacitacion.objects.all()
        tipo      = self.request.query_params.get('tipo')
        estado    = self.request.query_params.get('estado')
        modalidad = self.request.query_params.get('modalidad')
        search    = self.request.query_params.get('search')

        if tipo:
            qs = qs.filter(tipo=tipo)
        if estado:
            qs = qs.filter(estado=estado)
        if modalidad:
            qs = qs.filter(modalidad=modalidad)
        if search:
            qs = qs.filter(Q(titulo__icontains=search) | Q(instructor__icontains=search))
        return qs


class CrearCapacitacionView(generics.CreateAPIView):
    serializer_class   = CapacitacionSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        cap = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'capacitacion', cap.id,
            detalle=f'Capacitación creada: {cap.titulo}', request=self.request,
        )


class DetalleCapacitacionView(generics.RetrieveUpdateDestroyAPIView):
    queryset            = Capacitacion.objects.all()
    permission_classes  = [IsAuthenticated, EsTalentoHumano]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return CapacitacionConParticipantesSerializer
        return CapacitacionSerializer

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        cap = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'capacitacion', cap.id,
            detalle=f'Capacitación actualizada: {cap.titulo} -> {cap.estado}', request=self.request,
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'capacitacion', instance.id,
            detalle=f'Capacitación eliminada: {instance.titulo}', request=self.request,
        )
        instance.delete()


# ── PARTICIPANTES ────────────────────────────────────────────────────────────

class InscribirParticipanteView(APIView):
    """
    POST /api/capacitaciones/<id>/inscribir/
    Body: {"colaborador": <id_colaborador>}
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, pk):
        capacitacion = generics.get_object_or_404(Capacitacion, pk=pk)
        serializer = InscribirParticipanteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        colaborador_id = serializer.validated_data['colaborador']

        if capacitacion.cupo_maximo and capacitacion.participantes.count() >= capacitacion.cupo_maximo:
            return Response({'error': 'Esta capacitación ya alcanzó su cupo máximo.'}, status=400)

        if ParticipanteCapacitacion.objects.filter(capacitacion=capacitacion, colaborador_id=colaborador_id).exists():
            return Response({'error': 'Este colaborador ya está inscrito en esta capacitación.'}, status=400)

        participante = ParticipanteCapacitacion.objects.create(capacitacion=capacitacion, colaborador_id=colaborador_id)
        registrar_auditoria(
            request.user, 'CREATE', 'participante_capacitacion', participante.id,
            detalle=f'{participante.colaborador.nombre} inscrito en {capacitacion.titulo}', request=request,
        )
        return Response(ParticipanteSerializer(participante).data, status=status.HTTP_201_CREATED)


class ActualizarParticipanteView(generics.UpdateAPIView):
    """
    PATCH /api/capacitaciones/participantes/<id>/
    Marca asistencia, calificacion, certificado, observaciones.
    """
    queryset            = ParticipanteCapacitacion.objects.select_related('colaborador', 'capacitacion')
    serializer_class    = ParticipanteSerializer
    permission_classes  = [IsAuthenticated, EsTalentoHumano]

    def perform_update(self, serializer):
        participante = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'participante_capacitacion', participante.id,
            detalle=f'{participante.colaborador.nombre}: {participante.estado_asistencia}', request=self.request,
        )


class EliminarParticipanteView(generics.DestroyAPIView):
    queryset            = ParticipanteCapacitacion.objects.all()
    permission_classes  = [IsAuthenticated, EsTalentoHumano]

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'participante_capacitacion', instance.id,
            detalle=f'{instance.colaborador.nombre} retirado de {instance.capacitacion.titulo}', request=self.request,
        )
        instance.delete()


# ── ESTADISTICAS ─────────────────────────────────────────────────────────────

class EstadisticasCapacitacionesView(APIView):
    """
    GET /api/capacitaciones/estadisticas/
    Incluye alerta de INDUCCION PENDIENTE: colaboradores activos que ingresaron
    hace mas de DIAS_INDUCCION_LIMITE dias y no tienen ninguna capacitacion de
    tipo INDUCCION marcada como ASISTIO o COMPLETADO.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        from colaboradores.models import Colaborador

        capacitaciones = Capacitacion.objects.all()
        participantes  = ParticipanteCapacitacion.objects.select_related('colaborador', 'capacitacion')

        total_horas = sum(
            float(c.duracion_horas) * c.participantes.filter(estado_asistencia__in=['ASISTIO', 'COMPLETADO']).count()
            for c in capacitaciones
        )

        proximas = capacitaciones.filter(estado='PROGRAMADA', fecha_inicio__gte=date.today()).order_by('fecha_inicio')[:8]
        proximas_lista = [{
            'id': c.id, 'titulo': c.titulo, 'tipo': c.get_tipo_display(),
            'fecha_inicio': c.fecha_inicio.isoformat(), 'inscritos': c.participantes.count(),
        } for c in proximas]

        dist_tipo = {}
        for row in capacitaciones.values('tipo'):
            dist_tipo[row['tipo']] = dist_tipo.get(row['tipo'], 0) + 1

        # Cobertura: colaboradores activos con al menos 1 capacitacion completada/asistida
        activos = Colaborador.objects.filter(activo=True)
        colaboradores_capacitados = set(
            participantes.filter(estado_asistencia__in=['ASISTIO', 'COMPLETADO'], colaborador__activo=True)
            .values_list('colaborador_id', flat=True)
        )

        # Induccion pendiente
        limite_fecha = date.today() - timedelta(days=DIAS_INDUCCION_LIMITE)
        colaboradores_con_induccion = set(
            participantes.filter(
                capacitacion__tipo='INDUCCION', estado_asistencia__in=['ASISTIO', 'COMPLETADO'],
            ).values_list('colaborador_id', flat=True)
        )
        pendientes_induccion = []
        for c in activos.filter(fecha_ingreso__lte=limite_fecha):
            if c.id_colaborador not in colaboradores_con_induccion:
                dias = (date.today() - c.fecha_ingreso).days if c.fecha_ingreso else None
                pendientes_induccion.append({
                    'id_colaborador': c.id_colaborador, 'nombre': c.nombre, 'cargo': c.cargo,
                    'area': c.area, 'dias_desde_ingreso': dias,
                })
        pendientes_induccion.sort(key=lambda x: x['dias_desde_ingreso'] or 0, reverse=True)

        return Response({
            'kpis': {
                'total_capacitaciones': capacitaciones.count(),
                'programadas': capacitaciones.filter(estado='PROGRAMADA').count(),
                'total_horas_formacion': round(total_horas, 1),
                'colaboradores_capacitados': len(colaboradores_capacitados),
                'total_colaboradores_activos': activos.count(),
                'induccion_pendiente': len(pendientes_induccion),
            },
            'proximas': proximas_lista,
            'distribucion_tipo': dist_tipo,
            'induccion_pendiente': pendientes_induccion[:15],
        })
