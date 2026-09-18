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
} from 'lucide-react';
import { Module, QuizQuestion } from '../types';
import { api } from '../lib/api';
import { setModuleQuiz, getModuleQuestions } from '../plugins/QuizzesPlugin';

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
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2d2d44] bg-[#0f0f18]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded-xl text-[#06b6d4]">
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
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1a2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-[#2d2d44] bg-[#1a1a2e]/50 flex flex-wrap items-center justify-between gap-3">
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
              className="px-3.5 py-2 bg-[#232338] hover:bg-[#2d2d44] border border-[#3b3b5c] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#06b6d4]" />
              <span>Añadir Pregunta</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 bg-[#0f0f18] px-3 py-1.5 rounded-lg border border-[#2d2d44]">
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#06b6d4]" />
              <p className="text-xs">Cargando datos de evaluación...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-[#2d2d44] rounded-2xl space-y-3">
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
                  className="px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-[#2d2d44]"
                >
                  <Plus className="w-4 h-4 text-[#06b6d4]" />
                  <span>Crear Manualmente</span>
                </button>
              </div>
            </div>
          ) : (
            questions.map((q, qIdx) => (
              <div
                key={q.id || qIdx}
                className="bg-[#0f0f18] border border-[#2d2d44] rounded-xl p-4 space-y-4 hover:border-[#3b3b5c] transition-all"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between gap-2 border-b border-[#232338] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/20 px-2 py-0.5 rounded-md">
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
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-[#1a1a2e]"
                      title="Mover arriba"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveQuestion(qIdx, 1)}
                      disabled={qIdx === questions.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-[#1a1a2e]"
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
                    className="w-full bg-[#141420] border border-[#2d2d44] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4]"
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
                              : 'bg-[#141420] border-[#2d2d44] text-slate-300 hover:border-[#3b3b5c]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-500 border-emerald-400 text-black'
                                : 'bg-[#1a1a2e] border-[#3b3b5c] text-slate-400'
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
                    className="w-full bg-[#141420] border border-[#2d2d44] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2d2d44] bg-[#0f0f18] flex items-center justify-between gap-3">
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
              className="px-4 py-2 bg-[#1a1a2e] hover:bg-[#2d2d44] text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
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