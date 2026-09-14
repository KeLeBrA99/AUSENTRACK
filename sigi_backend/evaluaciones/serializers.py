"""
AUSENTRACK - Serializers de Evaluaciones de Desempeño
"""
from rest_framework import serializers
from .models import EvaluacionDesempeno, CRITERIOS_ESTANDAR


class CriterioSerializer(serializers.Serializer):
    criterio = serializers.CharField(max_length=100)
    puntaje  = serializers.IntegerField(min_value=1, max_value=5)
    comentario = serializers.CharField(required=False, allow_blank=True, default='')


class EvaluacionDesempenoSerializer(serializers.ModelSerializer):
    tipo_evaluacion_display = serializers.CharField(source='get_tipo_evaluacion_display', read_only=True)
    estado_display           = serializers.CharField(source='get_estado_display', read_only=True)
    colaborador_nombre       = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula       = serializers.CharField(source='colaborador.cedula', read_only=True)
    colaborador_cargo        = serializers.CharField(source='colaborador.cargo', read_only=True)
    criterios = CriterioSerializer(many=True)

    class Meta:
        model  = EvaluacionDesempeno
        fields = [
            'id', 'colaborador', 'colaborador_nombre', 'colaborador_cedula', 'colaborador_cargo',
            'periodo', 'tipo_evaluacion', 'tipo_evaluacion_display',
            'fecha_evaluacion', 'evaluador',
            'criterios', 'puntaje_final',
            'fortalezas', 'areas_mejora', 'plan_accion',
            'estado', 'estado_display', 'responsable_hr', 'token_publico',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'puntaje_final', 'token_publico', 'created_at', 'updated_at']

    def validate_criterios(self, value):
        if not value:
            raise serializers.ValidationError('Debes calificar al menos un criterio.')
        return value


class CrearInvitacionSerializer(serializers.Serializer):
    """Datos para generar un link publico de autoevaluacion (sin login)."""
    colaborador      = serializers.IntegerField()
    periodo          = serializers.CharField(max_length=30)
    tipo_evaluacion  = serializers.ChoiceField(choices=EvaluacionDesempeno.TIPO_CHOICES, default='AUTOEVALUACION')
    fecha_evaluacion = serializers.DateField()
    evaluador        = serializers.CharField(max_length=150)
    responsable_hr   = serializers.CharField(max_length=150)


class EvaluacionPublicaLecturaSerializer(serializers.ModelSerializer):
    """Lo minimo que ve quien abre el link publico: NO expone datos de otros modulos."""
    colaborador_nombre = serializers.CharField(source='colaborador.nombre', read_only=True)

    class Meta:
        model  = EvaluacionDesempeno
        fields = ['id', 'colaborador_nombre', 'periodo', 'tipo_evaluacion', 'criterios', 'estado']


class EvaluacionPublicaEnvioSerializer(serializers.Serializer):
    """Lo que envia quien completa el formulario publico."""
    criterios    = CriterioSerializer(many=True)
    fortalezas   = serializers.CharField(required=False, allow_blank=True, default='')
    areas_mejora = serializers.CharField(required=False, allow_blank=True, default='')
    plan_accion  = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_criterios(self, value):
        if not value:
            raise serializers.ValidationError('Debes calificar al menos un criterio.')
        return value


class EvaluacionListSerializer(serializers.ModelSerializer):
    """Version liviana para el listado de la tabla."""
    tipo_evaluacion_display = serializers.CharField(source='get_tipo_evaluacion_display', read_only=True)
    estado_display          = serializers.CharField(source='get_estado_display', read_only=True)
    colaborador_nombre      = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula      = serializers.CharField(source='colaborador.cedula', read_only=True)

    class Meta:
        model  = EvaluacionDesempeno
        fields = [
            'id', 'colaborador', 'colaborador_nombre', 'colaborador_cedula',
            'periodo', 'tipo_evaluacion', 'tipo_evaluacion_display',
            'fecha_evaluacion', 'puntaje_final', 'estado', 'estado_display',
        ]
