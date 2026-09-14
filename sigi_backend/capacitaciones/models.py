"""
AUSENTRACK - Modelos de Capacitaciones e Inducción
"""
from django.db import models


class Capacitacion(models.Model):

    TIPO_CHOICES = [
        ('INDUCCION',            'Inducción'),
        ('CAPACITACION_TECNICA', 'Capacitación Técnica'),
        ('SEGURIDAD_SALUD',      'Seguridad y Salud en el Trabajo'),
        ('LIDERAZGO',            'Liderazgo'),
        ('SERVICIO_CLIENTE',     'Servicio al Cliente'),
        ('OTRO',                 'Otro'),
    ]

    MODALIDAD_CHOICES = [
        ('PRESENCIAL', 'Presencial'),
        ('VIRTUAL',    'Virtual'),
        ('MIXTA',      'Mixta'),
    ]

    ESTADO_CHOICES = [
        ('PROGRAMADA', 'Programada'),
        ('EN_CURSO',   'En Curso'),
        ('FINALIZADA', 'Finalizada'),
        ('CANCELADA',  'Cancelada'),
    ]

    titulo          = models.CharField(max_length=200)
    tipo            = models.CharField(max_length=25, choices=TIPO_CHOICES, default='CAPACITACION_TECNICA')
    descripcion     = models.TextField(blank=True, default='')
    instructor      = models.CharField(max_length=150, blank=True, default='')
    modalidad       = models.CharField(max_length=12, choices=MODALIDAD_CHOICES, default='PRESENCIAL')
    fecha_inicio    = models.DateField()
    fecha_fin       = models.DateField(null=True, blank=True)
    duracion_horas  = models.DecimalField(max_digits=5, decimal_places=1, default=1)
    punto_venta     = models.CharField(max_length=100, blank=True, default='', help_text='Vacío = aplica a todos los puntos')
    punto_venta_fk  = models.ForeignKey(
        'puntos_venta.PuntoVenta', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='capacitaciones', db_column='id_punto_venta',
    )
    cupo_maximo     = models.PositiveIntegerField(null=True, blank=True)
    estado          = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='PROGRAMADA', db_index=True)
    responsable_hr  = models.CharField(max_length=150)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'capacitacion'
        verbose_name = 'Capacitación'
        ordering     = ['-fecha_inicio']

    def __str__(self):
        return f'{self.titulo} ({self.get_tipo_display()})'

    def save(self, *args, **kwargs):
        if self.punto_venta_fk_id:
            self.punto_venta = self.punto_venta_fk.nombre
        super().save(*args, **kwargs)


class ParticipanteCapacitacion(models.Model):

    ESTADO_CHOICES = [
        ('INSCRITO',     'Inscrito'),
        ('ASISTIO',      'Asistió'),
        ('NO_ASISTIO',   'No asistió'),
        ('COMPLETADO',   'Completado'),
    ]

    capacitacion = models.ForeignKey(Capacitacion, on_delete=models.CASCADE, related_name='participantes')
    colaborador  = models.ForeignKey(
        'colaboradores.Colaborador', on_delete=models.CASCADE,
        related_name='capacitaciones', db_column='id_colaborador',
    )
    estado_asistencia   = models.CharField(max_length=12, choices=ESTADO_CHOICES, default='INSCRITO')
    calificacion         = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    certificado_emitido  = models.BooleanField(default=False)
    observaciones         = models.CharField(max_length=255, blank=True, default='')
    fecha_inscripcion     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'participante_capacitacion'
        verbose_name    = 'Participante de Capacitación'
        unique_together = [('capacitacion', 'colaborador')]

    def __str__(self):
        return f'{self.colaborador.nombre} - {self.capacitacion.titulo} ({self.get_estado_asistencia_display()})'
