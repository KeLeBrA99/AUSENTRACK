# AUSENTRACK
### Sistema de Gestión de Talento Humano

![Django](https://img.shields.io/badge/Django-4.2-092E20?style=flat&logo=django)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![DRF](https://img.shields.io/badge/Django_REST_Framework-3.14-red?style=flat)
![JWT](https://img.shields.io/badge/Auth-JWT-orange?style=flat)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

AUSENTRACK es una plataforma web de gestión integral de Talento Humano para
empresas colombianas (desarrollado originalmente para las sedes de Poke).
Empezó como un sistema de seguimiento de incapacidades laborales y creció
hasta cubrir todo el ciclo de vida del colaborador: reclutamiento, contratación,
gestión de personal, desempeño, capacitación, vacaciones y disciplina.

---

## Módulos del sistema

| Módulo | Qué hace |
|---|---|
| **Dashboard** | Resumen general con gráficas de los 5 módulos principales |
| **Colaboradores** | Ficha completa (salario, bonos, EPS/ARL, punto de venta), importación masiva por Excel |
| **EPS / ARL** | Catálogo de entidades aseguradoras |
| **Incapacidades** | Registro, prórroga (límite 540 días, Ley 100/1993), documentos adjuntos, cálculo automático del responsable de pago |
| **Procesos Disciplinarios** | Llamados de atención, cartas, seguimiento por punto de venta, alertas de reincidencia |
| **Reclutamiento** | Vacantes + pipeline de candidatos tipo kanban; al contratar, genera el colaborador automáticamente |
| **Contratos** | Generación de PDF, control de vencimientos, renovación encadenada |
| **Evaluaciones de Desempeño** | Calificación por criterios estándar (1-5 estrellas), ranking, promedio por criterio |
| **Capacitaciones** | Cursos con asistencia, alerta de inducción pendiente para personal nuevo |
| **Puntos de Venta** | Personal requerido vs. real por sede, detección de nombres mal escritos |
| **Vacaciones** | Saldo automático (15 días hábiles/año), solicitud, aprobación/rechazo |
| **Reportes** | Exportación a Excel y PDF con filtros |
| **Usuarios / Auditoría** | Roles (Admin, Talento Humano, Nómina), trazabilidad completa de acciones |

Todos los módulos de personal (Colaboradores, Reclutamiento, Procesos
Disciplinarios, Contratos, Capacitaciones) están conectados entre sí por
relaciones reales en la base de datos — no solo por texto — así que
"Poke 2" y "Poke2" siempre se cuentan como el mismo punto de venta.

---

## Tecnologías

| Capa | Tecnología |
|------|------------|
| Backend | Python 3.11+ + Django 4.2 + Django REST Framework |
| Autenticación | SimpleJWT |
| Base de datos | MySQL |
| Frontend | React 18 + React Router 6 |
| Gráficas | Recharts |
| Reportes | openpyxl (Excel) + ReportLab (PDF) |

---

## Estructura del proyecto

```
AUSENTRACK/
├── sigi_backend/                # API REST Django
│   ├── authentication/          # Usuarios, roles, auditoría, JWT
│   ├── colaboradores/           # Personal, EPS/ARL, empresas, importación Excel
│   ├── incapacidades/           # Incapacidades + prórroga + documentos
│   ├── procesos_disciplinarios/ # Llamados de atención, cartas
│   ├── reclutamiento/           # Vacantes + candidatos (pipeline)
│   ├── contratos/               # Contratos, PDF, renovaciones
│   ├── evaluaciones/            # Evaluaciones de desempeño
│   ├── capacitaciones/          # Cursos + asistencia + inducción
│   ├── puntos_venta/            # Sedes + personal requerido
│   ├── vacaciones/              # Solicitudes + saldo
│   └── sigi_backend/            # Configuración global (settings, urls)
│
└── sigi_frontend/                # SPA React
    └── src/
        ├── api/                  # Servicios HTTP (axios), uno por módulo
        ├── components/           # Layout, Modal, Tabla
        ├── context/              # AuthContext (estado de sesión)
        ├── utils/                # Helpers (formateo de errores, etc.)
        └── pages/                # Una carpeta por módulo
```

---

## Instalación y ejecución local

### Requisitos
- Python 3.11 o 3.12 (evitar 3.13 por compatibilidad)
- Node.js 18+ / npm 9+
- MySQL Server (o XAMPP con MySQL)
- Git

### 1. Backend

```bash
cd sigi_backend

# Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt
```

> **Nota Windows:** el proyecto usa `pymysql` en vez de `mysqlclient` porque
> este último requiere Visual C++ Build Tools para compilar. `pymysql` es
> puro Python y ya viene activado en `sigi_backend/sigi_backend/__init__.py`.

Crea la base de datos en MySQL:
```sql
CREATE DATABASE sigi_db;
```

Revisa `sigi_backend/sigi_backend/settings.py` → bloque `DATABASES` y ajusta
usuario/contraseña/host si no usas los valores por defecto.

```bash
# Migrar y crear tu usuario administrador
python manage.py migrate
python manage.py createsuperuser

# Levantar el servidor
python manage.py runserver
```

Backend disponible en `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd sigi_frontend
npm install
npm start
```

Frontend disponible en `http://localhost:3000`.

### 3. Datos base necesarios

Antes de usar varios módulos, crea al menos:
- **Una Empresa** (Colaboradores → aún no tiene pantalla propia, se crea por comando):
  ```bash
  python manage.py shell -c "from colaboradores.models import Empresa; Empresa.objects.create(nit='TU_NIT', razon_social='Tu Empresa')"
  ```
- **Tus puntos de venta reales** (Puntos de Venta → Importar Excel, o uno por uno)

---

## Variables sensibles (antes de producción)

Este repo trae valores de desarrollo que **deben cambiarse** antes de exponer
el sistema fuera de tu máquina:

- `SECRET_KEY` en `settings.py` — es el de ejemplo de Django, no usar en producción
- Contraseña de MySQL en `DATABASES` — cambiar por una real
- `DEBUG = True` y `ALLOWED_HOSTS = ['*']` — cerrar antes de desplegar en un servidor accesible desde internet

---

## Roles del sistema

| Rol | Acceso |
|---|---|
| **ADMIN** | Todo, incluyendo eliminar registros |
| **TALENTO_HUMANO** | Todos los módulos de gestión de personal (crear/editar) |
| **NOMINA** | Consulta de colaboradores y datos relacionados a pago |

---

## Normativa aplicada (Incapacidades)

| Norma | Aplicación en el sistema |
|-------|--------------------------|
| Ley 100/1993 Art. 227 | Cálculo automático del responsable de pago (Empleador días 1-2, EPS desde día 3) |
| Ley 100/1993 Art. 227 | Límite de 540 días para incapacidades prorrogables |
| Decreto 019/2012 | Proceso de cobro ante EPS y ARL |

**Vacaciones**: 15 días hábiles causados por año trabajado (1.25 días/mes), según
el estándar general del Código Sustantivo del Trabajo colombiano.

---

## Licencia

MIT License — libre para uso académico y educativo.
