# AUSENTRACK
### Sistema de Gestión de Incapacidades Laborales

![Django](https://img.shields.io/badge/Django-4.2-092E20?style=flat&logo=django)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![DRF](https://img.shields.io/badge/Django_REST_Framework-3.14-red?style=flat)
![JWT](https://img.shields.io/badge/Auth-JWT-orange?style=flat)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

AUSENTRACK es una aplicación web para la gestión integral de incapacidades laborales en empresas colombianas. Automatiza el registro, seguimiento y control del ausentismo laboral cumpliendo con la normativa vigente (Ley 100/1993 - Decreto 019/2012).

---

## Características Principales

- **Autenticación JWT** con roles diferenciados (Admin, Talento Humano, Nómina)
- **Dashboard interactivo** con gráficas de tendencia, tipos, estados y responsables de pago
- **Gestión de colaboradores** con importación masiva desde Excel
- **Registro de incapacidades** con cálculo automático del responsable de pago según normativa colombiana
- **Prórroga de incapacidades** con validación del límite de 540 días (Ley 100/1993)
- **Subida de documentos** (PDF/JPG/PNG) adjuntos a cada incapacidad
- **Reportes** exportables en Excel y PDF con filtros avanzados
- **Auditoría completa** de todas las acciones del sistema
- **Gestión de usuarios** con desactivación lógica

---

## Tecnologías

| Capa | Tecnología |
|------|------------|
| Backend | Python 3.12 + Django 4.2 + Django REST Framework |
| Autenticación | SimpleJWT |
| Frontend | React 18 + React Router 6 |
| Gráficas | Recharts |
| Reportes | openpyxl + ReportLab |
| Base de datos | SQLite (desarrollo) / PostgreSQL (producción) |
| Estilos | CSS personalizado |

---

## Estructura del Proyecto

```
Proyecto-de-grado/
├── sigi_backend/           # API REST Django
│   ├── authentication/     # Usuarios, roles, auditoría, JWT
│   ├── colaboradores/      # Gestión de personal + importación Excel
│   ├── incapacidades/      # Núcleo del sistema + prórroga + documentos
│   └── sigi_backend/       # Configuración global
│
└── sigi_frontend/          # SPA React
    └── src/
        ├── api/            # Servicios HTTP (axios)
        ├── components/     # Layout, Modal, Tabla
        ├── context/        # AuthContext (estado de sesión)
        └── pages/          # Dashboard, Colaboradores, Incapacidades, etc.
```

---

## Instalación y Ejecución

### Requisitos
- Python 3.10+
- Node.js 18+
- npm 9+

### Backend

```bash
cd sigi_backend

# Crear entorno virtual
python -m venv venv

# Activar entorno (Windows)
venv\Scripts\activate

# Activar entorno (Linux/Mac)
# source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Aplicar migraciones
python manage.py migrate

# Crear superusuario administrador
python manage.py createsuperuser

# Iniciar servidor
python manage.py runserver
```

El backend quedará disponible en: `http://127.0.0.1:8000`

### Frontend

```bash
cd sigi_frontend

# Instalar dependencias
npm install

# Iniciar aplicación
npm start
```

La aplicación quedará disponible en: `http://localhost:3000`

---

## Variables de Entorno (Producción)

Crea un archivo `.env` en `sigi_backend/` con las siguientes variables:

```env
SECRET_KEY=tu_clave_secreta_muy_segura
DEBUG=False
ALLOWED_HOSTS=tudominio.com
DATABASE_URL=postgresql://usuario:password@host:5432/ausentrack
```

---

## Módulos del Sistema

| Módulo | Descripción | Roles |
|--------|-------------|-------|
| Dashboard | Estadísticas y gráficas en tiempo real | Todos |
| Colaboradores | Registro y gestión del personal | Admin / T. Humano |
| EPS / ARL | Catálogo de entidades aseguradoras | Admin / T. Humano |
| Incapacidades | Registro, seguimiento y documentos | Todos |
| Prórroga | Extensión de incapacidades (máx. 540 días) | Admin / T. Humano |
| Reportes | Exportación Excel y PDF | Todos |
| Usuarios | Administración de cuentas | Admin |
| Auditoría | Trazabilidad de acciones | Admin |
| Mi Perfil | Datos personales y cambio de contraseña | Todos |

---

## Normativa Aplicada

| Norma | Aplicación en el sistema |
|-------|--------------------------|
| Ley 100/1993 Art. 227 | Cálculo automático del responsable de pago |
| Ley 100/1993 Art. 227 | Límite de 540 días para incapacidades prorrogables |
| Decreto 019/2012 | Proceso de cobro ante EPS y ARL |

### Lógica de Responsable de Pago

```
Enfermedad General:
  Días 1-2   → EMPLEADOR
  Día 3+     → EPS

Accidente Laboral  → ARL
Enfermedad Laboral → ARL
Licencia Maternidad → EPS
Licencia Paternidad → EPS
```

---

## API REST — Endpoints Principales

```
POST   /api/auth/login/                    # Autenticación
GET    /api/colaboradores/                 # Listar colaboradores
POST   /api/colaboradores/importar/        # Importación masiva Excel
GET    /api/incapacidades/                 # Listar incapacidades
GET    /api/incapacidades/estadisticas/    # Datos para dashboard
POST   /api/incapacidades/<id>/prorroga/   # Crear prórroga
POST   /api/incapacidades/<id>/documento/  # Subir documento
GET    /api/incapacidades/reporte/         # Exportar Excel/PDF
GET    /api/auth/auditoria/                # Registros de auditoría
```

---

## Capturas del Sistema

> Dashboard con estadísticas en tiempo real, módulo de incapacidades con gestión completa y prórroga con validación normativa.

---

## Documentación

- **Manual de Usuario** — Guía completa para usuarios finales con instrucciones paso a paso
- **Documentación Técnica** — Arquitectura, modelos de BD, endpoints y guía de despliegue

---

## Autor

Proyecto de Grado — Ingeniería de Software  
Universidad — 2026

---

## Licencia

MIT License — libre para uso académico y educativo.
