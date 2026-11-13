"""
AUSENTRACK - Vistas de incapacidades
"""

import os
import uuid
from pathlib import Path

from django.http import FileResponse
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q
from django.conf import settings
from authentication.permissions import EsTalentoHumano, EsNomina
from authentication.views import registrar_auditoria
from .models import Incapacidad
from .serializers import (
    IncapacidadSerializer, IncapacidadListSerializer, CambiarEstadoSerializer, ProrrogaSerializer,
)

LIMITE_DIAS = 540   # tope legal de dias acumulados de una incapacidad con sus prorrogas


def _primer_error(errores):
    """Convierte los errores de un serializer en un solo texto legible."""
    for campo, mensajes in errores.items():
        texto = mensajes[0] if isinstance(mensajes, (list, tuple)) else mensajes
        return str(texto) if campo == 'non_field_errors' else f'{campo}: {texto}'
    return 'Datos invalidos.'


def _raiz(incapacidad):
    """Incapacidad inicial de la cadena (la que no es prorroga de ninguna)."""
    vistos = set()
    while incapacidad.incapacidad_padre_id and incapacidad.pk not in vistos:
        vistos.add(incapacidad.pk)
        incapacidad = incapacidad.incapacidad_padre
    return incapacidad


def _dias_de_la_cadena(raiz):
    """Dias de la incapacidad inicial mas todas sus prorrogas, a cualquier nivel."""
    total, ids, vistos = raiz.dias or 0, [raiz.pk], {raiz.pk}
    while ids:
        hijos = [h for h in Incapacidad.objects.filter(incapacidad_padre__in=ids).values('id_incapacidad', 'dias')
                 if h['id_incapacidad'] not in vistos]
        total += sum(h['dias'] or 0 for h in hijos)
        ids = [h['id_incapacidad'] for h in hijos]
        vistos.update(ids)
    return total


class ListarIncapacidadesView(generics.ListAPIView):
    """
    GET /api/incapacidades/
    Filtros: colaborador, tipo, estado, fecha_inicio_desde, fecha_inicio_hasta
    """
    serializer_class   = IncapacidadListSerializer
    permission_classes = [IsAuthenticated, EsNomina]

    def get_queryset(self):
        qs = Incapacidad.objects.select_related(
            'colaborador', 'entidad_emisora'
        )
        p = self.request.query_params

        if p.get('colaborador'):
            qs = qs.filter(colaborador=p.get('colaborador'))
        if p.get('tipo'):
            qs = qs.filter(tipo=p.get('tipo'))
        if p.get('estado'):
            qs = qs.filter(estado=p.get('estado'))
        if p.get('fecha_inicio_desde'):
            qs = qs.filter(fecha_inicio__gte=p.get('fecha_inicio_desde'))
        if p.get('fecha_inicio_hasta'):
            qs = qs.filter(fecha_inicio__lte=p.get('fecha_inicio_hasta'))
        if p.get('buscar'):
            qs = qs.filter(
                Q(colaborador__nombre__icontains=p.get('buscar')) |
                Q(colaborador__cedula__icontains=p.get('buscar'))
            )
        return qs.order_by('-fecha_inicio')


class CrearIncapacidadView(generics.CreateAPIView):
    """
    POST /api/incapacidades/crear/
    Solo TALENTO_HUMANO y ADMIN.
    """
    serializer_class   = IncapacidadSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        incapacidad = serializer.save(usuario_registro=self.request.user)
        registrar_auditoria(
            self.request.user, 'CREATE', 'incapacidad',
            incapacidad.id_incapacidad, request=self.request
        )


class DetalleIncapacidadView(generics.RetrieveUpdateAPIView):
    """
    GET/PUT/PATCH /api/incapacidades/<id>/
    """
    queryset     = Incapacidad.objects.select_related('colaborador', 'entidad_emisora', 'usuario_registro')
    lookup_field = 'id_incapacidad'

    def get_serializer_class(self):
        return IncapacidadSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), EsNomina()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        incapacidad = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'incapacidad',
            incapacidad.id_incapacidad, request=self.request
        )


