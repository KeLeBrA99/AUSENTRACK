"""
AUSENTRACK - Pruebas de vacaciones y festivos

    python manage.py test
"""
from datetime import date

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from authentication.models import Usuario
from colaboradores.models import Colaborador, Empresa
from sigi_backend.festivos import contar_dias_habiles, domingo_de_pascua, festivos_colombia
from .models import SolicitudVacaciones


class FestivosTests(SimpleTestCase):

    def test_festivos_de_2026(self):
        esperados = {
            date(2026, 1, 1), date(2026, 1, 12), date(2026, 3, 23), date(2026, 4, 2), date(2026, 4, 3),
            date(2026, 5, 1), date(2026, 5, 18), date(2026, 6, 8), date(2026, 6, 15), date(2026, 6, 29),
            date(2026, 7, 20), date(2026, 8, 7), date(2026, 8, 17), date(2026, 10, 12), date(2026, 11, 2),
            date(2026, 11, 16), date(2026, 12, 8), date(2026, 12, 25),
        }
        self.assertEqual(festivos_colombia(2026), esperados)

    def test_pascua(self):
        self.assertEqual(domingo_de_pascua(2024), date(2024, 3, 31))
        self.assertEqual(domingo_de_pascua(2025), date(2025, 4, 20))
        self.assertEqual(domingo_de_pascua(2026), date(2026, 4, 5))

    def test_dias_habiles_descuentan_festivos_y_fines_de_semana(self):
        # Semana Santa 2026: lunes 30 mar a viernes 3 abr -> jueves y viernes son festivos
        self.assertEqual(contar_dias_habiles(date(2026, 3, 30), date(2026, 4, 3)), 3)
        # Semana normal
        self.assertEqual(contar_dias_habiles(date(2026, 3, 9), date(2026, 3, 13)), 5)
        # Lunes festivo (2 nov) dentro de dos semanas completas
        self.assertEqual(contar_dias_habiles(date(2026, 11, 2), date(2026, 11, 13)), 9)
        self.assertEqual(contar_dias_habiles(date(2026, 3, 14), date(2026, 3, 15)), 0)   # sabado y domingo
        self.assertEqual(contar_dias_habiles(date(2026, 3, 13), date(2026, 3, 9)), 0)    # rango invertido

    @override_settings(VACACIONES_SABADO_HABIL=True)
    def test_sabado_habil_si_la_empresa_lo_trabaja(self):
        self.assertEqual(contar_dias_habiles(date(2026, 3, 9), date(2026, 3, 15)), 6)


class SolicitudesTests(APITestCase):

    def setUp(self):
        self.th = Usuario.objects.create_user('th@prueba.co', 'Talento', 'Clave-Segura-2026', rol='TALENTO_HUMANO')
        empresa = Empresa.objects.create(nit='900', razon_social='Empresa de prueba')
        # Ingreso hace mucho: saldo de sobra salvo que la prueba diga lo contrario
        self.colaborador = Colaborador.objects.create(
            empresa=empresa, cedula='1001', nombre='Persona De Prueba', fecha_ingreso=date(2020, 1, 15))
        self.nuevo = Colaborador.objects.create(
            empresa=empresa, cedula='1002', nombre='Recien Llegado', fecha_ingreso=date.today())
        self.client.force_authenticate(self.th)

    def solicitud(self, colaborador=None, inicio=date(2026, 3, 9), fin=date(2026, 3, 13), **extra):
        return SolicitudVacaciones.objects.create(
            colaborador=colaborador or self.colaborador, fecha_inicio=inicio, fecha_fin=fin, **extra)

    def accion(self, solicitud, nombre, **datos):
        return self.client.post(f'/api/vacaciones/{solicitud.pk}/{nombre}/', {'aprobado_por': 'Talento', **datos}, format='json')

    def test_los_festivos_no_descuentan_vacaciones(self):
        r = self.client.post('/api/vacaciones/crear/', {
            'colaborador': self.colaborador.pk, 'tipo_solicitud': 'VACACIONES',
            'fecha_inicio': '2026-03-30', 'fecha_fin': '2026-04-03',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['dias_habiles'], 3)

    def test_corregir_las_fechas_recalcula_los_dias(self):
        s = self.solicitud()
        self.assertEqual(s.dias_habiles, 5)
        r = self.client.patch(f'/api/vacaciones/{s.pk}/', {'fecha_fin': '2026-03-20'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['dias_habiles'], 10)

    def test_aprobar_exige_saldo(self):
        """Las solicitudes que llegan por JotForm entran sin validar saldo."""
        s = self.solicitud(colaborador=self.nuevo, origen='JOTFORM')
        r = self.accion(s, 'aprobar')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.data['sin_saldo'])
        s.refresh_from_db()
        self.assertEqual(s.estado, 'SOLICITADA')
        # autorizacion anticipada, de forma deliberada
        self.assertEqual(self.accion(s, 'aprobar', autorizar_sin_saldo=True).status_code, 200)

    def test_un_permiso_no_depende_del_saldo(self):
        s = self.solicitud(colaborador=self.nuevo, tipo_solicitud='PERMISO_NO_REMUNERADO')
        self.assertEqual(self.accion(s, 'aprobar').status_code, 200)

    def test_flujo_normal(self):
        s = self.solicitud()
        self.assertEqual(self.accion(s, 'aprobar').status_code, 200)
        self.assertEqual(self.accion(s, 'disfrutada').status_code, 200)
        s.refresh_from_db()
        self.assertEqual(s.estado, 'DISFRUTADA')

    def test_no_se_permiten_saltos_de_estado(self):
        rechazada = self.solicitud()
        self.assertEqual(self.accion(rechazada, 'rechazar', motivo_rechazo='Temporada alta').status_code, 200)
        # una rechazada no se puede marcar como disfrutada (descontaria saldo) ni aprobar despues
        self.assertEqual(self.accion(rechazada, 'disfrutada').status_code, 400)
        self.assertEqual(self.accion(rechazada, 'aprobar').status_code, 400)
        self.assertEqual(self.accion(rechazada, 'cancelar').status_code, 400)

        pendiente = self.solicitud(inicio=date(2026, 5, 4), fin=date(2026, 5, 8))
        self.assertEqual(self.accion(pendiente, 'disfrutada').status_code, 400)     # aun no aprobada
        self.assertEqual(self.accion(pendiente, 'aprobar').status_code, 200)
        self.assertEqual(self.accion(pendiente, 'aprobar').status_code, 400)        # ya aprobada
        self.assertEqual(self.accion(pendiente, 'cancelar').status_code, 200)
