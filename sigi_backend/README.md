# SIGI - Sistema de Gestion de Incapacidades
# Universidad Politecnico Grancolombiano — Proyecto de Grado 2026
# Jose Armando Salamanca — Ingenieria de Software

## Requisitos previos
- Python 3.10 o superior
- Node.js 18 o superior
- MySQL 8.0 o superior (ya instalado con MySQL Workbench)

---

## CONFIGURACION DEL BACKEND (Django)

### 1. Crear y activar el entorno virtual

    cd sigi_backend
    python -m venv venv

    # Windows:
    venv\Scripts\activate

    # Mac / Linux:
    source venv/bin/activate

### 2. Instalar dependencias

    pip install -r requirements.txt

### 3. Configurar la base de datos

Abre sigi_backend/settings.py y edita la seccion DATABASES con tu contrasena de MySQL:

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': 'sigi_db',
            'USER': 'root',
            'PASSWORD': 'TU_CONTRASENA_AQUI',
            'HOST': 'localhost',
            'PORT': '3306',
        }
    }

Asegurate de que la base de datos sigi_db ya existe (ya ejecutaste el script SQL).

### 4. Crear las tablas de Django (migraciones)

    python manage.py makemigrations
    python manage.py migrate

### 5. Crear el superusuario administrador

    python manage.py createsuperuser

### 6. Iniciar el servidor

    python manage.py runserver

El backend estara disponible en: http://localhost:8000

---

## CONFIGURACION DEL FRONTEND (React)

### 1. Instalar dependencias

    cd sigi_frontend
    npm install

### 2. Iniciar el servidor de desarrollo

    npm start

El frontend estara disponible en: http://localhost:3000

---

## ENDPOINTS PRINCIPALES (Sprint 1)

| Metodo | Endpoint                        | Descripcion                  |
|--------|---------------------------------|------------------------------|
| POST   | /api/auth/login/                | Iniciar sesion                |
| POST   | /api/auth/logout/               | Cerrar sesion                 |
| POST   | /api/auth/token/refresh/        | Renovar token JWT             |
| GET    | /api/auth/perfil/               | Ver perfil del usuario        |
| POST   | /api/auth/cambiar-password/     | Cambiar contrasena            |
| GET    | /api/auth/usuarios/             | Listar usuarios (solo ADMIN)  |
| POST   | /api/auth/usuarios/crear/       | Crear usuario (solo ADMIN)    |
| GET    | /api/auth/auditoria/            | Ver log de auditoria (ADMIN)  |

---

## ESTRUCTURA DEL PROYECTO

    sigi_backend/
        sigi_backend/         <- Configuracion principal Django
            settings.py
            urls.py
            wsgi.py
        authentication/       <- Sprint 1: Autenticacion y usuarios
            models.py         <- Modelo Usuario y Auditoria
            views.py          <- Endpoints de autenticacion
            serializers.py    <- Serializadores
            permissions.py    <- Permisos por rol
            urls.py           <- Rutas de autenticacion
        colaboradores/        <- Sprint 2
        incapacidades/        <- Sprint 3
        manage.py
        requirements.txt

    sigi_frontend/
        src/
            api/
                axios.js      <- Configuracion de Axios con JWT
            context/
                AuthContext.jsx <- Estado global del usuario
            components/
                layout/
                    RutaProtegida.jsx <- Proteccion de rutas por rol
            pages/
                auth/
                    Login.jsx     <- Pantalla de login
                    Login.css     <- Estilos del login
                dashboard/        <- Sprint 2 en adelante
            App.jsx               <- Enrutamiento principal
            index.jsx             <- Punto de entrada
            index.css             <- Estilos globales
        public/
            index.html
        package.json
