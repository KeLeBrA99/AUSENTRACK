"""
AUSENTRACK - Modelo de Puntos de Venta
"""
from django.db import models


class PuntoVenta(models.Model):

    nombre             = models.CharField(max_length=100, unique=True)
    personal_requerido = models.PositiveIntegerField(default=1, help_text='Cuantos colaboradores necesita este punto operando al 100%')
    direccion          = models.CharField(max_length=200, blank=True, default='')
    telefono           = models.CharField(max_length=20, blank=True, default='')
    notas              = models.CharField(max_length=255, blank=True, default='')
    activo             = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'punto_venta'
        verbose_name = 'Punto de Venta'
        ordering     = ['nombre']

    def __str__(self):
        return self.nombre
