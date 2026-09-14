"""
AUSENTRACK - Modelo de Evaluaciones de Desempeño
"""
import uuid
from django.db import models

# Criterios estandar que se evaluan siempre (puntaje 1 a 5 cada uno).
# Se guardan en la evaluacion como JSON: [{"criterio": "...", "puntaje": 4}, ...]
CRITERIOS_ESTANDAR = [
    'Calidad del trabajo',
    'Trabajo en equipo',
    'Puntualidad y asistencia',
    'Actitud de servicio',
    'Cumplimiento de metas',
]


class EvaluacionDesempeno(models.Model):

    TIPO_CHOICES = [
        ('PERIODO_PRUEBA',  'Periodo de Prueba'),
        ('JEFE_DIRECTO',    'Evaluación de Jefe Directo'),
        ('AUTOEVALUACION',  'Autoevaluación'),
        ('DESEMPENO_360',   'Evaluación 360°'),
    ]

    ESTADO_CHOICES = [
        ('BORRADOR',            'Borrador'),
        ('COMPLETADA',          'Completada'),
        ('ENTREGADA_COLABORADOR', 'Entregada al colaborador'),
    ]

    colaborador = models.ForeignKey(
        'colaboradores.Colaborador', on_delete=models.CASCADE,
        related_name='evaluaciones', db_column='id_colaborador',
    )
    periodo         = models.CharField(max_length=30, help_text='Ej: 2026-S1, Q3 2026')
    tipo_evaluacion = models.CharField(max_length=20, choices=TIPO_CHOICES, default='JEFE_DIRECTO')
    fecha_evaluacion = models.DateField()
    evaluador       = models.CharField(max_length=150)

    # Lista de {"criterio": str, "puntaje": int(1-5)}
    criterios       = models.JSONField(default=list)
    puntaje_final   = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    fortalezas      = models.TextField(blank=True, default='')
    areas_mejora    = models.TextField(blank=True, default='')
    plan_accion     = models.TextField(blank=True, default='')

    estado          = models.CharField(max_length=25, choices=ESTADO_CHOICES, default='BORRADOR', db_index=True)
    responsable_hr  = models.CharField(max_length=150)

    # Si no es None, existe un link publico (sin login) por el que el
    # colaborador o evaluador externo puede completar esta evaluacion.
    # Se invalida (vuelve a None) automaticamente al recibir la respuesta,
    # para que el link no se pueda volver a usar.
    token_publico   = models.UUIDField(default=None, null=True, blank=True, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table     = 'evaluacion_desempeno'
        verbose_name = 'Evaluación de Desempeño'
        ordering     = ['-fecha_evaluacion']
        indexes = [
            models.Index(fields=['periodo']),
            models.Index(fields=['estado']),
        ]

    def __str__(self):
        return f'{self.colaborador.nombre} - {self.periodo} ({self.puntaje_final or "sin calificar"})'

    def calcular_puntaje_final(self):
        """Promedio simple de los puntajes de los criterios (1 a 5)."""
        if not self.criterios:
            return None
        puntajes = [c.get('puntaje') for c in self.criterios if isinstance(c.get('puntaje'), (int, float))]
        if not puntajes:
            return None
        return round(sum(puntajes) / len(puntajes), 2)

    def save(self, *args, **kwargs):
        self.puntaje_final = self.calcular_puntaje_final()
        super().save(*args, **kwargs)
