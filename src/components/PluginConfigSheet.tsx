/**
 * Ventana «Configurar» de un plugin, en el mismo sistema que las demás hojas del
 * panel (Usuarios, Audio, Recursos): cabecera con icono, cuerpo con bloques y
 * pie con Cancelar / Guardar. Cada plugin pinta sus bloques; los plugins sin
 * pantalla propia caen en la lista genérica de campos.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Award, BarChart3, Check, CheckSquare, Download, HardDrive, Image as ImageIcon, Layers, Loader2, MessageSquare,
  Monitor, Moon, Palette, RotateCcw, Save, Sun, Upload, Video, X, Youtube,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AcademiaPlugin } from '../types';
import { SignaturePad } from './SignaturePad';
import { FestiveHatOverlay } from './FestiveHatOverlay';
import { DEFAULT_LOGO_URL } from '../lib/logoConfig';
import type { ColorTheme } from '../lib/themeApplicator';
import type { CustomizerConfig } from '../lib/customizerConfig';

type Form = Record<string, any>;

interface Props {
  plugin: AcademiaPlugin | null;
  title: string;
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  dirty: boolean;
  saving: boolean;
  fieldLabels: Record<string, string>;
  onPreviewCustomizer: (patch: Partial<CustomizerConfig>) => void;
  onSave: (event: React.FormEvent) => void;
  onCancel: () => void;
  downloadingSample: boolean;
  onDownloadSample: () => void;
}

const PALETTE = [
  { key: 'plugSheetColor_cyan', name: 'Cian', hex: '#06b6d4' }, { key: 'plugSheetColor_blue', name: 'Azul', hex: '#3b82f6' }, { key: 'plugSheetColor_purple', name: 'Violeta', hex: '#a855f7' },
  { key: 'plugSheetColor_magenta', name: 'Magenta', hex: '#ec4899' }, { key: 'plugSheetColor_orange', name: 'Naranja', hex: '#f97316' }, { key: 'plugSheetColor_yellow', name: 'Amarillo', hex: '#eab308' },
];

/** Una clave sin etiqueta se muestra como palabras, nunca como el nombre interno. */
const humanize = (key: string) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const ICONS: Record<string, React.ElementType> = { Award, CheckSquare, MessageSquare, BarChart3, Video, Youtube, HardDrive, Palette };

/** Bloque con título y, si hace falta, una línea de ayuda. */
const Block: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="admin-plugin-sheet__block">
    <header><h4>{title}</h4>{hint && <p>{hint}</p>}</header>
    {children}
  </section>
);

const Field: React.FC<{ id: string; label: string; hint?: string; children: React.ReactNode }> = ({ id, label, hint, children }) => (
  <div className="meeting-field"><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}</div>
);

/** Opciones excluyentes: tarjetas pequeñas con un título y, opcional, una línea. */
function Options<T extends string>({ label, value, onChange, options, cols = 2 }: {
  label: string; value: T; onChange: (value: T) => void; cols?: number;
  options: Array<{ value: T; title: string; text?: string; icon?: React.ElementType; swatch?: string }>;
}) {
  return (
    <div className="admin-plugin-sheet__options" role="radiogroup" aria-label={label} data-cols={cols}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onChange(option.value)}>
            {option.swatch && <span className="admin-plugin-sheet__swatch" style={{ backgroundColor: option.swatch }} aria-hidden="true" />}
            {Icon && <Icon aria-hidden="true" />}
            <span><strong>{option.title}</strong>{option.text && <small>{option.text}</small>}</span>
            {value === option.value && <Check className="admin-plugin-sheet__check" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

const SwitchRow: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, hint, checked, onChange }) => (
  <div className="admin-plugin-sheet__switch-row">
    <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="admin-plugins__switch" onClick={() => onChange(!checked)}><span /></button>
  </div>
);

