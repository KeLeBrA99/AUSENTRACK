"""
AUSENTRACK - Vistas de Contratos
"""
from datetime import date, timedelta
from io import BytesIO

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import Contrato
from .serializers import ContratoSerializer, RenovarContratoSerializer, TerminarContratoSerializer

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    REPORTLAB_DISPONIBLE = True
except ImportError:
    REPORTLAB_DISPONIBLE = False


def _marcar_vencidos():
    """Pasa a VENCIDO cualquier contrato VIGENTE cuya fecha_fin ya paso."""
    Contrato.objects.filter(
        estado='VIGENTE', fecha_fin__isnull=False, fecha_fin__lt=date.today()
    ).update(estado='VENCIDO')


# ── CRUD ─────────────────────────────────────────────────────────────────────

class ListarContratosView(generics.ListAPIView):
    """
    GET /api/contratos/
    Filtros: ?colaborador=&estado=&tipo_contrato=&search=&proximos_a_vencer=30
    """
    serializer_class   = ContratoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        _marcar_vencidos()
        qs = Contrato.objects.select_related('colaborador')

        colaborador = self.request.query_params.get('colaborador')
        estado      = self.request.query_params.get('estado')
        tipo        = self.request.query_params.get('tipo_contrato')
        search      = self.request.query_params.get('search')
        proximos    = self.request.query_params.get('proximos_a_vencer')

        if colaborador:
            qs = qs.filter(colaborador_id=colaborador)
        if estado:
            qs = qs.filter(estado=estado)
        if tipo:
            qs = qs.filter(tipo_contrato=tipo)
        if search:
            qs = qs.filter(Q(colaborador__nombre__icontains=search) | Q(colaborador__cedula__icontains=search))
        if proximos:
            try:
                dias = int(proximos)
                limite = date.today() + timedelta(days=dias)
                qs = qs.filter(estado='VIGENTE', fecha_fin__isnull=False, fecha_fin__lte=limite, fecha_fin__gte=date.today())
            except ValueError:
                pass
        return qs


class CrearContratoView(generics.CreateAPIView):
    serializer_class   = ContratoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        contrato = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'contrato', contrato.id,
            detalle=f'Contrato creado: {contrato.colaborador.nombre} ({contrato.get_tipo_contrato_display()})',
            request=self.request,
        )


class DetalleContratoView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = Contrato.objects.select_related('colaborador')
    serializer_class   = ContratoSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        contrato = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'contrato', contrato.id,
            detalle=f'Contrato actualizado: {contrato.colaborador.nombre} -> {contrato.estado}',
            request=self.request,
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'contrato', instance.id,
            detalle=f'Contrato eliminado: {instance.colaborador.nombre}', request=self.request,
        )
        instance.delete()


# ── RENOVAR / TERMINAR ───────────────────────────────────────────────────────

class RenovarContratoView(APIView):
    """
    POST /api/contratos/<id>/renovar/
    Crea un contrato nuevo encadenado al actual (marca el actual como RENOVADO).
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, pk):
        contrato_actual = generics.get_object_or_404(Contrato, pk=pk)
        serializer = RenovarContratoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        # Se marca el anterior como RENOVADO ANTES de crear el nuevo, para que
        # en ningun momento existan dos contratos VIGENTES del mismo colaborador.
        contrato_actual.estado = 'RENOVADO'
        contrato_actual.save(update_fields=['estado'])

        nuevo = Contrato.objects.create(
            colaborador=contrato_actual.colaborador,
            contrato_anterior=contrato_actual,
            tipo_contrato=datos.get('tipo_contrato', contrato_actual.tipo_contrato),
            cargo=contrato_actual.cargo,
            punto_venta=contrato_actual.punto_venta,
            salario=datos.get('salario', contrato_actual.salario),
            fecha_inicio=datos['fecha_inicio'],
            fecha_fin=datos.get('fecha_fin'),
            responsable_hr=datos['responsable_hr'],
            observaciones=datos.get('observaciones', ''),
            estado='VIGENTE',
        )

        registrar_auditoria(
            request.user, 'CREATE', 'contrato', nuevo.id,
            detalle=f'Contrato renovado: {contrato_actual.colaborador.nombre} (contrato #{contrato_actual.id} -> #{nuevo.id})',
            request=request,
        )
        return Response(ContratoSerializer(nuevo).data, status=status.HTTP_201_CREATED)


class TerminarContratoView(APIView):
    """
    POST /api/contratos/<id>/terminar/
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, pk):
        contrato = generics.get_object_or_404(Contrato, pk=pk)
        serializer = TerminarContratoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        contrato.estado = 'TERMINADO'
        contrato.fecha_terminacion = datos.get('fecha_terminacion') or date.today()
        contrato.motivo_terminacion = datos.get('motivo_terminacion', '')
        contrato.save(update_fields=['estado', 'fecha_terminacion', 'motivo_terminacion'])

        registrar_auditoria(
            request.user, 'UPDATE', 'contrato', contrato.id,
            detalle=f'Contrato terminado: {contrato.colaborador.nombre}', request=request,
        )
        return Response(ContratoSerializer(contrato).data, status=status.HTTP_200_OK)


