"""
SIGI - Serializadores de incapacidades
"""

from rest_framework import serializers
from .models import Incapacidad


class IncapacidadSerializer(serializers.ModelSerializer):
    colaborador_nombre      = serializers.CharField(source='colaborador.nombre',          read_only=True)
    colaborador_cedula      = serializers.CharField(source='colaborador.cedula',           read_only=True)
    entidad_emisora_nombre  = serializers.CharField(source='entidad_emisora.nombre',       read_only=True)
    usuario_registro_nombre = serializers.CharField(source='usuario_registro.nombre',     read_only=True)
    tipo_display            = serializers.CharField(source='get_tipo_display',             read_only=True)
    estado_display          = serializers.CharField(source='get_estado_display',           read_only=True)
    responsable_display     = serializers.CharField(source='get_responsable_pago_display', read_only=True)

    class Meta:
        model  = Incapacidad
        fields = [
            'id_incapacidad',
            'colaborador', 'colaborador_nombre', 'colaborador_cedula',
            'entidad_emisora', 'entidad_emisora_nombre',
            'usuario_registro', 'usuario_registro_nombre',
            'incapacidad_padre',
            'tipo', 'tipo_display',
            'fecha_inicio', 'fecha_fin', 'dias',
            'diagnostico',
            'responsable_pago', 'responsable_display',
            'estado', 'estado_display',
            'documento_url', 'observaciones',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id_incapacidad', 'dias', 'responsable_pago',
            'usuario_registro', 'created_at', 'updated_at',
        ]

    def validate(self, data):
        fecha_inicio = data.get('fecha_inicio')
        fecha_fin    = data.get('fecha_fin')
        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError('La fecha de fin no puede ser anterior a la fecha de inicio.')
        return data


class IncapacidadListSerializer(serializers.ModelSerializer):
    colaborador_nombre     = serializers.CharField(source='colaborador.nombre',          read_only=True)
    colaborador_cedula     = serializers.CharField(source='colaborador.cedula',           read_only=True)
    entidad_emisora_nombre = serializers.CharField(source='entidad_emisora.nombre',       read_only=True)
    tipo_display           = serializers.CharField(source='get_tipo_display',             read_only=True)
    estado_display         = serializers.CharField(source='get_estado_display',           read_only=True)
    responsable_display    = serializers.CharField(source='get_responsable_pago_display', read_only=True)

    class Meta:
        model  = Incapacidad
        fields = [
            'id_incapacidad',
            'colaborador_nombre', 'colaborador_cedula',
            'entidad_emisora_nombre',
            'tipo', 'tipo_display',
            'fecha_inicio', 'fecha_fin', 'dias',
            'responsable_pago', 'responsable_display',
            'estado', 'estado_display',
            'created_at',
        ]


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=['ACTIVA', 'EN_COBRO', 'PAGADA', 'CERRADA'])
