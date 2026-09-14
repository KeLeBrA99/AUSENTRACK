"""
AUSENTRACK - Serializers de Reclutamiento y Selección
"""
from rest_framework import serializers
from .models import Vacante, Candidato


class CandidatoSerializer(serializers.ModelSerializer):
    etapa_display = serializers.CharField(source='get_etapa_display', read_only=True)
    vacante_cargo = serializers.CharField(source='vacante.cargo', read_only=True)
    vacante_punto_venta = serializers.CharField(source='vacante.punto_venta', read_only=True)
    colaborador_nombre = serializers.CharField(source='colaborador.nombre', read_only=True, default=None)

    class Meta:
        model  = Candidato
        fields = [
            'id', 'vacante', 'vacante_cargo', 'vacante_punto_venta',
            'colaborador', 'colaborador_nombre',
            'nombre', 'cedula', 'telefono', 'email',
            'etapa', 'etapa_display', 'fecha_postulacion', 'fuente',
            'notas', 'motivo_rechazo', 'responsable_hr',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'colaborador', 'created_at', 'updated_at']


class VacanteSerializer(serializers.ModelSerializer):
    estado_display   = serializers.CharField(source='get_estado_display', read_only=True)
    total_candidatos = serializers.SerializerMethodField()
    candidatos_contratados = serializers.SerializerMethodField()
    punto_venta_fk_nombre = serializers.CharField(source='punto_venta_fk.nombre', read_only=True, default=None)

    class Meta:
        model  = Vacante
        fields = [
            'id', 'cargo', 'punto_venta', 'punto_venta_fk', 'punto_venta_fk_nombre', 'salario_ofrecido',
            'descripcion', 'requisitos', 'responsable_hr',
            'estado', 'estado_display', 'fecha_apertura', 'fecha_cierre',
            'vacantes_disponibles', 'total_candidatos', 'candidatos_contratados',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_candidatos(self, obj):
        return obj.candidatos.count()

    def get_candidatos_contratados(self, obj):
        return obj.candidatos.filter(etapa='CONTRATADO').count()


class VacanteConCandidatosSerializer(VacanteSerializer):
    """Version con el listado completo de candidatos anidado (para el detalle/kanban)."""
    candidatos = CandidatoSerializer(many=True, read_only=True)

    class Meta(VacanteSerializer.Meta):
        fields = VacanteSerializer.Meta.fields + ['candidatos']
