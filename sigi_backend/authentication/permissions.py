"""
SIGI - Permisos personalizados
"""

from rest_framework.permissions import BasePermission


class EsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == 'ADMIN'


class EsTalentoHumano(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol in ('ADMIN', 'TALENTO_HUMANO')


class EsNomina(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol in ('ADMIN', 'TALENTO_HUMANO', 'NOMINA')
