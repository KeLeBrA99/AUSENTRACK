"""
AUSENTRACK - Vistas de incapacidades
"""

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
from .serializers import IncapacidadSerializer, IncapacidadListSerializer, CambiarEstadoSerializer


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

        mas_de_180 = Incapacidad.objects.filter(
            estado='ACTIVA',
            dias__gte=180
        ).select_related('colaborador').values(
            'id_incapacidad', 'colaborador__nombre', 'fecha_inicio', 'dias', 'tipo'
        )

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
        from authentication.views import registrar_auditoria

        try:
            incapacidad_padre = Incapacidad.objects.get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=404)

        # Calcular total dias acumulados (cadena completa)
        def get_raiz(inc):
            while inc.incapacidad_padre:
                inc = inc.incapacidad_padre
            return inc

        raiz = get_raiz(incapacidad_padre)
        dias_acumulados = Incapacidad.objects.filter(
            id_incapacidad=raiz.id_incapacidad
        ).values_list('dias', flat=True).first() or 0

        # Sumar todas las prórrogas de la raíz
        def sumar_prorrogas(raiz_id):
            total = 0
            ids = [raiz_id]
            while ids:
                hijos = list(Incapacidad.objects.filter(
                    incapacidad_padre__in=ids
                ).values('id_incapacidad', 'dias'))
                total += sum(h['dias'] for h in hijos)
                ids = [h['id_incapacidad'] for h in hijos]
            return total

        dias_prorrogas = sumar_prorrogas(raiz.id_incapacidad)
        dias_totales   = (raiz.dias or 0) + dias_prorrogas

        fecha_inicio = request.data.get('fecha_inicio')
        fecha_fin    = request.data.get('fecha_fin')
        diagnostico  = request.data.get('diagnostico', incapacidad_padre.diagnostico)
        observaciones= request.data.get('observaciones', '')

        if not fecha_inicio or not fecha_fin:
            return Response({'error': 'fecha_inicio y fecha_fin son obligatorios.'}, status=400)

        from datetime import date
        try:
            fi = date.fromisoformat(fecha_inicio)
            ff = date.fromisoformat(fecha_fin)
        except ValueError:
            return Response({'error': 'Formato de fecha invalido. Use YYYY-MM-DD.'}, status=400)

        if ff <= fi:
            return Response({'error': 'La fecha de fin debe ser posterior a la fecha de inicio.'}, status=400)

        dias_nueva = (ff - fi).days

        if dias_totales + dias_nueva > 540:
            return Response({
                'error': f'La prorroga supera el limite de 540 dias. Dias acumulados: {dias_totales}. Maximo permitido para esta prorroga: {540 - dias_totales} dias.'
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
            'dias_restantes':  540 - (dias_totales + prorroga.dias),
            'mensaje':         f'Prorroga creada correctamente. Total acumulado: {dias_totales + prorroga.dias} dias de 540 permitidos.'
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
            'dias_restantes':  540 - dias_totales,
            'puede_prorrogar': dias_totales < 540,
        })


class SubirDocumentoView(APIView):
    """
    POST /api/incapacidades/<id>/documento/
    Sube el documento PDF o imagen de la incapacidad.
    DELETE /api/incapacidades/<id>/documento/
    Elimina el documento.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request, id_incapacidad):
        from authentication.views import registrar_auditoria
        import os

        try:
            incapacidad = Incapacidad.objects.get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=404)

        archivo = request.FILES.get('documento')
        if not archivo:
            return Response({'error': 'No se envio ningun archivo.'}, status=400)

        # Validar extension
        ext = os.path.splitext(archivo.name)[1].lower()
        if ext not in ['.pdf', '.jpg', '.jpeg', '.png']:
            return Response({'error': 'Solo se permiten archivos PDF, JPG o PNG.'}, status=400)

        # Validar tamano (max 10MB)
        if archivo.size > 10 * 1024 * 1024:
            return Response({'error': 'El archivo no puede superar 10MB.'}, status=400)

        # Eliminar documento anterior si existe
        if incapacidad.documento_url:
            ruta_anterior = os.path.join(settings.MEDIA_ROOT, incapacidad.documento_url)
            if os.path.exists(ruta_anterior):
                os.remove(ruta_anterior)

        # Guardar nuevo documento
        nombre_archivo = f'incapacidad_{id_incapacidad}_{archivo.name}'
        carpeta        = os.path.join(settings.MEDIA_ROOT, 'documentos_incapacidades')
        os.makedirs(carpeta, exist_ok=True)
        ruta_completa  = os.path.join(carpeta, nombre_archivo)

        with open(ruta_completa, 'wb+') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        incapacidad.documento_url = f'documentos_incapacidades/{nombre_archivo}'
        incapacidad.save()

        registrar_auditoria(
            request.user, 'UPDATE', 'incapacidad', id_incapacidad,
            detalle=f'Documento subido: {archivo.name}',
            request=request
        )

        return Response({
            'mensaje':      'Documento subido correctamente.',
            'documento_url': incapacidad.documento_url,
            'url_descarga': request.build_absolute_uri(f'{settings.MEDIA_URL}{incapacidad.documento_url}'),
        })

    def delete(self, request, id_incapacidad):
        import os
        try:
            incapacidad = Incapacidad.objects.get(id_incapacidad=id_incapacidad)
        except Incapacidad.DoesNotExist:
            return Response({'error': 'Incapacidad no encontrada.'}, status=404)

        if incapacidad.documento_url:
            ruta = os.path.join(settings.MEDIA_ROOT, incapacidad.documento_url)
            if os.path.exists(ruta):
                os.remove(ruta)
            incapacidad.documento_url = None
            incapacidad.save()

        return Response({'mensaje': 'Documento eliminado correctamente.'})
