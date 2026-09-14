"""
AUSENTRACK - Modelos de Dotación y EPP (parte del modulo SST)

Pilar 2 de SST: control de inventario/stock por talla, registro de entregas
con constancia de recibido, y una matriz de riesgos que define que elementos
requiere cada cargo/punto de venta (pilar 3), para poder comparar lo
requerido contra lo efectivamente entregado.
"""
from django.db import models


class ElementoDotacion(models.Model):
    """Catalogo de prendas de dotacion y elementos de proteccion personal (EPP)."""

    CATEGORIA_CHOICES = [
        ('UNIFORME', 'Uniforme / Dotación'),
        ('EPP',      'Elemento de Protección Personal'),
    ]

    nombre        = models.CharField(max_length=150)
    categoria     = models.CharField(max_length=10, choices=CATEGORIA_CHOICES, default='UNIFORME')
    usa_talla     = models.BooleanField(default=True, help_text='Si aplica, se controla stock por talla (ropa, botas, etc.)')
    vida_util_meses = models.PositiveIntegerField(null=True, blank=True, help_text='Cada cuantos meses se debe reponer (ley/desgaste). Vacío = sin periodicidad fija')
    activo        = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = 'elemento_dotacion'
        verbose_name = 'Elemento de Dotación/EPP'
        ordering     = ['categoria', 'nombre']

    def __str__(self):
        return f'{self.nombre} ({self.get_categoria_display()})'


class InventarioElemento(models.Model):
    """Stock disponible de un elemento, opcionalmente desglosado por talla."""

    elemento    = models.ForeignKey(ElementoDotacion, on_delete=models.CASCADE, related_name='inventario')
    talla       = models.CharField(max_length=10, blank=True, default='', help_text='Vacío si el elemento no maneja talla')
    cantidad_disponible = models.IntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(default=5, help_text='Debajo de esta cantidad se genera alerta de reposición')
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'inventario_elemento'
        verbose_name = 'Inventario de Elemento'
        unique_together = [('elemento', 'talla')]
        ordering     = ['elemento__nombre', 'talla']

    def __str__(self):
        talla = f' - Talla {self.talla}' if self.talla else ''
        return f'{self.elemento.nombre}{talla}: {self.cantidad_disponible} disp.'


class EntregaDotacion(models.Model):
    """
    Encabezado de una entrega de dotacion/EPP a un colaborador. El detalle
    (que elementos y cuantos) vive en DetalleEntregaDotacion.
    """

    TIPO_CHOICES = [
        ('INGRESO',    'Ingreso (dotación inicial)'),
        ('PERIODICA',  'Entrega periódica (ley)'),
        ('REPOSICION', 'Reposición por desgaste/daño'),
    ]

    colaborador     = models.ForeignKey('colaboradores.Colaborador', on_delete=models.CASCADE, related_name='entregas_dotacion', db_column='id_colaborador')
    tipo_entrega    = models.CharField(max_length=10, choices=TIPO_CHOICES, default='INGRESO')
    fecha_entrega   = models.DateField()
    responsable_hr  = models.CharField(max_length=150)
    firma_recibido  = models.BooleanField(default=False, help_text='Constancia de recibido firmada por el colaborador')
    observaciones   = models.TextField(blank=True, default='')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = 'entrega_dotacion'
        verbose_name = 'Entrega de Dotación'
        ordering     = ['-fecha_entrega']

    def __str__(self):
        return f'{self.colaborador.nombre} - {self.get_tipo_entrega_display()} ({self.fecha_entrega})'


class DetalleEntregaDotacion(models.Model):
    """Cada linea (elemento + talla + cantidad) dentro de una entrega."""

    entrega   = models.ForeignKey(EntregaDotacion, on_delete=models.CASCADE, related_name='detalles')
    elemento  = models.ForeignKey(ElementoDotacion, on_delete=models.PROTECT, related_name='entregas')
    talla     = models.CharField(max_length=10, blank=True, default='')
    cantidad  = models.PositiveIntegerField(default=1)

    class Meta:
        db_table     = 'detalle_entrega_dotacion'
        verbose_name = 'Detalle de Entrega'

    def __str__(self):
        return f'{self.elemento.nombre} x{self.cantidad}'


class RequisitoElemento(models.Model):
    """
    Matriz de riesgos / seguimiento operativo (pilar 3): que elemento requiere
    cada cargo, opcionalmente restringido a un punto de venta especifico.
    Vacio en punto_venta = aplica a ese cargo en todos los puntos.
    """

    cargo       = models.CharField(max_length=100, help_text='Debe coincidir con el cargo del colaborador')
    punto_venta = models.ForeignKey('puntos_venta.PuntoVenta', on_delete=models.CASCADE, null=True, blank=True, related_name='requisitos_dotacion')
    elemento    = models.ForeignKey(ElementoDotacion, on_delete=models.CASCADE, related_name='requisitos')
    obligatorio = models.BooleanField(default=True)

    class Meta:
        db_table     = 'requisito_elemento'
        verbose_name = 'Requisito de Elemento por Cargo'
        unique_together = [('cargo', 'punto_venta', 'elemento')]
        ordering     = ['cargo']

    def __str__(self):
        punto = f' @ {self.punto_venta.nombre}' if self.punto_venta_id else ' (todos los puntos)'
        return f'{self.cargo}{punto} -> {self.elemento.nombre}'
