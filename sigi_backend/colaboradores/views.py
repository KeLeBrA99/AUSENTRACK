"""
SIGI - Vistas de colaboradores
"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from authentication.permissions import EsAdmin, EsTalentoHumano, EsNomina
from authentication.views import registrar_auditoria
from .models import Empresa, Entidad, Colaborador
from .serializers import (
    EmpresaSerializer,
    EntidadSerializer,
    ColaboradorSerializer,
    ColaboradorListSerializer,
    ColaboradorRetiroSerializer,
)


# ── EMPRESA ──────────────────────────────────────────────────────────────────

class ListarEmpresasView(generics.ListAPIView):
    """
    GET /api/colaboradores/empresas/
    """
    queryset           = Empresa.objects.filter(activo=True)
    serializer_class   = EmpresaSerializer
    permission_classes = [IsAuthenticated]


# ── ENTIDADES ─────────────────────────────────────────────────────────────────

class ListarEntidadesView(generics.ListAPIView):
    """
    GET /api/colaboradores/entidades/?tipo=EPS
    GET /api/colaboradores/entidades/?tipo=ARL
    """
    serializer_class   = EntidadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs   = Entidad.objects.filter(activo=True)
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs.order_by('nombre')


class CrearEntidadView(generics.CreateAPIView):
    """
    POST /api/colaboradores/entidades/crear/
    Solo ADMIN.
    """
    serializer_class   = EntidadSerializer
    permission_classes = [IsAuthenticated, EsAdmin]

    def perform_create(self, serializer):
        entidad = serializer.save()
        registrar_auditoria(self.request.user, 'CREATE', 'entidad', entidad.id_entidad, request=self.request)


class DetalleEntidadView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/colaboradores/entidades/<id>/
    Solo ADMIN.
    """
    queryset           = Entidad.objects.all()
    serializer_class   = EntidadSerializer
    permission_classes = [IsAuthenticated, EsAdmin]
    lookup_field       = 'id_entidad'

    def perform_update(self, serializer):
        entidad = serializer.save()
        registrar_auditoria(self.request.user, 'UPDATE', 'entidad', entidad.id_entidad, request=self.request)

    def perform_destroy(self, instance):
        registrar_auditoria(self.request.user, 'DELETE', 'entidad', instance.id_entidad, request=self.request)
        instance.activo = False
        instance.save()


# ── COLABORADORES ─────────────────────────────────────────────────────────────

class ColaboradoresPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class ListarColaboradoresView(generics.ListAPIView):
    """
    GET /api/colaboradores/
    Soporta filtros: ?nombre=&cedula=&area=&activo=
    Paginado: 50 por pagina (?page=N, ?page_size=N hasta 200).
    """
    serializer_class   = ColaboradorListSerializer
    permission_classes = [IsAuthenticated, EsNomina]
    pagination_class   = ColaboradoresPagination

    def get_queryset(self):
        qs      = Colaborador.objects.select_related('empresa', 'eps', 'arl', 'punto_venta')
        nombre  = self.request.query_params.get('nombre')
        cedula  = self.request.query_params.get('cedula')
        area    = self.request.query_params.get('area')
        punto_venta = self.request.query_params.get('punto_venta')
        cargo   = self.request.query_params.get('cargo')
        activo  = self.request.query_params.get('activo')
        estado  = self.request.query_params.get('estado')  # 'activo' | 'retirado'

        if nombre:
            qs = qs.filter(nombre__icontains=nombre)
        if cedula:
            qs = qs.filter(cedula__icontains=cedula)
        if area:
            qs = qs.filter(area__icontains=area)
        if punto_venta:
            qs = qs.filter(punto_venta_id=punto_venta)
        if cargo:
            qs = qs.filter(cargo__icontains=cargo)
        if activo is not None:
            qs = qs.filter(activo=activo.lower() == 'true')
        if estado:
            estado = estado.strip().lower()
            if estado in ('activo', 'activos'):
                qs = qs.filter(activo=True)
            elif estado in ('retirado', 'retirados', 'inactivo'):
                qs = qs.filter(activo=False)

        return qs.order_by('nombre')


class CrearColaboradorView(generics.CreateAPIView):
    """
    POST /api/colaboradores/crear/
    Solo ADMIN y TALENTO_HUMANO.
    """
    serializer_class   = ColaboradorSerializer
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def perform_create(self, serializer):
        colaborador = serializer.save()
        registrar_auditoria(
            self.request.user, 'CREATE', 'colaborador',
            colaborador.id_colaborador, request=self.request
        )


