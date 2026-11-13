"""
AUSENTRACK - Paginacion opcional de los listados

Un listado se pagina SOLO cuando la peticion trae ?page=. Sin ese parametro
responde igual que siempre (la lista completa), de modo que las pantallas
existentes siguen funcionando y cada una puede pasarse a paginar cuando le
convenga:

    GET /api/incapacidades/                      -> [ {...}, {...}, ... ]
    GET /api/incapacidades/?page=2&page_size=25  -> { count, next, previous, results: [...] }
"""
from rest_framework.pagination import PageNumberPagination


class PaginacionOpcional(PageNumberPagination):
    page_size             = 50
    page_size_query_param = 'page_size'
    max_page_size         = 200

    def paginate_queryset(self, queryset, request, view=None):
        if self.page_query_param not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)