/** Imagen subida o por URL: vista previa, subir, restablecer. */
const LogoPicker: React.FC<{
  src: string; fallback: string; isCustom: boolean; maxBytes?: number; onChange: (value: string) => void; onReset: () => void;
  inputId: string; withUrl?: boolean; presets?: Array<{ label: string; url: string }>;
}> = ({ src, fallback, isCustom, maxBytes, onChange, onReset, inputId, withUrl, presets }) => {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (maxBytes && file.size > maxBytes) { setError(t('elLogoNoDebeSuperar2MbPorFavorEligeUna', 'El logo no debe superar 2 MB. Por favor elige una imagen más pequeña.')); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = (loaded) => { const result = loaded.target?.result as string; if (result) onChange(result); };
    reader.readAsDataURL(file);
  };
  return (
    <div className="admin-plugin-sheet__logo">
      <span className="admin-plugin-sheet__logo-preview">
        <img src={src || fallback} alt="" onError={(event) => { (event.currentTarget as HTMLImageElement).src = fallback; }} />
        <FestiveHatOverlay size="md" />
      </span>
      <div>
        {withUrl && (
          <input type="text" aria-label={t('urlDeLaImagenEjLogoavifOHttps', 'URL de la imagen (ej: /logo.avif o https://...)')} value={isCustom ? src : ''} onChange={(event) => onChange(event.target.value)} placeholder={t('urlDeLaImagenEjLogoavifOHttps', 'URL de la imagen (ej: /logo.avif o https://...)')} />
        )}
        <div className="admin-plugin-sheet__logo-actions">
          <label htmlFor={inputId} className="mentor-course-control"><Upload aria-hidden="true" />{t('subir', 'Subir')}</label>
          <input id={inputId} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/avif" onChange={upload} hidden />
          {isCustom && <button type="button" className="mentor-course-control" onClick={() => { setError(''); onReset(); }}><RotateCcw aria-hidden="true" />{t('restablecer', 'Restablecer')}</button>}
        </div>
        {presets && (
          <div className="admin-plugin-sheet__chips">
            {presets.map((preset) => <button key={preset.label} type="button" onClick={() => onChange(preset.url)}>{preset.label}</button>)}
          </div>
        )}
        {error && <p className="admin-resource-sheet__error" role="alert">{error}</p>}
      </div>
    </div>
  );
};

const Chips: React.FC<{ items: string[]; onPick: (value: string) => void }> = ({ items, onPick }) => (
  <div className="admin-plugin-sheet__chips">{items.map((item) => <button key={item} type="button" onClick={() => onPick(item)}>{item}</button>)}</div>
);

