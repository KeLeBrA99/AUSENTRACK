"""
AUSENTRACK - Vistas de Vacaciones
"""
import json
import re
from datetime import date, timedelta
from django.db.models import Q, Sum
from django.utils import timezone
from django.conf import settings
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import SolicitudVacaciones
from .serializers import SolicitudVacacionesSerializer, ResponderSolicitudSerializer

DIAS_POR_MES = 15 / 12  # 15 dias habiles de ley por cada año completo trabajado


def _contar_dias_habiles(inicio, fin):
    """Dias de lunes a viernes entre dos fechas (ambas incluidas)."""
    if not inicio or not fin or fin < inicio:
        return 0
    dias = 0
    actual = inicio
    while actual <= fin:
        if actual.weekday() < 5:
            dias += 1
        actual += timedelta(days=1)
    return dias


def _dias_causados(colaborador, hasta=None):
    """
    Dias de vacaciones causados desde la fecha de ingreso hasta 'hasta'
    (por defecto hoy, o la fecha de retiro si ya no esta activo).
    """
    if not colaborador.fecha_ingreso:
        return 0
    limite = hasta or colaborador.fecha_retiro or date.today()
    meses = (limite.year - colaborador.fecha_ingreso.year) * 12 + (limite.month - colaborador.fecha_ingreso.month)
    if limite.day < colaborador.fecha_ingreso.day:
        meses -= 1
    meses = max(meses, 0)
    return round(meses * DIAS_POR_MES, 1)


def _calcular_saldo(colaborador):
    """
    Saldo de un colaborador. IMPORTANTE: solo las solicitudes de tipo
    VACACIONES descuentan del saldo -- un permiso (remunerado o no) es otra
    figura y no consume dias de vacaciones causados.
    """
    causados = _dias_causados(colaborador)
    consumidas = SolicitudVacaciones.objects.filter(
        colaborador=colaborador, tipo_solicitud='VACACIONES',
        estado__in=['APROBADA', 'DISFRUTADA']
    )
    dias_consumidos = sum(s.dias_habiles for s in consumidas)
    pendientes = SolicitudVacaciones.objects.filter(
        colaborador=colaborador, tipo_solicitud='VACACIONES', estado='SOLICITADA'
    )
    dias_pendientes = sum(s.dias_habiles for s in pendientes)
    return {
        'dias_causados': causados,
        'dias_consumidos': dias_consumidos,
        'dias_pendientes_aprobacion': dias_pendientes,
        'saldo_disponible': round(causados - dias_consumidos, 1),
    }


def _calcular_saldos_en_bloque(colaboradores):
    """
    Version optimizada de _calcular_saldo para varios colaboradores a la vez.

    En vez de hacer 2 consultas por cada colaborador (que con 241 activos eran
    ~483 consultas), agrupa TODAS las solicitudes en una sola consulta usando
    aggregate por colaborador. Devuelve {id_colaborador: {saldo...}}.
    """
    ids = [c.id_colaborador for c in colaboradores]
    if not ids:
        return {}

    # Una sola consulta: suma dias_habiles agrupando por colaborador y estado.
    # Solo tipo VACACIONES: los permisos no consumen dias de vacaciones.
    filas = (
        SolicitudVacaciones.objects
        .filter(colaborador_id__in=ids, tipo_solicitud='VACACIONES',
                estado__in=['APROBADA', 'DISFRUTADA', 'SOLICITADA'])
        .values('colaborador_id', 'estado')
        .annotate(total_dias=Sum('dias_habiles'))
    )

    consumidos = {}
    pendientes = {}
    for fila in filas:
        cid = fila['colaborador_id']
        total = fila['total_dias'] or 0
        if fila['estado'] == 'SOLICITADA':
            pendientes[cid] = pendientes.get(cid, 0) + total
        else:
            consumidos[cid] = consumidos.get(cid, 0) + total

    resultado = {}
    for c in colaboradores:
        causados = _dias_causados(c)
        dias_consumidos = consumidos.get(c.id_colaborador, 0)
        resultado[c.id_colaborador] = {
            'dias_causados': causados,
            'dias_consumidos': dias_consumidos,
            'dias_pendientes_aprobacion': pendientes.get(c.id_colaborador, 0),
            'saldo_disponible': round(causados - dias_consumidos, 1),
        }
    return resultado


# ── CRUD ─────────────────────────────────────────────────────────────────────

