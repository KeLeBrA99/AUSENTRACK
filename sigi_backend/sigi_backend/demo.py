"""
AUSENTRACK - Modo demostracion (DEMO_MODE=True)

Pensado para publicar el sistema con datos ficticios, por ejemplo como enlace
en un portafolio. Cualquiera puede entrar con los usuarios de prueba, asi que:

  - La pantalla de inicio muestra esos usuarios (GET /api/demo/).
  - Se bloquean las acciones que dejarian a los demas visitantes por fuera o
    que guardarian archivos de un desconocido: administrar usuarios, cambiar
    contraseñas, subir documentos, importar archivos y el panel /admin/.
  - Todo lo demas funciona normal; los datos se recargan solos cada cierto
    tiempo (ver entrypoint.sh).

Con DEMO_MODE=False (el valor por defecto) nada de esto se activa.
"""
import re

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

MENSAJE = 'Esta accion esta desactivada en la demostracion publica.'

# (metodos, patron de la ruta)
BLOQUEADAS = [
    ({'POST', 'PUT', 'PATCH', 'DELETE'}, re.compile(r'^/api/auth/usuarios/')),
    ({'POST', 'PUT', 'PATCH'},           re.compile(r'^/api/auth/(password|cambiar-password|perfil)/')),
    ({'POST'},                           re.compile(r'^/api/incapacidades/\d+/documento/')),
    ({'POST', 'PUT', 'PATCH'},           re.compile(r'^/api/.*importar')),
    ({'POST'},                           re.compile(r'^/api/vacaciones/webhook')),
    ({'GET', 'POST', 'PUT', 'PATCH', 'DELETE'}, re.compile(r'^/admin/')),
]


class SaludMiddleware:
    """
    GET /healthz -> 200 "ok". Es lo que consulta la plataforma de alojamiento
    para saber si el servicio esta vivo. Va de primero en MIDDLEWARE porque
    esas consultas llegan por HTTP interno y con un nombre de host propio: si
    pasaran por el resto, la redireccion a HTTPS o la validacion de
    ALLOWED_HOSTS las rechazarian y el servicio se daria por caido.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/healthz':
            return HttpResponse('ok', content_type='text/plain')
        return self.get_response(request)


class BloqueosDemoMiddleware:

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.DEMO_MODE:
            for metodos, patron in BLOQUEADAS:
                if request.method in metodos and patron.search(request.path):
                    return JsonResponse({'detail': MENSAJE, 'error': MENSAJE}, status=403)
        return self.get_response(request)


class InfoDemoView(APIView):
    """
    GET /api/demo/  (publico)
    Le dice al frontend si esta en modo demostracion y, solo en ese caso, con
    que usuarios de prueba se puede entrar. Tambien sirve de chequeo de salud.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        if not settings.DEMO_MODE:
            return Response({'demo': False})
        from colaboradores.management.commands.cargar_demo import CLAVE_DEMO, USUARIOS_DEMO
        return Response({
            'demo': True,
            'clave': CLAVE_DEMO,
            'usuarios': [{'rol': rol, 'email': email, 'nombre': nombre} for rol, email, nombre in USUARIOS_DEMO],
        })
