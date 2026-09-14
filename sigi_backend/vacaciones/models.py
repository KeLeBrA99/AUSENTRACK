"""
AUSENTRACK - Modelo de Vacaciones

En Colombia el derecho estandar es 15 dias habiles de vacaciones por cada
año trabajado (equivalente a 1.25 dias por mes completo laborado). El saldo
disponible de cada colaborador se calcula en tiempo real (no se guarda un
contador aparte) a partir de su fecha de ingreso y de sus solicitudes ya
aprobadas o disfrutadas.
"""
from django.db import models
from datetime import timedelta


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
        if self.fecha_inicio and self.fecha_fin and not self.dias_habiles:
            self.dias_habiles = self._calcular_dias_habiles()
        super().save(*args, **kwargs)

    def _calcular_dias_habiles(self):
        """Cuenta los dias de lunes a viernes entre fecha_inicio y fecha_fin (ambas incluidas)."""
        dias = 0
        actual = self.fecha_inicio
        while actual <= self.fecha_fin:
            if actual.weekday() < 5:  # 0=lunes ... 4=viernes
                dias += 1
            actual += timedelta(days=1)
        return dias