class ListarSolicitudesView(generics.ListAPIView):
    """
    GET /api/vacaciones/
    Filtros: ?colaborador=&estado=&search=
    """
    serializer_class   = SolicitudVacacionesSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs = SolicitudVacaciones.objects.select_related('colaborador')
        colaborador = self.request.query_params.get('colaborador')
        estado      = self.request.query_params.get('estado')
        search      = self.request.query_params.get('search')

        if colaborador:
            qs = qs.filter(colaborador_id=colaborador)
        if estado:
            qs = qs.filter(estado=estado)
        if search:
            qs = qs.filter(Q(colaborador__nombre__icontains=search) | Q(colaborador__cedula__icontains=search))
        return qs


class CrearSolicitudView(generics.CreateAPIView):
    serializer_class   = SolicitudVacacionesSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        solicitud = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'solicitud_vacaciones', solicitud.id,
            detalle=f'Solicitud creada: {solicitud.colaborador.nombre} ({solicitud.dias_habiles} días)',
            request=self.request,
        )


class DetalleSolicitudView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = SolicitudVacaciones.objects.select_related('colaborador')
    serializer_class   = SolicitudVacacionesSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        solicitud = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'solicitud_vacaciones', solicitud.id,
            detalle=f'Solicitud actualizada: {solicitud.colaborador.nombre} -> {solicitud.estado}',
            request=self.request,
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'solicitud_vacaciones', instance.id,
            detalle=f'Solicitud eliminada: {instance.colaborador.nombre}', request=self.request,
        )
        instance.delete()


# ── APROBAR / RECHAZAR / CANCELAR ────────────────────────────────────────────

class AprobarSolicitudView(APIView):
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, pk):
        solicitud = generics.get_object_or_404(SolicitudVacaciones, pk=pk)
        serializer = ResponderSolicitudSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        solicitud.estado = 'APROBADA'
        solicitud.aprobado_por = serializer.validated_data['aprobado_por']
        solicitud.fecha_respuesta = timezone.now()
        solicitud.save(update_fields=['estado', 'aprobado_por', 'fecha_respuesta'])

        registrar_auditoria(
            request.user, 'UPDATE', 'solicitud_vacaciones', solicitud.id,
            detalle=f'Solicitud aprobada: {solicitud.colaborador.nombre}', request=request,
        )
        return Response(SolicitudVacacionesSerializer(solicitud).data, status=200)


class RechazarSolicitudView(APIView):
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, pk):
        solicitud = generics.get_object_or_404(SolicitudVacaciones, pk=pk)
        serializer = ResponderSolicitudSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        solicitud.estado = 'RECHAZADA'
        solicitud.aprobado_por = serializer.validated_data['aprobado_por']
        solicitud.motivo_rechazo = serializer.validated_data.get('motivo_rechazo', '')
        solicitud.fecha_respuesta = timezone.now()
        solicitud.save(update_fields=['estado', 'aprobado_por', 'motivo_rechazo', 'fecha_respuesta'])

        registrar_auditoria(
            request.user, 'UPDATE', 'solicitud_vacaciones', solicitud.id,
            detalle=f'Solicitud rechazada: {solicitud.colaborador.nombre}', request=request,
        )
        return Response(SolicitudVacacionesSerializer(solicitud).data, status=200)


class CancelarSolicitudView(APIView):
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, pk):
        solicitud = generics.get_object_or_404(SolicitudVacaciones, pk=pk)
        solicitud.estado = 'CANCELADA'
        solicitud.save(update_fields=['estado'])
        registrar_auditoria(
            request.user, 'UPDATE', 'solicitud_vacaciones', solicitud.id,
            detalle=f'Solicitud cancelada: {solicitud.colaborador.nombre}', request=request,
        )
        return Response(SolicitudVacacionesSerializer(solicitud).data, status=200)


class MarcarDisfrutadaView(APIView):
    """Una vez pasa la fecha y el colaborador efectivamente sale a disfrutarlas."""
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, pk):
        solicitud = generics.get_object_or_404(SolicitudVacaciones, pk=pk)
        solicitud.estado = 'DISFRUTADA'
        solicitud.save(update_fields=['estado'])
        registrar_auditoria(
            request.user, 'UPDATE', 'solicitud_vacaciones', solicitud.id,
            detalle=f'Vacaciones marcadas como disfrutadas: {solicitud.colaborador.nombre}', request=request,
        )
        return Response(SolicitudVacacionesSerializer(solicitud).data, status=200)


# ── SALDOS ───────────────────────────────────────────────────────────────────

