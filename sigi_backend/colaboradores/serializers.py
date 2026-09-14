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
    eps_nombre              = serializers.CharField(source='eps.nombre', read_only=True)
    arl_nombre               = serializers.CharField(source='arl.nombre', read_only=True)
    caja_compensacion_nombre = serializers.CharField(source='caja_compensacion.nombre', read_only=True, default=None)
    fondo_pension_nombre     = serializers.CharField(source='fondo_pension.nombre', read_only=True, default=None)
    empresa_nombre           = serializers.CharField(source='empresa.razon_social', read_only=True)
    tipo_documento_display   = serializers.CharField(source='get_tipo_documento_display', read_only=True)
    tipo_bono_display        = serializers.CharField(source='get_tipo_bono_display', read_only=True)
    punto_venta_nombre       = serializers.CharField(source='punto_venta.nombre', read_only=True, default=None)
    estado                   = serializers.SerializerMethodField()

    class Meta:
        model  = Colaborador
        fields = [
            'id_colaborador', 'cedula', 'tipo_documento', 'tipo_documento_display',
            'nombre', 'cargo', 'area', 'punto_venta', 'punto_venta_nombre',
            'salario', 'tipo_bono', 'tipo_bono_display', 'valor_bono',
            'fecha_ingreso', 'activo', 'estado', 'fecha_retiro', 'motivo_retiro',
            'created_at',
            'empresa', 'empresa_nombre',
            'eps', 'eps_nombre',
            'arl', 'arl_nombre',
            'caja_compensacion', 'caja_compensacion_nombre',
            'fondo_pension', 'fondo_pension_nombre',
        ]
        read_only_fields = ['id_colaborador', 'created_at']

    def get_estado(self, obj):
        return 'Activo' if obj.activo else 'Retirado'

    def validate_cedula(self, value):
        qs = Colaborador.objects.filter(cedula=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un colaborador con esta cedula.')
        return value

    def validate(self, data):
        tipo_bono  = data.get('tipo_bono', getattr(self.instance, 'tipo_bono', 'NINGUNO'))
        valor_bono = data.get('valor_bono', getattr(self.instance, 'valor_bono', None))
        if tipo_bono in ('FIJO', 'PROMEDIO') and valor_bono is None:
            raise serializers.ValidationError(
                {'valor_bono': 'Obligatorio cuando el tipo de bono es FIJO o PROMEDIO.'}
            )
        return data


class ColaboradorRetiroSerializer(serializers.Serializer):
    """Datos para la acción de retirar un colaborador."""
    fecha_retiro  = serializers.DateField(required=False)
    motivo_retiro = serializers.CharField(required=False, allow_blank=True, default='')


class ColaboradorListSerializer(serializers.ModelSerializer):
    eps_nombre     = serializers.CharField(source='eps.nombre', read_only=True)
    arl_nombre     = serializers.CharField(source='arl.nombre', read_only=True)
    empresa_nombre = serializers.CharField(source='empresa.razon_social', read_only=True)
    punto_venta_nombre = serializers.CharField(source='punto_venta.nombre', read_only=True, default=None)
    estado         = serializers.SerializerMethodField()

    class Meta:
        model  = Colaborador
        fields = [
            'id_colaborador', 'cedula', 'tipo_documento', 'nombre', 'cargo', 'area',
            'punto_venta', 'punto_venta_nombre',
            'salario', 'tipo_bono', 'valor_bono',
            'fecha_ingreso', 'activo', 'estado', 'fecha_retiro',
            'empresa_nombre', 'eps_nombre', 'arl_nombre',
        ]

    def get_estado(self, obj):
        return 'Activo' if obj.activo else 'Retirado'
