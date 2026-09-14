"""
SIGI - Serializadores de authentication
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Usuario


class SIGITokenSerializer(TokenObtainPairSerializer):
    """
    Extiende el token JWT para incluir datos del usuario en la respuesta.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['nombre'] = user.nombre
        token['rol']    = user.rol
        token['email']  = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['usuario'] = {
            'id_usuario': self.user.id_usuario,
            'nombre':     self.user.nombre,
            'email':      self.user.email,
            'rol':        self.user.rol,
        }
        return data


class UsuarioSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Usuario
        fields = ['id_usuario', 'nombre', 'email', 'rol', 'activo', 'created_at']
        read_only_fields = ['id_usuario', 'created_at']


class CrearUsuarioSerializer(serializers.ModelSerializer):

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = Usuario
        fields = ['nombre', 'email', 'password', 'rol']

    def create(self, validated_data):
        password = validated_data.pop('password')
        usuario  = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        return usuario


class CambiarPasswordSerializer(serializers.Serializer):

    password_actual = serializers.CharField(write_only=True)
    password_nuevo  = serializers.CharField(write_only=True, min_length=8)

    def validate_password_actual(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contrasena actual es incorrecta.')
        return value
