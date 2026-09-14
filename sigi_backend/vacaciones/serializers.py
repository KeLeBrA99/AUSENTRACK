"""
AUSENTRACK - Serializers de Vacaciones
"""
from rest_framework import serializers
from .models import SolicitudVacaciones


class SolicitudVacacionesSerializer(serializers.ModelSerializer):
    estado_display     = serializers.CharField(source='get_estado_display', read_only=True)
    tipo_solicitud_display = serializers.CharField(source='get_tipo_solicitud_display', read_only=True)
    colaborador_nombre = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula = serializers.CharField(source='colaborador.cedula', read_only=True)
    colaborador_cargo  = serializers.CharField(source='colaborador.cargo', read_only=True)

    # Permite registrar vacaciones anticipadas (sin saldo suficiente) de forma
    # deliberada. Por defecto False: el sistema bloquea y avisa.
    autorizar_sin_saldo = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model  = SolicitudVacaciones
        fields = [
            'id', 'colaborador', 'colaborador_nombre', 'colaborador_cedula', 'colaborador_cargo',
            'tipo_solicitud', 'tipo_solicitud_display',
            'fecha_inicio', 'fecha_fin', 'dias_habiles',
            'estado', 'estado_display', 'fecha_solicitud', 'origen',
            'responsable_hr', 'aprobado_por', 'fecha_respuesta',
            'motivo_rechazo', 'observaciones', 'updated_at',
            'autorizar_sin_saldo',
        ]
        read_only_fields = ['id', 'dias_habiles', 'fecha_solicitud', 'fecha_respuesta', 'updated_at', 'origen']

    def create(self, validated_data):
        validated_data.pop('autorizar_sin_saldo', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('autorizar_sin_saldo', None)
        return super().update(instance, validated_data)

    def validate(self, data):
        inicio = data.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fin = data.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        colaborador = data.get('colaborador', getattr(self.instance, 'colaborador', None))
        tipo = data.get('tipo_solicitud', getattr(self.instance, 'tipo_solicitud', 'VACACIONES'))
        autorizar_sin_saldo = data.get('autorizar_sin_saldo', False)

        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({'fecha_fin': 'La fecha de fin no puede ser anterior a la fecha de inicio.'})

        if not (inicio and fin and colaborador):
            return data

        # ── 1. No permitir fechas que se pisen con otra solicitud vigente ──
        solapadas = SolicitudVacaciones.objects.filter(
            colaborador=colaborador,
            estado__in=['SOLICITADA', 'APROBADA', 'DISFRUTADA'],
            fecha_inicio__lte=fin,
            fecha_fin__gte=inicio,
        )
        if self.instance:
            solapadas = solapadas.exclude(pk=self.instance.pk)
        conflicto = solapadas.first()
        if conflicto:
            raise serializers.ValidationError({
                'fecha_inicio': (
                    f'Estas fechas se cruzan con otra solicitud de {colaborador.nombre} '
                    f'({conflicto.fecha_inicio} a {conflicto.fecha_fin}, {conflicto.get_estado_display()}).'
                )
            })

        # ── 2. No aprobar mas dias de vacaciones de los causados ──────────
        if tipo == 'VACACIONES' and not autorizar_sin_saldo:
            from .views import _calcular_saldo, _contar_dias_habiles
            saldo = _calcular_saldo(colaborador)['saldo_disponible']
            dias_pedidos = _contar_dias_habiles(inicio, fin)
            if dias_pedidos > saldo:
                raise serializers.ValidationError({
                    'fecha_fin': (
                        f'{colaborador.nombre} tiene {saldo} día(s) de vacaciones disponibles y se '
                        f'están solicitando {dias_pedidos}. Si es una autorización anticipada, '
                        f'marca la opción para autorizarla sin saldo.'
                    )
                })

        return data


class ResponderSolicitudSerializer(serializers.Serializer):
    aprobado_por   = serializers.CharField(max_length=150)
    motivo_rechazo = serializers.CharField(required=False, allow_blank=True, default='')
