#!/bin/sh
# AUSENTRACK - arranque del contenedor
set -e

python manage.py migrate --noinput

if [ "$DEMO_MODE" = "True" ] || [ "$DEMO_MODE" = "true" ]; then
    # Demostracion publica: datos ficticios nuevos en cada arranque y cada
    # DEMO_REINICIO_SEGUNDOS (6 horas por defecto), para borrar lo que hayan
    # escrito los visitantes.
    python manage.py cargar_demo --reiniciar
    (
        while sleep "${DEMO_REINICIO_SEGUNDOS:-21600}"; do
            python manage.py cargar_demo --reiniciar || true
        done
    ) &
fi

exec gunicorn sigi_backend.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --timeout 60 \
    --access-logfile -
