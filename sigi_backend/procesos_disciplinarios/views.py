"""
AUSENTRACK - Vistas de Procesos Disciplinarios

Acceso restringido a ADMIN y TALENTO_HUMANO (informacion confidencial de GH,
igual que el panel original de referencia).
"""
from datetime import date, datetime
from io import BytesIO

from django.http import HttpResponse
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser

from authentication.permissions import EsAdmin, EsTalentoHumano
from authentication.views import registrar_auditoria
from .models import ProcesoDisciplinario
from .serializers import ProcesoDisciplinarioSerializer, ProcesoDisciplinarioListSerializer

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill
    OPENPYXL_DISPONIBLE = True
except ImportError:
    OPENPYXL_DISPONIBLE = False

DIAS_ESTANCADO = 15  # umbral de dias para marcar un caso activo como estancado


# ── LISTAR / CREAR ──────────────────────────────────────────────────────────

class ListarProcesosView(generics.ListAPIView):
    """
    GET /api/procesos-disciplinarios/
    Filtros: ?estado=&tipo_proceso=&punto_venta=&cargo=&search=
    """
    serializer_class   = ProcesoDisciplinarioListSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_queryset(self):
        qs          = ProcesoDisciplinario.objects.all()
        estado      = self.request.query_params.get('estado')
        tipo        = self.request.query_params.get('tipo_proceso')
        punto_venta = self.request.query_params.get('punto_venta')
        cargo       = self.request.query_params.get('cargo')
        search      = self.request.query_params.get('search')

        if estado:
            qs = qs.filter(estado=estado)
        if tipo:
            qs = qs.filter(tipo_proceso=tipo)
        if punto_venta:
            qs = qs.filter(punto_venta__iexact=punto_venta)
        if cargo:
            qs = qs.filter(cargo__iexact=cargo)
        if search:
            qs = qs.filter(
                Q(nombre__icontains=search) |
                Q(cedula__icontains=search) |
                Q(motivo__icontains=search)
            )
        return qs


class CrearProcesoView(generics.CreateAPIView):
    """
    POST /api/procesos-disciplinarios/crear/
    """
    serializer_class   = ProcesoDisciplinarioSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        proceso = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'proceso_disciplinario', proceso.id,
            detalle=f'Proceso registrado para {proceso.nombre}', request=self.request
        )


