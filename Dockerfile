# AUSENTRACK - una sola imagen con el backend (Django) y el frontend (React)
#
#   docker compose up --build                                   -> con MySQL, para uso real
#   docker compose -f docker-compose.demo.yml up --build        -> demostracion con datos ficticios

# ── 1. Compilar el frontend ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
COPY sigi_frontend/package.json sigi_frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY sigi_frontend/ ./
# La API queda en el mismo sitio que la aplicacion web: ruta relativa.
ENV REACT_APP_API_URL=/api
RUN npm run build

# ── 2. Backend + frontend compilado ──────────────────────────────────────────
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FRONTEND_DIR=/app/frontend

WORKDIR /app
COPY sigi_backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY sigi_backend/ ./
COPY --from=frontend /app/build /app/frontend

# Archivos del panel /admin/ (no necesita base de datos real para esto)
RUN DB_ENGINE=sqlite DB_NAME=/tmp/build.sqlite3 python manage.py collectstatic --noinput

# No correr como root
RUN useradd --create-home ausentrack \
    && mkdir -p /app/media /data \
    && chown -R ausentrack:ausentrack /app/media /data
USER ausentrack

EXPOSE 8000
CMD ["sh", "entrypoint.sh"]
