"""
AUSENTRACK - Serializers de Dotación y EPP
"""
from rest_framework import serializers
from .models import ElementoDotacion, InventarioElemento, EntregaDotacion, DetalleEntregaDotacion, RequisitoElemento


class InventarioElementoSerializer(serializers.ModelSerializer):
    elemento_nombre    = serializers.CharField(source='elemento.nombre', read_only=True)
    elemento_categoria = serializers.CharField(source='elemento.categoria', read_only=True)
    bajo_stock         = serializers.SerializerMethodField()

    class Meta:
        model  = InventarioElemento
        fields = ['id', 'elemento', 'elemento_nombre', 'elemento_categoria', 'talla', 'cantidad_disponible', 'stock_minimo', 'bajo_stock', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def get_bajo_stock(self, obj):
        return obj.cantidad_disponible <= obj.stock_minimo


class ElementoDotacionSerializer(serializers.ModelSerializer):
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    inventario         = InventarioElementoSerializer(many=True, read_only=True)
    stock_total         = serializers.SerializerMethodField()

    class Meta:
        model  = ElementoDotacion
        fields = ['id', 'nombre', 'categoria', 'categoria_display', 'usa_talla', 'vida_util_meses', 'activo', 'inventario', 'stock_total', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_stock_total(self, obj):
        return sum(i.cantidad_disponible for i in obj.inventario.all())


class DetalleEntregaDotacionSerializer(serializers.ModelSerializer):
    elemento_nombre = serializers.CharField(source='elemento.nombre', read_only=True)

    class Meta:
        model  = DetalleEntregaDotacion
        fields = ['id', 'elemento', 'elemento_nombre', 'talla', 'cantidad']
        read_only_fields = ['id']


class EntregaDotacionSerializer(serializers.ModelSerializer):
    tipo_entrega_display = serializers.CharField(source='get_tipo_entrega_display', read_only=True)
    colaborador_nombre    = serializers.CharField(source='colaborador.nombre', read_only=True)
    colaborador_cedula    = serializers.CharField(source='colaborador.cedula', read_only=True)
    colaborador_cargo     = serializers.CharField(source='colaborador.cargo', read_only=True)
    detalles = DetalleEntregaDotacionSerializer(many=True)

    class Meta:
        model  = EntregaDotacion
        fields = [
            'id', 'colaborador', 'colaborador_nombre', 'colaborador_cedula', 'colaborador_cargo',
            'tipo_entrega', 'tipo_entrega_display', 'fecha_entrega', 'responsable_hr',
            'firma_recibido', 'observaciones', 'detalles', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError('Agrega al menos un elemento entregado.')
        return value

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        entrega = EntregaDotacion.objects.create(**validated_data)
        for detalle in detalles_data:
            DetalleEntregaDotacion.objects.create(entrega=entrega, **detalle)
            # Descontar del inventario si existe registro para esa talla
            inv = InventarioElemento.objects.filter(elemento=detalle['elemento'], talla=detalle.get('talla', '')).first()
            if inv:
                inv.cantidad_disponible = max(0, inv.cantidad_disponible - detalle['cantidad'])
                inv.save(update_fields=['cantidad_disponible'])
        return entrega


class RequisitoElementoSerializer(serializers.ModelSerializer):
    elemento_nombre    = serializers.CharField(source='elemento.nombre', read_only=True)
    punto_venta_nombre = serializers.CharField(source='punto_venta.nombre', read_only=True, default=None)

    class Meta:
        model  = RequisitoElemento
        fields = ['id', 'cargo', 'punto_venta', 'punto_venta_nombre', 'elemento', 'elemento_nombre', 'obligatorio']
        read_only_fields = ['id']
