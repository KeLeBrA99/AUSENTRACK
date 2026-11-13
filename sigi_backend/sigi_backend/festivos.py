"""
AUSENTRACK - Festivos de Colombia y conteo de dias habiles

Los 18 festivos nacionales salen de tres reglas (Ley 51 de 1983):
  - Fecha fija: se celebran el dia que caigan.
  - "Ley Emiliani": si no caen en lunes, se trasladan al lunes siguiente.
  - Dependientes de la Pascua: se calculan a partir del Domingo de Pascua.

No hace falta mantener una lista por año: se calculan para cualquier año.
"""
from datetime import date, timedelta
from functools import lru_cache

from django.conf import settings

FIJOS = [(1, 1), (5, 1), (7, 20), (8, 7), (12, 8), (12, 25)]
# Año Nuevo, Dia del Trabajo, Independencia, Batalla de Boyaca,
# Inmaculada Concepcion, Navidad

EMILIANI = [(1, 6), (3, 19), (6, 29), (8, 15), (10, 12), (11, 1), (11, 11)]
# Reyes Magos, San Jose, San Pedro y San Pablo, Asuncion de la Virgen,
# Dia de la Raza, Todos los Santos, Independencia de Cartagena


def domingo_de_pascua(anio: int) -> date:
    """Algoritmo de Butcher-Meeus para el calendario gregoriano."""
    a, b, c = anio % 19, anio // 100, anio % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = (h + l - 7 * m + 114) % 31 + 1
    return date(anio, mes, dia)


def _al_lunes(fecha: date) -> date:
    """La misma fecha si ya es lunes; si no, el lunes siguiente."""
    return fecha + timedelta(days=(7 - fecha.weekday()) % 7)


@lru_cache(maxsize=None)
def festivos_colombia(anio: int) -> frozenset:
    pascua = domingo_de_pascua(anio)
    festivos = {date(anio, mes, dia) for mes, dia in FIJOS}
    festivos |= {_al_lunes(date(anio, mes, dia)) for mes, dia in EMILIANI}
    festivos |= {
        pascua - timedelta(days=3),              # Jueves Santo
        pascua - timedelta(days=2),              # Viernes Santo
        _al_lunes(pascua + timedelta(days=40)),  # Ascension del Señor
        _al_lunes(pascua + timedelta(days=61)),  # Corpus Christi
        _al_lunes(pascua + timedelta(days=69)),  # Sagrado Corazon
    }
    return frozenset(festivos)


def es_festivo(fecha: date) -> bool:
    return fecha in festivos_colombia(fecha.year)


def es_dia_habil(fecha: date) -> bool:
    """
    Lunes a sabado que no sean festivos. Si la jornada de la empresa es de
    lunes a viernes, el sabado deja de contar (VACACIONES_SABADO_HABIL=False
    en el .env). El domingo nunca es habil.
    """
    ultimo_habil = 5 if getattr(settings, 'VACACIONES_SABADO_HABIL', True) else 4
    return fecha.weekday() <= ultimo_habil and not es_festivo(fecha)


def contar_dias_habiles(inicio: date, fin: date) -> int:
    """Dias habiles entre dos fechas, ambas incluidas."""
    if not inicio or not fin or fin < inicio:
        return 0
    return sum(1 for n in range((fin - inicio).days + 1) if es_dia_habil(inicio + timedelta(days=n)))
