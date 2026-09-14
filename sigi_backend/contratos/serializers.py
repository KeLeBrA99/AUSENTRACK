"""
AUSENTRACK - Serializers de Contratos
"""
from datetime import date
from rest_framework import serializers
from .models import Contrato


class ContratoSerializer(serializers.ModelSerializer):
    tipo_contrato_display = serializers.CharField(source='get_tipo_contrato_display', read_only=True)
    estado_display        = serializers.CharField(source='get_estado_display', read_only=True)
    colaborador_nombre    = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula    = serializers.CharField(source='colaborador.cedula', read_only=True)
    punto_venta_fk_nombre = serializers.CharField(source='punto_venta_fk.nombre', read_only=True, default=None)
    dias_para_vencer       = serializers.SerializerMethodField()

    class Meta:
        model  = Contrato
        fields = [
            'id', 'colaborador', 'colaborador_nombre', 'colaborador_cedula',
            'contrato_anterior',
            'tipo_contrato', 'tipo_contrato_display', 'cargo', 'punto_venta', 'punto_venta_fk', 'punto_venta_fk_nombre',
            'salario', 'fecha_inicio', 'fecha_fin', 'estado', 'estado_display',
            'responsable_hr', 'observaciones',
            'fecha_terminacion', 'motivo_terminacion',
            'dias_para_vencer',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'contrato_anterior', 'created_at', 'updated_at']

    def get_dias_para_vencer(self, obj):
        if not obj.fecha_fin or obj.estado != 'VIGENTE':
            return None
        return (obj.fecha_fin - date.today()).days

    def validate(self, data):
        tipo = data.get('tipo_contrato', getattr(self.instance, 'tipo_contrato', None))
        fecha_fin = data.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        fecha_inicio = data.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        colaborador = data.get('colaborador', getattr(self.instance, 'colaborador', None))
        estado = data.get('estado', getattr(self.instance, 'estado', 'VIGENTE'))

        if tipo and tipo != 'INDEFINIDO' and not fecha_fin:
            raise serializers.ValidationError(
                {'fecha_fin': 'Obligatoria para cualquier tipo de contrato distinto a Término Indefinido.'}
            )

        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError(
                {'fecha_fin': 'La fecha de fin no puede ser anterior a la fecha de inicio.'}
            )

        # Un colaborador no puede tener dos contratos vigentes al mismo tiempo:
        # hay que terminar o renovar el anterior primero.
        if colaborador and estado == 'VIGENTE':
            vigentes = Contrato.objects.filter(colaborador=colaborador, estado='VIGENTE')
            if self.instance:
                vigentes = vigentes.exclude(pk=self.instance.pk)
            actual = vigentes.first()
            if actual:
                raise serializers.ValidationError({
                    'colaborador': (
                        f'{colaborador.nombre} ya tiene un contrato vigente '
                        f'(desde {actual.fecha_inicio}, {actual.get_tipo_contrato_display()}). '
                        f'Termínalo o renuévalo antes de crear uno nuevo.'
                    )
                })
        return data


class RenovarContratoSerializer(serializers.Serializer):
    """Datos para renovar un contrato: se crea uno nuevo encadenado al actual."""
    fecha_inicio  = serializers.DateField()
    fecha_fin     = serializers.DateField(required=False, allow_null=True)
    tipo_contrato = serializers.ChoiceField(choices=Contrato.TIPO_CHOICES, required=False)
    salario       = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    responsable_hr = serializers.CharField(max_length=150)
    observaciones = serializers.CharField(required=False, allow_blank=True, default='')


class TerminarContratoSerializer(serializers.Serializer):
    fecha_terminacion  = serializers.DateField(required=False)
    motivo_terminacion = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