# ── GENERAR PDF ──────────────────────────────────────────────────────────────

class GenerarPdfContratoView(APIView):
    """
    GET /api/contratos/<id>/pdf/
    Genera un documento PDF simple del contrato con los datos del colaborador
    y las condiciones pactadas. Sirve como borrador/soporte, no reemplaza el
    contrato legal firmado.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request, pk):
        if not REPORTLAB_DISPONIBLE:
            return Response({'detail': 'reportlab no esta instalado.'}, status=500)

        contrato = generics.get_object_or_404(Contrato.objects.select_related('colaborador'), pk=pk)
        c = contrato.colaborador

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        titulo_style = ParagraphStyle('TituloContrato', parent=styles['Heading1'], alignment=1, fontSize=15)
        normal = styles['Normal']

        elementos = [
            Paragraph('CONTRATO DE TRABAJO', titulo_style),
            Spacer(1, 0.6*cm),
            Paragraph(f'Tipo: {contrato.get_tipo_contrato_display()}', normal),
            Spacer(1, 0.4*cm),
        ]

        datos_tabla = [
            ['Colaborador', c.nombre],
            ['Cédula', c.cedula],
            ['Cargo', contrato.cargo],
            ['Punto de venta / Área', contrato.punto_venta or '—'],
            ['Salario', f'$ {contrato.salario:,.0f}'],
            ['Fecha de inicio', contrato.fecha_inicio.strftime('%d/%m/%Y')],
            ['Fecha de finalización', contrato.fecha_fin.strftime('%d/%m/%Y') if contrato.fecha_fin else 'Indefinido'],
            ['Responsable HR', contrato.responsable_hr],
        ]
        tabla = Table(datos_tabla, colWidths=[5*cm, 10*cm])
        tabla.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#1F3864')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elementos.append(tabla)

        if contrato.observaciones:
            elementos += [Spacer(1, 0.6*cm), Paragraph('<b>Observaciones:</b>', normal), Paragraph(contrato.observaciones, normal)]

        elementos += [
            Spacer(1, 2.5*cm),
            Table([['_' * 30, '_' * 30], ['Firma Empleador', 'Firma Colaborador']], colWidths=[7.5*cm, 7.5*cm],
                  style=TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')])),
        ]

        doc.build(elementos)
        buffer.seek(0)

        registrar_auditoria(
            request.user, 'CREATE', 'contrato_pdf', contrato.id,
            detalle=f'PDF de contrato generado: {c.nombre}', request=request,
        )

        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="contrato_{c.cedula}.pdf"'
        return response


# ── ESTADISTICAS ─────────────────────────────────────────────────────────────

class EstadisticasContratosView(APIView):
    """
    GET /api/contratos/estadisticas/
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        _marcar_vencidos()
        qs = Contrato.objects.select_related('colaborador')

        vigentes  = qs.filter(estado='VIGENTE')
        vencidos  = qs.filter(estado='VENCIDO')
        terminados = qs.filter(estado='TERMINADO')

        hoy = date.today()
        limite_30 = hoy + timedelta(days=30)
        proximos_30 = vigentes.filter(fecha_fin__isnull=False, fecha_fin__lte=limite_30, fecha_fin__gte=hoy)

        proximos_lista = []
        for ct in proximos_30.order_by('fecha_fin'):
            proximos_lista.append({
                'id': ct.id, 'colaborador': ct.colaborador.nombre,
                'cargo': ct.cargo, 'punto_venta': ct.punto_venta,
                'fecha_fin': ct.fecha_fin.isoformat(),
                'dias_restantes': (ct.fecha_fin - hoy).days,
            })

        dist_tipo = {}
        for row in vigentes.values('tipo_contrato'):
            dist_tipo[row['tipo_contrato']] = dist_tipo.get(row['tipo_contrato'], 0) + 1

        dist_estado = {}
        for row in qs.values('estado'):
            dist_estado[row['estado']] = dist_estado.get(row['estado'], 0) + 1

        return Response({
            'kpis': {
                'vigentes': vigentes.count(),
                'vencidos': vencidos.count(),
                'terminados': terminados.count(),
                'proximos_a_vencer_30d': proximos_30.count(),
            },
            'proximos_a_vencer': proximos_lista,
            'distribucion_tipo': dist_tipo,
            'distribucion_estado': dist_estado,
        })
