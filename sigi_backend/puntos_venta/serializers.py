"""
AUSENTRACK - Serializers de Puntos de Venta
"""
from rest_framework import serializers
from .models import PuntoVenta


class PuntoVentaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PuntoVenta
        fields = [
            'id', 'nombre', 'personal_requerido', 'direccion', 'telefono',
            'notas', 'activo', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_nombre(self, value):
        qs = PuntoVenta.objects.filter(nombre__iexact=value.strip())
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un punto de venta con este nombre.')
        return value.strip()
