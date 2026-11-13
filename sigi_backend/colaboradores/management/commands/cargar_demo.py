"""
AUSENTRACK - Datos de demostracion

    python manage.py cargar_demo

Llena una base VACIA con datos inventados para mostrar el sistema: una
empresa ficticia, 8 puntos de venta, 60 colaboradores y movimientos en los
13 modulos (incapacidades con prorrogas, vacaciones, contratos, procesos,
reclutamiento, evaluaciones, capacitaciones, retiros y dotacion).

Todo es ficticio: los nombres salen de combinar nombres y apellidos comunes y
las cedulas son numeros de relleno. Ningun dato corresponde a una persona real.

POR SEGURIDAD el comando se niega a correr si la base ya tiene colaboradores:
nunca mezcla ni borra informacion real. Para ver la demo usa una base aparte:

    1. En el .env:   DB_NAME=ausentrack_demo
    2. En MySQL:     CREATE DATABASE ausentrack_demo CHARACTER SET utf8mb4;
    3. python manage.py migrate
    4. python manage.py cargar_demo
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from authentication.models import Auditoria, Usuario
from capacitaciones.models import Capacitacion, ParticipanteCapacitacion
from colaboradores.models import Colaborador, Empresa, Entidad
from contratos.models import Contrato
from dotacion.models import (
    DetalleEntregaDotacion, ElementoDotacion, EntregaDotacion, InventarioElemento, RequisitoElemento,
)
from evaluaciones.models import CRITERIOS_ESTANDAR, EvaluacionDesempeno
from incapacidades.models import Incapacidad
from procesos_disciplinarios.models import ProcesoDisciplinario
from puntos_venta.models import PuntoVenta
from reclutamiento.models import Candidato, Vacante
from retiros.models import Retiro
from sigi_backend.festivos import es_dia_habil
from vacaciones.models import SolicitudVacaciones

CLAVE_DEMO = 'Demo-Ausentrack-2026'
RESPONSABLE = 'Laura Demo (Talento Humano)'

NOMBRES = ['Andrés', 'Camila', 'Santiago', 'Valentina', 'Juan', 'Daniela', 'Carlos', 'Mariana', 'Felipe', 'Laura',
           'Sebastián', 'Paula', 'Diego', 'Natalia', 'Julián', 'Carolina', 'Mateo', 'Sara', 'Nicolás', 'Juliana',
           'David', 'Luisa', 'Esteban', 'Manuela', 'Óscar', 'Angélica', 'Ricardo', 'Diana', 'Jorge', 'Tatiana']
APELLIDOS = ['Rodríguez', 'Gómez', 'Martínez', 'López', 'García', 'Hernández', 'Ramírez', 'Torres', 'Díaz', 'Vargas',
             'Moreno', 'Rojas', 'Jiménez', 'Castro', 'Ortiz', 'Suárez', 'Mendoza', 'Ruiz', 'Cárdenas', 'Pardo']
PUNTOS = [('Centro', 9), ('Chapinero', 8), ('Norte', 8), ('Occidente', 7), ('Sur', 7), ('Suba', 6),
          ('Usaquén', 6), ('Administración', 9)]
CARGOS = [('Auxiliar de cocina', 1_500_000), ('Cajero', 1_550_000), ('Mesero', 1_500_000),
          ('Cocinero', 1_900_000), ('Líder de punto', 2_600_000)]
CARGOS_ADMIN = [('Analista de nómina', 2_800_000), ('Analista de talento humano', 2_800_000),
                ('Auxiliar contable', 2_100_000), ('Coordinador de operaciones', 4_200_000)]
ENTIDADES = [
    ('EPS', ['EPS Sura', 'Sanitas', 'Nueva EPS', 'Salud Total', 'Compensar EPS']),
    ('ARL', ['ARL Sura', 'Positiva']),
    ('CCF', ['Compensar', 'Colsubsidio']),
    ('AFP', ['Porvenir', 'Protección', 'Colpensiones']),
]
DIAGNOSTICOS = ['J06.9 Infección respiratoria aguda', 'A09 Gastroenteritis', 'M54.5 Lumbago', 'S93.4 Esguince de tobillo',
                'R51 Cefalea', 'J20.9 Bronquitis aguda', 'K29.7 Gastritis', 'M75.1 Síndrome del manguito rotador']


class Command(BaseCommand):
    help = 'Carga datos ficticios de demostracion en una base vacia.'

    def handle(self, *args, **opciones):
        if Colaborador.objects.exists():
            raise CommandError(
                'La base de datos ya tiene colaboradores. Este comando solo corre sobre una base vacia, '
                'para no mezclar datos inventados con informacion real. Usa una base aparte para la demo '
                '(instrucciones al inicio de cargar_demo.py).'
            )
        self.rng = random.Random(2026)
        self.hoy = date.today()
        with transaction.atomic():
            self._usuarios()
            self._catalogos()
            self._colaboradores()
            self._contratos()
            self._incapacidades()
            self._vacaciones()
            self._procesos()
            self._reclutamiento()
            self._evaluaciones()
            self._capacitaciones()
            self._retiros()
            self._dotacion()
            self._auditoria()

        self.stdout.write(self.style.SUCCESS(
            f'\nDemo cargada: {Colaborador.objects.count()} colaboradores, {Incapacidad.objects.count()} incapacidades, '
            f'{SolicitudVacaciones.objects.count()} solicitudes de vacaciones, {Contrato.objects.count()} contratos.'
        ))
        self.stdout.write('Usuarios de demostracion (clave para los tres: %s)' % CLAVE_DEMO)
        for u in self.usuarios.values():
            self.stdout.write(f'  {u.email:22s} {u.get_rol_display()}')

    # ── utilidades ───────────────────────────────────────────────────────
    def dias_atras(self, n):
        return self.hoy - timedelta(days=n)

    def habil(self, fecha):
        """Corre la fecha al siguiente dia habil."""
        while not es_dia_habil(fecha):
            fecha += timedelta(days=1)
        return fecha

    # ── datos ────────────────────────────────────────────────────────────
    def _usuarios(self):
        self.usuarios = {
            rol: Usuario.objects.create_user(email, nombre, CLAVE_DEMO, rol=rol)
            for rol, email, nombre in [
                ('ADMIN', 'admin@demo.co', 'Administrador Demo'),
                ('TALENTO_HUMANO', 'talento@demo.co', 'Laura Demo'),
                ('NOMINA', 'nomina@demo.co', 'Nómina Demo'),
            ]
        }
        self.th = self.usuarios['TALENTO_HUMANO']

    def _catalogos(self):
        self.empresa = Empresa.objects.create(
            nit='900000000-0', razon_social='Sabores del Valle S.A.S. (empresa ficticia)',
            sector='Restaurantes', direccion='Calle Falsa 123, Bogotá', telefono='6010000000',
        )
        self.entidades = {
            tipo: [Entidad.objects.create(tipo=tipo, nombre=n, nit=f'8{i}{j:02d}000000-{j}')
                   for j, n in enumerate(nombres)]
            for i, (tipo, nombres) in enumerate(ENTIDADES)
        }
        self.puntos = [
            PuntoVenta.objects.create(nombre=n, personal_requerido=req, direccion=f'Carrera {10 + i} # {20 + i}-{30 + i}')
            for i, (n, req) in enumerate(PUNTOS)
        ]

    def _colaboradores(self):
        rng = self.rng
        nombres = set()
        while len(nombres) < 60:
            nombres.add(f'{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)} {rng.choice(APELLIDOS)}')
        self.colaboradores = []
        for i, nombre in enumerate(sorted(nombres)):
            punto = self.puntos[i % len(self.puntos)]
            cargo, salario = rng.choice(CARGOS_ADMIN if punto.nombre == 'Administración' else CARGOS)
            self.colaboradores.append(Colaborador.objects.create(
                empresa=self.empresa,
                eps=rng.choice(self.entidades['EPS']), arl=rng.choice(self.entidades['ARL']),
                caja_compensacion=rng.choice(self.entidades['CCF']), fondo_pension=rng.choice(self.entidades['AFP']),
                cedula=f'90000{i + 1:05d}', nombre=nombre, cargo=cargo, punto_venta=punto,
                salario=Decimal(salario),
                tipo_bono='FIJO' if cargo == 'Líder de punto' else 'NINGUNO',
                valor_bono=Decimal(300_000) if cargo == 'Líder de punto' else None,
                fecha_ingreso=self.dias_atras(rng.randint(40, 1500)),
            ))
        # Los 6 ultimos se retiran mas abajo (modulo de retiros)
        self.activos, self.por_retirar = self.colaboradores[:54], self.colaboradores[54:]

    def _contratos(self):
        rng = self.rng
        for i, c in enumerate(self.colaboradores):
            if i % 3 == 0:      # termino fijo: algunos por vencer, uno vencido
                fin = self.hoy + timedelta(days=[12, 25, 45, 90, 200, -10][i // 3 % 6])
                Contrato.objects.create(
                    colaborador=c, tipo_contrato='FIJO', cargo=c.cargo, salario=c.salario,
                    fecha_inicio=fin - timedelta(days=364), fecha_fin=fin,
                    estado='VENCIDO' if fin < self.hoy else 'VIGENTE', responsable_hr=RESPONSABLE,
                )
            else:
                Contrato.objects.create(
                    colaborador=c, tipo_contrato=rng.choice(['INDEFINIDO', 'INDEFINIDO', 'OBRA_LABOR']),
                    cargo=c.cargo, salario=c.salario, fecha_inicio=c.fecha_ingreso, responsable_hr=RESPONSABLE,
                )

    def _incapacidad(self, colaborador, inicio, dias, tipo='ENFERMEDAD_GENERAL', padre=None, estado=None):
        fin = inicio + timedelta(days=dias - 1)
        if tipo in ('ACCIDENTE_LABORAL', 'ENFERMEDAD_LABORAL'):
            entidad = colaborador.arl
        else:
            entidad = colaborador.eps
        return Incapacidad.objects.create(
            colaborador=colaborador, usuario_registro=self.th, entidad_emisora=entidad, tipo=tipo,
            fecha_inicio=inicio, fecha_fin=fin, incapacidad_padre=padre,
            diagnostico=self.rng.choice(DIAGNOSTICOS),
            estado=estado or ('ACTIVA' if fin >= self.hoy else 'CERRADA'),
        )

    def _incapacidades(self):
        rng = self.rng
        # Casos cortos repartidos en el ultimo año
        for _ in range(38):
            c = rng.choice(self.activos)
            tipo = rng.choices(['ENFERMEDAD_GENERAL', 'ACCIDENTE_LABORAL', 'ENFERMEDAD_LABORAL'], [80, 15, 5])[0]
            self._incapacidad(c, self.dias_atras(rng.randint(20, 360)), rng.choice([1, 2, 2, 3, 3, 5, 7, 10]), tipo)
        # Vigentes hoy, algunas por vencer esta semana
        for dias_restantes, duracion in [(1, 5), (2, 7), (4, 10), (9, 15), (20, 30)]:
            self._incapacidad(rng.choice(self.activos), self.hoy - timedelta(days=duracion - dias_restantes - 1), duracion)
        # Licencias
        femeninos = {'Camila', 'Valentina', 'Daniela', 'Mariana', 'Laura', 'Paula', 'Natalia', 'Carolina', 'Sara',
                     'Juliana', 'Luisa', 'Manuela', 'Angélica', 'Diana', 'Tatiana'}
        mujer  = next(c for c in self.activos if c.nombre.split()[0] in femeninos)
        hombre = next(c for c in self.activos if c.nombre.split()[0] not in femeninos)
        self._incapacidad(mujer, self.dias_atras(60), 126, 'MATERNIDAD')
        self._incapacidad(hombre, self.dias_atras(200), 14, 'PATERNIDAD')
        # Caso largo con prorrogas mensuales: supera los 180 dias y dispara la alerta
        largo, inicio, anterior = self.activos[11], self.dias_atras(205), None
        for n in range(7):
            anterior = self._incapacidad(largo, inicio + timedelta(days=30 * n), 30, padre=anterior,
                                         estado='ACTIVA' if n == 6 else 'CERRADA')
        # Caso con dos prorrogas ya cerrado
        inicio, anterior = self.dias_atras(120), None
        for n, dias in enumerate([5, 10, 15]):
            anterior = self._incapacidad(self.activos[20], inicio, dias, padre=anterior, estado='CERRADA')
            inicio += timedelta(days=dias)

    def _vacaciones(self):
        rng = self.rng
        antiguos = [c for c in self.activos if (self.hoy - c.fecha_ingreso).days > 500]
        usados = set()

        def solicitud(desde_hoy, dias, estado, tipo='VACACIONES', origen='MANUAL'):
            c = rng.choice([x for x in antiguos if x.pk not in usados])
            usados.add(c.pk)
            inicio = self.habil(self.hoy + timedelta(days=desde_hoy))
            respondida = estado in ('APROBADA', 'RECHAZADA', 'DISFRUTADA')
            SolicitudVacaciones.objects.create(
                colaborador=c, tipo_solicitud=tipo, fecha_inicio=inicio, fecha_fin=inicio + timedelta(days=dias - 1),
                estado=estado, origen=origen, responsable_hr=RESPONSABLE,
                aprobado_por='Laura Demo' if respondida else '',
                motivo_rechazo='Temporada alta en el punto de venta' if estado == 'RECHAZADA' else '',
            )

        for desde in (-300, -240, -180, -150, -120, -90, -60, -45):
            solicitud(desde, rng.choice([5, 8, 10, 15]), 'DISFRUTADA')
        for desde in (-3, 10, 18, 30, 45):
            solicitud(desde, rng.choice([5, 8, 12]), 'APROBADA')
        for desde, origen in ((20, 'JOTFORM'), (35, 'JOTFORM'), (50, 'MANUAL'), (60, 'JOTFORM')):
            solicitud(desde, rng.choice([3, 5, 10]), 'SOLICITADA', origen=origen)
        solicitud(15, 10, 'RECHAZADA')
        solicitud(25, 5, 'CANCELADA')
        solicitud(8, 2, 'APROBADA', tipo='PERMISO_NO_REMUNERADO')
        solicitud(12, 1, 'SOLICITADA', tipo='PERMISO_REMUNERADO', origen='JOTFORM')

    def _procesos(self):
        rng = self.rng
        casos = [
            ('LLAMADO_ATENCION', 'Llegadas tarde reiteradas durante el mes.', 'CERRADO', 'Compromiso de puntualidad firmado'),
            ('LLAMADO_ATENCION', 'Uso del celular en horario de atención al cliente.', 'CERRADO', 'Llamado verbal'),
            ('CARTA_MEJORA', 'Bajo cumplimiento del protocolo de servicio.', 'EN_PROCESO', ''),
            ('DESCARGOS', 'Faltante de caja al cierre del turno.', 'EN_PROCESO', ''),
            ('DESCARGOS', 'Ausencia sin justificar durante dos días.', 'CERRADO', 'Suspensión de 2 días'),
            ('SUSPENSION', 'Incumplimiento de normas de manipulación de alimentos.', 'CERRADO', 'Suspensión de 3 días'),
            ('COMUNICADO_DISCIPLINARIO', 'No portar la dotación completa.', 'ABIERTO', ''),
            ('LLAMADO_ATENCION', 'Trato inadecuado a un compañero.', 'ARCHIVADO', 'Conciliado entre las partes'),
            ('CARTA_MEJORA', 'Errores frecuentes en la toma de pedidos.', 'EN_PROCESO', ''),
            ('DESCARGOS', 'Abandono del puesto antes de terminar el turno.', 'DESISTIDO', 'Se aceptó la justificación'),
        ]
        for tipo, motivo, estado, resultado in casos:
            c = rng.choice(self.activos)
            ProcesoDisciplinario.objects.create(
                colaborador=c, nombre=c.nombre, cedula=c.cedula, cargo=c.cargo or '', fecha_ingreso=c.fecha_ingreso,
                tipo_proceso=tipo, fecha_actuacion=self.dias_atras(rng.randint(5, 240)), motivo=motivo,
                responsable_hr=RESPONSABLE, estado=estado, resultado=resultado,
            )

    def _reclutamiento(self):
        rng = self.rng
        etapas = ['POSTULADO', 'POSTULADO', 'ENTREVISTA_RH', 'ENTREVISTA_RH', 'ENTREVISTA_JEFE', 'PRUEBAS', 'OFERTA',
                  'CONTRATADO', 'RECHAZADO', 'DESISTIO']
        vacantes = [('Mesero', 0, 'ABIERTA', 2), ('Cocinero', 2, 'ABIERTA', 1), ('Cajero', 4, 'ABIERTA', 1),
                    ('Auxiliar de cocina', 1, 'PAUSADA', 1), ('Líder de punto', 5, 'CUBIERTA', 1)]
        n = 0
        for cargo, i_punto, estado, cupos in vacantes:
            v = Vacante.objects.create(
                cargo=cargo, punto_venta_fk=self.puntos[i_punto], salario_ofrecido=Decimal(dict(CARGOS)[cargo]),
                descripcion=f'Vacante de {cargo.lower()} para el punto {self.puntos[i_punto].nombre}.',
                requisitos='Bachiller. Experiencia mínima de 6 meses. Disponibilidad para turnos rotativos.',
                responsable_hr=RESPONSABLE, estado=estado, fecha_apertura=self.dias_atras(rng.randint(10, 60)),
                fecha_cierre=self.dias_atras(3) if estado == 'CUBIERTA' else None, vacantes_disponibles=cupos,
            )
            for _ in range(rng.randint(4, 7)):
                n += 1
                etapa = 'CONTRATADO' if estado == 'CUBIERTA' and _ == 0 else rng.choice(etapas[:7] + etapas[8:])
                nombre = f'{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)}'
                Candidato.objects.create(
                    vacante=v, nombre=nombre, cedula=f'91000{n:05d}', telefono=f'30000000{n:02d}',
                    email=f'candidato{n}@ejemplo.com', etapa=etapa,
                    fecha_postulacion=self.dias_atras(rng.randint(1, 30)),
                    fuente=rng.choice(['Computrabajo', 'Referido', 'Redes sociales', 'Hoja de vida en el punto']),
                    motivo_rechazo='No cumple la experiencia requerida' if etapa == 'RECHAZADO' else '',
                    responsable_hr=RESPONSABLE,
                )

    def _evaluaciones(self):
        rng = self.rng
        for c in rng.sample(self.activos, 22):
            nivel = rng.choice([3, 4, 4, 4, 5])
            estado = rng.choice(['COMPLETADA', 'COMPLETADA', 'ENTREGADA_COLABORADOR', 'BORRADOR'])
            EvaluacionDesempeno.objects.create(
                colaborador=c, periodo=f'{self.hoy.year}-S1', tipo_evaluacion=rng.choice(['JEFE_DIRECTO', 'JEFE_DIRECTO', 'PERIODO_PRUEBA']),
                fecha_evaluacion=self.dias_atras(rng.randint(10, 150)), evaluador='Líder del punto',
                criterios=[] if estado == 'BORRADOR' else [
                    {'criterio': nombre, 'puntaje': max(1, min(5, nivel + rng.choice([-1, 0, 0, 1])))}
                    for nombre in CRITERIOS_ESTANDAR
                ],
                fortalezas='' if estado == 'BORRADOR' else 'Buena disposición y trabajo en equipo.',
                areas_mejora='' if estado == 'BORRADOR' else 'Reforzar tiempos de entrega en horas pico.',
                plan_accion='' if estado == 'BORRADOR' else 'Acompañamiento del líder durante un mes.',
                estado=estado, responsable_hr=RESPONSABLE,
            )

    def _capacitaciones(self):
        rng = self.rng
        cursos = [
            ('Inducción corporativa', 'INDUCCION', -90, 'FINALIZADA', 4),
            ('Manipulación higiénica de alimentos', 'CAPACITACION_TECNICA', -45, 'FINALIZADA', 8),
            ('Servicio al cliente de alto impacto', 'SERVICIO_CLIENTE', -20, 'FINALIZADA', 6),
            ('Brigada de emergencias y primeros auxilios', 'SEGURIDAD_SALUD', -2, 'EN_CURSO', 12),
            ('Liderazgo para líderes de punto', 'LIDERAZGO', 14, 'PROGRAMADA', 16),
            ('Prevención de riesgo ergonómico', 'SEGURIDAD_SALUD', 30, 'PROGRAMADA', 3),
        ]
        for titulo, tipo, desde, estado, horas in cursos:
            inicio = self.hoy + timedelta(days=desde)
            cap = Capacitacion.objects.create(
                titulo=titulo, tipo=tipo, descripcion=f'Jornada de formación: {titulo.lower()}.',
                instructor='Formador externo', modalidad=rng.choice(['PRESENCIAL', 'VIRTUAL', 'MIXTA']),
                fecha_inicio=inicio, fecha_fin=inicio + timedelta(days=1), duracion_horas=Decimal(horas),
                cupo_maximo=20, estado=estado, responsable_hr=RESPONSABLE,
            )
            for c in rng.sample(self.activos, rng.randint(8, 16)):
                if estado == 'FINALIZADA':
                    asistio = rng.random() < 0.85
                    ParticipanteCapacitacion.objects.create(
                        capacitacion=cap, colaborador=c,
                        estado_asistencia='COMPLETADO' if asistio else 'NO_ASISTIO',
                        calificacion=Decimal(rng.randint(35, 50)) / 10 if asistio else None,
                        certificado_emitido=asistio,
                    )
                else:
                    ParticipanteCapacitacion.objects.create(capacitacion=cap, colaborador=c)

    def _retiros(self):
        rng = self.rng
        tipos = ['RENUNCIA_VOLUNTARIA', 'RENUNCIA_VOLUNTARIA', 'TERMINACION_CONTRATO', 'MUTUO_ACUERDO',
                 'DESPIDO_CON_JUSTA_CAUSA', 'RENUNCIA_VOLUNTARIA']
        for c, tipo, hace in zip(self.por_retirar, tipos, [150, 110, 75, 40, 18, 4]):
            fecha = self.dias_atras(hace)
            pagada = hace > 30
            Retiro.objects.create(
                colaborador=c, tipo_retiro=tipo, motivo='Motivos personales.' if 'RENUNCIA' in tipo else 'Fin de la relación laboral.',
                fecha_retiro=fecha, ultimo_dia_laborado=fecha, responsable_hr=RESPONSABLE,
                devolucion_dotacion=pagada, devolucion_equipos=pagada, paz_y_salvo_emitido=pagada,
                carta_laboral_entregada=pagada, estado_liquidacion='PAGADA' if pagada else rng.choice(['PENDIENTE', 'EN_PROCESO']),
                fecha_liquidacion=fecha + timedelta(days=10) if pagada else None,
                entrevista_realizada=tipo == 'RENUNCIA_VOLUNTARIA',
                entrevista_notas='Se retira por una oferta con mejor horario.' if tipo == 'RENUNCIA_VOLUNTARIA' else '',
                recomendable_recontratacion=tipo != 'DESPIDO_CON_JUSTA_CAUSA',
            )
            c.retirar(fecha=fecha, motivo=dict(Retiro.TIPO_CHOICES)[tipo])
            Contrato.objects.filter(colaborador=c, estado='VIGENTE').update(
                estado='TERMINADO', fecha_terminacion=fecha, motivo_terminacion=dict(Retiro.TIPO_CHOICES)[tipo])

    def _dotacion(self):
        rng = self.rng
        elementos = [('Camisa institucional', 'UNIFORME', True, 6), ('Pantalón', 'UNIFORME', True, 6),
                     ('Delantal', 'UNIFORME', False, 6), ('Gorro de cocina', 'UNIFORME', False, 4),
                     ('Zapato antideslizante', 'EPP', True, 12), ('Guantes anticorte', 'EPP', False, 6),
                     ('Tapabocas (caja)', 'EPP', False, 1)]
        tallas = {'Camisa institucional': ['S', 'M', 'L', 'XL'], 'Pantalón': ['30', '32', '34', '36'],
                  'Zapato antideslizante': ['36', '38', '40', '42']}
        self.elementos = {}
        for nombre, categoria, usa_talla, vida in elementos:
            e = ElementoDotacion.objects.create(nombre=nombre, categoria=categoria, usa_talla=usa_talla, vida_util_meses=vida)
            self.elementos[nombre] = e
            for talla in tallas.get(nombre, ['']):
                InventarioElemento.objects.create(
                    elemento=e, talla=talla, cantidad_disponible=rng.choice([2, 3, 8, 12, 20, 30]), stock_minimo=5)
        for cargo in ('Cocinero', 'Auxiliar de cocina'):
            for nombre in ('Camisa institucional', 'Pantalón', 'Delantal', 'Gorro de cocina', 'Zapato antideslizante', 'Guantes anticorte'):
                RequisitoElemento.objects.create(cargo=cargo, elemento=self.elementos[nombre])
        for cargo in ('Mesero', 'Cajero', 'Líder de punto'):
            for nombre in ('Camisa institucional', 'Pantalón', 'Zapato antideslizante'):
                RequisitoElemento.objects.create(cargo=cargo, elemento=self.elementos[nombre])
        for c in rng.sample(self.activos, 30):
            entrega = EntregaDotacion.objects.create(
                colaborador=c, tipo_entrega=rng.choice(['INGRESO', 'PERIODICA', 'PERIODICA', 'REPOSICION']),
                fecha_entrega=self.dias_atras(rng.randint(5, 330)), responsable_hr=RESPONSABLE,
                firma_recibido=rng.random() < 0.9,
            )
            for nombre in rng.sample(['Camisa institucional', 'Pantalón', 'Zapato antideslizante', 'Delantal'], rng.randint(2, 3)):
                DetalleEntregaDotacion.objects.create(
                    entrega=entrega, elemento=self.elementos[nombre],
                    talla=rng.choice(tallas[nombre]) if nombre in tallas else '', cantidad=rng.choice([1, 2]),
                )

    def _auditoria(self):
        rng = self.rng
        acciones = [('LOGIN', 'usuario', 'Inicio de sesion'), ('CREATE', 'incapacidad', 'Incapacidad registrada'),
                    ('UPDATE', 'colaborador', 'Datos actualizados'), ('CREATE', 'contrato', 'Contrato creado'),
                    ('UPDATE', 'solicitud_vacaciones', 'Solicitud aprobada'), ('LOGOUT', 'usuario', 'Cierre de sesion')]
        for n in range(120):
            accion, tabla, detalle = rng.choice(acciones)
            Auditoria.objects.create(
                usuario=rng.choice(list(self.usuarios.values())), accion=accion, tabla_afectada=tabla,
                id_registro=rng.randint(1, 60), detalle=detalle, ip_origen='127.0.0.1',
            )
