"""
AUSENTRACK - Configuracion de URLs principales
"""

from django.contrib import admin
from django.urls import path, include

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

# La carpeta media/ NO se publica por URL. Lo unico que guarda son los
# documentos de incapacidades (datos de salud), que se descargan con sesion
# iniciada por /api/incapacidades/<id>/documento/.
