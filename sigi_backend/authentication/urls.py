"""
SIGI - URLs de authentication
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('login/',              views.LoginView.as_view(),           name='login'),
    path('logout/',             views.LogoutView.as_view(),          name='logout'),
    path('token/refresh/',      TokenRefreshView.as_view(),          name='token_refresh'),
    path('perfil/',             views.PerfilView.as_view(),          name='perfil'),
    path('cambiar-password/',   views.CambiarPasswordView.as_view(), name='cambiar_password'),
    path('usuarios/',           views.ListarUsuariosView.as_view(),  name='listar_usuarios'),
    path('usuarios/crear/',     views.CrearUsuarioView.as_view(),    name='crear_usuario'),
    path('usuarios/<int:id_usuario>/', views.DetalleUsuarioView.as_view(), name='detalle_usuario'),
    path('auditoria/',          views.ListarAuditoriaView.as_view(), name='auditoria'),
]
