"""
AUSENTRACK - Modelo de Procesos Disciplinarios
"""
from django.db import models
from django.conf import settings


class ProcesoDisciplinario(models.Model):

    TIPO_PROCESO_CHOICES = [
        ('LLAMADO_ATENCION',          'Llamado de Atención'),
        ('CARTA_MEJORA',              'Carta a la Mejora'),
        ('DESCARGOS',                 'Descargos'),
        ('SUSPENSION',                'Suspensión'),
        ('COMUNICADO_DISCIPLINARIO',  'Comunicado disciplinario'),
        ('SIN_ESPECIFICAR',           'Sin especificar'),
        ('OTRO',                      'Otro'),
    ]

    ESTADO_CHOICES = [
        ('EN_PROCESO',  'En Proceso'),
        ('CERRADO',     'Cerrado'),
        ('ARCHIVADO',   'Archivado'),
        ('ABIERTO',     'Abierto'),
        ('DESISTIDO',   'Desistido'),
    ]

    # Vinculo opcional al colaborador real en el sistema. Se deja opcional (null=True)
    # para no romper procesos ya creados a mano o importados antes de que existiera
    # este vinculo, y porque a veces se documenta un proceso de alguien que aun no
    # esta cargado como colaborador.
    colaborador = models.ForeignKey(
        'colaboradores.Colaborador', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='procesos_disciplinarios', db_column='id_colaborador',
    )

    # Datos del colaborador al momento del proceso (denormalizado a propósito:
    # el proceso debe conservar cómo estaban los datos en ese momento, aunque
    # el colaborador luego cambie de cargo, punto de venta o se retire).
    nombre         = models.CharField(max_length=200)
    cedula         = models.CharField(max_length=20, db_index=True)
    cargo          = models.CharField(max_length=100, blank=True, default='')
    punto_venta    = models.CharField(max_length=100, blank=True, default='')
    punto_venta_fk = models.ForeignKey(
        'puntos_venta.PuntoVenta', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='procesos_disciplinarios', db_column='id_punto_venta',
    )
    fecha_ingreso  = models.DateField(null=True, blank=True)
    antiguedad     = models.PositiveIntegerField(null=True, blank=True, help_text='Antigüedad en años')

    # Datos del proceso disciplinario
    tipo_proceso    = models.CharField(max_length=30, choices=TIPO_PROCESO_CHOICES, default='SIN_ESPECIFICAR')
    fecha_actuacion = models.DateField()
    motivo          = models.TextField()
    responsable_hr  = models.CharField(max_length=150)
    estado          = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='EN_PROCESO', db_index=True)
    resultado       = models.CharField(max_length=255, blank=True, default='')
    observaciones   = models.TextField(blank=True, default='')

    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'proceso_disciplinario'
        verbose_name = 'Proceso Disciplinario'
        ordering     = ['-fecha_actuacion', 'nombre']
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['cedula']),
        ]

    def __str__(self):
        return f'{self.nombre} - {self.get_tipo_proceso_display()} ({self.get_estado_display()})'

    def save(self, *args, **kwargs):
        # Si viene de un colaborador vinculado, hereda su punto de venta real.
        if self.colaborador_id and self.colaborador.punto_venta_id:
            self.punto_venta_fk = self.colaborador.punto_venta
        if self.punto_venta_fk_id:
            self.punto_venta = self.punto_venta_fk.nombre
        super().save(*args, **kwargs)
