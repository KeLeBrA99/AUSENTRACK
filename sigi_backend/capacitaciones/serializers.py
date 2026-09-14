"""
AUSENTRACK - Serializers de Capacitaciones e Inducción
"""
from rest_framework import serializers
from .models import Capacitacion, ParticipanteCapacitacion


class ParticipanteSerializer(serializers.ModelSerializer):
    estado_asistencia_display = serializers.CharField(source='get_estado_asistencia_display', read_only=True)
    colaborador_nombre = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula = serializers.CharField(source='colaborador.cedula', read_only=True)
    colaborador_cargo  = serializers.CharField(source='colaborador.cargo', read_only=True)

    class Meta:
        model  = ParticipanteCapacitacion
        fields = [
            'id', 'capacitacion', 'colaborador', 'colaborador_nombre', 'colaborador_cedula', 'colaborador_cargo',
            'estado_asistencia', 'estado_asistencia_display', 'calificacion',
            'certificado_emitido', 'observaciones', 'fecha_inscripcion',
        ]
        read_only_fields = ['id', 'fecha_inscripcion']


class CapacitacionSerializer(serializers.ModelSerializer):
    tipo_display      = serializers.CharField(source='get_tipo_display', read_only=True)
    modalidad_display = serializers.CharField(source='get_modalidad_display', read_only=True)
    estado_display    = serializers.CharField(source='get_estado_display', read_only=True)
    punto_venta_fk_nombre = serializers.CharField(source='punto_venta_fk.nombre', read_only=True, default=None)
    total_participantes = serializers.SerializerMethodField()
    total_completados    = serializers.SerializerMethodField()

    class Meta:
        model  = Capacitacion
        fields = [
            'id', 'titulo', 'tipo', 'tipo_display', 'descripcion', 'instructor',
            'modalidad', 'modalidad_display', 'fecha_inicio', 'fecha_fin',
            'duracion_horas', 'punto_venta', 'punto_venta_fk', 'punto_venta_fk_nombre', 'cupo_maximo',
            'estado', 'estado_display', 'responsable_hr',
            'total_participantes', 'total_completados',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_participantes(self, obj):
        return obj.participantes.count()

    def get_total_completados(self, obj):
        return obj.participantes.filter(estado_asistencia='COMPLETADO').count()


class CapacitacionConParticipantesSerializer(CapacitacionSerializer):
    participantes = ParticipanteSerializer(many=True, read_only=True)

    class Meta(CapacitacionSerializer.Meta):
        fields = CapacitacionSerializer.Meta.fields + ['participantes']


class InscribirParticipanteSerializer(serializers.Serializer):
    colaborador = serializers.IntegerField()