class DetalleColaboradorView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/colaboradores/<id>/
    """
    queryset     = Colaborador.objects.select_related('empresa', 'eps', 'arl')
    lookup_field = 'id_colaborador'

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ColaboradorSerializer
        return ColaboradorSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), EsNomina()]
        return [IsAuthenticated(), EsTalentoHumano()]

    def perform_update(self, serializer):
        colaborador = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'colaborador',
            colaborador.id_colaborador, request=self.request
        )

    def perform_destroy(self, instance):
        registrar_auditoria(
            self.request.user, 'DELETE', 'colaborador',
            instance.id_colaborador, request=self.request
        )
        instance.activo = False
        instance.save()


class RetirarColaboradorView(APIView):
    """
    POST /api/colaboradores/<id>/retirar/
    Body opcional: { "fecha_retiro": "YYYY-MM-DD", "motivo_retiro": "..." }
    Marca al colaborador como inactivo sin borrar el registro (conserva historial
    de incapacidades). Solo TALENTO_HUMANO / ADMIN.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, id_colaborador):
        colaborador = generics.get_object_or_404(Colaborador, pk=id_colaborador)
        serializer = ColaboradorRetiroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        colaborador.retirar(
            fecha=serializer.validated_data.get('fecha_retiro'),
            motivo=serializer.validated_data.get('motivo_retiro', ''),
        )
        registrar_auditoria(
            request.user, 'UPDATE', 'colaborador', colaborador.id_colaborador,
            detalle='Colaborador marcado como retirado', request=request
        )
        return Response(ColaboradorSerializer(colaborador).data, status=status.HTTP_200_OK)