class DetalleProcesoView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/procesos-disciplinarios/<id>/
    DELETE solo ADMIN (elimina el registro; para "archivar" se usa PATCH estado=ARCHIVADO).
    """
    queryset           = ProcesoDisciplinario.objects.all()
    serializer_class   = ProcesoDisciplinarioSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), EsAdmin()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        proceso = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'proceso_disciplinario', proceso.id,
            detalle=f'Proceso actualizado: {proceso.nombre} -> {proceso.estado}', request=self.request
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'proceso_disciplinario', instance.id,
            detalle=f'Proceso eliminado: {instance.nombre}', request=self.request
        )
        instance.delete()


# ── ESTADISTICAS (KPIs, ranking, distribucion, alertas de riesgo) ─────────────

class EstadisticasProcesosView(APIView):
    """
    GET /api/procesos-disciplinarios/estadisticas/
    Acepta los mismos filtros que el listado para que el dashboard reaccione
    a los filtros activos en la tabla, si se desea.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        import re
        from puntos_venta.models import PuntoVenta

        def _normalizar(texto):
            return re.sub(r'[^a-z0-9]', '', texto.lower()) if texto else ''

        qs = ProcesoDisciplinario.objects.select_related('punto_venta_fk').all()

        total      = qs.count()
        activos    = qs.filter(estado__in=['EN_PROCESO', 'ABIERTO']).count()
        cerrados   = qs.filter(estado='CERRADO').count()
        archivados = qs.filter(estado='ARCHIVADO').count()
        colaboradores = qs.values('cedula').distinct().count()

        # Ranking por punto de venta: usa la relacion real cuando existe, y
        # solo recurre al texto -con comparacion flexible- para procesos
        # antiguos que aun no la tengan asignada.
        puntos_oficiales = list(PuntoVenta.objects.filter(activo=True))
        ranking = {}
        for p in qs:
            if p.punto_venta_fk_id:
                key = p.punto_venta_fk.nombre
            elif p.punto_venta:
                clave_norm = _normalizar(p.punto_venta)
                match = next((pv for pv in puntos_oficiales if _normalizar(pv.nombre) == clave_norm), None)
                key = match.nombre if match else p.punto_venta
            else:
                key = 'Sin especificar'
            ranking[key] = ranking.get(key, 0) + 1
        ranking = sorted(ranking.items(), key=lambda x: x[1], reverse=True)

        # Distribucion por estado
        dist_estado = {}
        for row in qs.values('estado'):
            dist_estado[row['estado']] = dist_estado.get(row['estado'], 0) + 1

        # Distribucion por tipo de proceso
        dist_tipo = {}
        for row in qs.values('tipo_proceso'):
            dist_tipo[row['tipo_proceso']] = dist_tipo.get(row['tipo_proceso'], 0) + 1

        # Distribucion por cargo
        dist_cargo = {}
        for row in qs.values('cargo'):
            key = row['cargo'] or 'Sin especificar'
            dist_cargo[key] = dist_cargo.get(key, 0) + 1

        # Alertas: casos estancados (activos con +15 dias desde la actuacion)
        hoy = date.today()
        estancados = []
        for p in qs.filter(estado__in=['EN_PROCESO', 'ABIERTO']):
            dias = (hoy - p.fecha_actuacion).days
            if dias >= DIAS_ESTANCADO:
                estancados.append({
                    'id': p.id, 'nombre': p.nombre, 'punto_venta': p.punto_venta,
                    'tipo_proceso': p.get_tipo_proceso_display(), 'dias': dias,
                })
        estancados.sort(key=lambda x: x['dias'], reverse=True)

        # Alertas: colaboradores reincidentes (2+ procesos por cedula)
        por_cedula = {}
        for p in qs:
            por_cedula.setdefault(p.cedula, []).append(p)
        reincidentes = []
        for cedula, procesos in por_cedula.items():
            if len(procesos) >= 2:
                tipos = sorted({pr.get_tipo_proceso_display() for pr in procesos})
                reincidentes.append({
                    'cedula': cedula, 'nombre': procesos[0].nombre,
                    'punto_venta': procesos[0].punto_venta,
                    'tipos': ', '.join(tipos), 'cantidad': len(procesos),
                })
        reincidentes.sort(key=lambda x: x['cantidad'], reverse=True)

        return Response({
            'kpis': {
                'total': total, 'activos': activos, 'cerrados': cerrados,
                'archivados': archivados, 'colaboradores': colaboradores,
            },
            'ranking_punto_venta': [{'punto_venta': k, 'cantidad': v} for k, v in ranking],
            'distribucion_estado': dist_estado,
            'distribucion_tipo_proceso': dist_tipo,
            'distribucion_cargo': dist_cargo,
            'estancados': estancados,
            'reincidentes': reincidentes,
            'umbral_dias_estancado': DIAS_ESTANCADO,
        })


# ── EXPORTAR A EXCEL ─────────────────────────────────────────────────────────

