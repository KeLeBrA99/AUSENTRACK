"""
SIGI - Modelos de la app colaboradores
Entidades (EPS/ARL) y Colaboradores
"""

from django.db import models


class Empresa(models.Model):
    id_empresa   = models.AutoField(primary_key=True)
    nit          = models.CharField(max_length=20, unique=True)
    razon_social = models.CharField(max_length=150)
    sector       = models.CharField(max_length=100, null=True, blank=True)
    direccion    = models.CharField(max_length=200, null=True, blank=True)
    telefono     = models.CharField(max_length=20, null=True, blank=True)
    activo       = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = 'empresa'
        verbose_name = 'Empresa'

    def __str__(self):
        return self.razon_social


class Entidad(models.Model):

    TIPO_CHOICES = [
        ('EPS', 'EPS'),
        ('ARL', 'ARL'),
    ]

    id_entidad     = models.AutoField(primary_key=True)
    tipo           = models.CharField(max_length=3, choices=TIPO_CHOICES)
    nombre         = models.CharField(max_length=150)
    nit            = models.CharField(max_length=20, null=True, blank=True)
    telefono       = models.CharField(max_length=20, null=True, blank=True)
    plataforma_url = models.CharField(max_length=200, null=True, blank=True)
    activo         = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = 'entidad'
        verbose_name = 'Entidad'

    def __str__(self):
        return f'{self.tipo} - {self.nombre}'


class Colaborador(models.Model):
    id_colaborador = models.AutoField(primary_key=True)
    empresa        = models.ForeignKey(Empresa, on_delete=models.RESTRICT, db_column='id_empresa')
    eps            = models.ForeignKey(Entidad, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='colaboradores_eps', db_column='id_eps')
    arl            = models.ForeignKey(Entidad, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='colaboradores_arl', db_column='id_arl')
    cedula         = models.CharField(max_length=20, unique=True)
    nombre         = models.CharField(max_length=100)
    cargo          = models.CharField(max_length=100, null=True, blank=True)
    area           = models.CharField(max_length=100, null=True, blank=True)
    fecha_ingreso  = models.DateField()
    activo         = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = 'colaborador'
        verbose_name = 'Colaborador'
        ordering     = ['nombre']

    def __str__(self):
        return f'{self.nombre} - {self.cedula}'
