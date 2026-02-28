#!/usr/bin/env python
"""
SIGI - Utilidad de gestion de Django
"""

import os
import sys


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sigi_backend.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "No se pudo importar Django. Verifica que este instalado y "
            "que el entorno virtual este activado."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
