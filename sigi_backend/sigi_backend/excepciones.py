"""
AUSENTRACK - Manejo central de errores de la API
"""
import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def manejador_de_errores(exc, context):
    """
    Igual que el manejador estandar de DRF, mas un caso: un filtro mal
    escrito en la URL de una consulta (?colaborador=abc, ?fecha_desde=31-02)
    hacia fallar la consulta a la base y el usuario recibia un error 500.
    Ahora recibe un 400 con un mensaje claro.

    Solo aplica a consultas GET que traen parametros; cualquier otro error
    inesperado sigue saliendo como 500 para no esconder fallos reales.
    """
    respuesta = exception_handler(exc, context)
    if respuesta is not None:
        return respuesta

    request = context.get('request')
    es_consulta_con_filtros = request is not None and request.method == 'GET' and bool(request.query_params)
    if es_consulta_con_filtros and isinstance(exc, (DjangoValidationError, ValueError)):
        logger.warning('Filtro invalido en %s: %s', request.get_full_path(), exc)
        return Response(
            {'error': 'Uno de los filtros de la consulta no es valido. Revisa las fechas (AAAA-MM-DD) y los numeros.'},
            status=400,
        )
    return None
