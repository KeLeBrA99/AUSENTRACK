"""
AUSENTRACK - Configuracion de URLs principales
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

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
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)