"""
AUSENTRACK - Pruebas del modulo de incapacidades

    python manage.py test
"""
import shutil
import tempfile
from datetime import date, timedelta
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from authentication.models import Usuario
from colaboradores.models import Colaborador, Empresa, Entidad
from .models import Incapacidad

PDF = b'%PDF-1.4\n%prueba\n'
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 16
MEDIA_TEMPORAL = tempfile.mkdtemp(prefix='ausentrack_pruebas_')


@override_settings(MEDIA_ROOT=MEDIA_TEMPORAL)
class BaseIncapacidades(APITestCase):

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_TEMPORAL, ignore_errors=True)

    def setUp(self):
        self.admin  = Usuario.objects.create_user('admin@prueba.co', 'Admin', 'Clave-Segura-2026', rol='ADMIN')
        self.th     = Usuario.objects.create_user('th@prueba.co', 'Talento', 'Clave-Segura-2026', rol='TALENTO_HUMANO')
        self.nomina = Usuario.objects.create_user('nomina@prueba.co', 'Nomina', 'Clave-Segura-2026', rol='NOMINA')
        empresa = Empresa.objects.create(nit='900', razon_social='Empresa de prueba')
        eps = Entidad.objects.create(tipo='EPS', nombre='EPS de prueba', nit='800')
        self.colaborador = Colaborador.objects.create(
            empresa=empresa, eps=eps, cedula='1001', nombre='Persona De Prueba', fecha_ingreso=date(2024, 1, 15),
        )
        self.client.force_authenticate(self.th)

    def crear(self, inicio, fin, tipo='ENFERMEDAD_GENERAL', padre=None):
        return Incapacidad.objects.create(
            colaborador=self.colaborador, usuario_registro=self.th, tipo=tipo,
            fecha_inicio=inicio, fecha_fin=fin, incapacidad_padre=padre,
        )

    def subir(self, incapacidad, nombre='incapacidad.pdf', contenido=PDF):
        return self.client.post(
            f'/api/incapacidades/{incapacidad.pk}/documento/',
            {'documento': SimpleUploadedFile(nombre, contenido)}, format='multipart',
        )


