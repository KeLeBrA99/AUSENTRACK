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
        # documento_url es de SOLO LECTURA: lo fija el servidor al subir el
        # archivo. Si se pudiera escribir, cualquiera con permiso de edicion
        # podria apuntarlo a otro archivo del servidor y luego borrarlo con
        # "Eliminar documento".
        read_only_fields = [
            'id_incapacidad', 'dias', 'responsable_pago', 'documento_url',
            'usuario_registro', 'created_at', 'updated_at',
        ]

    def validate(self, data):
        fecha_inicio = data.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fecha_fin    = data.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        colaborador  = data.get('colaborador', getattr(self.instance, 'colaborador', None))

        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError('La fecha de fin no puede ser anterior a la fecha de inicio.')

        # Una persona no puede estar incapacitada dos veces en las mismas
        # fechas: eso desordena el conteo de dias y el calculo de quien paga.
        # Las prorrogas se excluyen: son la continuacion de una incapacidad,
        # no un caso paralelo.
        if fecha_inicio and fecha_fin and colaborador:
            padre = data.get('incapacidad_padre', getattr(self.instance, 'incapacidad_padre', None))
            if not padre:
                solapadas = Incapacidad.objects.filter(
                    colaborador=colaborador,
                    fecha_inicio__lte=fecha_fin,
                    fecha_fin__gte=fecha_inicio,
                ).exclude(estado='CERRADA')
                if self.instance:
                    solapadas = solapadas.exclude(pk=self.instance.pk)
                conflicto = solapadas.first()
                if conflicto:
                    raise serializers.ValidationError({
                        'fecha_inicio': (
                            f'{colaborador.nombre} ya tiene una incapacidad registrada que se cruza con '
                            f'estas fechas ({conflicto.fecha_inicio} a {conflicto.fecha_fin}). '
                            f'Si es una continuación, regístrala como prórroga.'
                        )
                    })
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
        # Incluye los campos que el frontend necesita para abrir "Editar" y
        # "Documento" desde una fila del listado. Sin ellos el formulario de
        # edicion arrancaba con diagnostico, observaciones, entidad y prorroga
        # vacios y, al guardar, los borraba; y el documento adjunto nunca se
        # mostraba.
        fields = [
            'id_incapacidad',
            'colaborador', 'colaborador_nombre', 'colaborador_cedula',
            'entidad_emisora', 'entidad_emisora_nombre',
            'incapacidad_padre',
            'tipo', 'tipo_display',
            'fecha_inicio', 'fecha_fin', 'dias',
            'diagnostico', 'observaciones',
            'responsable_pago', 'responsable_display',
            'estado', 'estado_display',
            'documento_url',
            'created_at',
        ]


class ProrrogaSerializer(serializers.Serializer):
    """Datos para crear la prorroga de una incapacidad existente."""
    fecha_inicio  = serializers.DateField()
    fecha_fin     = serializers.DateField()
    diagnostico   = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=300)
    observaciones = serializers.CharField(required=False, allow_blank=True, allow_null=True, default='')

    def validate(self, data):
        if data['fecha_fin'] < data['fecha_inicio']:
            raise serializers.ValidationError('La fecha de fin no puede ser anterior a la fecha de inicio.')
        return data


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=['ACTIVA', 'EN_COBRO', 'PAGADA', 'CERRADA'])