class ReactivarColaboradorView(APIView):
    """
    POST /api/colaboradores/<id>/reactivar/
    Reactiva a un colaborador retirado (ej. reingreso). Solo TALENTO_HUMANO / ADMIN.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request, id_colaborador):
        colaborador = generics.get_object_or_404(Colaborador, pk=id_colaborador)
        colaborador.reactivar()
        registrar_auditoria(
            request.user, 'UPDATE', 'colaborador', colaborador.id_colaborador,
            detalle='Colaborador reactivado', request=request
        )
        return Response(ColaboradorSerializer(colaborador).data, status=status.HTTP_200_OK)


class BuscarColaboradorView(APIView):
    """
    GET /api/colaboradores/buscar/?q=termino
    Busqueda rapida por nombre o cedula.
    """
    permission_classes = [IsAuthenticated, EsNomina]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])
        colaboradores = Colaborador.objects.filter(
            activo=True
        ).filter(
            models.Q(nombre__icontains=q) | models.Q(cedula__icontains=q)
        ).select_related('eps', 'arl')[:10]

        data = [
            {
                'id_colaborador': c.id_colaborador,
                'cedula':         c.cedula,
                'nombre':         c.nombre,
                'cargo':          c.cargo,
                'area':           c.area,
                'eps':            c.eps.id_entidad if c.eps else None,
                'eps_nombre':     c.eps.nombre if c.eps else None,
                'arl':            c.arl.id_entidad if c.arl else None,
                'arl_nombre':     c.arl.nombre if c.arl else None,
            }
            for c in colaboradores
        ]
        return Response(data)


from django.db import models as django_models
BuscarColaboradorView.get.__globals__['models'] = django_models


class ImportarColaboradoresView(APIView):
    """
    POST /api/colaboradores/importar/
    Importa colaboradores desde un archivo Excel.
    Columnas esperadas: cedula, nombre, cargo, area, fecha_ingreso, nit_empresa, nit_eps, nit_arl
    Columnas nuevas (opcionales, compatibles con archivos viejos que no las traigan):
      tipo_documento (CC/CE/TI/PA/PPT, default CC)
      salario
      tipo_bono (FIJO/PROMEDIO/NINGUNO, default NINGUNO)
      valor_bono (obligatorio si tipo_bono es FIJO o PROMEDIO)
    Solo ADMIN y TALENTO_HUMANO.
    """
    permission_classes = [IsAuthenticated, EsTalentoHumano]

    def post(self, request):
        try:
            import openpyxl
        except ImportError:
            return Response({'error': 'openpyxl no esta instalado.'}, status=500)

        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'error': 'No se envio ningun archivo.'}, status=400)

        try:
            wb   = openpyxl.load_workbook(archivo)
            ws   = wb.active
            rows = list(ws.iter_rows(values_only=True))
        except Exception:
            return Response({'error': 'No se pudo leer el archivo. Verifica que sea un Excel valido (.xlsx).'}, status=400)

        if len(rows) < 2:
            return Response({'error': 'El archivo no tiene datos.'}, status=400)

        # Detectar la fila de encabezados tecnicos (busca la fila que tenga
        # 'cedula' y 'nombre' entre sus celdas, en vez de asumir que es la
        # primera fila -- la plantilla descargable trae titulo/subtitulo antes).
        encabezados = None
        header_idx = None
        for idx, row in enumerate(rows):
            valores = [str(c).strip().lower() if c else '' for c in row]
            if 'cedula' in valores and 'nombre' in valores:
                encabezados = valores
                header_idx = idx
                break

        if encabezados is None:
            return Response({
                'error': 'No se encontraron los encabezados. El archivo debe tener una fila con, al menos, las columnas: cedula, nombre.'
            }, status=400)

        def col(nombre):
            try:
                return encabezados.index(nombre)
            except ValueError:
                return None

        i_cedula         = col('cedula')
        i_tipo_documento = col('tipo_documento')
        i_nombre         = col('nombre')
        i_cargo          = col('cargo')
        i_area           = col('area')
        i_salario        = col('salario')
        i_tipo_bono      = col('tipo_bono')
        i_valor_bono     = col('valor_bono')
        i_fecha_ingreso  = col('fecha_ingreso')
        i_nit_empresa    = col('nit_empresa')
        i_nit_eps        = col('nit_eps')
        i_nit_arl        = col('nit_arl')

        if i_cedula is None or i_nombre is None:
            return Response({
                'error': 'El archivo debe tener al menos las columnas: cedula, nombre.'
            }, status=400)

        from colaboradores.models import Empresa, Entidad, Colaborador
        from datetime import datetime

        exitosos  = 0
        errores   = []

        # Filas de datos: todo lo que sigue a la fila de encabezados tecnicos.
        # Si la plantilla trae ademas una fila de etiquetas visuales
        # (ej. "Cedula *"), se salta automaticamente.
        filas_datos = rows[header_idx + 1:]

        def parece_fila_de_etiqueta(fila):
            valor = fila[i_cedula] if i_cedula is not None and i_cedula < len(fila) else None
            if valor is None:
                return True
            texto = str(valor).strip()
            return texto == '' or texto.lower().startswith('cedula') or texto.endswith('*')

        while filas_datos and parece_fila_de_etiqueta(filas_datos[0]):
            filas_datos = filas_datos[1:]

        for num_fila, fila in enumerate(filas_datos, start=header_idx + 2):
            try:
                cedula = str(fila[i_cedula]).strip() if fila[i_cedula] else None
                nombre = str(fila[i_nombre]).strip() if fila[i_nombre] else None

                if not cedula or not nombre:
                    errores.append(f'Fila {num_fila}: cedula y nombre son obligatorios.')
                    continue

                if Colaborador.objects.filter(cedula=cedula).exists():
                    errores.append(f'Fila {num_fila}: cedula {cedula} ya existe, se omitio.')
                    continue

                # Empresa
                empresa = None
                if i_nit_empresa is not None and fila[i_nit_empresa]:
                    empresa = Empresa.objects.filter(nit=str(fila[i_nit_empresa]).strip()).first()
                if not empresa:
                    empresa = Empresa.objects.first()

                # EPS
                eps = None
                if i_nit_eps is not None and fila[i_nit_eps]:
                    eps = Entidad.objects.filter(nit=str(fila[i_nit_eps]).strip(), tipo='EPS').first()

                # ARL
                arl = None
                if i_nit_arl is not None and fila[i_nit_arl]:
                    arl = Entidad.objects.filter(nit=str(fila[i_nit_arl]).strip(), tipo='ARL').first()

                # Tipo de documento (default CC si no viene o es invalido)
                tipos_doc_validos = {c[0] for c in Colaborador.TIPO_DOCUMENTO_CHOICES}
                tipo_documento = 'CC'
                if i_tipo_documento is not None and fila[i_tipo_documento]:
                    valor_td = str(fila[i_tipo_documento]).strip().upper()
                    if valor_td in tipos_doc_validos:
                        tipo_documento = valor_td
                    else:
                        errores.append(
                            f'Fila {num_fila}: tipo_documento "{valor_td}" no valido, se uso CC por defecto.'
                        )

                # Salario
                salario = None
                if i_salario is not None and fila[i_salario] not in (None, ''):
                    try:
                        salario = round(float(fila[i_salario]), 2)
                    except (TypeError, ValueError):
                        errores.append(f'Fila {num_fila}: salario invalido, se dejo vacio.')

                # Tipo de bono (default NINGUNO si no viene o es invalido)
                tipos_bono_validos = {c[0] for c in Colaborador.TIPO_BONO_CHOICES}
                tipo_bono = 'NINGUNO'
                if i_tipo_bono is not None and fila[i_tipo_bono]:
                    valor_tb = str(fila[i_tipo_bono]).strip().upper()
                    if valor_tb in tipos_bono_validos:
                        tipo_bono = valor_tb
                    else:
                        errores.append(
                            f'Fila {num_fila}: tipo_bono "{valor_tb}" no valido, se uso NINGUNO por defecto.'
                        )

                # Valor del bono
                valor_bono = None
                if i_valor_bono is not None and fila[i_valor_bono] not in (None, ''):
                    try:
                        valor_bono = round(float(fila[i_valor_bono]), 2)
                    except (TypeError, ValueError):
                        errores.append(f'Fila {num_fila}: valor_bono invalido, se dejo vacio.')

                if tipo_bono in ('FIJO', 'PROMEDIO') and valor_bono is None:
                    errores.append(
                        f'Fila {num_fila}: tipo_bono es {tipo_bono} pero no tiene valor_bono, se guardo como NINGUNO.'
                    )
                    tipo_bono = 'NINGUNO'

                # Fecha ingreso
                fecha_ingreso = None
                if i_fecha_ingreso is not None and fila[i_fecha_ingreso]:
                    val = fila[i_fecha_ingreso]
                    if isinstance(val, datetime):
                        fecha_ingreso = val.date()
                    else:
                        try:
                            fecha_ingreso = datetime.strptime(str(val).strip(), '%Y-%m-%d').date()
                        except Exception:
                            try:
                                fecha_ingreso = datetime.strptime(str(val).strip(), '%d/%m/%Y').date()
                            except Exception:
                                pass

                # Vincular con el punto de venta oficial (si existe uno que coincida,
                # ignorando mayusculas/espacios/puntuacion, ej. "Poke2" == "Poke 2")
                area_texto = str(fila[i_area]).strip() if i_area is not None and fila[i_area] else ''
                punto_venta = None
                if area_texto:
                    from puntos_venta.models import PuntoVenta
                    import re as _re
                    clave = _re.sub(r'[^a-z0-9]', '', area_texto.lower())
                    for pv in PuntoVenta.objects.filter(activo=True):
                        if _re.sub(r'[^a-z0-9]', '', pv.nombre.lower()) == clave:
                            punto_venta = pv
                            break

                Colaborador.objects.create(
                    cedula         = cedula,
                    tipo_documento = tipo_documento,
                    nombre         = nombre,
                    cargo          = str(fila[i_cargo]).strip()         if i_cargo is not None and fila[i_cargo] else '',
                    area           = area_texto,
                    punto_venta    = punto_venta,
                    salario        = salario,
                    tipo_bono      = tipo_bono,
                    valor_bono     = valor_bono,
                    fecha_ingreso  = fecha_ingreso,
                    empresa        = empresa,
                    eps            = eps,
                    arl            = arl,
                )
                exitosos += 1

            except Exception as e:
                errores.append(f'Fila {num_fila}: {str(e)}')

        from authentication.views import registrar_auditoria
        registrar_auditoria(
            request.user, 'CREATE', 'colaborador', 0,
            detalle=f'Importacion masiva: {exitosos} exitosos, {len(errores)} errores',
            request=request
        )

        return Response({
            'exitosos': exitosos,
            'errores':  errores,
            'mensaje':  f'Se importaron {exitosos} colaboradores correctamente.'
        })


class DescargarPlantillaView(APIView):
    """
    GET /api/colaboradores/plantilla/
    Genera y descarga la plantilla Excel para importacion masiva.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            from openpyxl.utils import get_column_letter
            import io
            from django.http import HttpResponse
        except ImportError:
            return Response({'error': 'openpyxl no esta instalado.'}, status=500)

        wb = Workbook()
        ws = wb.active
        ws.title = 'Colaboradores'

        color_azul  = '1F3864'
        color_verde = '1D6F42'
        borde = Border(
            left=Side(style='thin', color='CCCCCC'),
            right=Side(style='thin', color='CCCCCC'),
            top=Side(style='thin', color='CCCCCC'),
            bottom=Side(style='thin', color='CCCCCC'),
        )

        # Titulo
        ws.merge_cells('A1:H1')
        ws['A1'] = 'AUSENTRACK - Plantilla de Importacion de Colaboradores'
        ws['A1'].font      = Font(bold=True, size=13, color='FFFFFF')
        ws['A1'].fill      = PatternFill(fill_type='solid', fgColor=color_azul)
        ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
        ws.row_dimensions[1].height = 28

        # Subtitulo
        ws.merge_cells('A2:H2')
        ws['A2'] = 'Completa los datos a partir de la fila 6. Campos en VERDE son obligatorios.'
        ws['A2'].font      = Font(size=10, color='555555', italic=True)
        ws['A2'].fill      = PatternFill(fill_type='solid', fgColor='EBF5FB')
        ws['A2'].alignment = Alignment(horizontal='center', vertical='center')
        ws.row_dimensions[2].height = 18

        # Leyenda
        ws.merge_cells('A3:D3')
        ws['A3'] = '* Campo obligatorio (verde) | Campos opcionales (azul)'
        ws['A3'].font      = Font(size=9, color='666666', italic=True)
        ws['A3'].alignment = Alignment(horizontal='left', vertical='center')
        ws.row_dimensions[3].height = 14

        # Fila tecnica (nombres de columna para el sistema)
        columnas = [
            ('cedula',         'Cedula',           True,  18),
            ('tipo_documento', 'Tipo Documento',   False, 16),
            ('nombre',         'Nombre Completo',  True,  28),
            ('cargo',          'Cargo',            False, 22),
            ('area',           'Area',             False, 18),
            ('salario',        'Salario',          False, 16),
            ('tipo_bono',      'Tipo Bono',        False, 14),
            ('valor_bono',     'Valor Bono',       False, 16),
            ('fecha_ingreso',  'Fecha Ingreso',    False, 16),
            ('nit_empresa',    'NIT Empresa',      False, 18),
            ('nit_eps',        'NIT EPS',          False, 16),
            ('nit_arl',        'NIT ARL',          False, 16),
        ]

        for col_num, (key, label, requerido, ancho) in enumerate(columnas, start=1):
            letra = get_column_letter(col_num)
            # Fila 4: nombre tecnico (lo lee el backend)
            c4 = ws.cell(row=4, column=col_num, value=key)
            c4.font      = Font(bold=True, size=9, color='888888')
            c4.fill      = PatternFill(fill_type='solid', fgColor='F2F2F2')
            c4.alignment = Alignment(horizontal='center')
            c4.border    = borde
            # Fila 5: etiqueta visual
            c5 = ws.cell(row=5, column=col_num, value=label + (' *' if requerido else ''))
            c5.font      = Font(bold=True, size=11, color='FFFFFF')
            c5.fill      = PatternFill(fill_type='solid', fgColor=color_verde if requerido else color_azul)
            c5.alignment = Alignment(horizontal='center', vertical='center')
            c5.border    = borde
            ws.column_dimensions[letra].width = ancho

        ws.row_dimensions[4].height = 16
        ws.row_dimensions[5].height = 24

        # Filas de ejemplo
        ejemplos = [
            ('12345678', 'CC', 'Juan Carlos Perez',    'Analista',     'Tecnologia',     '2500000', 'FIJO',     '150000', '2024-01-15', '900123456-1', '', ''),
            ('87654321', 'CC', 'Maria Fernanda Gomez', 'Coordinadora', 'Talento Humano', '3200000', 'PROMEDIO', '200000', '2023-06-01', '900123456-1', '', ''),
        ]
        for fila_num, datos in enumerate(ejemplos, start=6):
            es_par = fila_num % 2 == 0
            for col_num, valor in enumerate(datos, start=1):
                celda           = ws.cell(row=fila_num, column=col_num, value=valor)
                celda.fill      = PatternFill(fill_type='solid', fgColor='EBF5FB' if es_par else 'FFFFFF')
                celda.border    = borde
                celda.alignment = Alignment(vertical='center')
            ws.row_dimensions[fila_num].height = 20

        # Hoja referencia
        ws2 = wb.create_sheet('Referencia')
        ws2.merge_cells('A1:C1')
        ws2['A1'] = 'GUIA DE CAMPOS'
        ws2['A1'].font      = Font(bold=True, size=12, color='FFFFFF')
        ws2['A1'].fill      = PatternFill(fill_type='solid', fgColor=color_azul)
        ws2['A1'].alignment = Alignment(horizontal='center')
        refs = [
            ('Campo',         'Descripcion',                           'Ejemplo'),
            ('cedula',        'Numero de cedula',                      '12345678'),
            ('tipo_documento','CC, CE, TI, PA o PPT (default CC)',     'CC'),
            ('nombre',        'Nombre completo',                       'Juan Perez'),
            ('cargo',         'Cargo o puesto',                        'Analista'),
            ('area',          'Area o departamento',                   'Sistemas'),
            ('salario',       'Salario mensual (numero, sin puntos ni $)', '2500000'),
            ('tipo_bono',     'FIJO, PROMEDIO o NINGUNO (default NINGUNO)', 'FIJO'),
            ('valor_bono',    'Obligatorio si tipo_bono es FIJO o PROMEDIO', '150000'),
            ('fecha_ingreso', 'Fecha formato YYYY-MM-DD o DD/MM/YYYY', '2024-01-15'),
            ('nit_empresa',   'NIT de la empresa (debe existir en el sistema)', '900123456-1'),
            ('nit_eps',       'NIT de la EPS registrada en el sistema', ''),
            ('nit_arl',       'NIT de la ARL registrada en el sistema', ''),
        ]
        for i, (c, d, e) in enumerate(refs, start=2):
            ws2.cell(row=i, column=1, value=c).font = Font(bold=(i == 2))
            ws2.cell(row=i, column=2, value=d)
            ws2.cell(row=i, column=3, value=e)
            for col in range(1, 4):
                ws2.cell(row=i, column=col).border    = borde
                ws2.cell(row=i, column=col).alignment = Alignment(vertical='center')
            ws2.row_dimensions[i].height = 18
        ws2.column_dimensions['A'].width = 18
        ws2.column_dimensions['B'].width = 45
        ws2.column_dimensions['C'].width = 20

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="plantilla_colaboradores.xlsx"'
        return response