class SaldoColaboradorView(APIView):
    """GET /api/vacaciones/saldo/<id_colaborador>/"""
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request, id_colaborador):
        from colaboradores.models import Colaborador
        colaborador = generics.get_object_or_404(Colaborador, pk=id_colaborador)
        return Response(_calcular_saldo(colaborador))


class SaldosGeneralesView(APIView):
    """
    GET /api/vacaciones/saldos/
    Saldo de todos los colaboradores activos, ordenado por mayor saldo
    acumulado primero (riesgo de perder dias / pasivo laboral alto).
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        from colaboradores.models import Colaborador
        # select_related evita una consulta extra por cada punto de venta
        colaboradores = list(Colaborador.objects.filter(activo=True).select_related('punto_venta'))
        saldos = _calcular_saldos_en_bloque(colaboradores)

        resultado = []
        for c in colaboradores:
            resultado.append({
                'id_colaborador': c.id_colaborador, 'nombre': c.nombre, 'cargo': c.cargo,
                'punto_venta': c.punto_venta.nombre if c.punto_venta_id else c.area,
                **saldos[c.id_colaborador],
            })
        resultado.sort(key=lambda x: x['saldo_disponible'], reverse=True)
        return Response(resultado)


# ── ESTADISTICAS ─────────────────────────────────────────────────────────────

class EstadisticasVacacionesView(APIView):
    """GET /api/vacaciones/estadisticas/"""
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        from colaboradores.models import Colaborador

        qs = SolicitudVacaciones.objects.select_related('colaborador')
        pendientes = qs.filter(estado='SOLICITADA')

        hoy = date.today()
        proximas = qs.filter(estado='APROBADA', fecha_inicio__gte=hoy).order_by('fecha_inicio')[:8]
        proximas_lista = [{
            'id': s.id, 'colaborador': s.colaborador.nombre,
            'fecha_inicio': s.fecha_inicio.isoformat(), 'fecha_fin': s.fecha_fin.isoformat(),
            'dias_habiles': s.dias_habiles,
        } for s in proximas]

        # Colaboradores con saldo acumulado alto (riesgo/pasivo laboral): +30 dias sin tomar
        saldos_altos = []
        colaboradores_activos = list(Colaborador.objects.filter(activo=True))
        saldos = _calcular_saldos_en_bloque(colaboradores_activos)
        for c in colaboradores_activos:
            saldo = saldos[c.id_colaborador]
            if saldo['saldo_disponible'] >= 30:
                saldos_altos.append({'id_colaborador': c.id_colaborador, 'nombre': c.nombre, **saldo})
        saldos_altos.sort(key=lambda x: x['saldo_disponible'], reverse=True)

        return Response({
            'kpis': {
                'solicitudes_pendientes': pendientes.count(),
                'en_disfrute_actualmente': qs.filter(estado='APROBADA', fecha_inicio__lte=hoy, fecha_fin__gte=hoy).count(),
                'dias_tomados_este_anio': sum(
                    s.dias_habiles for s in qs.filter(estado__in=['APROBADA', 'DISFRUTADA'], fecha_inicio__year=hoy.year)
                ),
                'colaboradores_saldo_alto': len(saldos_altos),
            },
            'proximas_vacaciones': proximas_lista,
            'saldos_altos': saldos_altos[:10],
        })


# ── WEBHOOK JOTFORM ───────────────────────────────────────────────────────────

def _extraer_campo(datos_planos, *palabras_clave):
    """
    Busca en las llaves del formulario (formato JotForm: 'q4_cedula', 'q7_fechaInicio', etc.)
    una que contenga alguna de las palabras clave, sin importar mayusculas/guiones/espacios.
    """
    for llave, valor in datos_planos.items():
        llave_normalizada = re.sub(r'^q\d+_', '', llave.lower())
        llave_normalizada = re.sub(r'[^a-z]', '', llave_normalizada)
        for palabra in palabras_clave:
            if palabra in llave_normalizada:
                return valor
    return None


def _normalizar_fecha_jotform(valor):
    """JotForm puede mandar la fecha como texto 'YYYY-MM-DD' o como objeto {month,day,year}."""
    if valor is None:
        return None
    if isinstance(valor, dict):
        m = valor.get('month') or valor.get('m')
        d = valor.get('day') or valor.get('d')
        y = valor.get('year') or valor.get('y')
        if m and d and y:
            try:
                return date(int(y), int(m), int(d))
            except (TypeError, ValueError):
                return None
        return None
    texto = str(valor).strip()
    for fmt_sep in ('-', '/'):
        partes = texto.split(fmt_sep)
        if len(partes) == 3:
            try:
                if len(partes[0]) == 4:  # YYYY-MM-DD
                    return date(int(partes[0]), int(partes[1]), int(partes[2]))
                else:  # DD-MM-YYYY o MM-DD-YYYY (se asume DD-MM-YYYY, formato colombiano)
                    return date(int(partes[2]), int(partes[1]), int(partes[0]))
            except (TypeError, ValueError):
                continue
    return None


class WebhookJotformVacacionesView(APIView):
    """
    POST /api/vacaciones/webhook-jotform/?token=<JOTFORM_WEBHOOK_TOKEN>

    Endpoint publico (sin login) para que JotForm notifique una nueva solicitud
    de vacaciones o permiso. Crea la solicitud en estado SOLICITADA -- el saldo
    de vacaciones del colaborador SOLO se descuenta cuando Talento Humano la
    aprueba dentro de AUSENTRACK, nunca al llegar desde el formulario.

    Configuracion en JotForm: Settings > Integrations > Webhooks, apuntando a
    esta URL completa (con el token). En cada pregunta del formulario, revisa
    el "Field Name" (nombre unico interno, no la etiqueta visible) y procura
    que contenga alguna de estas palabras para que el sistema la reconozca:
    'cedula', 'inicio' (fecha inicio), 'fin' (fecha fin), 'tipo' (tipo de
    solicitud), 'observacion' o 'motivo' (comentario opcional).
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'publico'

    def post(self, request):
        from colaboradores.models import Colaborador

        token_esperado = getattr(settings, 'JOTFORM_WEBHOOK_TOKEN', None)
        token_recibido = request.query_params.get('token')
        if not token_esperado or token_recibido != token_esperado:
            return Response({'error': 'Token invalido o no configurado.'}, status=status.HTTP_403_FORBIDDEN)

        raw = request.data.get('rawRequest') or request.POST.get('rawRequest')
        if not raw:
            # Algunos webhooks mandan los campos directo en el body, no dentro de 'rawRequest'
            datos = {k: v for k, v in request.data.items()}
        else:
            try:
                datos = json.loads(raw) if isinstance(raw, str) else raw
            except (TypeError, ValueError):
                return Response({'error': 'No se pudo interpretar rawRequest como JSON.'}, status=400)

        cedula = _extraer_campo(datos, 'cedula', 'documento')
        fecha_inicio_raw = _extraer_campo(datos, 'inicio')
        fecha_fin_raw = _extraer_campo(datos, 'fin')
        tipo_raw = _extraer_campo(datos, 'tipo')
        observaciones = _extraer_campo(datos, 'observacion', 'motivo', 'comentario') or ''

        if not cedula:
            return Response({'error': 'No se encontro el campo de cedula en el envio.'}, status=400)

        colaborador = Colaborador.objects.filter(cedula=str(cedula).strip(), activo=True).first()
        if not colaborador:
            return Response({'error': f'No existe un colaborador activo con cedula {cedula}.'}, status=404)

        fecha_inicio = _normalizar_fecha_jotform(fecha_inicio_raw)
        fecha_fin = _normalizar_fecha_jotform(fecha_fin_raw)
        if not fecha_inicio or not fecha_fin:
            return Response({'error': 'No se pudieron interpretar las fechas de inicio/fin recibidas.'}, status=400)
        if fecha_fin < fecha_inicio:
            return Response({'error': 'La fecha de fin es anterior a la fecha de inicio.'}, status=400)

        tipo_solicitud = 'VACACIONES'
        if tipo_raw:
            texto_tipo = str(tipo_raw).strip().lower()
            if 'no remunerado' in texto_tipo:
                tipo_solicitud = 'PERMISO_NO_REMUNERADO'
            elif 'remunerado' in texto_tipo:
                tipo_solicitud = 'PERMISO_REMUNERADO'
            elif 'vacacion' not in texto_tipo:
                tipo_solicitud = 'OTRO'

        solicitud = SolicitudVacaciones.objects.create(
            colaborador=colaborador,
            tipo_solicitud=tipo_solicitud,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            estado='SOLICITADA',
            origen='JOTFORM',
            observaciones=str(observaciones)[:1000],
        )

        return Response({'ok': True, 'id': solicitud.id, 'colaborador': colaborador.nombre, 'dias_habiles': solicitud.dias_habiles}, status=201)
