/**
 * LandingPageEditor.tsx - Editor CMS de Portada de DocentOS
 * Permite al Administrador personalizar completamente la Landing Page pública:
 * - Hero, Cursos Destacados, Beneficios, Testimonios, Banner de Anuncios y Footer.
 */

import React, { useState, useEffect } from 'react';
import {
  Layout,
  Sparkles,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  Search,
  Star,
  Megaphone,
  Globe,
  Layers,
  Brain,
  Video,
  ShieldCheck,
  Award,
  Link2,
  Sliders,
  HelpCircle,
  RefreshCw,
  Image as ImageIcon,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { LandingConfig, LandingBenefit, LandingTestimonial, Course } from '../types';

interface LandingPageEditorProps {
  onSaved?: () => void;
}

export const LandingPageEditor: React.FC<LandingPageEditorProps> = ({ onSaved }) => {
  const [activeTab, setActiveTab] = useState<'hero' | 'courses' | 'benefits' | 'testimonials' | 'footer'>('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Course selector state
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [courseSearch, setCourseSearch] = useState('');

  // Form State
  const [config, setConfig] = useState<LandingConfig>({
    heroTitle: 'El Motor de Aprendizaje Abierto con IA Nativa & Mentoría',
    heroSubtitle: 'DocentOS es la alternativa moderna, liviana y modular de código abierto frente a plataformas LMS tradicionales monolíticas como Moodle u Odoo LMS.',
    heroMediaUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
    heroCtaText: 'Explorar Cursos',
    heroCtaLink: '#courses',
    heroSecondaryCtaText: 'Pase VIP',
    heroSecondaryCtaLink: '#vip',
    featuredCourseIds: ['course-giantucchi-mastery'],
    bannerEnabled: true,
    bannerText: '🚀 ¡Novedad en DocentOS v2.5! Motor de IA optimizado, gestión de guías vocales e integración con Drive.',
    bannerLinkText: 'Ver Novedades',
    bannerLinkUrl: '#',
    benefits: [],
    testimonials: [],
    footerText: 'Created and maintained by Giantucchi (Jose Luis Hernandez Hernandez)',
    githubUrl: 'https://github.com/giantucchi/docentos',
    discordUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
  });

  const [showLivePreview, setShowLivePreview] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, coursesRes] = await Promise.all([
        api.getLandingConfig(),
        api.getCourses(),
      ]);

      if (configRes.config) {
        setConfig(configRes.config);
      }
      if (coursesRes.courses) {
        setAvailableCourses(coursesRes.courses);
      }
    } catch (err: any) {
      console.error('Error loading landing config or courses:', err);
      setErrorMsg('No se pudo cargar la configuración de la portada.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await api.updateLandingConfig(config);
      if (res.success) {
        setSuccessMsg('¡Configuración de la portada guardada con éxito!');
        if (onSaved) onSaved();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      console.error('Error saving landing config:', err);
      setErrorMsg(err.message || 'Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  // Featured Courses Helpers
  const toggleFeaturedCourse = (courseId: string) => {
    const current = [...config.featuredCourseIds];
    const index = current.indexOf(courseId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(courseId);
    }
    setConfig({ ...config, featuredCourseIds: current });
  };

  // Benefits Handlers
  const addBenefit = () => {
    const newB: LandingBenefit = {
      id: `b-${Date.now()}`,
      icon: 'Brain',
      title: 'Nuevo Beneficio',
      description: 'Escribe aquí la descripción detallada del beneficio.',
    };
    setConfig({ ...config, benefits: [...config.benefits, newB] });
  };

  const updateBenefit = (id: string, field: keyof LandingBenefit, val: string) => {
    const updated = config.benefits.map((b) => (b.id === id ? { ...b, [field]: val } : b));
    setConfig({ ...config, benefits: updated });
  };

  const deleteBenefit = (id: string) => {
    setConfig({ ...config, benefits: config.benefits.filter((b) => b.id !== id) });
  };

  // Testimonials Handlers
  const addTestimonial = () => {
    const newT: LandingTestimonial = {
      id: `t-${Date.now()}`,
      name: 'Estudiante / Graduado',
      role: 'Desarrollador Software',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      comment: 'DocentOS transformó mi proceso de aprendizaje con clases interactiva y mentoría técnica.',
      rating: 5,
    };
    setConfig({ ...config, testimonials: [...config.testimonials, newT] });
  };

  const updateTestimonial = (id: string, field: keyof LandingTestimonial, val: any) => {
    const updated = config.testimonials.map((t) => (t.id === id ? { ...t, [field]: val } : t));
    setConfig({ ...config, testimonials: updated });
  };

  const deleteTestimonial = (id: string) => {
    setConfig({ ...config, testimonials: config.testimonials.filter((t) => t.id !== id) });
  };

  if (loading) {
    return (
      <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-8 text-center text-slate-400 flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-[#06b6d4]" />
        <span>Cargando CMS Gestor de Portada...</span>
      </div>
    );
  }

  const filteredCourses = availableCourses.filter(
    (c) =>
      c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.category.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* CMS Header */}
      <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs font-bold mb-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>CMS Gestor de Bloques & Portada</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Personalización de Landing Page
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Edita títulos, hero visual, cursos destacados, testimonios y secciones públicas del LMS.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
              showLivePreview
                ? 'bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4]'
                : 'bg-[#1a1a2e] border-[#2d2d44] text-slate-300 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            {showLivePreview ? 'Ocultar Previsualización' : 'Vista Previa Rápida'}
          </button>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Guardar Cambios</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-[#06b6d4]/10 border border-[#06b6d4]/40 text-[#06b6d4] text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in shadow-md">
          <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in shadow-md">
          <HelpCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Preview Card */}
      {showLivePreview && (
        <div className="bg-[#0a0a0f] border-2 border-[#06b6d4]/50 rounded-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
            <span className="text-xs font-extrabold text-[#06b6d4] uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-4 h-4" /> Previsualización en Tiempo Real de la Portada
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Modo Live Preview</span>
          </div>

          {/* Banner Promo Preview */}
          {config.bannerEnabled && (
            <div className="bg-gradient-to-r from-[#06b6d4]/20 via-[#a855f7]/20 to-[#06b6d4]/20 border border-[#06b6d4]/30 rounded-xl p-3 text-center text-xs text-white font-semibold flex items-center justify-center gap-2">
              <Megaphone className="w-4 h-4 text-[#06b6d4]" />
              <span>{config.bannerText}</span>
              {config.bannerLinkText && (
                <span className="underline text-[#06b6d4] cursor-pointer font-bold ml-1">
                  {config.bannerLinkText} →
                </span>
              )}
            </div>
          )}

          {/* Hero Preview */}
          <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 text-center space-y-4">
            <h1 className="text-2xl font-black text-white">{config.heroTitle}</h1>
            <p className="text-xs text-slate-300 max-w-2xl mx-auto">{config.heroSubtitle}</p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="btn-brand-primary px-4 py-2 rounded-xl text-xs font-bold">
                {config.heroCtaText}
              </span>
              <span className="bg-[#1a1a2e] border border-[#2d2d44] px-4 py-2 rounded-xl text-xs font-bold text-slate-300">
                {config.heroSecondaryCtaText}
              </span>
            </div>

            {config.heroMediaUrl && (
              <div className="mt-4 max-w-xl mx-auto rounded-xl overflow-hidden border border-[#2d2d44] aspect-video bg-black">
                <img
                  src={config.heroMediaUrl}
                  alt="Hero Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex bg-[#0a0a0f] p-1.5 rounded-xl border border-[#2d2d44] gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('hero')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'hero' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Hero Section
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'courses' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" /> Cursos Destacados ({config.featuredCourseIds.length})
        </button>

        <button
          onClick={() => setActiveTab('benefits')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'benefits' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Brain className="w-4 h-4" /> Beneficios ({config.benefits.length})
        </button>

        <button
          onClick={() => setActiveTab('testimonials')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'testimonials' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Star className="w-4 h-4 text-[#eab308]" /> Testimonios ({config.testimonials.length})
        </button>

        <button
          onClick={() => setActiveTab('footer')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'footer' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" /> Anuncios & Footer
        </button>
      </div>

      {/* TAB 1: HERO SECTION EDITOR */}
      {activeTab === 'hero' && (
        <form onSubmit={handleSave} className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <div className="border-b border-[#2d2d44] pb-3">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#06b6d4]" />
              Edición de la Sección Principal (Hero Header)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Personaliza los textos de impacto principal, imágenes/video de cabecera y botones de llamada a la acción.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Título Principal de Portada
              </label>
              <input
                type="text"
                required
                value={config.heroTitle}
                onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Subtítulo / Descripción
              </label>
              <textarea
                rows={3}
                required
                value={config.heroSubtitle}
                onChange={(e) => setConfig({ ...config, heroSubtitle: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                URL de Imagen / Banner de Portada
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ImageIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={config.heroMediaUrl}
                    onChange={(e) => setConfig({ ...config, heroMediaUrl: e.target.value })}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Texto Botón CTA Principal
                </label>
                <input
                  type="text"
                  value={config.heroCtaText}
                  onChange={(e) => setConfig({ ...config, heroCtaText: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Enlace Botón CTA Principal
                </label>
                <input
                  type="text"
                  value={config.heroCtaLink}
                  onChange={(e) => setConfig({ ...config, heroCtaLink: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Texto Botón Secundario
                </label>
                <input
                  type="text"
                  value={config.heroSecondaryCtaText}
                  onChange={(e) => setConfig({ ...config, heroSecondaryCtaText: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Enlace Botón Secundario
                </label>
                <input
                  type="text"
                  value={config.heroSecondaryCtaLink}
                  onChange={(e) => setConfig({ ...config, heroSecondaryCtaLink: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[#2d2d44]">
            <button
              type="submit"
              disabled={saving}
              className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20"
            >
              <Save className="w-4 h-4" /> Guardar Sección Hero
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: FEATURED COURSES SELECTOR */}
      {activeTab === 'courses' && (
        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2d2d44] pb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-[#06b6d4]" />
                Selector de Cursos Destacados en Portada
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Marca cuáles de los cursos creados por mentores deseas destacar en el catálogo público de la portada.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar cursos..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((c) => {
              const isSelected = config.featuredCourseIds.includes(c.id);

              return (
                <div
                  key={c.id}
                  onClick={() => toggleFeaturedCourse(c.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#06b6d4]/10 border-[#06b6d4] shadow-lg shadow-[#06b6d4]/10'
                      : 'bg-[#1a1a2e] border-[#2d2d44] hover:border-slate-500'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-[#2d2d44]">
                      <img src={c.coverImage} alt={c.title} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-[#06b6d4] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3 h-3" /> Destacado
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-[#06b6d4] font-bold uppercase tracking-wider">{c.category}</span>
                      <h4 className="text-xs font-bold text-white line-clamp-2 mt-0.5">{c.title}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{c.description}</p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[#2d2d44] flex items-center justify-between text-xs">
                    <span className="font-extrabold text-[#a855f7]">${c.price.toFixed(2)} USD</span>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        isSelected
                          ? 'bg-[#06b6d4] text-white'
                          : 'bg-[#0a0a0f] border border-[#2d2d44] text-slate-300 hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Quitar de la Portada' : 'Destacar en Portada'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-[#2d2d44]">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20"
            >
              <Save className="w-4 h-4" /> Guardar Selección de Cursos
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: BENEFITS EDITOR */}
      {activeTab === 'benefits' && (
        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#2d2d44] pb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-[#06b6d4]" />
                Sección de Beneficios & Metodología
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Define las tarjetas de propuesta de valor e innovaciones técnicas.
              </p>
            </div>

            <button
              onClick={addBenefit}
              className="px-3.5 py-2 bg-[#06b6d4] hover:bg-[#06b6d4]/80 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" /> Agregar Beneficio
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.benefits.map((b) => (
              <div key={b.id} className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#06b6d4] uppercase font-mono">Icono:</span>
                    <select
                      value={b.icon}
                      onChange={(e) => updateBenefit(b.id, 'icon', e.target.value)}
                      className="bg-[#0a0a0f] border border-[#2d2d44] text-white text-xs rounded-lg px-2 py-1"
                    >
                      <option value="Brain">Brain (IA)</option>
                      <option value="Video">Video (Drive)</option>
                      <option value="ShieldCheck">ShieldCheck (Roles)</option>
                      <option value="Layers">Layers (Plugins)</option>
                      <option value="Award">Award (Certificados)</option>
                      <option value="Sparkles">Sparkles (Gamificación)</option>
                    </select>
                  </div>

                  <button
                    onClick={() => deleteBenefit(b.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-[#141420]"
                    title="Eliminar beneficio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Título del Beneficio</label>
                  <input
                    type="text"
                    value={b.title}
                    onChange={(e) => updateBenefit(b.id, 'title', e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    value={b.description}
                    onChange={(e) => updateBenefit(b.id, 'description', e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-[#2d2d44]">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20"
            >
              <Save className="w-4 h-4" /> Guardar Secciones de Beneficios
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: TESTIMONIALS EDITOR */}
      {activeTab === 'testimonials' && (
        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#2d2d44] pb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-[#eab308]" />
                Sección de Testimonios & Reseñas
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Agrega y gestiona reseñas de graduados, estudiantes VIP y mentores.
              </p>
            </div>

            <button
              onClick={addTestimonial}
              className="px-3.5 py-2 bg-[#a855f7] hover:bg-[#a855f7]/80 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" /> Agregar Testimonio
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.testimonials.map((t) => (
              <div key={t.id} className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={t.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={t.name}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-[#2d2d44]"
                    />
                    <span className="text-xs font-bold text-white">{t.name}</span>
                  </div>

                  <button
                    onClick={() => deleteTestimonial(t.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-[#141420]"
                    title="Eliminar testimonio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre</label>
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => updateTestimonial(t.id, 'name', e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cargo / Rol</label>
                    <input
                      type="text"
                      value={t.role}
                      onChange={(e) => updateTestimonial(t.id, 'role', e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL Avatar / Foto</label>
                  <input
                    type="url"
                    value={t.avatarUrl}
                    onChange={(e) => updateTestimonial(t.id, 'avatarUrl', e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comentario / Opinión</label>
                  <textarea
                    rows={2}
                    value={t.comment}
                    onChange={(e) => updateTestimonial(t.id, 'comment', e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Calificación (Estrellas: {t.rating})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={t.rating}
                    onChange={(e) => updateTestimonial(t.id, 'rating', parseInt(e.target.value))}
                    className="w-full accent-[#eab308] cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-[#2d2d44]">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20"
            >
              <Save className="w-4 h-4" /> Guardar Testimonios
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: BANNER PROMO & FOOTER */}
      {activeTab === 'footer' && (
        <form onSubmit={handleSave} className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <div className="border-b border-[#2d2d44] pb-3">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#06b6d4]" />
              Banner Promocional & Enlaces del Pie de Página
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configura el anuncio promocional superior y los enlaces institucionales/redes sociales.
            </p>
          </div>

          {/* Banner Toggle */}
          <div className="bg-[#0a0a0f] border border-[#2d2d44] p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#06b6d4]" />
                  Activar Banner de Anuncios Promocionales
                </h4>
                <p className="text-[11px] text-slate-400">
                  Muestra una barra superior fija en la portada para anuncios o lanzamientos.
                </p>
              </div>

              <input
                type="checkbox"
                checked={config.bannerEnabled}
                onChange={(e) => setConfig({ ...config, bannerEnabled: e.target.checked })}
                className="w-5 h-5 accent-[#06b6d4] rounded cursor-pointer"
              />
            </div>

            {config.bannerEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Texto del Anuncio</label>
                  <input
                    type="text"
                    value={config.bannerText}
                    onChange={(e) => setConfig({ ...config, bannerText: e.target.value })}
                    className="w-full bg-[#141420] border border-[#2d2d44] rounded-lg p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Texto del Enlace</label>
                  <input
                    type="text"
                    value={config.bannerLinkText}
                    onChange={(e) => setConfig({ ...config, bannerLinkText: e.target.value })}
                    className="w-full bg-[#141420] border border-[#2d2d44] rounded-lg p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">URL de Destino</label>
                  <input
                    type="text"
                    value={config.bannerLinkUrl}
                    onChange={(e) => setConfig({ ...config, bannerLinkUrl: e.target.value })}
                    className="w-full bg-[#141420] border border-[#2d2d44] rounded-lg p-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Texts & Links */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Texto Principal del Footer
              </label>
              <input
                type="text"
                value={config.footerText}
                onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  value={config.githubUrl}
                  onChange={(e) => setConfig({ ...config, githubUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={config.linkedinUrl}
                  onChange={(e) => setConfig({ ...config, linkedinUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Discord Community URL
                </label>
                <input
                  type="url"
                  value={config.discordUrl}
                  onChange={(e) => setConfig({ ...config, discordUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Twitter / X URL
                </label>
                <input
                  type="url"
                  value={config.twitterUrl}
                  onChange={(e) => setConfig({ ...config, twitterUrl: e.target.value })}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[#2d2d44]">
            <button
              type="submit"
              disabled={saving}
              className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20"
            >
              <Save className="w-4 h-4" /> Guardar Banner & Footer
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