class ExportarProcesosExcelView(APIView):
    """
    GET /api/procesos-disciplinarios/exportar/
    Respeta los mismos filtros que el listado.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        if not OPENPYXL_DISPONIBLE:
            return Response(
                {'detail': 'openpyxl no esta instalado.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        qs = ProcesoDisciplinario.objects.all()
        estado      = request.query_params.get('estado')
        tipo        = request.query_params.get('tipo_proceso')
        punto_venta = request.query_params.get('punto_venta')
        cargo       = request.query_params.get('cargo')
        search      = request.query_params.get('search')

        if estado:
            qs = qs.filter(estado=estado)
        if tipo:
            qs = qs.filter(tipo_proceso=tipo)
        if punto_venta:
            qs = qs.filter(punto_venta__iexact=punto_venta)
        if cargo:
            qs = qs.filter(cargo__iexact=cargo)
        if search:
            qs = qs.filter(
                Q(nombre__icontains=search) | Q(cedula__icontains=search) | Q(motivo__icontains=search)
            )

        columnas = [
            'Colaborador', 'Cedula', 'Cargo', 'Punto de venta',
            'Fecha ingreso', 'Antiguedad (anios)', 'Tipo de proceso',
            'Fecha actuacion', 'Motivo', 'Responsable HR', 'Estado',
            'Resultado', 'Observaciones',
        ]

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Procesos Disciplinarios'
        ws.append(columnas)

        header_fill = PatternFill(start_color='A83E3E', end_color='A83E3E', fill_type='solid')
        header_font = Font(color='FFFFFF', bold=True)
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font

        for p in qs:
            ws.append([
                p.nombre, p.cedula, p.cargo, p.punto_venta,
                p.fecha_ingreso.isoformat() if p.fecha_ingreso else '',
                p.antiguedad if p.antiguedad is not None else '',
                p.get_tipo_proceso_display(),
                p.fecha_actuacion.isoformat(),
                p.motivo, p.responsable_hr, p.get_estado_display(),
                p.resultado, p.observaciones,
            ])

        for col_cells in ws.columns:
            longitud = max(len(str(c.value)) if c.value is not None else 0 for c in col_cells)
            ws.column_dimensions[col_cells[0].column_letter].width = min(longitud + 4, 50)

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        registrar_auditoria(
            request.user, 'CREATE', 'proceso_disciplinario_export', None,
            detalle=f'Exportacion Excel de procesos disciplinarios ({qs.count()} registros)', request=request
        )

        response = HttpResponse(
            buffer.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="procesos-disciplinarios.xlsx"'
        return response


# ── IMPORTAR DESDE EXCEL ─────────────────────────────────────────────────────

def _parse_fecha(valor):
    """Acepta datetime/date de openpyxl, o texto en YYYY-MM-DD o DD/MM/YYYY."""
    if valor is None or valor == '':
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


class ImportarProcesosView(APIView):
    """
    POST /api/procesos-disciplinarios/importar/  (multipart/form-data, campo 'archivo')
    Columnas esperadas (nombres tecnicos, sin importar el orden ni la fila exacta
    en la que esten -- se detecta automaticamente la fila de encabezados):
      nombre, cedula, cargo, punto_venta, fecha_ingreso, antiguedad,
      tipo_proceso, fecha_actuacion, motivo, responsable_hr, estado,
      resultado, observaciones
    Solo ADMIN y TALENTO_HUMANO.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]
    parser_classes      = [MultiPartParser]

    def post(self, request):
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'error': 'No se recibio ningun archivo.'}, status=400)

        try:
            wb = openpyxl.load_workbook(archivo, data_only=True) if OPENPYXL_DISPONIBLE else None
        except Exception:
            return Response({'error': 'No se pudo leer el archivo. Verifica que sea un .xlsx valido.'}, status=400)

        if wb is None:
            return Response({'detail': 'openpyxl no esta instalado.'}, status=500)

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))

        # Detectar la fila de encabezados tecnicos (busca la fila que tenga
        # 'nombre' y 'cedula' entre sus celdas), igual que en colaboradores,
        # para que la plantilla descargable (con titulo antes) funcione tal cual.
        encabezados = None
        header_idx  = None
        for idx, row in enumerate(rows):
            valores = [str(c).strip().lower() if c else '' for c in row]
            if 'nombre' in valores and 'cedula' in valores:
                encabezados = valores
                header_idx  = idx
                break

        if encabezados is None:
            return Response({
                'error': 'No se encontraron los encabezados. El archivo debe tener una fila con, al menos, las columnas: nombre, cedula.'
            }, status=400)

        def col(nombre):
            try:
                return encabezados.index(nombre)
            except ValueError:
                return None

        i_nombre         = col('nombre')
        i_cedula         = col('cedula')
        i_cargo          = col('cargo')
        i_punto_venta    = col('punto_venta')
        i_fecha_ingreso  = col('fecha_ingreso')
        i_antiguedad     = col('antiguedad')
        i_tipo_proceso   = col('tipo_proceso')
        i_fecha_actuacion = col('fecha_actuacion')
        i_motivo         = col('motivo')
        i_responsable_hr = col('responsable_hr')
        i_estado         = col('estado')
        i_resultado      = col('resultado')
        i_observaciones  = col('observaciones')

        filas_datos = rows[header_idx + 1:]

        def parece_fila_de_etiqueta(fila):
            valor = fila[i_nombre] if i_nombre is not None and i_nombre < len(fila) else None
            if valor is None:
                return True
            texto = str(valor).strip()
            return texto == '' or texto.endswith('*')

        while filas_datos and parece_fila_de_etiqueta(filas_datos[0]):
            filas_datos = filas_datos[1:]

        tipos_validos   = {c[0] for c in ProcesoDisciplinario.TIPO_PROCESO_CHOICES}
        estados_validos = {c[0] for c in ProcesoDisciplinario.ESTADO_CHOICES}

        exitosos = 0
        errores  = []

        for num_fila, fila in enumerate(filas_datos, start=header_idx + 2):
            try:
                nombre = str(fila[i_nombre]).strip() if i_nombre is not None and fila[i_nombre] else None
                cedula = str(fila[i_cedula]).strip() if i_cedula is not None and fila[i_cedula] else None
                if not nombre or not cedula:
                    continue  # fila vacia al final del archivo

                fecha_actuacion = _parse_fecha(fila[i_fecha_actuacion]) if i_fecha_actuacion is not None else None
                if not fecha_actuacion:
                    errores.append(f'Fila {num_fila}: fecha_actuacion invalida o vacia, fila omitida.')
                    continue

                tipo_proceso = 'SIN_ESPECIFICAR'
                if i_tipo_proceso is not None and fila[i_tipo_proceso]:
                    valor_tp = str(fila[i_tipo_proceso]).strip().upper().replace(' ', '_')
                    if valor_tp in tipos_validos:
                        tipo_proceso = valor_tp
                    else:
                        # Intentar por texto visible (ej. "Carta a la Mejora")
                        match = next((c[0] for c in ProcesoDisciplinario.TIPO_PROCESO_CHOICES
                                      if c[1].strip().lower() == str(fila[i_tipo_proceso]).strip().lower()), None)
                        tipo_proceso = match or 'SIN_ESPECIFICAR'
                        if not match:
                            errores.append(f'Fila {num_fila}: tipo_proceso "{fila[i_tipo_proceso]}" no reconocido, se uso "Sin especificar".')

                estado = 'EN_PROCESO'
                if i_estado is not None and fila[i_estado]:
                    valor_e = str(fila[i_estado]).strip().upper().replace(' ', '_')
                    if valor_e in estados_validos:
                        estado = valor_e
                    else:
                        match = next((c[0] for c in ProcesoDisciplinario.ESTADO_CHOICES
                                      if c[1].strip().lower() == str(fila[i_estado]).strip().lower()), None)
                        estado = match or 'EN_PROCESO'
                        if not match:
                            errores.append(f'Fila {num_fila}: estado "{fila[i_estado]}" no reconocido, se uso "En Proceso".')

                antiguedad = None
                if i_antiguedad is not None and fila[i_antiguedad] not in (None, ''):
                    try:
                        antiguedad = int(float(fila[i_antiguedad]))
                    except (TypeError, ValueError):
                        antiguedad = None

                ProcesoDisciplinario.objects.create(
                    nombre           = nombre.upper(),
                    cedula           = cedula,
                    cargo            = str(fila[i_cargo]).strip() if i_cargo is not None and fila[i_cargo] else '',
                    punto_venta      = str(fila[i_punto_venta]).strip() if i_punto_venta is not None and fila[i_punto_venta] else '',
                    fecha_ingreso    = _parse_fecha(fila[i_fecha_ingreso]) if i_fecha_ingreso is not None else None,
                    antiguedad       = antiguedad,
                    tipo_proceso     = tipo_proceso,
                    fecha_actuacion  = fecha_actuacion,
                    motivo           = str(fila[i_motivo]).strip() if i_motivo is not None and fila[i_motivo] else '',
                    responsable_hr   = str(fila[i_responsable_hr]).strip() if i_responsable_hr is not None and fila[i_responsable_hr] else request.user.nombre,
                    estado           = estado,
                    resultado        = str(fila[i_resultado]).strip() if i_resultado is not None and fila[i_resultado] else '',
                    observaciones    = str(fila[i_observaciones]).strip() if i_observaciones is not None and fila[i_observaciones] else '',
                )
                exitosos += 1
            except Exception as e:
                errores.append(f'Fila {num_fila}: error inesperado ({e}).')

        registrar_auditoria(
            request.user, 'CREATE', 'proceso_disciplinario_import', None,
            detalle=f'Importacion masiva: {exitosos} casos creados, {len(errores)} filas con problemas',
            request=request
        )

        return Response({'exitosos': exitosos, 'errores': errores}, status=200)


