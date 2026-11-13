"""
AUSENTRACK - Pruebas de usuarios, perfil y permisos

    python manage.py test
"""
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Usuario

CLAVE = 'Clave-Segura-2026'
SIN_LIMITE = {'DEFAULT_THROTTLE_RATES': {'login': '1000/min', 'publico': '1000/min'}}


class BaseUsuarios(APITestCase):

    def setUp(self):
        self.admin  = Usuario.objects.create_user('admin@prueba.co', 'Admin', CLAVE, rol='ADMIN')
        self.th     = Usuario.objects.create_user('th@prueba.co', 'Talento', CLAVE, rol='TALENTO_HUMANO')
        self.nomina = Usuario.objects.create_user('nomina@prueba.co', 'Nomina', CLAVE, rol='NOMINA')

    def entrar(self, email, password):
        return self.client.post('/api/auth/login/', {'email': email, 'password': password}, format='json')


class PerfilTests(BaseUsuarios):

    def test_cambiar_la_propia_contrasena(self):
        """La pantalla 'Mi perfil' llama a /auth/password/, que antes no existia (404)."""
        self.client.force_authenticate(self.th)
        r = self.client.post('/api/auth/password/', {'password_actual': 'incorrecta', 'password_nuevo': 'Otra-Clave-2027'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/auth/password/', {'password_actual': CLAVE, 'password_nuevo': '12345678'}, format='json')
        self.assertEqual(r.status_code, 400)                      # demasiado comun
        r = self.client.post('/api/auth/password/', {'password_actual': CLAVE, 'password_nuevo': 'Otra-Clave-2027'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.client.force_authenticate(None)
        self.assertEqual(self.entrar('th@prueba.co', CLAVE).status_code, 401)
        self.assertEqual(self.entrar('th@prueba.co', 'Otra-Clave-2027').status_code, 200)

    def test_cambiar_el_propio_nombre_pero_no_el_rol(self):
        """PATCH /auth/perfil/ antes respondia 405."""
        self.client.force_authenticate(self.nomina)
        r = self.client.patch('/api/auth/perfil/', {'nombre': 'Nombre Nuevo', 'rol': 'ADMIN', 'email': 'otro@prueba.co'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.nomina.refresh_from_db()
        self.assertEqual((self.nomina.nombre, self.nomina.rol, self.nomina.email), ('Nombre Nuevo', 'NOMINA', 'nomina@prueba.co'))


class AdministracionUsuariosTests(BaseUsuarios):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.admin)

    def test_solo_admin_administra_usuarios(self):
        for usuario in (self.th, self.nomina):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.get('/api/auth/usuarios/').status_code, 403)
            self.assertEqual(self.client.patch(f'/api/auth/usuarios/{usuario.pk}/', {'rol': 'ADMIN'}, format='json').status_code, 403)
            self.assertEqual(self.client.get('/api/auth/auditoria/').status_code, 403)

    def test_el_admin_restablece_la_contrasena_de_otro_usuario(self):
        """Antes el campo se ignoraba en silencio y la contrasena no cambiaba."""
        r = self.client.patch(f'/api/auth/usuarios/{self.th.pk}/', {'password': 'Restablecida-2027'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertNotIn('password', r.data)
        self.client.force_authenticate(None)
        self.assertEqual(self.entrar('th@prueba.co', 'Restablecida-2027').status_code, 200)

    def test_editar_sin_contrasena_la_conserva(self):
        r = self.client.patch(f'/api/auth/usuarios/{self.th.pk}/', {'nombre': 'Talento H', 'password': ''}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.client.force_authenticate(None)
        self.assertEqual(self.entrar('th@prueba.co', CLAVE).status_code, 200)

    def test_no_se_puede_dejar_el_sistema_sin_administrador(self):
        self.assertEqual(self.client.delete(f'/api/auth/usuarios/{self.admin.pk}/').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/auth/usuarios/{self.admin.pk}/', {'rol': 'NOMINA'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/auth/usuarios/{self.admin.pk}/', {'activo': False}, format='json').status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.activo and self.admin.rol == 'ADMIN')
        # con un segundo administrador si se puede desactivar al primero (desde el otro)
        otro = Usuario.objects.create_user('admin2@prueba.co', 'Admin 2', CLAVE, rol='ADMIN')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.delete(f'/api/auth/usuarios/{self.admin.pk}/').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/auth/usuarios/{otro.pk}/').status_code, 400)

    def test_crear_usuario_valida_la_contrasena(self):
        nuevo = {'nombre': 'Nueva', 'email': 'nueva@prueba.co', 'rol': 'NOMINA'}
        self.assertEqual(self.client.post('/api/auth/usuarios/crear/', {**nuevo, 'password': 'password'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/auth/usuarios/crear/', {**nuevo, 'password': CLAVE}, format='json').status_code, 201)

    def test_usuario_desactivado_no_entra(self):
        self.client.delete(f'/api/auth/usuarios/{self.th.pk}/')
        self.client.force_authenticate(None)
        self.assertEqual(self.entrar('th@prueba.co', CLAVE).status_code, 401)


class AccesoPorRolTests(BaseUsuarios):
    """Sin sesion no se ve nada; con sesion, cada rol solo ve lo suyo."""

    SOLO_TALENTO_HUMANO = [
        '/api/vacaciones/', '/api/contratos/', '/api/evaluaciones/', '/api/retiros/',
        '/api/procesos-disciplinarios/', '/api/reclutamiento/vacantes/', '/api/capacitaciones/',
        '/api/dotacion/entregas/', '/api/puntos-venta/',
    ]
    TAMBIEN_NOMINA = ['/api/colaboradores/', '/api/incapacidades/', '/api/incapacidades/estadisticas/']

    def test_sin_sesion_todo_responde_401(self):
        for url in self.SOLO_TALENTO_HUMANO + self.TAMBIEN_NOMINA + ['/api/auth/perfil/', '/api/auth/usuarios/']:
            self.assertEqual(self.client.get(url).status_code, 401, url)

    def test_nomina_no_entra_a_los_modulos_de_talento_humano(self):
        self.client.force_authenticate(self.nomina)
        for url in self.SOLO_TALENTO_HUMANO:
            self.assertEqual(self.client.get(url).status_code, 403, url)
        for url in self.TAMBIEN_NOMINA:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_talento_humano_entra_a_todos_los_modulos(self):
        self.client.force_authenticate(self.th)
        for url in self.SOLO_TALENTO_HUMANO + self.TAMBIEN_NOMINA:
            self.assertEqual(self.client.get(url).status_code, 200, url)
