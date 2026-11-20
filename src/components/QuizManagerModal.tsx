/**
 * Modal de Administración de Evaluaciones & Quizzes (`QuizManagerModal.tsx`)
 *
 * Permite a Administradores y Mentores:
 * 1. Generar cuestionarios automáticos con Inteligencia Artificial basados en el contenido del módulo.
 * 2. Crear, editar y eliminar preguntas interactivas manualmente con 4 opciones de respuesta y retroalimentación.
 * 3. Persistir los cuestionarios en backend y sincronizar el estado del plugin interactivo.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Module, QuizQuestion } from '../types';
import { api } from '../lib/api';
import { setModuleQuiz, getModuleQuestions } from '../plugins/QuizzesPlugin';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useTranslation, Trans } from 'react-i18next'

function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'y', 'o', 'a', 'que', 'para', 'por', 'con', 'es', 'son',
  'al', 'se', 'su', 'sus', 'como', 'sobre', 'este', 'esta', 'estos', 'estas',
  'the', 'an', 'in', 'on', 'and', 'or', 'to', 'for', 'with', 'is', 'are',
]);

function computeScore(option: string, explanation: string): number {
  const normOpt = normalizeText(option);
  const normExp = normalizeText(explanation);
  if (!normOpt || !normExp) return 0;
  if (normOpt.length >= 10 && normExp.includes(normOpt)) return 1.0;
  const prefix25 = normOpt.slice(0, 25);
  if (prefix25.length >= 12 && normExp.includes(prefix25)) return 0.95;

  const words = normOpt.split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length === 0) return 0;

  let matches = 0;
  for (const w of words) {
    if (normExp.includes(w)) matches++;
  }
  const ratio = matches / words.length;

  let bigramBonus = 0;
  if (words.length >= 2) {
    let bigramMatches = 0;
    for (let i = 0; i < words.length - 1; i++) {
      if (normExp.includes(`${words[i]} ${words[i + 1]}`)) bigramMatches++;
    }
    bigramBonus = (bigramMatches / (words.length - 1)) * 0.3;
  }
  return Math.min(1.0, ratio * 0.7 + bigramBonus);
}

function detectQuestionMismatch(q: QuizQuestion): number | null {
  const options = q.options || [];
  if (options.length < 2 || !q.explanation || !q.explanation.trim()) return null;
  const currentIdx = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < options.length ? q.correctIndex : 0;
  const scores = options.map((opt) => computeScore(opt, q.explanation));
  const currentScore = scores[currentIdx] ?? 0;

  let bestIdx = currentIdx;
  let bestScore = currentScore;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIdx = i;
    }
  }

  if (bestIdx !== currentIdx && bestScore >= 0.6 && (bestScore - currentScore) >= 0.35) {
    return bestIdx;
  }
  return null;
}

interface QuizManagerModalProps {
  module: Module;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (questions: QuizQuestion[]) => void;
}

export const QuizManagerModal: React.FC<QuizManagerModalProps> = ({
  module,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation()
  useBodyScrollLock(isOpen);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [confirmAll, setConfirmAll] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (isOpen && d && !d.open) d.showModal();
  }, [isOpen]);
  useEffect(() => {
    const d = confirmRef.current;
    if (!d) return;
    if (confirmAll && !d.open) d.showModal();
    if (!confirmAll && d.open) d.close();
  }, [confirmAll]);

  const mismatches = questions
    .map((q, idx) => ({ qIdx: idx, targetIdx: detectQuestionMismatch(q) }))
    .filter((m): m is { qIdx: number; targetIdx: number } => m.targetIdx !== null);

  const handleReconcileAllMismatches = () => {
    const updated = [...questions];
    let count = 0;
    for (let i = 0; i < updated.length; i++) {
      const target = detectQuestionMismatch(updated[i]);
      if (target !== null) {
        updated[i] = { ...updated[i], correctIndex: target };
        count++;
      }
    }
    setQuestions(updated);
    setSuccessMessage(t('seCorrigieronCountRespuestasParaQue', { defaultValue_one: 'Se corrigieron {{count}} respuesta para que coincidan con su explicación.', defaultValue_other: 'Se corrigieron {{count}} respuestas para que coincidan con su explicación.', count: count }));
  };

  useEffect(() => {
    if (!isOpen) return;
    loadQuizData();
  }, [isOpen, module.id]);

  const loadQuizData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getModuleQuiz(module.id);
      if (res.success && res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
        setModuleQuiz(module.id, res.questions);
      } else {
        const local = getModuleQuestions(module.id);
        setQuestions(local || []);
      }
    } catch (err: any) {
      const local = getModuleQuestions(module.id);
      setQuestions(local || []);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    const newQ: QuizQuestion = {
      id: `q_manual_${Date.now()}_${questions.length + 1}`,
      text: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: '',
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQuestionText = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].text = text;
    setQuestions(updated);
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...questions];
    const opts = [...updated[qIndex].options];
    opts[optIndex] = val;
    updated[qIndex].options = opts;
    setQuestions(updated);
  };

  const handleSetCorrectIndex = (qIndex: number, correctIndex: number) => {
    const updated = [...questions];
    updated[qIndex].correctIndex = correctIndex;
    setQuestions(updated);
  };

  const handleUpdateExplanation = (qIndex: number, exp: string) => {
    const updated = [...questions];
    updated[qIndex].explanation = exp;
    setQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const handleMoveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    setQuestions(updated);
  };

  const handleGenerateWithAi = async () => {
    try {
      setGeneratingAi(true);
      setError(null);
      setSuccessMessage(null);
      const res = await api.generateModuleQuiz(module.id, 4);
      if (res.success && res.questions) {
        setQuestions(res.questions);
        setSuccessMessage(t('examenGeneradoConIaRevisaLasPreguntasY', 'Examen generado con IA. Revisa las preguntas y guarda los cambios.'));
      }
    } catch (err: any) {
      setError(err.message || t('noSePudoGenerarElExamenConIa', 'No se pudo generar el examen con IA.'));
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSaveQuiz = async () => {
    const validQuestions = questions.filter((q) => q.text.trim().length > 0);
    for (let i = 0; i < validQuestions.length; i++) {
      const q = validQuestions[i];
      const filledOptions = q.options.filter((o) => o.trim().length > 0);
      if (filledOptions.length < 2) {
        setError(t('laPreguntaIDebeTenerAlMenos2OpcionesDe', 'La pregunta #{{i}} debe tener al menos 2 opciones de respuesta rellenas.', { i: i + 1 }));
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const res = await api.saveModuleQuiz(module.id, validQuestions);
      setModuleQuiz(module.id, res.questions || validQuestions);
      setSuccessMessage('Evaluación guardada');
      if (onSaved) {
        onSaved(res.questions || validQuestions);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || t('errorAlGuardarLaEvaluacion', 'Error al guardar la evaluación.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setSaving(true);
      await api.deleteModuleQuiz(module.id);
      setModuleQuiz(module.id, []);
      setQuestions([]);
      setSuccessMessage(t('evaluacionEliminadaDelModulo', 'Evaluación eliminada del módulo.'));
      if (onSaved) onSaved([]);
    } catch (err: any) {
      setError(err.message || t('errorAlEliminar2', 'Error al eliminar'));
    } finally {
      setSaving(false);
      setConfirmAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="mentee-sheet mentee-sheet--wide"
      aria-labelledby="quiz-editor-title"
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="mentee-sheet__body mentee-sheet__body--tools">
        <header className="mentee-sheet__head mentee-sheet__head--plain">
          <div className="mentor-mentee-id">
            <strong id="quiz-editor-title">{t('examenDelModulo', 'Examen del módulo')}</strong>
            <span>{module.title}</span>
          </div>
          <button type="button" className="mentee-sheet__close" onClick={onClose} disabled={saving} aria-label={t('cerrar', 'Cerrar')}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="quiz-tools">
          <div className="quiz-tools__actions">
            <button type="button" className="mentor-course-control" onClick={handleGenerateWithAi} disabled={generatingAi || saving}>
              {generatingAi ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
              {generatingAi ? t('generandoExamen', 'Generando examen') : t('generarConIa', 'Generar con IA')}
            </button>
            <button type="button" className="mentor-course-control" onClick={handleAddQuestion} disabled={generatingAi || saving}>
              <Plus aria-hidden="true" />
              {t('anadirPregunta', 'Añadir pregunta')}
            </button>
            {mismatches.length > 0 && (
              <button
                type="button"
                className="mentor-course-control"
                onClick={handleReconcileAllMismatches}
                disabled={generatingAi || saving}
                title={t('alinearLasRespuestasMarcadasConSu', 'Alinear las respuestas marcadas con su explicación')}
              >
                {t('corregirRespuestasLength', 'Corregir respuestas ({{length}})', { length: mismatches.length })}
              </button>
            )}
          </div>
          <span className="quiz-tools__count">
            {questions.length} {questions.length === 1 ? t('pregunta', 'pregunta') : t('preguntas', 'preguntas')}
          </span>
        </div>

        <div className="mentee-sheet__list quiz-editor">
          {error && (
            <p className="mentee-sheet__error" role="alert">
              <AlertCircle aria-hidden="true" /> <span>{error}</span>
            </p>
          )}
          {successMessage && (
            <p className="mentee-sheet__error quiz-notice" role="status">
              <CheckCircle2 aria-hidden="true" /> <span>{successMessage}</span>
            </p>
          )}

          {loading ? (
            <p className="mentee-sheet__empty" role="status">
              <Loader2 aria-hidden="true" className="animate-spin" /> {t('cargandoExamen', 'Cargando examen')}
            </p>
          ) : questions.length === 0 ? (
            <div className="quiz-empty">
              <h3>{t('esteModuloAunNoTieneExamen', 'Este módulo aún no tiene examen')}</h3>
              <p>{t('generaUnaPropuestaAPartirDelTemarioO', 'Genera una propuesta a partir del temario o escribe las preguntas tú mismo.')}</p>
              <div>
                <button type="button" className="mentor-course-control mentor-course-import" onClick={handleGenerateWithAi} disabled={generatingAi}>
                  {generatingAi ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
                  {t('generarConIa', 'Generar con IA')}
                </button>
                <button type="button" className="mentor-course-control" onClick={handleAddQuestion}>
                  <Plus aria-hidden="true" />
                  {t('crearManualmente', 'Crear manualmente')}
                </button>
              </div>
            </div>
          ) : (
            questions.map((q, qIdx) => {
              const mismatchIdx = detectQuestionMismatch(q);
              return (
                <section key={q.id || qIdx} className="quiz-question" aria-label={t('preguntaQIdx', 'Pregunta {{qIdx}}', { qIdx: qIdx + 1 })}>
                  <header className="quiz-question__head">
                    <strong>{t('pregunta2', 'Pregunta')} {qIdx + 1}</strong>
                    <div className="quiz-question__actions">
                      <button type="button" onClick={() => handleMoveQuestion(qIdx, -1)} disabled={qIdx === 0} aria-label={t('subirPregunta', 'Subir pregunta')} title={t('subir', 'Subir')}>
                        <ChevronUp aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => handleMoveQuestion(qIdx, 1)} disabled={qIdx === questions.length - 1} aria-label={t('bajarPregunta', 'Bajar pregunta')} title={t('bajar', 'Bajar')}>
                        <ChevronDown aria-hidden="true" />
                      </button>
                      <button type="button" data-danger="true" onClick={() => handleDeleteQuestion(qIdx)} aria-label={t('eliminarPregunta', 'Eliminar pregunta')} title={t('eliminarPregunta', 'Eliminar pregunta')}>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </header>

                  <label className="meeting-field">
                    <span>{t('enunciado', 'Enunciado')}</span>
                    <textarea
                      rows={2}
                      value={q.text}
                      onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                      placeholder={t('ejCualEsElConceptoCentralDeEstaLeccion', 'Ej: ¿Cuál es el concepto central de esta lección?')}
                    />
                  </label>

                  <fieldset className="quiz-field">
                    <legend><Trans i18nKey="respuestasMarcaLaCorrecta">Respuestas <em>(marca la correcta)</em></Trans></legend>
                    <div className="quiz-options" role="radiogroup" aria-label={t('respuestasDeLaPreguntaQIdx', 'Respuestas de la pregunta {{qIdx}}', { qIdx: qIdx + 1 })}>
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correctIndex === optIdx;
                        return (
                          <label key={optIdx} className="quiz-option" data-correct={isCorrect || undefined}>
                            <input
                              type="radio"
                              name={`correct-${q.id || qIdx}`}
                              checked={isCorrect}
                              onChange={() => handleSetCorrectIndex(qIdx, optIdx)}
                              aria-label={t('marcarLaOpcionValComoCorrecta', 'Marcar la opción {{val}} como correcta', { val: String.fromCharCode(65 + optIdx) })}
                            />
                            <span className="quiz-option__letter" aria-hidden="true">{String.fromCharCode(65 + optIdx)}</span>
                            <textarea
                              rows={1}
                              value={opt}
                              onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                              placeholder={t('opcionVal', 'Opción {{val}}', { val: String.fromCharCode(65 + optIdx) })}
                              aria-label={t('textoDeLaOpcionVal', 'Texto de la opción {{val}}', { val: String.fromCharCode(65 + optIdx) })}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {mismatchIdx !== null && (
                    <div className="quiz-mismatch" role="note">
                      <p>
                        {t('laExplicacionPareceDescribirLa', 'La explicación parece describir la')} <strong>{t('opcion', 'opción')} {String.fromCharCode(65 + mismatchIdx)}</strong> {t('yNoLa', 'y no la')} {String.fromCharCode(65 + q.correctIndex)}{t('queEsLaMarcada', ', que es la marcada.')}
                      </p>
                      <button type="button" className="mentor-course-control" onClick={() => handleSetCorrectIndex(qIdx, mismatchIdx)}>
                        {t('marcarLaOpcion', 'Marcar la opción')} {String.fromCharCode(65 + mismatchIdx)}
                      </button>
                    </div>
                  )}

                  <label className="meeting-field">
                    <span><Trans i18nKey="explicacionSeMuestraAlCalificar">Explicación <em>(se muestra al calificar)</em></Trans></span>
                    <textarea
                      rows={2}
                      value={q.explanation}
                      onChange={(e) => handleUpdateExplanation(qIdx, e.target.value)}
                      placeholder={t('explicaPorQueEsaRespuestaEsLaCorrecta', 'Explica por qué esa respuesta es la correcta')}
                    />
                  </label>
                </section>
              );
            })
          )}
        </div>

        <footer className="mentee-sheet__foot mentee-sheet__foot--actions quiz-foot">
          <div>
            {questions.length > 0 && (
              <button type="button" className="mentor-course-control quiz-foot__danger" data-danger="true" onClick={() => setConfirmAll(true)} disabled={saving}>
                <Trash2 aria-hidden="true" />
                {t('eliminarTodo', 'Eliminar todo')}
              </button>
            )}
            <button type="button" className="mentor-course-control" onClick={onClose} disabled={saving}>
              {t('cancelar', 'Cancelar')}
            </button>
            <button type="button" className="mentor-course-control mentor-course-import" onClick={handleSaveQuiz} disabled={saving || questions.length === 0}>
              {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
              {saving ? t('guardando2', 'Guardando') : t('guardarEvaluacion', 'Guardar evaluación')}
            </button>
          </div>
        </footer>

        <dialog
          ref={confirmRef}
          className="mentor-confirm"
          aria-labelledby="quiz-delete-title"
          onCancel={(e) => { e.preventDefault(); setConfirmAll(false); }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmAll(false); }}
        >
          {confirmAll && (
            <div className="mentor-confirm__body">
              <h3 id="quiz-delete-title">{t('eliminarElExamen', 'Eliminar el examen')}</h3>
              <p>{t('seBorraranLasLengthPreguntasDe', 'Se borrarán las {{length}} preguntas de', { length: questions.length })} <strong>{module.title}</strong><Trans i18nKey="estaAccionEsPermanente">. Esta acción es <strong className="mentor-confirm__permanent">permanente</strong>.</Trans></p>
              <div className="mentor-confirm__actions">
                <button type="button" className="mentor-course-control" onClick={() => setConfirmAll(false)}>{t('cancelar', 'Cancelar')}</button>
                <button type="button" className="mentor-course-control" data-danger="true" onClick={handleDeleteAll}>
                  <Trash2 aria-hidden="true" />
                  {t('eliminar', 'Eliminar')}
                </button>
              </div>
            </div>
          )}
        </dialog>
      </div>
    </dialog>
  );
};
