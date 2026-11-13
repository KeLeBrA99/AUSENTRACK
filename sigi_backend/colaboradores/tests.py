"""
AUSENTRACK - Pruebas del comando de datos de demostracion

    python manage.py test
"""
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from colaboradores.models import Colaborador
from incapacidades.models import Incapacidad
from rest_framework.test import APIClient

from authentication.models import Usuario


class CargarDemoTests(TestCase):

    def test_carga_la_demo_y_el_sistema_responde(self):
        call_command('cargar_demo', stdout=StringIO())
        self.assertEqual(Colaborador.objects.count(), 60)
        self.assertEqual(Colaborador.objects.filter(activo=False).count(), 6)
        self.assertTrue(Incapacidad.objects.filter(incapacidad_padre__isnull=False).exists())

        cliente = APIClient()
        cliente.force_authenticate(Usuario.objects.get(email='admin@demo.co'))
        for url in ('/api/colaboradores/', '/api/incapacidades/', '/api/incapacidades/estadisticas/',
                    '/api/vacaciones/', '/api/vacaciones/estadisticas/', '/api/contratos/', '/api/evaluaciones/',
                    '/api/capacitaciones/', '/api/retiros/', '/api/dotacion/entregas/', '/api/puntos-venta/',
                    '/api/procesos-disciplinarios/', '/api/reclutamiento/vacantes/'):
            self.assertEqual(cliente.get(url).status_code, 200, url)
        # el caso largo con prorrogas dispara la alerta de 180 dias
        self.assertEqual(len(cliente.get('/api/incapacidades/alertas/').data['mas_de_180_dias']), 1)

    def test_no_corre_si_ya_hay_datos(self):
        call_command('cargar_demo', stdout=StringIO())
        with self.assertRaises(CommandError):
            call_command('cargar_demo', stdout=StringIO())
        self.assertEqual(Colaborador.objects.count(), 60)
