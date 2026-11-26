/**
 * SignaturePad — Módulo de Firma Digital para Plugins de Certificados
 * Modos: Subir archivo de imagen | Caligráfica generada
 * Solo disponible para plugins de categoría 'certificates'.
 */

import React, { useRef, useState } from 'react';
import { Upload, Trash2, Check, Sparkles, PenTool } from 'lucide-react';
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

export interface SignaturePadProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  signatoryTitle?: string;
  label?: string;
  /** Estilo del panel moderno (hoja de configuración). */
  modern?: boolean;
}

type SignatureMode = 'upload' | 'type';

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  signatoryTitle = i18next.t('giantucchiMentorDirector', 'Giantucchi - Mentor Director'),
  label = i18next.t('firmaDigitalizadaOficial', 'Firma Digitalizada Oficial'),
  modern = false,
}) => {
  const { t } = useTranslation()
  const [mode, setMode] = useState<SignatureMode>('upload');
  const [calligraphyName, setCalligraphyName] = useState(signatoryTitle.split('-')[0].trim());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can re-trigger
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      alert(t('porFavorSeleccionaUnaImagenValidaPngJpg', 'Por favor selecciona una imagen válida (PNG, JPG, SVG o WebP).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const generateCalligraphy = () => {
    if (!calligraphyName.trim()) return;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = 'italic 58px "Brush Script MT", "Segoe Script", "Apple Chancery", cursive, serif';
    ctx.fillStyle = '#06b6d4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(calligraphyName, canvas.width / 2, canvas.height / 2);

    onChange(canvas.toDataURL('image/png'));
  };

  if (modern) {
    return (
      <div className="signature-pad">
        <div className="signature-pad__head">
          <strong>{label}</strong>
          {value && <span><Check aria-hidden="true" />{t('firmaConfigurada', 'Firma Configurada')}</span>}
        </div>

        <div className="signature-pad__modes" role="group" aria-label={label}>
          <button type="button" aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}><Upload aria-hidden="true" />{t('plugSheetFirmaSubir', 'Subir imagen')}</button>
          <button type="button" aria-pressed={mode === 'type'} onClick={() => setMode('type')}><Sparkles aria-hidden="true" />{t('plugSheetFirmaEscribir', 'Escribir firma')}</button>
        </div>

        {mode === 'upload' ? (
          <>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFileUpload} hidden />
            <button type="button" className="signature-pad__drop" onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" />
              <strong>{t('clicParaSeleccionarImagenDeFirma', 'Clic para seleccionar imagen de firma')}</strong>
              <small>{t('pngConFondoTransparenteRecomendadoJpgSvg', 'PNG con fondo transparente recomendado (JPG, SVG, WebP)')}</small>
            </button>
          </>
        ) : (
          <div className="signature-pad__type">
            <input value={calligraphyName} onChange={(event) => setCalligraphyName(event.target.value)} placeholder={t('nombreDelFirmante', 'Nombre del firmante...')} aria-label={t('nombreDelFirmante', 'Nombre del firmante...')} />
            <button type="button" className="mentor-course-control" onClick={generateCalligraphy}><Sparkles aria-hidden="true" />{t('generar', 'Generar')}</button>
          </div>
        )}

        {value ? (
          <figure className="signature-pad__preview">
            <img src={value} alt={t('firmaDigital', 'Firma Digital')} />
            <figcaption>{signatoryTitle}</figcaption>
            <button type="button" onClick={() => onChange('')}><Trash2 aria-hidden="true" />{t('eliminarFirma', 'Eliminar Firma')}</button>
          </figure>
        ) : (
          <p className="signature-pad__hint">{t('sinFirmaPersonalizadaSeEstamparaLaFirma', '* Sin firma personalizada se estampará la firma oficial por defecto.')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-[#141420] border border-[#2d2d44] rounded-xl p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2d2d44] pb-2">
        <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-[var(--color-brand-cyan)]" />
          {label}
        </label>
        {value && (
          <span className="text-[10px] font-bold text-success-light bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3" /> {t('firmaConfigurada', 'Firma Configurada')}
          </span>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-col sm:flex-row gap-1.5 p-1 bg-[#0a0a0f] rounded-lg border border-[#2d2d44]">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-[color,background-color,border-color,opacity,box-shadow] flex items-center justify-center gap-1.5 ${mode === 'upload' ? 'bg-[var(--color-brand-cyan)] text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
        >
          <Upload className="w-3 h-3" />
          <span>{t('subirImagenDeFirma', 'Subir Imagen de Firma')}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('type')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-[color,background-color,border-color,opacity,box-shadow] flex items-center justify-center gap-1.5 ${mode === 'type' ? 'bg-[var(--color-brand-cyan)] text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>{t('firmaCaligrafica', 'Firma Caligráfica')}</span>
        </button>
      </div>

      {/* MODO 1: SUBIR ARCHIVO */}
      {mode === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#2d2d44] hover:border-[var(--color-brand-cyan)] rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#0a0a0f] group"
          >
            <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[var(--color-brand-cyan)]/10 border border-[var(--color-brand-cyan)]/30 flex items-center justify-center text-[var(--color-brand-cyan)] transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-white">{t('clicParaSeleccionarImagenDeFirma', 'Clic para seleccionar imagen de firma')}</p>
            <p className="text-[11px] text-slate-400 mt-1">{t('pngConFondoTransparenteRecomendadoJpgSvg', 'PNG con fondo transparente recomendado (JPG, SVG, WebP)')}</p>
          </div>
        </div>
      )}

      {/* MODO 2: CALIGRÁFICA */}
      {mode === 'type' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={calligraphyName}
            onChange={(e) => setCalligraphyName(e.target.value)}
            placeholder={t('nombreDelFirmante', 'Nombre del firmante...')}
            className="min-w-0 flex-1 py-2 px-3 bg-[#0a0a0f] border border-[#2d2d44] focus:border-[var(--color-brand-cyan)] rounded-xl text-xs text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={generateCalligraphy}
            className="px-4 py-2 bg-brand-cyan hover:opacity-90 text-on-brand font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-opacity whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('generar', 'Generar')}
          </button>
        </div>
      )}

      {/* Preview */}
      {value ? (
        <div className="p-3.5 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>{t('previsualizacionDeFirma', 'Previsualización de Firma:')}</span>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-danger-light hover:text-danger-light flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('eliminarFirma', 'Eliminar Firma')}
            </button>
          </div>
          <div className="flex flex-col items-center justify-center py-4 px-3 bg-[#141420] rounded-xl border border-[#2d2d44] shadow-inner">
            <div className="h-28 sm:h-32 w-full max-w-sm flex items-center justify-center p-2">
              <img
                src={value}
                alt={t('firmaDigital', 'Firma Digital')}
                className="max-h-24 sm:max-h-28 max-w-full object-contain filter drop-shadow-md"
              />
            </div>
            <div className="w-72 border-t-2 border-[#2d2d44] my-2" />
            <p className="text-xs font-bold text-slate-100 text-center">{signatoryTitle}</p>
            <span className="text-[10px] font-mono text-[var(--color-brand-cyan)] mt-0.5">
              {t('certificacionDigitalVerificada', 'Certificación Digital Verificada')}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic text-center py-1">
          {t('sinFirmaPersonalizadaSeEstamparaLaFirma', '* Sin firma personalizada se estampará la firma oficial por defecto.')}
        </p>
      )}
    </div>
  );
};
