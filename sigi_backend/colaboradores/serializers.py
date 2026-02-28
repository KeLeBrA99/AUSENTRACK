"""
SIGI - Serializadores de colaboradores
"""

from rest_framework import serializers
from .models import Empresa, Entidad, Colaborador


class EmpresaSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Empresa
        fields = ['id_empresa', 'nit', 'razon_social', 'sector', 'direccion', 'telefono', 'activo']


class EntidadSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Entidad
        fields = ['id_entidad', 'tipo', 'nombre', 'nit', 'telefono', 'plataforma_url', 'activo']


class ColaboradorSerializer(serializers.ModelSerializer):
    eps_nombre     = serializers.CharField(source='eps.nombre', read_only=True)
    arl_nombre     = serializers.CharField(source='arl.nombre', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)

    class Meta:
        model  = Colaborador
        fields = [
            'id_colaborador', 'cedula', 'nombre', 'cargo', 'area',
            'fecha_ingreso', 'activo', 'created_at',
            'empresa', 'empresa_nombre',
            'eps', 'eps_nombre',
            'arl', 'arl_nombre',
        ]
        read_only_fields = ['id_colaborador', 'created_at']

    def validate_cedula(self, value):
        qs = Colaborador.objects.filter(cedula=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un colaborador con esta cedula.')
        return value


class ColaboradorListSerializer(serializers.ModelSerializer):
    eps_nombre     = serializers.CharField(source='eps.nombre', read_only=True)
    arl_nombre     = serializers.CharField(source='arl.nombre', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)

    class Meta:
        model  = Colaborador
        fields = [
            'id_colaborador', 'cedula', 'nombre', 'cargo', 'area',
            'fecha_ingreso', 'activo',
            'empresa_nombre', 'eps_nombre', 'arl_nombre',
        ]
