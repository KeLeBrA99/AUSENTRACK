# AUSENTRACK — Guía de despliegue

Todo lo que sigue ya está preparado en el código. Esta guía es la lista de
pasos para el día que quieras sacar AUSENTRACK de tu laptop y ponerlo en un
servidor real, para que Talento Humano lo use sin depender de tu equipo.

---

## 1. Backend — archivo `.env` de producción

En el servidor, crea `sigi_backend/.env` con estos valores (nunca subas este
archivo a Git):

```
# Genera una clave NUEVA, distinta a la de desarrollo:
#   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
SECRET_KEY=<la clave que generaste>

DEBUG=False
ALLOWED_HOSTS=ausentrack.tuempresa.com

DB_NAME=sigi_db
DB_USER=<usuario de mysql>
DB_PASSWORD=<contraseña fuerte, distinta a la local>
DB_HOST=<host de la base de datos>
DB_PORT=3306

CORS_ALLOWED_ORIGINS=https://ausentrack.tuempresa.com

JOTFORM_WEBHOOK_TOKEN=<genera uno nuevo, distinto al de desarrollo>

THROTTLE_LOGIN=10/min
THROTTLE_PUBLICO=30/hour
SECURE_SSL_REDIRECT=True
```

**Al poner `DEBUG=False` se activan solas** estas protecciones (verificado):
redirección forzada a HTTPS, HSTS por un año, cookies solo por HTTPS,
bloqueo de incrustación en iframes (`X-Frame-Options: DENY`) y protección
contra sniffing de contenido.

> Si tu proveedor (Railway, Render, nginx) ya redirige a HTTPS por su cuenta,
> pon `SECURE_SSL_REDIRECT=False` para evitar un bucle de redirecciones.

---

## 2. Frontend — archivo `.env` de producción

En `sigi_frontend/.env`:

```
REACT_APP_API_URL=https://ausentrack.tuempresa.com/api
```

Luego compila:

```bash
npm install
npm run build
```

La carpeta `build/` resultante es lo que se publica en el servidor web.

> Importante: esta variable se aplica **al compilar**, no al ejecutar. Si
> cambias la URL después, hay que volver a correr `npm run build`.

---

## 3. Base de datos

```bash
python manage.py migrate
python manage.py createsuperuser
```

Y respalda antes de cualquier despliegue:

```bash
mysqldump -u usuario -p sigi_db > respaldo_$(date +%F).sql
```

---

## 4. Archivos estáticos y multimedia

Los documentos de incapacidades (`media/`) deben quedar en un volumen
persistente, no dentro del contenedor o carpeta de la aplicación — si no, se
pierden en cada despliegue.

---

## 5. Verificación posterior

Django trae un chequeo propio de seguridad. Córrelo en el servidor:

```bash
python manage.py check --deploy
```

Y comprueba a mano:

- [ ] Entrar por HTTP redirige a HTTPS
- [ ] El login funciona, y al fallar 10 veces seguidas responde 429
- [ ] El link público de autoevaluación abre desde otra red
- [ ] El webhook de JotForm llega (revisa el historial en JotForm)

---

## 6. Lo que queda pendiente para una operación seria

Estas cosas no están resueltas en el código y hay que decidirlas al desplegar:

- **Respaldos automáticos** de MySQL (un cron diario con `mysqldump`)
- **Servidor de aplicación**: `runserver` es solo para desarrollo. En
  producción se usa gunicorn o uwsgi detrás de nginx.
- **Monitoreo de errores**: hoy los errores solo quedan en consola. Vale la
  pena conectar algo como Sentry para enterarte cuando algo falle.
- **Rotación del token de JotForm** si alguna vez se filtra.
