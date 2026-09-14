"""
AUSENTRACK - Vistas de Reclutamiento y Selección
"""
from django.db.models import Q
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import Vacante, Candidato
from .serializers import (
    VacanteSerializer, VacanteConCandidatosSerializer, CandidatoSerializer,
)


# ── VACANTES ─────────────────────────────────────────────────────────────────

class ListarVacantesView(generics.ListAPIView):
    """
    GET /api/reclutamiento/vacantes/
    Filtros: ?estado=&punto_venta=&search=
    """
    serializer_class   = VacanteSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs          = Vacante.objects.all()
        estado      = self.request.query_params.get('estado')
        punto_venta = self.request.query_params.get('punto_venta')
        search      = self.request.query_params.get('search')

        if estado:
            qs = qs.filter(estado=estado)
        if punto_venta:
            qs = qs.filter(punto_venta__iexact=punto_venta)
        if search:
            qs = qs.filter(Q(cargo__icontains=search) | Q(punto_venta__icontains=search))
        return qs


class CrearVacanteView(generics.CreateAPIView):
    serializer_class   = VacanteSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        vacante = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'vacante', vacante.id,
            detalle=f'Vacante creada: {vacante.cargo} ({vacante.punto_venta})', request=self.request
        )


class DetalleVacanteView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET  -> incluye los candidatos anidados (para la vista de pipeline)
    PUT/PATCH/DELETE -> gestion normal
    """
    queryset            = Vacante.objects.all()
    permission_classes  = [IsAuthenticated, EsTalentoHumano]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return VacanteConCandidatosSerializer
        return VacanteSerializer

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        vacante = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'vacante', vacante.id,
            detalle=f'Vacante actualizada: {vacante.cargo} -> {vacante.estado}', request=self.request
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'vacante', instance.id,
            detalle=f'Vacante eliminada: {instance.cargo}', request=self.request
        )
        instance.delete()


# ── CANDIDATOS ───────────────────────────────────────────────────────────────

class ListarCandidatosView(generics.ListAPIView):
    """
    GET /api/reclutamiento/candidatos/
    Filtros: ?vacante=&etapa=&search=
    """
    serializer_class   = CandidatoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs      = Candidato.objects.select_related('vacante')
        vacante = self.request.query_params.get('vacante')
        etapa   = self.request.query_params.get('etapa')
        search  = self.request.query_params.get('search')

        if vacante:
            qs = qs.filter(vacante_id=vacante)
        if etapa:
            qs = qs.filter(etapa=etapa)
        if search:
            qs = qs.filter(Q(nombre__icontains=search) | Q(cedula__icontains=search))
        return qs


class CrearCandidatoView(generics.CreateAPIView):
    serializer_class   = CandidatoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        candidato = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'candidato', candidato.id,
            detalle=f'Candidato postulado: {candidato.nombre} -> {candidato.vacante.cargo}', request=self.request
        )


class DetalleCandidatoView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/reclutamiento/candidatos/<id>/
    El PATCH es el mas usado: mover de etapa dentro del pipeline (arrastrar en el kanban).
    """
    queryset           = Candidato.objects.select_related('vacante')
    serializer_class   = CandidatoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        etapa_anterior = self.get_object().etapa
        candidato = serializer.save()
        detalle = f'Candidato {candidato.nombre}: {etapa_anterior} -> {candidato.etapa}' \
            if etapa_anterior != candidato.etapa else f'Candidato {candidato.nombre} actualizado'
        registrar_auditoria(
            self.request.user, 'UPDATE', 'candidato', candidato.id,
            detalle=detalle, request=self.request
        )

        # Si el candidato queda CONTRATADO, se le genera automaticamente su
        # ficha de Colaborador (si no existe ya una con esa cedula), para no
        # tener que volver a digitar sus datos en el modulo de Colaboradores.
        if candidato.etapa == 'CONTRATADO' and etapa_anterior != 'CONTRATADO':
            self._generar_colaborador(candidato)

        # Si no quedan mas cupos en la vacante, se marca como CUBIERTA automaticamente.
        if candidato.etapa == 'CONTRATADO':
            vacante = candidato.vacante
            contratados = vacante.candidatos.filter(etapa='CONTRATADO').count()
            if contratados >= vacante.vacantes_disponibles and vacante.estado == 'ABIERTA':
                vacante.estado = 'CUBIERTA'
                vacante.save(update_fields=['estado'])

    def _generar_colaborador(self, candidato):
        from colaboradores.models import Colaborador, Empresa
        from datetime import date

        # Si ya existe un colaborador con esa cedula, solo se vincula (no se duplica).
        existente = Colaborador.objects.filter(cedula=candidato.cedula).first()
        if existente:
            candidato.colaborador = existente
            candidato.save(update_fields=['colaborador'])
            return

        empresa = Empresa.objects.first()
        if not empresa:
            # No se puede crear el colaborador sin empresa; se deja para que
            # Talento Humano lo registre manualmente una vez exista una empresa.
            return

        nuevo = Colaborador.objects.create(
            empresa=empresa,
            cedula=candidato.cedula,
            nombre=candidato.nombre,
            cargo=candidato.vacante.cargo,
            area=candidato.vacante.punto_venta,
            punto_venta=candidato.vacante.punto_venta_fk,
            salario=candidato.vacante.salario_ofrecido,
            fecha_ingreso=date.today(),
        )
        candidato.colaborador = nuevo
        candidato.save(update_fields=['colaborador'])
        registrar_auditoria(
            self.request.user, 'CREATE', 'colaborador', nuevo.id_colaborador,
            detalle=f'Colaborador generado automaticamente al contratar a {candidato.nombre} (vacante: {candidato.vacante.cargo})',
            request=self.request,
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'candidato', instance.id,
            detalle=f'Candidato eliminado: {instance.nombre}', request=self.request
        )
        instance.delete()


