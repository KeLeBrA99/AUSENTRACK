"""
AUSENTRACK - Serializers de Retiros
"""
from rest_framework import serializers
from .models import Retiro


class RetiroSerializer(serializers.ModelSerializer):
    tipo_retiro_display        = serializers.CharField(source='get_tipo_retiro_display', read_only=True)
    estado_liquidacion_display = serializers.CharField(source='get_estado_liquidacion_display', read_only=True)
    colaborador_nombre         = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula         = serializers.CharField(source='colaborador.cedula', read_only=True)
    colaborador_cargo          = serializers.CharField(source='colaborador.cargo', read_only=True)
    punto_venta_nombre         = serializers.CharField(source='colaborador.punto_venta.nombre', read_only=True, default=None)
    checklist_completo         = serializers.SerializerMethodField()

    class Meta:
        model  = Retiro
        fields = [
            'id', 'colaborador', 'colaborador_nombre', 'colaborador_cedula', 'colaborador_cargo', 'punto_venta_nombre',
            'tipo_retiro', 'tipo_retiro_display', 'motivo',
            'fecha_retiro', 'ultimo_dia_laborado', 'responsable_hr',
            'devolucion_dotacion', 'devolucion_equipos', 'paz_y_salvo_emitido', 'carta_laboral_entregada',
            'checklist_completo',
            'estado_liquidacion', 'estado_liquidacion_display', 'fecha_liquidacion',
            'entrevista_realizada', 'entrevista_notas', 'recomendable_recontratacion',
            'observaciones', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_checklist_completo(self, obj):
        return obj.checklist_completo()


class RetiroListSerializer(serializers.ModelSerializer):
    tipo_retiro_display        = serializers.CharField(source='get_tipo_retiro_display', read_only=True)
    estado_liquidacion_display = serializers.CharField(source='get_estado_liquidacion_display', read_only=True)
    colaborador_nombre         = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula         = serializers.CharField(source='colaborador.cedula', read_only=True)
    punto_venta_nombre         = serializers.CharField(source='colaborador.punto_venta.nombre', read_only=True, default=None)

    class Meta:
        model  = Retiro
        fields = [
            'id', 'colaborador', 'colaborador_nombre', 'colaborador_cedula', 'punto_venta_nombre',
            'tipo_retiro', 'tipo_retiro_display', 'fecha_retiro',
            'estado_liquidacion', 'estado_liquidacion_display',
        ]
