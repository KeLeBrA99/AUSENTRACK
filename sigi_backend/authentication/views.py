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
from rest_framework.exceptions import ValidationError

from .serializers import (
    SIGITokenSerializer,
    UsuarioSerializer,
    PerfilSerializer,
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

    Limitado a 10 intentos por minuto por IP (configurable con THROTTLE_LOGIN
    en el .env) para dificultar ataques de fuerza bruta contra contraseñas.
    """
    serializer_class = SIGITokenSerializer
    permission_classes = [AllowAny]
    throttle_scope = 'login'

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

    Siempre responde 200: cerrar sesion es una operacion idempotente desde el
    punto de vista del usuario. Si el token ya vencio, ya estaba invalidado o
    no llego, la sesion igual se considera cerrada -- no tiene sentido
    devolverle un error a alguien que solo quiere salir.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # Token ya vencido/invalido: la sesion se cierra igual.

        try:
            registrar_auditoria(request.user, 'LOGOUT', 'usuario', request.user.id_usuario, request=request)
        except Exception:
            pass

        return Response({'mensaje': 'Sesion cerrada correctamente.'}, status=status.HTTP_200_OK)


class PerfilView(APIView):
    """
    GET   /api/auth/perfil/  Retorna los datos del usuario autenticado.
    PATCH /api/auth/perfil/  Actualiza su nombre (el rol y el correo no se
                             pueden cambiar desde aqui).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PerfilSerializer(request.user).data)

    def patch(self, request):
        serializer = PerfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        registrar_auditoria(request.user, 'UPDATE', 'usuario', request.user.id_usuario, 'Actualizo su perfil', request)
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

    def _proteger_acceso(self, usuario, queda_activo, queda_rol):
        """Evita que el sistema se quede sin nadie que pueda administrarlo."""
        deja_de_ser_admin = usuario.rol == 'ADMIN' and usuario.activo and (not queda_activo or queda_rol != 'ADMIN')
        if not deja_de_ser_admin:
            return
        if usuario.pk == self.request.user.pk:
            raise ValidationError({'detail': 'No puedes desactivarte ni quitarte el rol de administrador a ti mismo.'})
        otros_admin = Usuario.objects.filter(rol='ADMIN', activo=True).exclude(pk=usuario.pk).exists()
        if not otros_admin:
            raise ValidationError({'detail': 'Debe quedar al menos un administrador activo.'})

    def perform_update(self, serializer):
        actual = serializer.instance
        datos = serializer.validated_data
        self._proteger_acceso(actual, datos.get('activo', actual.activo), datos.get('rol', actual.rol))
        cambio_password = bool(datos.get('password'))
        usuario = serializer.save()
        registrar_auditoria(
            self.request.user, 'UPDATE', 'usuario', usuario.id_usuario,
            detalle='Contrasena restablecida por un administrador' if cambio_password else None,
            request=self.request,
        )

    def perform_destroy(self, instance):
        self._proteger_acceso(instance, queda_activo=False, queda_rol=instance.rol)
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
