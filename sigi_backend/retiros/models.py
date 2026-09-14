"""
AUSENTRACK - Modelo de Retiros (offboarding)

Complementa el flag simple activo/fecha_retiro que ya existe en Colaborador:
aqui se documenta el proceso completo de salida (tipo, checklist de entrega,
liquidacion, entrevista de salida), y al crear un Retiro se marca
automaticamente al colaborador como retirado, para que ambos queden
sincronizados sin doble digitacion.
"""
from django.db import models


class Retiro(models.Model):

    TIPO_CHOICES = [
        ('RENUNCIA_VOLUNTARIA',      'Renuncia voluntaria'),
        ('DESPIDO_CON_JUSTA_CAUSA',  'Despido con justa causa'),
        ('DESPIDO_SIN_JUSTA_CAUSA',  'Despido sin justa causa'),
        ('TERMINACION_CONTRATO',     'Terminación de contrato (vencimiento)'),
        ('MUTUO_ACUERDO',            'Mutuo acuerdo'),
        ('ABANDONO_PUESTO',          'Abandono del puesto'),
        ('OTRO',                     'Otro'),
    ]

    ESTADO_LIQUIDACION_CHOICES = [
        ('PENDIENTE',  'Pendiente'),
        ('EN_PROCESO', 'En proceso'),
        ('PAGADA',     'Pagada'),
    ]

    colaborador = models.ForeignKey(
        'colaboradores.Colaborador', on_delete=models.CASCADE,
        related_name='retiros', db_column='id_colaborador',
    )
    tipo_retiro          = models.CharField(max_length=25, choices=TIPO_CHOICES, default='RENUNCIA_VOLUNTARIA')
    motivo               = models.TextField(blank=True, default='')
    fecha_retiro          = models.DateField(help_text='Fecha en que se formaliza el retiro')
    ultimo_dia_laborado  = models.DateField(null=True, blank=True, help_text='Si es distinto a la fecha de retiro (ej. preaviso)')
    responsable_hr       = models.CharField(max_length=150)

    # Checklist de entrega / paz y salvo
    devolucion_dotacion  = models.BooleanField(default=False, help_text='Uniforme, herramientas de trabajo')
    devolucion_equipos   = models.BooleanField(default=False, help_text='Equipos electrónicos, llaves, accesos')
    paz_y_salvo_emitido  = models.BooleanField(default=False)
    carta_laboral_entregada = models.BooleanField(default=False)

    estado_liquidacion   = models.CharField(max_length=10, choices=ESTADO_LIQUIDACION_CHOICES, default='PENDIENTE')
    fecha_liquidacion    = models.DateField(null=True, blank=True)

    entrevista_realizada = models.BooleanField(default=False)
    entrevista_notas     = models.TextField(blank=True, default='')
    recomendable_recontratacion = models.BooleanField(null=True, blank=True, help_text='Vacio = no evaluado')

    observaciones = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'retiro'
        verbose_name = 'Retiro'
        ordering     = ['-fecha_retiro']
        indexes = [
            models.Index(fields=['tipo_retiro']),
            models.Index(fields=['estado_liquidacion']),
        ]

    def __str__(self):
        return f'{self.colaborador.nombre} - {self.get_tipo_retiro_display()} ({self.fecha_retiro})'

    def checklist_completo(self):
        return all([self.devolucion_dotacion, self.devolucion_equipos, self.paz_y_salvo_emitido])