export const PluginConfigSheet: React.FC<Props> = ({
  plugin, title, form, setForm, dirty, saving, fieldLabels, onPreviewCustomizer, onSave, onCancel, downloadingSample, onDownloadSample,
}) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (plugin && !dialog.open) dialog.showModal();
    if (!plugin && dialog.open) dialog.close();
  }, [plugin]);

  const set = (patch: Form) => setForm((current) => ({ ...current, ...patch }));
  const isCertificates = Boolean(plugin && (plugin.id === 'pdf-certificates' || plugin.category === 'certificates'));
  const isMeetings = plugin?.id === 'live-meetings';
  const isCustomizer = plugin?.id === 'docentos-customizer';
  const Icon = (plugin && ICONS[plugin.icon]) || Layers;
  const customLogo = Boolean(form.institutionLogo && form.institutionLogo !== '/logo.avif');
  const provider = form.defaultProvider === 'meet' ? 'meet' : 'jitsi';

  const genericKeys = isCertificates ? [] : Object.keys(plugin?.config || {}).filter((key) => {
    if (['signatureImage', 'signature', 'institutionLogo', 'backgroundColor'].includes(key)) return false;
    if (isMeetings && (key === 'defaultProvider' || key === 'jitsiDomain')) return false;
    if (isCustomizer) return false;
    // Listas y objetos no se editan como texto: el campo los convertiría en una cadena.
    if (typeof plugin?.config?.[key] === 'object') return false;
    return true;
  });

  return (
    <dialog
      ref={ref}
      className="mentee-sheet admin-plugin-sheet"
      aria-labelledby="admin-plugin-sheet-title"
      onClose={() => { if (plugin) onCancel(); }}
      onClick={(event) => { if (event.target === ref.current) onCancel(); }}
    >
      {plugin && (
        <div className="mentee-sheet__body admin-person-sheet">
          <header className="mentee-sheet__head">
            <span className="mentee-sheet__icon" aria-hidden="true"><Icon /></span>
            <div className="mentor-mentee-id">
              <strong id="admin-plugin-sheet-title">{title}</strong>
              <span>{isCustomizer ? t('previsualizaLosCambiosYGuardalosCuandoEl', 'Previsualiza los cambios y guárdalos cuando el resultado sea correcto.') : t('ajustaLosParametrosOperativosDelPlugin', 'Ajusta los parámetros operativos del plugin institucional.')}</span>
              {dirty && <span className="admin-plugin-sheet__dirty">{t('cambiosSinGuardar', 'Cambios sin guardar')}</span>}
            </div>
            <button type="button" className="mentee-sheet__close" onClick={onCancel} aria-label={t('cerrarModal', 'Cerrar modal')}><X aria-hidden="true" /></button>
          </header>

          <form id="admin-plugin-form" className="admin-person-sheet__scroll admin-plugin-sheet__form" onSubmit={onSave}>
            {isCertificates && (
              <>
                <Block title={t('plugSheetDiploma', 'Diploma')}>
                  <div className="admin-plugin-sheet__grid">
                    <Field id="plugin-institution" label={t('plugSheetInstitucion', 'Institución')}>
                      <input id="plugin-institution" value={form.institutionName ?? ''} onChange={(event) => set({ institutionName: event.target.value })} placeholder={t('ejAcademiaGiantucchi', 'ej. Academia Giantucchi')} />
                    </Field>
                    <Field id="plugin-badge" label={t('plugSheetInsignia', 'Texto de la insignia')}>
                      <input id="plugin-badge" value={form.badgeText ?? ''} onChange={(event) => set({ badgeText: event.target.value })} placeholder={t('ejCertificadoDeExcelenciaTecnica', 'ej. CERTIFICADO DE EXCELENCIA TÉCNICA')} />
                    </Field>
                  </div>
                  <div className="meeting-field">
                    <span id="plugin-color-label">{t('plugSheetColorPrimario', 'Color primario')}</span>
                    <div className="admin-plugin-sheet__options" role="radiogroup" aria-labelledby="plugin-color-label" data-cols="3">
                      {PALETTE.map((color) => (
                        <button key={color.hex} type="button" role="radio" aria-checked={(form.primaryColor || '#06b6d4').toLowerCase() === color.hex} onClick={() => set({ primaryColor: color.hex })}>
                          <span className="admin-plugin-sheet__swatch" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                          <span><strong>{t(color.key, color.name)}</strong></span>
                          {(form.primaryColor || '#06b6d4').toLowerCase() === color.hex && <Check className="admin-plugin-sheet__check" aria-hidden="true" />}
                        </button>
                      ))}
                      <label className="admin-plugin-sheet__custom" data-checked={!PALETTE.some((color) => color.hex === (form.primaryColor || '#06b6d4').toLowerCase()) || undefined}>
                        <span className="admin-plugin-sheet__swatch" style={{ backgroundColor: form.primaryColor || '#06b6d4' }} aria-hidden="true" />
                        <span><strong>{t('plugSheetOtroColor', 'Otro color')}</strong></span>
                        <input type="color" aria-label={t('plugSheetOtroColor', 'Otro color')} value={form.primaryColor || '#06b6d4'} onChange={(event) => set({ primaryColor: event.target.value })} />
                      </label>
                    </div>
                  </div>
                  <Options
                    label={t('plugSheetFondoDiploma', 'Fondo del diploma')}
                    value={(form.backgroundColor === 'white' ? 'white' : 'dark') as 'white' | 'dark'}
                    onChange={(value) => set({ backgroundColor: value })}
                    options={[
                      { value: 'white', title: t('plugSheetFondoBlanco', 'Fondo blanco'), swatch: '#ffffff' },
                      { value: 'dark', title: t('plugSheetFondoOscuro', 'Fondo oscuro'), swatch: '#0e0e17' },
                    ]}
                  />
                </Block>

                <Block title={t('plugSheetLogo', 'Logo del diploma')} hint={customLogo ? t('seMostraraEnLaCabeceraOficialDelDiploma', 'Se mostrará en la cabecera oficial del diploma') : t('emblemaInstitucionalPorDefecto', 'Emblema institucional por defecto')}>
                  <LogoPicker
                    inputId="univ-logo-input" src={form.institutionLogo || '/logo.avif'} fallback="/logo.avif" isCustom={customLogo} maxBytes={2 * 1024 * 1024}
                    onChange={(value) => set({ institutionLogo: value })} onReset={() => set({ institutionLogo: '/logo.avif' })}
                  />
                </Block>

                <Block title={t('plugSheetFirmas', 'Firmas')}>
                  <Field id="plugin-signatory" label={t('nombreYCargoDelFirmanteGiantucchi', 'Nombre y Cargo del Firmante Giantucchi')}>
                    <input id="plugin-signatory" value={form.signatoryTitle ?? ''} onChange={(event) => set({ signatoryTitle: event.target.value })} placeholder={t('ejProfGiancarloGiantucchiMentorDirector', 'ej. Prof. Giancarlo Giantucchi - Mentor Director & Evaluador')} />
                  </Field>
                  <SignaturePad
                    modern
                    value={form.signatureImage || form.signature || ''}
                    onChange={(signature) => setForm((current) => ({ ...current, signatureImage: signature, signature }))}
                    signatoryTitle={form.signatoryTitle || t('profGiancarloGiantucchiMentorDirector', 'Prof. Giancarlo Giantucchi - Mentor Director & Evaluador')}
                    label={t('firmaOficialDeGiantucchi', 'Firma Oficial de Giantucchi')}
                  />
                  <SwitchRow
                    label={t('plugSheetFirma2', 'Firma 2 · Universidad o instituto')}
                    hint={form.enableUniversitySignature
                      ? t('cocertificacionActivaElDiplomaIncluiraLa', 'Co-certificación activa: El diploma incluirá la segunda firma institucional a la izquierda.')
                      : t('opcionalDesactivadaElDiplomaSeEmitiraCon', 'Opcional (Desactivada): El diploma se emitirá con firma única de Giantucchi centrada.')}
                    checked={Boolean(form.enableUniversitySignature)}
                    onChange={(value) => set({ enableUniversitySignature: value })}
                  />
                  {form.enableUniversitySignature && (
                    <>
                      <Field id="plugin-univ-signatory" label={t('nombreYCargoDelFirmanteDeLaUniversidad', 'Nombre y Cargo del Firmante de la Universidad / Instituto')}>
                        <input id="plugin-univ-signatory" value={form.universitySignatoryTitle ?? ''} onChange={(event) => set({ universitySignatoryTitle: event.target.value })} placeholder={t('ejDireccionAcademicaUniversidadInstituto', 'ej. Dirección Académica - Universidad / Instituto')} />
                      </Field>
                      <SignaturePad
                        modern
                        value={form.universitySignatureImage || ''}
                        onChange={(signature) => setForm((current) => ({ ...current, universitySignatureImage: signature }))}
                        signatoryTitle={form.universitySignatoryTitle || t('direccionAcademicaUniversidadInstituto', 'Dirección Académica - Universidad / Instituto')}
                        label={t('firmaOficialDeLaUniversidadInstituto', 'Firma Oficial de la Universidad / Instituto')}
                      />
                    </>
                  )}
                </Block>

                <Block title={t('plugSheetMuestra', 'Vista previa')} hint={t('generaYDescargaUnDiplomaEnPngConTuFondo', 'Genera y descarga un diploma en PNG con tu fondo, logo, ambas firmas oficiales y metadatos centrados.')}>
                  <button type="button" className="mentor-course-control admin-plugin-sheet__sample" onClick={onDownloadSample} disabled={downloadingSample}>
                    {downloadingSample ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                    {downloadingSample ? t('generandoDiplomaDeAltaResolucion', 'Generando diploma de alta resolución...') : t('descargarCertificadoDeMuestraPng', 'Descargar Certificado de Muestra (PNG)')}
                  </button>
                </Block>
              </>
            )}

            {isMeetings && (
              <Block title={t('proveedorPorDefecto', 'Proveedor por defecto')} hint={provider === 'meet'
                ? t('alProgramarUnaClaseElFormularioAbriraCon', 'Al programar una clase, el formulario abrirá con Google Meet pre-seleccionado.')
                : t('alProgramarUnaClaseElFormularioAbriraCon2', 'Al programar una clase, el formulario abrirá con Jitsi Meet pre-seleccionado y generará la sala automáticamente.')}>
                <Options
                  label={t('proveedorPorDefecto', 'Proveedor por defecto')} value={provider}
                  onChange={(value) => set({ defaultProvider: value, jitsiDomain: value === 'meet' ? 'meet.google.com' : 'meet.jit.si' })}
                  options={[
                    { value: 'jitsi', title: t('jitsiMeet', 'Jitsi Meet'), icon: Video },
                    { value: 'meet', title: t('googleMeet', 'Google Meet'), icon: Video },
                  ]}
                />
                <Field id="plugin-domain" label={t('dominioDelProveedor', 'Dominio del proveedor')}>
                  <input id="plugin-domain" value={form.jitsiDomain ?? (provider === 'meet' ? 'meet.google.com' : 'meet.jit.si')} onChange={(event) => set({ jitsiDomain: event.target.value })} placeholder={provider === 'meet' ? 'meet.google.com' : 'meet.jit.si'} spellCheck={false} />
                </Field>
              </Block>
            )}

            {isCustomizer && (
              <>
                <Block title={t('plugSheetVersion', 'Versión de la interfaz')}>
                  <Options
                    label={t('plugSheetVersion', 'Versión de la interfaz')}
                    value={(form.interfaceVersion === 'v0.4-classic' ? 'v0.4-classic' : 'v0.5-modern') as 'v0.4-classic' | 'v0.5-modern'}
                    onChange={(value) => onPreviewCustomizer({ interfaceVersion: value })}
                    options={[
                      { value: 'v0.5-modern', icon: Monitor, title: t('plugSheetV05b', 'Moderna 0.5'), text: t('4MacroseccionesConSubnavegacionSimetrica', '4 Macro-secciones con sub-navegación simétrica (2 botones por sección) y estudios integrados de Medios y Portal.') },
                      { value: 'v0.4-classic', icon: Layers, title: t('plugSheetV04b', 'Clásica 0.4'), text: t('laVistaOriginalConLaBarraCompletaDe11', 'La vista original con la barra completa de 11 pestañas directas desplegadas en horizontal tal como estaba antes.') },
                    ]}
                  />
                </Block>

                <Block title={t('plugSheetAcento', 'Color de acento del campus')}>
                  <Options
                    label={t('plugSheetAcento', 'Color de acento del campus')}
                    value={(form.colorTheme || 'cyan') as ColorTheme}
                    onChange={(value) => onPreviewCustomizer({ colorTheme: value })}
                    cols={4}
                    options={[
                      { value: 'cyan', title: t('plugSheetTemaCian', 'Cian'), swatch: '#06b6d4' },
                      { value: 'violet', title: t('plugSheetTemaVioleta', 'Violeta'), swatch: '#8b5cf6' },
                      { value: 'emerald', title: t('plugSheetTemaEsmeralda', 'Esmeralda'), swatch: '#10b981' },
                      { value: 'amber', title: t('plugSheetTemaAmbar', 'Ámbar'), swatch: '#f59e0b' },
                    ]}
                  />
                </Block>

                <Block title={t('densidadDeLaInterfaz', 'Densidad de la interfaz')}>
                  <Options
                    label={t('densidadDeLaInterfaz', 'Densidad de la interfaz')}
                    value={(form.density === 'compact' ? 'compact' : 'comfortable') as 'compact' | 'comfortable'}
                    onChange={(value) => onPreviewCustomizer({ density: value })}
                    options={[
                      { value: 'comfortable', title: t('comoda', 'Cómoda'), text: t('masEspacioEntreControlesYContenido', 'Más espacio entre controles y contenido') },
                      { value: 'compact', title: t('compacta', 'Compacta'), text: t('masInformacionVisibleEnCadaPantalla', 'Más información visible en cada pantalla') },
                    ]}
                  />
                </Block>

                <Block title={t('plugSheetIluminacion', 'Modo de iluminación')}>
                  <Options
                    label={t('plugSheetIluminacion', 'Modo de iluminación')}
                    value={(form.colorMode === 'light' ? 'light' : 'dark') as 'light' | 'dark'}
                    onChange={(value) => onPreviewCustomizer({ colorMode: value })}
                    options={[
                      { value: 'dark', icon: Moon, title: t('plugSheetModoOscuro', 'Modo oscuro'), text: t('contrasteNocturnoDescansado', 'Contraste nocturno descansado') },
                      { value: 'light', icon: Sun, title: t('plugSheetModoClaro', 'Modo claro'), text: t('fondosClarosDeAltaLegibilidad', 'Fondos claros de alta legibilidad') },
                    ]}
                  />
                </Block>

                <Block title={t('plugSheetMarca', 'Marca y títulos')}>
                  <Field id="plugin-brand" label={t('nombreDeLaPlataformaMarca', 'Nombre de la Plataforma / Marca')} hint={t('defineElNombreVisibleDeLaMarcaEnLaBarra', 'Define el nombre visible de la marca en la barra de navegación superior, pie de página y títulos del portal.')}>
                    <input id="plugin-brand" value={form.customBrandName ?? 'DocentOS'} onChange={(event) => set({ customBrandName: event.target.value })} placeholder={t('ejAcademiaGiantucchi', 'ej. Academia Giantucchi')} />
                  </Field>
                  <Chips items={['DocentOS', 'Academia', 'Campus Virtual']} onPick={(value) => set({ customBrandName: value })} />
                  <Field id="plugin-campus" label={t('tituloDelCampusPanelDeAdministracion', 'Título del Campus / Panel de Administración')} hint={t('defineElTituloDeLaCabeceraEnElPanelDe', 'Define el título de la cabecera en el Panel de Control & Administración Global RBAC.')}>
                    <input id="plugin-campus" value={form.customCampusName ?? t('docentosCommandCenter', 'DocentOS Command Center')} onChange={(event) => set({ customCampusName: event.target.value })} placeholder={t('ejDocentosCommandCenter', 'ej. DocentOS Command Center')} />
                  </Field>
                  <Chips items={[t('docentosCommandCenter', 'DocentOS Command Center'), t('centroDeControl', 'Centro de Control'), 'Campus Central', 'Panel Administrativo']} onPick={(value) => set({ customCampusName: value })} />
                </Block>

                <Block title={t('logoDeLaInstitucionAnimacionDeScroll', 'Logo de la Institución & Animación de Scroll')} hint={t('plugSheetLogoHint', 'Al cambiarlo se actualizan la barra superior, la marca del campus y la animación de la portada.')}>
                  <LogoPicker
                    inputId="plugin-logo-input" withUrl src={form.customLogoUrl ?? ''} fallback={DEFAULT_LOGO_URL} isCustom={Boolean(form.customLogoUrl)}
                    onChange={(value) => set({ customLogoUrl: value })} onReset={() => set({ customLogoUrl: '' })}
                    presets={[
                      { label: t('logoDocentos', 'Logo DocentOS'), url: '/logo.avif' },
                      { label: t('reactCore', 'React Core'), url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg' },
                      { label: t('webGlobe', 'Web Globe'), url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80' },
                    ]}
                  />
                </Block>
              </>
            )}

            {genericKeys.length > 0 && (
              <Block title={isMeetings ? t('plugSheetOpciones', 'Opciones') : t('plugSheetAjustes', 'Ajustes')}>
                <div className="admin-plugin-sheet__grid">
                  {genericKeys.filter((key) => typeof form[key] !== 'boolean').map((key) => {
                    const value = form[key];
                    return (
                      <Field key={key} id={`plugin-field-${key}`} label={fieldLabels[key] || humanize(key)}>
                        <input
                          id={`plugin-field-${key}`} type={typeof value === 'number' ? 'number' : 'text'} value={value !== undefined ? value : ''}
                          onChange={(event) => set({ [key]: typeof value === 'number' ? Number(event.target.value) : event.target.value })}
                        />
                      </Field>
                    );
                  })}
                </div>
                {genericKeys.filter((key) => typeof form[key] === 'boolean').map((key) => (
                  <SwitchRow key={key} label={fieldLabels[key] || humanize(key)} checked={form[key]} onChange={(next) => set({ [key]: next })} />
                ))}
              </Block>
            )}
          </form>

          <footer className="mentee-sheet__foot mentee-sheet__foot--actions admin-plugin-sheet__foot">
            <div>
              <button type="button" className="mentor-course-control" onClick={onCancel}>{t('cancelar', 'Cancelar')}</button>
              <button type="submit" form="admin-plugin-form" className="mentor-course-control mentor-course-import" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                {saving ? t('guardando', 'Guardando...') : t('guardarAjustes', 'Guardar Ajustes')}
              </button>
            </div>
          </footer>
        </div>
      )}
    </dialog>
  );
};
