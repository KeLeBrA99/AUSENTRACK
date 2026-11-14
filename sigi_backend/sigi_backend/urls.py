"""
AUSENTRACK - Configuracion de URLs principales
"""

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse
from django.urls import path, include, re_path
from django.views.decorators.cache import never_cache

from .demo import InfoDemoView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/colaboradores/', include('colaboradores.urls')),
    path('api/incapacidades/', include('incapacidades.urls')),
    path('api/procesos-disciplinarios/', include('procesos_disciplinarios.urls')),
    path('api/reclutamiento/', include('reclutamiento.urls')),
    path('api/contratos/', include('contratos.urls')),
    path('api/evaluaciones/', include('evaluaciones.urls')),
    path('api/capacitaciones/', include('capacitaciones.urls')),
    path('api/puntos-venta/', include('puntos_venta.urls')),
    path('api/vacaciones/', include('vacaciones.urls')),
    path('api/retiros/', include('retiros.urls')),
    path('api/dotacion/', include('dotacion.urls')),
    path('api/demo/', InfoDemoView.as_view(), name='demo_info'),
]

if settings.FRONTEND_DIR:
    # Las rutas de la aplicacion web (/login, /incapacidades, ...) las resuelve
    # React en el navegador: para cualquier direccion que no sea de la API se
    # entrega index.html. Los archivos reales (JS, CSS, imagenes) los sirve
    # WhiteNoise antes de llegar aqui.
    @never_cache
    def aplicacion_web(request):
        return FileResponse(open(f'{settings.FRONTEND_DIR}/index.html', 'rb'), content_type='text/html')

    urlpatterns += [re_path(r'^(?!api/|admin/|django-static/|healthz$).*$', aplicacion_web)]

# La carpeta media/ NO se publica por URL. Lo unico que guarda son los
# documentos de incapacidades (datos de salud), que se descargan con sesion
# iniciada por /api/incapacidades/<id>/documento/.
