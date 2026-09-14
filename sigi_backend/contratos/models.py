"""
AUSENTRACK - Modelo de Contratos
"""
from django.db import models


class Contrato(models.Model):

    TIPO_CHOICES = [
        ('INDEFINIDO',           'Término Indefinido'),
        ('FIJO',                 'Término Fijo'),
        ('OBRA_LABOR',           'Obra o Labor'),
        ('APRENDIZAJE',          'Contrato de Aprendizaje'),
        ('PRESTACION_SERVICIOS', 'Prestación de Servicios'),
    ]

    ESTADO_CHOICES = [
        ('VIGENTE',   'Vigente'),
        ('VENCIDO',   'Vencido'),
        ('TERMINADO', 'Terminado'),
        ('RENOVADO',  'Renovado'),
    ]

    colaborador = models.ForeignKey(
        'colaboradores.Colaborador', on_delete=models.CASCADE,
        related_name='contratos', db_column='id_colaborador',
    )
    # Si este contrato nace de renovar uno anterior, queda encadenado aqui
    # para poder ver el historial completo de renovaciones de un colaborador.
    contrato_anterior = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='renovaciones',
    )

    tipo_contrato   = models.CharField(max_length=25, choices=TIPO_CHOICES, default='FIJO')
    cargo           = models.CharField(max_length=100)
    punto_venta     = models.CharField(max_length=100, blank=True, default='')
    punto_venta_fk  = models.ForeignKey(
        'puntos_venta.PuntoVenta', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='contratos', db_column='id_punto_venta',
    )
    salario         = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_inicio    = models.DateField()
    fecha_fin       = models.DateField(null=True, blank=True, help_text='Vacío para contratos a término indefinido')
    estado          = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='VIGENTE', db_index=True)
    responsable_hr  = models.CharField(max_length=150)
    observaciones   = models.TextField(blank=True, default='')
    fecha_terminacion = models.DateField(null=True, blank=True)
    motivo_terminacion = models.CharField(max_length=255, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'contrato'
        verbose_name = 'Contrato'
        ordering     = ['-fecha_inicio']
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['fecha_fin']),
        ]

    def __str__(self):
        return f'{self.colaborador.nombre} - {self.get_tipo_contrato_display()} ({self.get_estado_display()})'

    def save(self, *args, **kwargs):
        if self.colaborador_id and self.colaborador.punto_venta_id:
            self.punto_venta_fk = self.colaborador.punto_venta
        if self.punto_venta_fk_id:
            self.punto_venta = self.punto_venta_fk.nombre
        super().save(*args, **kwargs)

    @property
    def es_indefinido(self):
        return self.tipo_contrato == 'INDEFINIDO' or self.fecha_fin is None
