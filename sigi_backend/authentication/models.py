"""
SIGI - Modelos de la app authentication
Modelo de usuario personalizado con roles
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UsuarioManager(BaseUserManager):

    def create_user(self, email, nombre, password=None, **extra_fields):
        if not email:
            raise ValueError('El email es obligatorio')
        email = self.normalize_email(email)
        user = self.model(email=email, nombre=nombre, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, nombre, password=None, **extra_fields):
        extra_fields.setdefault('rol', 'ADMIN')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, nombre, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):

    ROL_CHOICES = [
        ('ADMIN', 'Administrador'),
        ('TALENTO_HUMANO', 'Talento Humano'),
        ('NOMINA', 'Nomina'),
    ]

    id_usuario  = models.AutoField(primary_key=True)
    nombre      = models.CharField(max_length=100)
    email       = models.EmailField(unique=True)
    rol         = models.CharField(max_length=20, choices=ROL_CHOICES, default='TALENTO_HUMANO')
    activo      = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    objects = UsuarioManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['nombre']

    class Meta:
        db_table = 'usuario'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f'{self.nombre} ({self.rol})'

    @property
    def is_active(self):
        return self.activo


class Auditoria(models.Model):

    ACCION_CHOICES = [
        ('CREATE', 'Creacion'),
        ('UPDATE', 'Actualizacion'),
        ('DELETE', 'Eliminacion'),
        ('LOGIN', 'Inicio de sesion'),
        ('LOGOUT', 'Cierre de sesion'),
    ]

    id_auditoria    = models.AutoField(primary_key=True)
    usuario         = models.ForeignKey(Usuario, on_delete=models.RESTRICT, db_column='id_usuario')
    accion          = models.CharField(max_length=20, choices=ACCION_CHOICES)
    tabla_afectada  = models.CharField(max_length=100)
    id_registro     = models.IntegerField(null=True, blank=True)
    detalle         = models.TextField(null=True, blank=True)
    ip_origen       = models.GenericIPAddressField(null=True, blank=True)
    fecha           = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auditoria'
        verbose_name = 'Auditoria'
        verbose_name_plural = 'Auditorias'
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.usuario} - {self.accion} - {self.tabla_afectada}'