class DescargarPlantillaProcesosView(APIView):
    """
    GET /api/procesos-disciplinarios/plantilla/
    Descarga una plantilla Excel con las columnas esperadas y 2 filas de ejemplo.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def get(self, request):
        if not OPENPYXL_DISPONIBLE:
            return Response({'detail': 'openpyxl no esta instalado.'}, status=500)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Plantilla'

        ws.merge_cells('A1:H1')
        ws['A1'] = 'AUSENTRACK - Plantilla de Importacion de Procesos Disciplinarios'
        ws['A1'].font = Font(bold=True, size=13, color='A83E3E')

        ws.merge_cells('A2:H2')
        ws['A2'] = 'Complete las columnas desde la fila 6. No modifique los nombres tecnicos de la fila 4.'
        ws['A2'].font = Font(italic=True, size=10, color='6B6F76')

        columnas = [
            ('nombre',           'Nombre Completo *',    True,  26),
            ('cedula',           'Cedula *',              True,  16),
            ('cargo',            'Cargo',                 False, 20),
            ('punto_venta',      'Punto de Venta',        False, 16),
            ('fecha_ingreso',    'Fecha Ingreso',         False, 15),
            ('antiguedad',       'Antiguedad (anios)',    False, 14),
            ('tipo_proceso',     'Tipo de Proceso *',     True,  22),
            ('fecha_actuacion',  'Fecha Actuacion *',     True,  16),
            ('motivo',           'Motivo *',              True,  45),
            ('responsable_hr',   'Responsable HR *',      True,  20),
            ('estado',           'Estado',                False, 14),
            ('resultado',        'Resultado / Sancion',   False, 22),
            ('observaciones',    'Observaciones',         False, 30),
        ]

        header_fill  = PatternFill(start_color='A83E3E', end_color='A83E3E', fill_type='solid')
        header_font  = Font(color='FFFFFF', bold=True)
        visual_fill  = PatternFill(start_color='F7E7E7', end_color='F7E7E7', fill_type='solid')

        for i, (tecnico, visual, obligatorio, ancho) in enumerate(columnas, start=1):
            c1 = ws.cell(row=4, column=i, value=tecnico)
            c1.fill = header_fill
            c1.font = header_font
            c2 = ws.cell(row=5, column=i, value=visual)
            c2.fill = visual_fill
            c2.font = Font(bold=obligatorio, size=10)
            ws.column_dimensions[c2.column_letter].width = ancho

        ejemplos = [
            ('JUAN CARLOS PEREZ', '12345678', 'Mesero', 'Poke 5', '2025-01-15', 1,
             'Llamado de Atención', '2026-08-01', 'Ejemplo de motivo del proceso disciplinario.',
             'Vivian Núñez', 'En Proceso', '', ''),
            ('MARIA FERNANDA GOMEZ', '87654321', 'Cajero', 'Poke 2', '2024-06-01', 2,
             'Carta a la Mejora', '2026-08-02', 'Otro ejemplo de motivo.',
             'Vivian Núñez', 'Cerrado', 'Sanción de 1 día', 'Seguimiento en 30 días'),
        ]
        for r, fila in enumerate(ejemplos, start=6):
            for c, valor in enumerate(fila, start=1):
                ws.cell(row=r, column=c, value=valor)

        # Hoja de referencia de valores validos
        ref = wb.create_sheet('Valores válidos')
        ref['A1'] = 'Tipo de proceso'
        ref['B1'] = 'Estado'
        ref['A1'].font = ref['B1'].font = Font(bold=True)
        for i, (_, label) in enumerate(ProcesoDisciplinario.TIPO_PROCESO_CHOICES, start=2):
            ref.cell(row=i, column=1, value=label)
        for i, (_, label) in enumerate(ProcesoDisciplinario.ESTADO_CHOICES, start=2):
            ref.cell(row=i, column=2, value=label)
        ref.column_dimensions['A'].width = 28
        ref.column_dimensions['B'].width = 16

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="plantilla_procesos_disciplinarios.xlsx"'
        return response
