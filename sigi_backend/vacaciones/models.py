"""
AUSENTRACK - Modelo de Vacaciones

En Colombia el derecho estandar es 15 dias habiles de vacaciones por cada
año trabajado (equivalente a 1.25 dias por mes completo laborado). El saldo
disponible de cada colaborador se calcula en tiempo real (no se guarda un
contador aparte) a partir de su fecha de ingreso y de sus solicitudes ya
aprobadas o disfrutadas.
"""
from django.db import models

from sigi_backend.festivos import contar_dias_habiles


class SolicitudVacaciones(models.Model):

    ESTADO_CHOICES = [
        ('SOLICITADA', 'Solicitada'),
        ('APROBADA',   'Aprobada'),
        ('RECHAZADA',  'Rechazada'),
        ('DISFRUTADA', 'Disfrutada'),
        ('CANCELADA',  'Cancelada'),
    ]

    TIPO_CHOICES = [
        ('VACACIONES',            'Vacaciones'),
        ('PERMISO_NO_REMUNERADO', 'Permiso no remunerado'),
        ('PERMISO_REMUNERADO',    'Permiso remunerado'),
        ('OTRO',                  'Otro'),
    ]

    colaborador = models.ForeignKey(
        'colaboradores.Colaborador', on_delete=models.CASCADE,
        related_name='solicitudes_vacaciones', db_column='id_colaborador',
    )
    tipo_solicitud  = models.CharField(max_length=25, choices=TIPO_CHOICES, default='VACACIONES', db_index=True)
    fecha_inicio    = models.DateField()
    fecha_fin       = models.DateField()
    dias_habiles    = models.PositiveIntegerField(help_text='Calculado automaticamente: dias de lunes a viernes en el rango')

    estado          = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='SOLICITADA', db_index=True)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    origen          = models.CharField(max_length=20, default='MANUAL', help_text='MANUAL o JOTFORM')

    responsable_hr  = models.CharField(max_length=150, blank=True, default='')
    aprobado_por    = models.CharField(max_length=150, blank=True, default='')
    fecha_respuesta = models.DateTimeField(null=True, blank=True)
    motivo_rechazo  = models.CharField(max_length=255, blank=True, default='')
    observaciones   = models.TextField(blank=True, default='')

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'solicitud_vacaciones'
        verbose_name = 'Solicitud de Vacaciones'
        ordering     = ['-fecha_inicio']
        indexes = [
            models.Index(fields=['estado']),
        ]

    def __str__(self):
        return f'{self.colaborador.nombre} - {self.fecha_inicio} a {self.fecha_fin} ({self.get_estado_display()})'

    def save(self, *args, **kwargs):
        # Se recalcula siempre que se guarda el registro completo: antes solo
        # se calculaba la primera vez, y al corregir las fechas de una
        # solicitud quedaba el numero de dias viejo (y el saldo, descuadrado).
        if self.fecha_inicio and self.fecha_fin:
            self.dias_habiles = self._calcular_dias_habiles()
        super().save(*args, **kwargs)

    def _calcular_dias_habiles(self):
        """Dias habiles entre fecha_inicio y fecha_fin (ambas incluidas), sin festivos."""
        return contar_dias_habiles(self.fecha_inicio, self.fecha_fin)
