"""
SIGI - Modelos de la app incapacidades
"""

from django.db import models
from colaboradores.models import Colaborador, Entidad
from authentication.models import Usuario


class Incapacidad(models.Model):

    TIPO_CHOICES = [
        ('ENFERMEDAD_GENERAL',  'Enfermedad General'),
        ('ACCIDENTE_LABORAL',   'Accidente Laboral'),
        ('ENFERMEDAD_LABORAL',  'Enfermedad Laboral'),
        ('MATERNIDAD',          'Licencia Maternidad'),
        ('PATERNIDAD',          'Licencia Paternidad'),
    ]

    RESPONSABLE_CHOICES = [
        ('EMPLEADOR', 'Empleador'),
        ('EPS',       'EPS'),
        ('ARL',       'ARL'),
    ]

    ESTADO_CHOICES = [
        ('ACTIVA',   'Activa'),
        ('EN_COBRO', 'En Cobro'),
        ('PAGADA',   'Pagada'),
        ('CERRADA',  'Cerrada'),
    ]

    id_incapacidad    = models.AutoField(primary_key=True)
    colaborador       = models.ForeignKey(Colaborador, on_delete=models.RESTRICT, db_column='id_colaborador', related_name='incapacidades')
    entidad_emisora   = models.ForeignKey(Entidad, on_delete=models.SET_NULL, null=True, blank=True, db_column='id_entidad_emisora', related_name='incapacidades')
    usuario_registro  = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='id_usuario_registro', related_name='incapacidades_registradas')
    incapacidad_padre = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, db_column='id_incapacidad_padre', related_name='prorrogas')
    tipo              = models.CharField(max_length=20, choices=TIPO_CHOICES)
    fecha_inicio      = models.DateField()
    fecha_fin         = models.DateField()
    dias              = models.IntegerField(default=0)
    diagnostico       = models.CharField(max_length=300, null=True, blank=True)
    responsable_pago  = models.CharField(max_length=10, choices=RESPONSABLE_CHOICES, default='EPS')
    estado            = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='ACTIVA')
    documento_url     = models.CharField(max_length=300, null=True, blank=True)
    observaciones     = models.TextField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'incapacidad'
        verbose_name = 'Incapacidad'
        ordering     = ['-created_at']

    def __str__(self):
        return f'{self.colaborador.nombre} - {self.tipo} - {self.fecha_inicio}'

    def calcular_responsable_pago(self):
        """
        Logica de negocio segun normativa colombiana.
        Ley 100/1993 y Decreto 1406/1999.
        - Accidente o enfermedad laboral: ARL
        - Maternidad / paternidad: EPS
        - Enfermedad general dias 1-2: Empleador
        - Enfermedad general dia 3 en adelante: EPS
        """
        if self.tipo in ('ACCIDENTE_LABORAL', 'ENFERMEDAD_LABORAL'):
            return 'ARL'
        if self.tipo in ('MATERNIDAD', 'PATERNIDAD'):
            return 'EPS'
        if self.tipo == 'ENFERMEDAD_GENERAL':
            return 'EMPLEADOR' if self.dias <= 2 else 'EPS'
        return 'EPS'

    def save(self, *args, **kwargs):
        if self.fecha_inicio and self.fecha_fin:
            delta    = self.fecha_fin - self.fecha_inicio
            self.dias = delta.days + 1
        self.responsable_pago = self.calcular_responsable_pago()
        super().save(*args, **kwargs)