class DocumentosTests(BaseIncapacidades):

    def setUp(self):
        super().setUp()
        self.inc = self.crear(date(2026, 3, 2), date(2026, 3, 6))

    def test_subir_ver_y_eliminar(self):
        r = self.subir(self.inc)
        self.assertEqual(r.status_code, 200, r.data)
        ruta = Path(MEDIA_TEMPORAL) / r.data['documento_url']
        self.assertTrue(ruta.is_file())
        # el nombre lo genera el servidor: no reutiliza el del archivo original
        self.assertNotIn('incapacidad.pdf', r.data['documento_url'])

        r = self.client.get(f'/api/incapacidades/{self.inc.pk}/documento/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['Content-Type'], 'application/pdf')
        self.assertEqual(b''.join(r.streaming_content), PDF)

        self.assertEqual(self.client.delete(f'/api/incapacidades/{self.inc.pk}/documento/').status_code, 200)
        self.assertFalse(ruta.exists())
        self.assertEqual(self.client.get(f'/api/incapacidades/{self.inc.pk}/documento/').status_code, 404)

    def test_el_documento_exige_sesion(self):
        url_documento = self.subir(self.inc).data['documento_url']
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/incapacidades/{self.inc.pk}/documento/').status_code, 401)
        # y ya no existe una URL publica /media/... para saltarse el login
        self.assertEqual(self.client.get(f'/media/{url_documento}').status_code, 404)

    def test_nomina_puede_ver_pero_no_subir_ni_borrar(self):
        self.subir(self.inc)
        self.client.force_authenticate(self.nomina)
        self.assertEqual(self.client.get(f'/api/incapacidades/{self.inc.pk}/documento/').status_code, 200)
        self.assertEqual(self.subir(self.inc).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/incapacidades/{self.inc.pk}/documento/').status_code, 403)

    def test_rechaza_archivos_que_no_son_lo_que_dicen(self):
        self.assertEqual(self.subir(self.inc, 'virus.exe', b'MZ...').status_code, 400)
        self.assertEqual(self.subir(self.inc, 'falso.pdf', b'<html><script>alert(1)</script>').status_code, 400)
        self.assertEqual(self.subir(self.inc, 'falso.png', PDF).status_code, 400)
        self.assertEqual(self.subir(self.inc, 'foto.png', PNG).status_code, 200)

    def test_reemplazar_borra_el_documento_anterior(self):
        primero = Path(MEDIA_TEMPORAL) / self.subir(self.inc).data['documento_url']
        segundo = Path(MEDIA_TEMPORAL) / self.subir(self.inc, 'otra.png', PNG).data['documento_url']
        self.assertFalse(primero.exists())
        self.assertTrue(segundo.is_file())

    def test_no_se_puede_borrar_un_archivo_ajeno_cambiando_documento_url(self):
        """Antes documento_url se podia editar y 'Eliminar documento' borraba esa ruta."""
        ajeno = Path(MEDIA_TEMPORAL) / 'archivo_del_sistema.txt'
        ajeno.write_text('no me borres')

        r = self.client.patch(f'/api/incapacidades/{self.inc.pk}/', {'documento_url': '../archivo_del_sistema.txt'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.inc.refresh_from_db()
        self.assertIsNone(self.inc.documento_url)            # el campo es de solo lectura

        # aunque el valor ya estuviera guardado asi en la base, no se toca
        Incapacidad.objects.filter(pk=self.inc.pk).update(documento_url='../archivo_del_sistema.txt')
        self.assertEqual(self.client.get(f'/api/incapacidades/{self.inc.pk}/documento/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/incapacidades/{self.inc.pk}/documento/').status_code, 200)
        self.subir(self.inc)
        self.assertTrue(ajeno.exists())


class ProrrogasTests(BaseIncapacidades):

    def prorrogar(self, incapacidad, inicio, fin):
        return self.client.post(
            f'/api/incapacidades/{incapacidad.pk}/prorroga/',
            {'fecha_inicio': str(inicio), 'fecha_fin': str(fin)}, format='json',
        )

    def test_los_dias_cuentan_ambos_extremos(self):
        inicial = self.crear(date(2026, 3, 2), date(2026, 3, 4))          # 3 dias
        r = self.prorrogar(inicial, date(2026, 3, 5), date(2026, 3, 9))   # 5 dias
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['dias_prorroga'], 5)
        self.assertEqual(r.data['dias_acumulados'], 8)

    def test_prorroga_de_un_solo_dia(self):
        inicial = self.crear(date(2026, 3, 2), date(2026, 3, 4))
        r = self.prorrogar(inicial, date(2026, 3, 5), date(2026, 3, 5))
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['dias_prorroga'], 1)

    def test_no_supera_540_dias_ni_por_un_dia(self):
        inicio = date(2025, 1, 1)
        inicial = self.crear(inicio, inicio + timedelta(days=529))        # 530 dias
        siguiente = inicio + timedelta(days=530)
        self.assertEqual(self.prorrogar(inicial, siguiente, siguiente + timedelta(days=10)).status_code, 400)  # 11 dias: 541
        r = self.prorrogar(inicial, siguiente, siguiente + timedelta(days=9))                                  # 10 dias: 540
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['dias_restantes'], 0)

    def test_validaciones(self):
        inicial = self.crear(date(2026, 3, 2), date(2026, 3, 4))
        self.assertEqual(self.prorrogar(inicial, date(2026, 3, 9), date(2026, 3, 5)).status_code, 400)   # fin < inicio
        self.assertEqual(self.prorrogar(inicial, date(2026, 3, 4), date(2026, 3, 8)).status_code, 400)   # se cruza con la original
        self.assertEqual(self.prorrogar(inicial, 'ayer', 'mañana').status_code, 400)
        self.assertEqual(self.client.post(f'/api/incapacidades/{inicial.pk}/prorroga/', [1, 2], format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/incapacidades/{inicial.pk}/prorroga/', {}, format='json').status_code, 400)
        self.assertEqual(self.prorrogar(Incapacidad(pk=99999), date(2026, 3, 5), date(2026, 3, 6)).status_code, 404)

    def test_responsable_de_pago(self):
        corta = self.crear(date(2026, 3, 2), date(2026, 3, 3))            # 2 dias
        self.assertEqual(corta.responsable_pago, 'EMPLEADOR')
        self.assertEqual(self.crear(date(2026, 4, 1), date(2026, 4, 5)).responsable_pago, 'EPS')
        self.assertEqual(self.crear(date(2026, 5, 1), date(2026, 5, 2), tipo='ACCIDENTE_LABORAL').responsable_pago, 'ARL')
        # una prorroga de 2 dias la paga la EPS: los 2 dias del empleador ya pasaron
        prorroga = self.crear(date(2026, 3, 4), date(2026, 3, 5), padre=corta)
        self.assertEqual(prorroga.responsable_pago, 'EPS')

    def test_alerta_de_180_dias_suma_las_prorrogas(self):
        inicio = date(2025, 6, 1)
        inicial = self.crear(inicio, inicio + timedelta(days=89))                       # 90 dias
        inicial.estado = 'CERRADA'
        inicial.save()
        self.crear(inicio + timedelta(days=90), inicio + timedelta(days=184), padre=inicial)   # 95 dias, activa
        self.crear(date(2026, 3, 2), date(2026, 3, 6))                                  # caso corto, no alerta

        r = self.client.get('/api/incapacidades/alertas/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['mas_de_180_dias']), 1)
        self.assertEqual(r.data['mas_de_180_dias'][0]['dias'], 185)


class ListadoTests(BaseIncapacidades):

    def test_editar_desde_el_listado_no_borra_datos(self):
        """
        El frontend abre "Editar" con la fila del listado y al guardar envia
        todos los campos del formulario. El listado no traia diagnostico,
        observaciones, entidad ni la incapacidad que se prorroga, asi que
        cualquier edicion los dejaba vacios.
        """
        eps = Entidad.objects.get(tipo='EPS')
        inicial = self.crear(date(2026, 3, 2), date(2026, 3, 4))
        prorroga = Incapacidad.objects.create(
            colaborador=self.colaborador, usuario_registro=self.th, tipo='ENFERMEDAD_GENERAL',
            fecha_inicio=date(2026, 3, 5), fecha_fin=date(2026, 3, 9), incapacidad_padre=inicial,
            entidad_emisora=eps, diagnostico='J06.9 Infeccion respiratoria', observaciones='Reposo en casa',
        )
        fila = next(f for f in self.client.get('/api/incapacidades/').data if f['id_incapacidad'] == prorroga.pk)

        # lo mismo que arma FormIncapacidad.jsx a partir de la fila, cambiando solo la fecha de fin
        payload = {
            'colaborador': fila.get('colaborador'), 'entidad_emisora': fila.get('entidad_emisora') or None,
            'incapacidad_padre': fila.get('incapacidad_padre') or None, 'tipo': fila['tipo'],
            'fecha_inicio': fila['fecha_inicio'], 'fecha_fin': '2026-03-10',
            'diagnostico': fila.get('diagnostico') or '', 'observaciones': fila.get('observaciones') or '',
        }
        if payload['colaborador'] is None:      # en JavaScript seria undefined: no viaja en el JSON
            del payload['colaborador']
        r = self.client.patch(f'/api/incapacidades/{prorroga.pk}/', payload, format='json')
        self.assertEqual(r.status_code, 200, r.data)

        prorroga.refresh_from_db()
        self.assertEqual(prorroga.diagnostico, 'J06.9 Infeccion respiratoria')
        self.assertEqual(prorroga.observaciones, 'Reposo en casa')
        self.assertEqual(prorroga.entidad_emisora, eps)
        self.assertEqual(prorroga.incapacidad_padre, inicial)       # sigue siendo prorroga
        self.assertEqual(prorroga.dias, 6)

    def test_el_listado_indica_si_hay_documento(self):
        inc = self.crear(date(2026, 3, 2), date(2026, 3, 4))
        self.assertIsNone(self.client.get('/api/incapacidades/').data[0]['documento_url'])
        self.subir(inc)
        self.assertTrue(self.client.get('/api/incapacidades/').data[0]['documento_url'])


class FiltrosTests(BaseIncapacidades):

    def test_un_filtro_mal_escrito_responde_400_y_no_500(self):
        for url in (
            '/api/incapacidades/?colaborador=abc',
            '/api/incapacidades/?fecha_inicio_desde=31-02-2026',
            '/api/incapacidades/reporte/?colaborador=abc',
            '/api/colaboradores/?punto_venta=abc',
            '/api/vacaciones/?colaborador=abc',
            '/api/contratos/?colaborador=abc',
        ):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 400, url)
            self.assertIn('error', r.data)
        self.assertEqual(self.client.get('/api/incapacidades/?colaborador=%d' % self.colaborador.pk).status_code, 200)