class EstadisticasColaboradoresView(APIView):
    """
    GET /api/colaboradores/estadisticas/
    Resumen para el dashboard general: activos/retirados, distribucion por
    punto de venta y por cargo.
    """
    permission_classes = [IsAuthenticated, EsNomina]

    def get(self, request):
        import re
        from puntos_venta.models import PuntoVenta

        def _normalizar(texto):
            return re.sub(r'[^a-z0-9]', '', texto.lower()) if texto else ''

        qs = Colaborador.objects.all()
        activos = qs.filter(activo=True).select_related('punto_venta')
        retirados = qs.filter(activo=False)

        puntos_oficiales = list(PuntoVenta.objects.filter(activo=True))

        # Se agrupa por el punto de venta oficial (relacion real) siempre que
        # exista; solo se recurre al texto libre de 'area' -y su comparacion
        # flexible- para colaboradores que aun no tengan la relacion asignada,
        # evitando que "Poke 2" y "Poke2" cuenten como sitios distintos.
        por_area = {}
        for c in activos:
            if c.punto_venta_id:
                key = c.punto_venta.nombre
            elif c.area:
                clave_norm = _normalizar(c.area)
                match = next((p for p in puntos_oficiales if _normalizar(p.nombre) == clave_norm), None)
                key = match.nombre if match else c.area
            else:
                key = 'Sin especificar'
            por_area[key] = por_area.get(key, 0) + 1
        ranking_area = sorted(por_area.items(), key=lambda x: x[1], reverse=True)

        por_cargo = {}
        for row in activos.values('cargo'):
            key = row['cargo'] or 'Sin especificar'
            por_cargo[key] = por_cargo.get(key, 0) + 1
        ranking_cargo = sorted(por_cargo.items(), key=lambda x: x[1], reverse=True)

        return Response({
            'total': qs.count(),
            'activos': activos.count(),
            'retirados': retirados.count(),
            'puntos_de_venta': len(por_area),
            'por_punto_venta': [{'punto_venta': k, 'cantidad': v} for k, v in ranking_area],
            'por_cargo': [{'cargo': k, 'cantidad': v} for k, v in ranking_cargo[:10]],
        })
