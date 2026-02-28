"""
SIGI - Vistas de authentication
"""

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Usuario, Auditoria
from .serializers import (
    SIGITokenSerializer,
    UsuarioSerializer,
    CrearUsuarioSerializer,
    CambiarPasswordSerializer,
)
from .permissions import EsAdmin


def registrar_auditoria(usuario, accion, tabla, id_registro=None, detalle=None, request=None):
    ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')
    Auditoria.objects.create(
        usuario=usuario,
        accion=accion,
        tabla_afectada=tabla,
        id_registro=id_registro,
        detalle=detalle,
        ip_origen=ip,
    )


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Retorna access token, refresh token y datos del usuario.
    """
    serializer_class = SIGITokenSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            email = request.data.get('email')
            try:
                usuario = Usuario.objects.get(email=email)
                registrar_auditoria(usuario, 'LOGIN', 'usuario', usuario.id_usuario, request=request)
            except Usuario.DoesNotExist:
                pass
        return response


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Invalida el refresh token del usuario.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            registrar_auditoria(request.user, 'LOGOUT', 'usuario', request.user.id_usuario, request=request)
            return Response({'mensaje': 'Sesion cerrada correctamente.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Token invalido.'}, status=status.HTTP_400_BAD_REQUEST)


class PerfilView(APIView):
    """
    GET /api/auth/perfil/
    Retorna los datos del usuario autenticado.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response(serializer.data)


class CambiarPasswordView(APIView):
    """
    POST /api/auth/cambiar-password/
    Permite al usuario cambiar su propia contrasena.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CambiarPasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data['password_nuevo'])
            request.user.save()
            registrar_auditoria(request.user, 'UPDATE', 'usuario', request.user.id_usuario, 'Cambio de contrasena', request)
            return Response({'mensaje': 'Contrasena actualizada correctamente.'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ListarUsuariosView(generics.ListAPIView):
    """
    GET /api/auth/usuarios/
    Lista todos los usuarios. Solo accesible por ADMIN.
    """
    queryset            = Usuario.objects.all().order_by('nombre')
    serializer_class    = UsuarioSerializer
    permission_classes  = [IsAuthenticated, EsAdmin]


class CrearUsuarioView(generics.CreateAPIView):
    """
    POST /api/auth/usuarios/crear/
    Crea un nuevo usuario. Solo accesible por ADMIN.
    """
    serializer_class    = CrearUsuarioSerializer
    permission_classes  = [IsAuthenticated, EsAdmin]

    def perform_create(self, serializer):
        usuario = serializer.save()
        registrar_auditoria(self.request.user, 'CREATE', 'usuario', usuario.id_usuario, request=self.request)


class DetalleUsuarioView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/auth/usuarios/<id>/
    Gestiona un usuario especifico. Solo accesible por ADMIN.
    """
    queryset            = Usuario.objects.all()
    serializer_class    = UsuarioSerializer
    permission_classes  = [IsAuthenticated, EsAdmin]
    lookup_field        = 'id_usuario'

    def perform_update(self, serializer):
        usuario = serializer.save()
        registrar_auditoria(self.request.user, 'UPDATE', 'usuario', usuario.id_usuario, request=self.request)

    def perform_destroy(self, instance):
        registrar_auditoria(self.request.user, 'DELETE', 'usuario', instance.id_usuario, request=self.request)
        instance.activo = False
        instance.save()


class ListarAuditoriaView(generics.ListAPIView):
    """
    GET /api/auth/auditoria/
    Lista el log de auditoria. Solo accesible por ADMIN.
    """
    permission_classes = [IsAuthenticated, EsAdmin]

    def get(self, request):
        from .models import Auditoria
        registros = Auditoria.objects.select_related('usuario').order_by('-fecha')[:500]
        data = [
            {
                'id':            r.id_auditoria,
                'usuario':       r.usuario.nombre,
                'accion':        r.accion,
                'tabla':         r.tabla_afectada,
                'id_registro':   r.id_registro,
                'detalle':       r.detalle,
                'ip':            r.ip_origen,
                'fecha':         r.fecha,
            }
            for r in registros
        ]
        return Response(data)