class CambiarEstadoView(APIView):
    """
    POST /api/incapacidades/<id>/estado/
    Cambia el estado de una incapacidad.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, id_incapacidad):
        try:
            incapacidad = Incapacidad.objects.get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CambiarEstadoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        estado_anterior       = incapacidad.estado
        incapacidad.estado    = serializer.validated_data['estado']
        incapacidad.save()

        registrar_auditoria(
            request.user, 'UPDATE', 'incapacidad',
            incapacidad.id_incapacidad,
            detalle=f'Cambio de estado: {estado_anterior} -> {incapacidad.estado}',
            request=request
        )
        return Response(IncapacidadSerializer(incapacidad).data)


class HistorialColaboradorView(generics.ListAPIView):
    """
    GET /api/incapacidades/historial/<id_colaborador>/
    Historial completo de un colaborador.
    """
    serializer_class   = IncapacidadListSerializer
    permission_classes = [IsAuthenticated, EsNomina]

    def get_queryset(self):
        return Incapacidad.objects.filter(
            colaborador=self.kwargs['id_colaborador']
        ).select_related('entidad_emisora').order_by('-fecha_inicio')


class AlertasView(APIView):
    """
    GET /api/incapacidades/alertas/
    Incapacidades que requieren atencion:
    - Activas con mas de 180 dias
    - Activas que vencen en los proximos 3 dias
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        from datetime import date, timedelta
        hoy       = date.today()
        en_3_dias = hoy + timedelta(days=3)

        proximas_a_vencer = Incapacidad.objects.filter(
            estado='ACTIVA',
            fecha_fin__gte=hoy,
            fecha_fin__lte=en_3_dias
        ).select_related('colaborador').values(
            'id_incapacidad', 'colaborador__nombre', 'fecha_fin', 'dias', 'tipo'
        )

        # El umbral de 180 dias se mide sobre la cadena completa (incapacidad
        # inicial + prorrogas). Una incapacidad rara vez dura 180 dias en un
        # solo registro: se expide por periodos cortos y se va prorrogando,
        # asi que mirar cada registro por separado nunca disparaba la alerta.
        filas = list(Incapacidad.objects.values(
            'id_incapacidad', 'incapacidad_padre_id', 'dias', 'estado',
            'fecha_inicio', 'tipo', 'colaborador__nombre',
        ))
        por_id = {f['id_incapacidad']: f for f in filas}

        def raiz_de(fila):
            vistos = set()
            while fila['incapacidad_padre_id'] in por_id and fila['id_incapacidad'] not in vistos:
                vistos.add(fila['id_incapacidad'])
                fila = por_id[fila['incapacidad_padre_id']]
            return fila

        cadenas = {}
        for f in filas:
            raiz = raiz_de(f)
            c = cadenas.setdefault(raiz['id_incapacidad'], {'raiz': raiz, 'dias': 0, 'activa': None})
            c['dias'] += f['dias'] or 0
            if f['estado'] == 'ACTIVA' and (c['activa'] is None or f['fecha_inicio'] > c['activa']['fecha_inicio']):
                c['activa'] = f

        mas_de_180 = sorted((
            {
                'id_incapacidad':      c['activa']['id_incapacidad'],
                'colaborador__nombre': c['raiz']['colaborador__nombre'],
                'fecha_inicio':        c['raiz']['fecha_inicio'],
                'dias':                c['dias'],
                'tipo':                c['raiz']['tipo'],
            }
            for c in cadenas.values() if c['activa'] and c['dias'] >= 180
        ), key=lambda x: -x['dias'])

        return Response({
            'proximas_a_vencer': list(proximas_a_vencer),
            'mas_de_180_dias':   list(mas_de_180),
        })


