"""
AUSENTRACK - Serializers de Procesos Disciplinarios
"""
from rest_framework import serializers
from .models import ProcesoDisciplinario


class ProcesoDisciplinarioSerializer(serializers.ModelSerializer):
    tipo_proceso_display = serializers.CharField(source='get_tipo_proceso_display', read_only=True)
    estado_display        = serializers.CharField(source='get_estado_display', read_only=True)
    colaborador_nombre    = serializers.CharField(source='colaborador.nombre', read_only=True, default=None)
    punto_venta_fk_nombre = serializers.CharField(source='punto_venta_fk.nombre', read_only=True, default=None)
    nombre = serializers.CharField(max_length=200, required=False, allow_blank=True)
    cedula = serializers.CharField(max_length=20, required=False, allow_blank=True)

    class Meta:
        model  = ProcesoDisciplinario
        fields = [
            'id', 'colaborador', 'colaborador_nombre',
            'nombre', 'cedula', 'cargo', 'punto_venta', 'punto_venta_fk', 'punto_venta_fk_nombre',
            'fecha_ingreso', 'antiguedad',
            'tipo_proceso', 'tipo_proceso_display',
            'fecha_actuacion', 'motivo', 'responsable_hr',
            'estado', 'estado_display', 'resultado', 'observaciones',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        """
        Si se selecciona un colaborador del sistema y no se escribieron a mano
        nombre/cedula/cargo/punto_venta, se autocompletan desde su ficha.
        Si NO hay colaborador seleccionado, nombre y cedula si son obligatorios.
        """
        colaborador = data.get('colaborador')
        if colaborador:
            if not data.get('nombre'):
                data['nombre'] = colaborador.nombre
            if not data.get('cedula'):
                data['cedula'] = colaborador.cedula
            if not data.get('cargo'):
                data['cargo'] = colaborador.cargo or ''
            if not data.get('punto_venta'):
                data['punto_venta'] = colaborador.area or ''
            if not data.get('fecha_ingreso'):
                data['fecha_ingreso'] = colaborador.fecha_ingreso
        else:
            if not data.get('nombre') and not (self.instance and self.instance.nombre):
                raise serializers.ValidationError({'nombre': 'Selecciona un colaborador o escribe el nombre manualmente.'})
            if not data.get('cedula') and not (self.instance and self.instance.cedula):
                raise serializers.ValidationError({'cedula': 'Selecciona un colaborador o escribe la cédula manualmente.'})
        return data


class ProcesoDisciplinarioListSerializer(serializers.ModelSerializer):
    """Version liviana para el listado principal de la tabla."""
    class Meta:
        model  = ProcesoDisciplinario
        fields = [
            'id', 'colaborador', 'nombre', 'cedula', 'cargo', 'punto_venta',
            'tipo_proceso', 'fecha_actuacion', 'estado', 'motivo',
        ]
