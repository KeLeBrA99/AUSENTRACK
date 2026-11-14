"""
AUSENTRACK - Pruebas del modo demostracion

    python manage.py test
"""
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from authentication.models import Usuario
from colaboradores.models import Colaborador

CLAVE = 'Clave-Segura-2026'


class ModoDemoTests(TestCase):

    def setUp(self):
        self.admin = Usuario.objects.create_user('admin@prueba.co', 'Admin', CLAVE, rol='ADMIN')
        self.otro  = Usuario.objects.create_user('otro@prueba.co', 'Otro', CLAVE, rol='NOMINA')
        self.cliente = APIClient()
        self.cliente.force_authenticate(self.admin)

    def test_en_una_instalacion_normal_no_hay_nada_de_demo(self):
        r = APIClient().get('/api/demo/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {'demo': False})          # no revela usuarios ni claves
        # y las acciones sensibles funcionan
        r = self.cliente.patch(f'/api/auth/usuarios/{self.otro.pk}/', {'nombre': 'Cambiado'}, format='json')
        self.assertEqual(r.status_code, 200)

    @override_settings(DEMO_MODE=True)
    def test_la_demo_anuncia_los_usuarios_de_prueba(self):
        datos = APIClient().get('/api/demo/').json()
        self.assertTrue(datos['demo'])
        self.assertEqual({u['rol'] for u in datos['usuarios']}, {'ADMIN', 'TALENTO_HUMANO', 'NOMINA'})

    @override_settings(DEMO_MODE=True)
    def test_la_demo_bloquea_lo_que_dejaria_por_fuera_a_otros_visitantes(self):
        c = self.cliente
        bloqueadas = [
            c.post('/api/auth/usuarios/crear/', {'nombre': 'x', 'email': 'x@x.co', 'password': CLAVE, 'rol': 'ADMIN'}, format='json'),
            c.patch(f'/api/auth/usuarios/{self.otro.pk}/', {'password': 'Otra-Clave-2027'}, format='json'),
            c.delete(f'/api/auth/usuarios/{self.otro.pk}/'),
            c.post('/api/auth/password/', {'password_actual': CLAVE, 'password_nuevo': 'Otra-Clave-2027'}, format='json'),
            c.post('/api/auth/cambiar-password/', {'password_actual': CLAVE, 'password_nuevo': 'Otra-Clave-2027'}, format='json'),
            c.patch('/api/auth/perfil/', {'nombre': 'Grosería'}, format='json'),
            c.post('/api/incapacidades/1/documento/', {}, format='multipart'),
            c.post('/api/colaboradores/importar/', {}, format='multipart'),
            c.get('/admin/'),
        ]
        for r in bloqueadas:
            self.assertEqual(r.status_code, 403, r.request['PATH_INFO'])
        self.otro.refresh_from_db()
        self.assertTrue(self.otro.activo and self.otro.check_password(CLAVE))
        # consultar y el resto del sistema siguen funcionando
        self.assertEqual(c.get('/api/auth/usuarios/').status_code, 200)
        self.assertEqual(c.get('/api/auth/perfil/').status_code, 200)
        self.assertEqual(c.get('/api/colaboradores/').status_code, 200)

    @override_settings(ALLOWED_HOSTS=['midominio.co'], SECURE_SSL_REDIRECT=True)
    def test_el_chequeo_de_salud_responde_aunque_el_host_no_este_permitido(self):
        r = APIClient().get('/healthz', HTTP_HOST='10.0.0.7:10000')
        self.assertEqual((r.status_code, r.content), (200, b'ok'))
        # cualquier otra ruta si exige HTTPS
        self.assertEqual(APIClient().get('/api/demo/', HTTP_HOST='midominio.co').status_code, 301)

    def test_reiniciar_nunca_borra_una_instalacion_real(self):
        """--reiniciar solo funciona con DEMO_MODE=True y SQLite, las dos a la vez."""
        with self.assertRaises(CommandError):
            call_command('cargar_demo', reiniciar=True, stdout=StringIO())
        self.assertTrue(Usuario.objects.filter(email='admin@prueba.co').exists())

        if connection.vendor != 'sqlite':
            with override_settings(DEMO_MODE=True):
                with self.assertRaises(CommandError):
                    call_command('cargar_demo', reiniciar=True, stdout=StringIO())
            self.assertTrue(Usuario.objects.filter(email='admin@prueba.co').exists())