class ReporteAusentismoView(APIView):
    """
    GET /api/incapacidades/reporte/
    Genera el reporte de ausentismo con filtros.
    Parametros: colaborador, tipo, estado, area, fecha_desde, fecha_hasta, formato (json|excel|pdf)
    """
    permission_classes = [IsAuthenticated, EsNomina]

    def get(self, request):
        from .reportes import get_queryset_reporte, exportar_excel, exportar_pdf
        from django.http import HttpResponse

        params  = request.query_params
        formato = params.get('formato', 'json')
        qs      = get_queryset_reporte(params)

        if formato == 'excel':
            buffer, err = exportar_excel(qs)
            if err:
                return Response({'error': err}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response = HttpResponse(
                buffer.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="ausentrack_reporte_{params.get("fecha_desde","")}.xlsx"'
            return response

        if formato == 'pdf':
            buffer, err = exportar_pdf(qs)
            if err:
                return Response({'error': err}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response = HttpResponse(buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="ausentrack_reporte_{params.get("fecha_desde","")}.pdf"'
            return response

        # JSON para mostrar en pantalla
        from .serializers import IncapacidadListSerializer
        data = IncapacidadListSerializer(qs, many=True).data

        total_dias       = sum(i['dias'] for i in data)
        total_registros  = len(data)

        return Response({
            'total_registros': total_registros,
            'total_dias':      total_dias,
            'incapacidades':   data,
        })


class CrearProrrogaView(APIView):
    """
    POST /api/incapacidades/<id>/prorroga/
    Crea una prorroga de una incapacidad existente.
    Valida: dias acumulados no superen 540 (normativa colombiana).
    Solo TALENTO_HUMANO y ADMIN.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, id_incapacidad):
        try:
            incapacidad_padre = Incapacidad.objects.select_related('incapacidad_padre').get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=404)

        if not isinstance(request.data, dict):
            return Response({'error': 'Se esperaba un objeto con fecha_inicio y fecha_fin.'}, status=400)
        serializer = ProrrogaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'error': _primer_error(serializer.errors)}, status=400)
        datos = serializer.validated_data
        fi, ff = datos['fecha_inicio'], datos['fecha_fin']
        diagnostico   = datos.get('diagnostico') or incapacidad_padre.diagnostico
        observaciones = datos.get('observaciones') or ''

        if fi <= incapacidad_padre.fecha_fin:
            return Response({
                'error': f'La prorroga debe empezar despues de que termina la incapacidad que prorroga '
                         f'({incapacidad_padre.fecha_fin}).'
            }, status=400)

        dias_totales = _dias_de_la_cadena(_raiz(incapacidad_padre))

        # Ambos extremos cuentan (igual que al guardar la incapacidad): del
        # 1 al 3 son 3 dias, y una prorroga de un solo dia es valida.
        dias_nueva = (ff - fi).days + 1

        if dias_totales + dias_nueva > LIMITE_DIAS:
            return Response({
                'error': f'La prorroga supera el limite de {LIMITE_DIAS} dias. Dias acumulados: {dias_totales}. '
                         f'Maximo permitido para esta prorroga: {max(LIMITE_DIAS - dias_totales, 0)} dias.'
            }, status=400)

        prorroga = Incapacidad.objects.create(
            colaborador       = incapacidad_padre.colaborador,
            entidad_emisora   = incapacidad_padre.entidad_emisora,
            usuario_registro  = request.user,
            incapacidad_padre = incapacidad_padre,
            tipo              = incapacidad_padre.tipo,
            fecha_inicio      = fi,
            fecha_fin         = ff,
            diagnostico       = diagnostico,
            observaciones     = observaciones,
            estado            = 'ACTIVA',
        )

        registrar_auditoria(
            request.user, 'CREATE', 'incapacidad', prorroga.id_incapacidad,
            detalle=f'Prorroga de incapacidad #{id_incapacidad}. Dias acumulados: {dias_totales + prorroga.dias}',
            request=request
        )

        return Response({
            'id_prorroga':     prorroga.id_incapacidad,
            'dias_prorroga':   prorroga.dias,
            'dias_acumulados': dias_totales + prorroga.dias,
            'dias_restantes':  LIMITE_DIAS - (dias_totales + prorroga.dias),
            'mensaje':         f'Prorroga creada correctamente. Total acumulado: {dias_totales + prorroga.dias} dias de {LIMITE_DIAS} permitidos.'
        }, status=201)


class HistorialProrrogasView(APIView):
    """
    GET /api/incapacidades/<id>/prorrogas/
    Retorna la cadena completa de prorrogas de una incapacidad.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, id_incapacidad):
        try:
            incapacidad = Incapacidad.objects.get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=404)

        # Ir a la raiz
        raiz = incapacidad
        while raiz.incapacidad_padre:
            raiz = raiz.incapacidad_padre

        # Construir cadena completa
        cadena = []
        def agregar(inc, nivel=0):
            cadena.append({
                'id':           inc.id_incapacidad,
                'nivel':        nivel,
                'es_prorroga':  nivel > 0,
                'fecha_inicio': str(inc.fecha_inicio),
                'fecha_fin':    str(inc.fecha_fin),
                'dias':         inc.dias,
                'estado':       inc.estado,
                'diagnostico':  inc.diagnostico,
            })
            for hijo in Incapacidad.objects.filter(incapacidad_padre=inc).order_by('fecha_inicio'):
                agregar(hijo, nivel + 1)

        agregar(raiz)
        dias_totales = sum(i['dias'] for i in cadena)

        return Response({
            'cadena':          cadena,
            'dias_totales':    dias_totales,
            'dias_restantes':  LIMITE_DIAS - dias_totales,
            'puede_prorrogar': dias_totales < LIMITE_DIAS,
        })


CARPETA_DOCUMENTOS = 'documentos_incapacidades'
# Extension permitida -> (primeros bytes que debe tener el archivo, tipo de contenido)
TIPOS_DOCUMENTO = {
    '.pdf':  (b'%PDF-',             'application/pdf'),
    '.jpg':  (b'\xff\xd8\xff',      'image/jpeg'),
    '.jpeg': (b'\xff\xd8\xff',      'image/jpeg'),
    '.png':  (b'\x89PNG\r\n\x1a\n', 'image/png'),
}


def _ruta_documento(documento_url):
    """
    Ruta absoluta del documento, SOLO si queda dentro de la carpeta de
    documentos de incapacidades. Devuelve None para cualquier otra ruta
    (por ejemplo '../../settings.py'), de modo que nunca se lea ni se borre
    un archivo ajeno.
    """
    if not documento_url:
        return None
    base = (Path(settings.MEDIA_ROOT) / CARPETA_DOCUMENTOS).resolve()
    ruta = (Path(settings.MEDIA_ROOT) / documento_url).resolve()
    return ruta if base in ruta.parents else None


def _borrar_documento(documento_url):
    ruta = _ruta_documento(documento_url)
    if ruta and ruta.is_file():
        ruta.unlink()


class SubirDocumentoView(APIView):
    """
    GET    /api/incapacidades/<id>/documento/  Descarga el documento (requiere sesion).
    POST   /api/incapacidades/<id>/documento/  Sube el PDF o imagen de la incapacidad.
    DELETE /api/incapacidades/<id>/documento/  Elimina el documento.

    Los documentos contienen datos de salud (dato sensible, Ley 1581 de
    2012): NO se publican por una URL abierta. Solo se entregan por este
    endpoint, que exige iniciar sesion.
    """
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), EsNomina()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def get(self, request, id_incapacidad):
        incapacidad = generics.get_object_or_404(Incapacidad, id_incapacidad=id_incapacidad)
        ruta = _ruta_documento(incapacidad.documento_url)
        if not ruta or not ruta.is_file():
            return Response({'error': 'Esta incapacidad no tiene documento adjunto.'}, status=404)

        _, tipo_contenido = TIPOS_DOCUMENTO.get(ruta.suffix.lower(), (None, 'application/octet-stream'))
        respuesta = FileResponse(open(ruta, 'rb'), content_type=tipo_contenido, filename=ruta.name)
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def post(self, request, id_incapacidad):
        try:
            incapacidad = Incapacidad.objects.get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=404)

        archivo = request.FILES.get('documento')
        if not archivo:
            return Response({'error': 'No se envio ningun archivo.'}, status=400)

        # Validar extension
        ext = os.path.splitext(archivo.name)[1].lower()
        if ext not in TIPOS_DOCUMENTO:
            return Response({'error': 'Solo se permiten archivos PDF, JPG o PNG.'}, status=400)

        # Validar tamano (max 10MB)
        if archivo.size > 10 * 1024 * 1024:
            return Response({'error': 'El archivo no puede superar 10MB.'}, status=400)

        # Validar que el contenido corresponda a la extension (que un .pdf sea
        # de verdad un PDF y no otro tipo de archivo renombrado)
        firma, _ = TIPOS_DOCUMENTO[ext]
        cabecera = archivo.read(len(firma))
        archivo.seek(0)
        if cabecera != firma:
            return Response({'error': 'El contenido del archivo no corresponde a un PDF, JPG o PNG valido.'}, status=400)

        # Guardar con un nombre generado por el servidor: no se reutiliza el
        # nombre original (puede traer caracteres raros o datos personales) y
        # no se puede adivinar.
        nombre_archivo = f'incapacidad_{id_incapacidad}_{uuid.uuid4().hex[:16]}{ext}'
        carpeta        = Path(settings.MEDIA_ROOT) / CARPETA_DOCUMENTOS
        carpeta.mkdir(parents=True, exist_ok=True)

        with open(carpeta / nombre_archivo, 'wb') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        documento_anterior = incapacidad.documento_url
        incapacidad.documento_url = f'{CARPETA_DOCUMENTOS}/{nombre_archivo}'
        incapacidad.save()
        _borrar_documento(documento_anterior)

        registrar_auditoria(
            request.user, 'UPDATE', 'incapacidad', id_incapacidad,
            detalle=f'Documento subido: {archivo.name}',
            request=request
        )

        return Response({
            'mensaje':       'Documento subido correctamente.',
            'documento_url': incapacidad.documento_url,
            'url_descarga':  request.build_absolute_uri(request.path),
        })

    def delete(self, request, id_incapacidad):
        try:
            incapacidad = Incapacidad.objects.get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=404)

        if incapacidad.documento_url:
            _borrar_documento(incapacidad.documento_url)
            incapacidad.documento_url = None
            incapacidad.save()
            registrar_auditoria(
                request.user, 'UPDATE', 'incapacidad', id_incapacidad,
                detalle='Documento eliminado', request=request
            )

        return Response({'mensaje': 'Documento eliminado correctamente.'})
