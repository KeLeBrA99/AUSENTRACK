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
        ('CCF', 'Caja de Compensación Familiar'),
        ('AFP', 'Fondo de Pensión'),
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

    TIPO_DOCUMENTO_CHOICES = [
        ('CC',  'Cédula de Ciudadanía'),
        ('CE',  'Cédula de Extranjería'),
        ('TI',  'Tarjeta de Identidad'),
        ('PA',  'Pasaporte'),
        ('PPT', 'Permiso por Protección Temporal'),
    ]

    TIPO_BONO_CHOICES = [
        ('FIJO',     'Fijo'),
        ('PROMEDIO', 'Promedio'),
        ('NINGUNO',  'Sin bono'),
    ]

    id_colaborador  = models.AutoField(primary_key=True)
    empresa         = models.ForeignKey(Empresa, on_delete=models.RESTRICT, db_column='id_empresa')
    eps             = models.ForeignKey(Entidad, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='colaboradores_eps', db_column='id_eps')
    arl             = models.ForeignKey(Entidad, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='colaboradores_arl', db_column='id_arl')
    caja_compensacion = models.ForeignKey(Entidad, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='colaboradores_ccf', db_column='id_caja_compensacion')
    fondo_pension   = models.ForeignKey(Entidad, on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='colaboradores_afp', db_column='id_fondo_pension')
    cedula          = models.CharField(max_length=20, unique=True)
    tipo_documento  = models.CharField(max_length=3, choices=TIPO_DOCUMENTO_CHOICES, default='CC')
    nombre          = models.CharField(max_length=100)
    cargo           = models.CharField(max_length=100, null=True, blank=True)
    area            = models.CharField(max_length=100, null=True, blank=True)
    # Vinculo real al punto de venta oficial (ademas del campo 'area' de texto
    # libre, que se mantiene por compatibilidad y se sincroniza automaticamente
    # cuando se asigna un punto_venta). Esto evita que "Poke 2" y "Poke2" se
    # cuenten como sitios distintos.
    punto_venta     = models.ForeignKey(
        'puntos_venta.PuntoVenta', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='colaboradores', db_column='id_punto_venta',
    )
    salario         = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    tipo_bono       = models.CharField(max_length=10, choices=TIPO_BONO_CHOICES, default='NINGUNO')
    valor_bono      = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Valor fijo del bono, o promedio histórico si tipo_bono='PROMEDIO'"
    )
    fecha_ingreso   = models.DateField()
    activo          = models.BooleanField(default=True)
    fecha_retiro    = models.DateField(null=True, blank=True)
    motivo_retiro   = models.CharField(max_length=255, null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = 'colaborador'
        verbose_name = 'Colaborador'
        ordering     = ['nombre']

    def __str__(self):
        estado = 'Activo' if self.activo else 'Retirado'
        return f'{self.nombre} - {self.cedula} ({estado})'

    def save(self, *args, **kwargs):
        # Si se asigna un punto_venta oficial, el campo 'area' de texto se
        # mantiene sincronizado con su nombre (asi todo lo que ya lee 'area'
        # en otros modulos sigue funcionando sin cambios).
        if self.punto_venta_id:
            self.area = self.punto_venta.nombre
        super().save(*args, **kwargs)

    def retirar(self, fecha=None, motivo=''):
        """Marca al colaborador como retirado sin borrar el registro,
        para conservar el historial de incapacidades asociadas."""
        from django.utils import timezone
        self.activo = False
        self.fecha_retiro = fecha or timezone.now().date()
        self.motivo_retiro = motivo
        self.save(update_fields=['activo', 'fecha_retiro', 'motivo_retiro'])

    def reactivar(self):
        """Reactiva a un colaborador retirado (ej. reingreso)."""
        self.activo = True
        self.fecha_retiro = None
        self.motivo_retiro = None
        self.save(update_fields=['activo', 'fecha_retiro', 'motivo_retiro'])
