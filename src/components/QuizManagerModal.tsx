/**
 * Modal de Administración de Evaluaciones & Quizzes (`QuizManagerModal.tsx`)
 *
 * Permite a Administradores y Mentores:
 * 1. Generar cuestionarios automáticos con Inteligencia Artificial basados en el contenido del módulo.
 * 2. Crear, editar y eliminar preguntas interactivas manualmente con 4 opciones de respuesta y retroalimentación.
 * 3. Persistir los cuestionarios en backend y sincronizar el estado del plugin interactivo.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  CheckSquare,
  ChevronUp,
  ChevronDown,
  Loader2,
  BookOpen,
  Award,
  Wand2,
} from 'lucide-react';
import { Module, QuizQuestion } from '../types';
import { api } from '../lib/api';
import { setModuleQuiz, getModuleQuestions } from '../plugins/QuizzesPlugin';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

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
  useBodyScrollLock(isOpen);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setSuccessMessage(`✨ Se corrigieron automáticamente ${count} ${count === 1 ? 'respuesta' : 'respuestas'} para que coincidan con su justificación pedagógica.`);
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
        setSuccessMessage('✨ ¡Examen generado automáticamente con IA! Revisa las preguntas y guarda los cambios.');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo generar el examen con IA.');
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
        setError(`La pregunta #${i + 1} debe tener al menos 2 opciones de respuesta rellenas.`);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const res = await api.saveModuleQuiz(module.id, validQuestions);
      setModuleQuiz(module.id, res.questions || validQuestions);
      setSuccessMessage('✅ ¡Evaluación guardada exitosamente!');
      if (onSaved) {
        onSaved(res.questions || validQuestions);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la evaluación.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('¿Estás seguro de eliminar todas las preguntas de este examen?')) return;
    try {
      setSaving(true);
      await api.deleteModuleQuiz(module.id);
      setModuleQuiz(module.id, []);
      setQuestions([]);
      setSuccessMessage('Evaluación eliminada del módulo.');
      if (onSaved) onSaved([]);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="app-dialog bg-surface border border-line rounded-2xl w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] flex flex-col shadow-2xl overflow-hidden overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-[#0f0f18]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-cyan/10 border border-brand-cyan/30 rounded-xl text-brand-cyan">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Gestión de Examen: {module.title}
              </h2>
              <p className="text-xs text-slate-400">
                Configura preguntas interactivas y retroalimentación para la evaluación del módulo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-raised transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-line bg-raised/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateWithAi}
              disabled={generatingAi || saving}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {generatingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              <span>{generatingAi ? 'Generando con IA...' : '✨ Generar Examen con IA'}</span>
            </button>

            <button
              type="button"
              onClick={handleAddQuestion}
              disabled={generatingAi || saving}
              className="px-3.5 py-2 bg-[#232338] hover:bg-line border border-[#3b3b5c] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-brand-cyan" />
              <span>Añadir Pregunta</span>
            </button>

            {mismatches.length > 0 && (
              <button
                type="button"
                onClick={handleReconcileAllMismatches}
                disabled={generatingAi || saving}
                className="px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm animate-pulse"
                title="Alinear las respuestas marcadas con su justificación pedagógica"
              >
                <Wand2 className="w-4 h-4 text-amber-400" />
                <span>Auto-conciliar ({mismatches.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 bg-[#0f0f18] px-3 py-1.5 rounded-lg border border-line">
              {questions.length} {questions.length === 1 ? 'pregunta configurada' : 'preguntas configuradas'}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-cyan" />
              <p className="text-xs">Cargando datos de evaluación...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-line rounded-2xl space-y-3">
              <BookOpen className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-white">Este módulo aún no tiene examen configurado</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Puedes generar un examen completo con Inteligencia Artificial en segundos o crear preguntas personalizadas manualmente.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateWithAi}
                  disabled={generatingAi}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Generar con IA</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-4 py-2 bg-raised border border-line text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-line"
                >
                  <Plus className="w-4 h-4 text-brand-cyan" />
                  <span>Crear Manualmente</span>
                </button>
              </div>
            </div>
          ) : (
            questions.map((q, qIdx) => (
              <div
                key={q.id || qIdx}
                className="bg-[#0f0f18] border border-line rounded-xl p-4 space-y-4 hover:border-[#3b3b5c] transition-all"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between gap-2 border-b border-[#232338] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-2 py-0.5 rounded-md">
                      Pregunta #{qIdx + 1}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Selecciona la opción correcta con el botón circular
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveQuestion(qIdx, -1)}
                      disabled={qIdx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-raised"
                      title="Mover arriba"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveQuestion(qIdx, 1)}
                      disabled={qIdx === questions.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-raised"
                      title="Mover abajo"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(qIdx)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded ml-2"
                      title="Eliminar pregunta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Enunciado */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Enunciado de la Pregunta</label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                    placeholder="Ej: ¿Cuál es el concepto central de esta lección?"
                    className="w-full bg-surface border border-line rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-cyan"
                  />
                </div>

                {/* 4 Opciones */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300">Opciones de Respuesta</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctIndex === optIdx;
                      return (
                        <div
                          key={optIdx}
                          onClick={() => handleSetCorrectIndex(qIdx, optIdx)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isCorrect
                              ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                              : 'bg-surface border-line text-slate-300 hover:border-[#3b3b5c]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-500 border-emerald-400 text-black'
                                : 'bg-raised border-[#3b3b5c] text-slate-400'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <input
                            type="text"
                            value={opt}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                            placeholder={`Opción ${String.fromCharCode(65 + optIdx)}`}
                            className="flex-1 bg-transparent border-none text-xs text-white placeholder-slate-600 focus:outline-none"
                          />
                          {isCorrect && (
                            <span className="text-[10px] uppercase font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                              Correcta
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alerta de inconsistencia si la justificación describe otra opción */}
                {(() => {
                  const mismatchIdx = detectQuestionMismatch(q);
                  if (mismatchIdx === null) return null;
                  return (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs text-amber-300">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          La justificación pedagógica parece describir la{' '}
                          <strong className="underline underline-offset-2">Opción {String.fromCharCode(65 + mismatchIdx)}</strong>{' '}
                          (<em>&ldquo;{q.options[mismatchIdx]?.slice(0, 45)}...&rdquo;</em>) en lugar de la {String.fromCharCode(65 + q.correctIndex)}.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSetCorrectIndex(qIdx, mismatchIdx)}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0"
                      >
                        Marcar Opción {String.fromCharCode(65 + mismatchIdx)} como correcta
                      </button>
                    </div>
                  );
                })()}

                {/* Explicación / Retroalimentación */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                    <span>Explicación / Justificación pedagógica (mostrada al calificar)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={q.explanation}
                    onChange={(e) => handleUpdateExplanation(qIdx, e.target.value)}
                    placeholder="Explica por qué la respuesta seleccionada es la correcta..."
                    className="w-full bg-surface border border-line rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-[#0f0f18] flex items-center justify-between gap-3">
          <div>
            {questions.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Eliminar todo
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-raised hover:bg-line text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveQuiz}
              disabled={saving || questions.length === 0}
              className="btn-brand-primary px-5 py-2 text-xs font-extrabold flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/10"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Guardando...' : 'Guardar Evaluación'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};