# ── ESTADISTICAS (dashboard de reclutamiento) ────────────────────────────────

class EstadisticasReclutamientoView(APIView):
    """
    GET /api/reclutamiento/estadisticas/
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        import re
        from puntos_venta.models import PuntoVenta

        def _normalizar(texto):
            return re.sub(r'[^a-z0-9]', '', texto.lower()) if texto else ''

        vacantes   = Vacante.objects.select_related('punto_venta_fk').all()
        candidatos = Candidato.objects.all()

        vacantes_abiertas = vacantes.filter(estado='ABIERTA').count()
        total_candidatos  = candidatos.count()
        contratados_mes   = candidatos.filter(etapa='CONTRATADO').count()

        # Distribucion de candidatos por etapa (para el kanban / funnel)
        por_etapa = {}
        for row in candidatos.values('etapa'):
            por_etapa[row['etapa']] = por_etapa.get(row['etapa'], 0) + 1

        # Vacantes por punto de venta: relacion real primero, texto de respaldo despues
        puntos_oficiales = list(PuntoVenta.objects.filter(activo=True))
        por_punto = {}
        for v in vacantes.filter(estado='ABIERTA'):
            if v.punto_venta_fk_id:
                key = v.punto_venta_fk.nombre
            elif v.punto_venta:
                clave_norm = _normalizar(v.punto_venta)
                match = next((pv for pv in puntos_oficiales if _normalizar(pv.nombre) == clave_norm), None)
                key = match.nombre if match else v.punto_venta
            else:
                key = 'Sin especificar'
            por_punto[key] = por_punto.get(key, 0) + 1
        ranking_puntos = sorted(por_punto.items(), key=lambda x: x[1], reverse=True)

        # Vacantes con mas tiempo abiertas (posible cuello de botella)
        from datetime import date
        hoy = date.today()
        vacantes_lentas = []
        for v in vacantes.filter(estado='ABIERTA'):
            dias = (hoy - v.fecha_apertura).days
            vacantes_lentas.append({
                'id': v.id, 'cargo': v.cargo, 'punto_venta': v.punto_venta, 'dias_abierta': dias,
            })
        vacantes_lentas.sort(key=lambda x: x['dias_abierta'], reverse=True)

        return Response({
            'kpis': {
                'vacantes_abiertas': vacantes_abiertas,
                'total_vacantes': vacantes.count(),
                'total_candidatos': total_candidatos,
                'contratados': contratados_mes,
            },
            'candidatos_por_etapa': por_etapa,
            'vacantes_por_punto_venta': [{'punto_venta': k, 'cantidad': v} for k, v in ranking_puntos],
            'vacantes_mas_antiguas': vacantes_lentas[:10],
        })
