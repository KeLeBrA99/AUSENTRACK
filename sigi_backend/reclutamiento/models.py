"""
AUSENTRACK - Modelos de Reclutamiento y Selección
"""
from django.db import models


class Vacante(models.Model):

    ESTADO_CHOICES = [
        ('ABIERTA',  'Abierta'),
        ('PAUSADA',  'Pausada'),
        ('CERRADA',  'Cerrada'),
        ('CUBIERTA', 'Cubierta'),
    ]

    cargo             = models.CharField(max_length=100)
    punto_venta       = models.CharField(max_length=100, blank=True, default='')
    # Vinculo real al punto de venta oficial. Se mantiene 'punto_venta' de
    # texto por compatibilidad (se sincroniza automaticamente al guardar).
    punto_venta_fk    = models.ForeignKey(
        'puntos_venta.PuntoVenta', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='vacantes', db_column='id_punto_venta',
    )
    salario_ofrecido  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    descripcion       = models.TextField(blank=True, default='')
    requisitos        = models.TextField(blank=True, default='')
    responsable_hr    = models.CharField(max_length=150)
    estado            = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='ABIERTA', db_index=True)
    fecha_apertura    = models.DateField()
    fecha_cierre      = models.DateField(null=True, blank=True)
    vacantes_disponibles = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'vacante'
        verbose_name = 'Vacante'
        ordering     = ['-fecha_apertura']

    def __str__(self):
        return f'{self.cargo} - {self.punto_venta} ({self.get_estado_display()})'

    def save(self, *args, **kwargs):
        if self.punto_venta_fk_id:
            self.punto_venta = self.punto_venta_fk.nombre
        super().save(*args, **kwargs)


class Candidato(models.Model):

    ETAPA_CHOICES = [
        ('POSTULADO',       'Postulado'),
        ('ENTREVISTA_RH',   'Entrevista RH'),
        ('ENTREVISTA_JEFE', 'Entrevista Jefe de Área'),
        ('PRUEBAS',         'Pruebas / Exámenes'),
        ('OFERTA',          'Oferta enviada'),
        ('CONTRATADO',      'Contratado'),
        ('RECHAZADO',       'Rechazado'),
        ('DESISTIO',        'Desistió'),
    ]

    vacante        = models.ForeignKey(Vacante, on_delete=models.CASCADE, related_name='candidatos')
    # Se llena automaticamente cuando el candidato pasa a CONTRATADO y se genera
    # su ficha de colaborador (ver logica en la vista de actualizacion).
    colaborador    = models.ForeignKey(
        'colaboradores.Colaborador', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='candidatura_origen', db_column='id_colaborador',
    )
    nombre         = models.CharField(max_length=200)
    cedula         = models.CharField(max_length=20, db_index=True)
    telefono       = models.CharField(max_length=30, blank=True, default='')
    email          = models.EmailField(blank=True, default='')
    etapa          = models.CharField(max_length=20, choices=ETAPA_CHOICES, default='POSTULADO', db_index=True)
    fecha_postulacion = models.DateField()
    fuente         = models.CharField(max_length=100, blank=True, default='', help_text='Ej: Computrabajo, referido, redes sociales')
    notas          = models.TextField(blank=True, default='')
    motivo_rechazo = models.CharField(max_length=255, blank=True, default='')
    responsable_hr = models.CharField(max_length=150)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'candidato'
        verbose_name = 'Candidato'
        ordering     = ['-fecha_postulacion']
        indexes = [
            models.Index(fields=['etapa']),
            models.Index(fields=['cedula']),
        ]

    def __str__(self):
        return f'{self.nombre} - {self.vacante.cargo} ({self.get_etapa_display()})'
