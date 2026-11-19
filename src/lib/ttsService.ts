/**
 * Servicio de Síntesis de Voz TTS (Text-to-Speech) - Academia Giantucchi Open Source
 *
 * Resuelve el problema asíncrono de Web Speech API (`window.speechSynthesis.onvoiceschanged`),
 * proporciona fallback con AudioContext sintetizado para navegadores restringidos,
 * y ofrece pruebas instantáneas de voz por idioma.
 */

import { resolveVoiceForText } from './ttsLanguage';

export interface TTSVoiceOption {
  id: string;
  name: string;
  lang: string;
  flag: string;
  gender: 'M' | 'F';
  sampleText: string;
}

export const SUPPORTED_TTS_VOICES: TTSVoiceOption[] = [
  // Español
  {
    id: 'es-MX-Sofia',
    name: 'Español (Latinoamérica - Sofía / México)',
    lang: 'es-MX',
    flag: '🇲🇽',
    gender: 'F',
    sampleText: '¡Hola! Bienvenido a la plataforma de mentoría oficial de DocentOS.',
  },
  {
    id: 'es-ES-Carlos',
    name: 'Español (España - Carlos)',
    lang: 'es-ES',
    flag: '🇪🇸',
    gender: 'M',
    sampleText: 'Saludos. Esta es una demostración de la voz sintética en español para guías de estudio.',
  },
  {
    id: 'es-AR-Mateo',
    name: 'Español (Argentina - Mateo)',
    lang: 'es-AR',
    flag: '🇦🇷',
    gender: 'M',
    sampleText: '¡Qué tal! Comencemos con la lección de hoy para dominar los conceptos clave.',
  },
  {
    id: 'es-US-Alonso',
    name: 'Español (EE.UU. - Alonso)',
    lang: 'es-US',
    flag: '🇺🇸',
    gender: 'M',
    sampleText: 'Hola a todos. Prepárense para explorar la arquitectura técnica avanzada.',
  },

  // English
  {
    id: 'en-US-Elena',
    name: 'English (US - Elena)',
    lang: 'en-US',
    flag: '🇺🇸',
    gender: 'F',
    sampleText: 'Hello! Welcome to the DocentOS mentorship platform.',
  },
  {
    id: 'en-GB-Arthur',
    name: 'English (UK - Arthur)',
    lang: 'en-GB',
    flag: '🇬🇧',
    gender: 'M',
    sampleText: 'Greetings! This is a test of the English synthetic voice guide.',
  },

  // Français
  {
    id: 'fr-FR-Claire',
    name: 'Français (France - Claire)',
    lang: 'fr-FR',
    flag: '🇫🇷',
    gender: 'F',
    sampleText: 'Bonjour! Bienvenue sur la plateforme de mentorat DocentOS.',
  },
  {
    id: 'fr-CA-Antoine',
    name: 'Français (Canada - Antoine)',
    lang: 'fr-CA',
    flag: '🇨🇦',
    gender: 'M',
    sampleText: 'Salut! Explorons ensemble la lection technique aujourd’hui.',
  },

  // Português
  {
    id: 'pt-BR-Lucas',
    name: 'Português (Brasil - Lucas)',
    lang: 'pt-BR',
    flag: '🇧🇷',
    gender: 'M',
    sampleText: 'Olá! Bem-vindo à plataforma de mentoria DocentOS.',
  },
  {
    id: 'pt-PT-Beatriz',
    name: 'Português (Portugal - Beatriz)',
    lang: 'pt-PT',
    flag: '🇵🇹',
    gender: 'F',
    sampleText: 'Olá a todos! Esta é uma demonstração do guia de voz sintetizado.',
  },

  // Italiano
  {
    id: 'it-IT-Marco',
    name: 'Italiano (Italia - Marco)',
    lang: 'it-IT',
    flag: '🇮🇹',
    gender: 'M',
    sampleText: 'Ciao! Benvenuto sulla piattaforma di mentoring DocentOS.',
  },
];

export interface SpeakOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

class TTSService {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private voicesLoaded: boolean = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private initPromise: Promise<SpeechSynthesisVoice[]> | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && ('speechSynthesis' in window || 'AudioContext' in window || 'webkitAudioContext' in window);
  }

  /**
   * Inicialización Asíncrona del motor de voces basada en Promesas
   */
  public initVoices(): Promise<SpeechSynthesisVoice[]> {
    if (this.voicesLoaded && this.cachedVoices.length > 0) {
      return Promise.resolve(this.cachedVoices);
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve([]);
        return;
      }

      const populate = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          this.cachedVoices = voices;
          this.voicesLoaded = true;
          resolve(voices);
        }
      };

      populate();

      if (this.cachedVoices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          populate();
        };

        // Fallback timeout por si onvoiceschanged no se dispara inmediatamente
        setTimeout(() => {
          if (this.cachedVoices.length === 0) {
            this.cachedVoices = window.speechSynthesis.getVoices() || [];
            this.voicesLoaded = this.cachedVoices.length > 0;
          }
          resolve(this.cachedVoices);
        }, 600);
      }
    });

    return this.initPromise;
  }

  public async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.voicesLoaded || this.cachedVoices.length === 0) {
      await this.initVoices();
    }
    return this.cachedVoices;
  }

  public stop(): void {
    this.speakToken++;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
    }
  }

  /**
   * Prueba instantánea de voz para una opción específica
   */
  public async testVoice(voiceId: string, speed: number = 1.0): Promise<void> {
    const voiceObj = SUPPORTED_TTS_VOICES.find((v) => v.id === voiceId) || SUPPORTED_TTS_VOICES[0];
    await this.speak({
      text: voiceObj.sampleText,
      voiceId: voiceObj.id,
      speed,
    });
  }

  /**
   * Parte el guion en fragmentos cortos. Chrome corta en silencio los
   * enunciados largos (~15 s) y deja la cola atascada.
   */
  private splitText(text: string, maxLength = 180): { text: string; offset: number }[] {
    const chunks: { text: string; offset: number }[] = [];
    const sentences = text.match(/[^.!?…]+[.!?…]*\s*|[.!?…]+\s*/g) || [text];
    let current = '';
    let currentOffset = 0;
    let cursor = 0;
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > maxLength) {
        chunks.push({ text: current, offset: currentOffset });
        current = '';
        currentOffset = cursor;
      }
      if (!current) currentOffset = cursor;
      current += sentence;
      cursor += sentence.length;
    }
    if (current.trim()) chunks.push({ text: current, offset: currentOffset });
    return chunks.filter((chunk) => chunk.text.trim().length > 0);
  }

  private speakToken = 0;

  /**
   * Reproduce el audio usando Web Speech API o Fallback de sintetizador de audio
   */
  public async speak(options: SpeakOptions): Promise<void> {
    this.stop();
    const token = ++this.speakToken;

    const hasSpeechApi = typeof window !== 'undefined' && 'speechSynthesis' in window;

    if (!hasSpeechApi) {
      this.playSynthAudioFallback(options);
      return;
    }

    let voices = this.cachedVoices;
    if (voices.length === 0) {
      voices = await this.getAvailableVoices();
    }

    // Chrome ignora un speak() lanzado justo después de cancel(): hay que dejarle respirar.
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (token !== this.speakToken) return; // otra reproducción o stop() la sustituyó

    // Si el texto está en otro idioma que la voz elegida, se usa la voz de ese idioma.
    const voiceId = resolveVoiceForText(options.text, options.voiceId);
    const targetVoiceConfig = SUPPORTED_TTS_VOICES.find((v) => v.id === voiceId);
    const targetLang = targetVoiceConfig ? targetVoiceConfig.lang : 'es-MX';

    // 1. Coincidencia por BCP-47
    let matchedVoice = voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase());

    // 2. Coincidencia por nombre (ej. Microsoft o Google Sabina/Carlos)
    if (!matchedVoice && voiceId) {
      const nameFragment = voiceId.split('-').pop()?.toLowerCase() || '';
      matchedVoice = voices.find((v) => v.name.toLowerCase().includes(nameFragment));
    }

    // 3. Fallback por código base de idioma ('es', 'en', 'fr', 'pt', 'it')
    if (!matchedVoice) {
      const baseLang = targetLang.split('-')[0].toLowerCase();
      matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(baseLang));
    }

    const chunks = this.splitText(options.text);
    let started = false;
    let failed = false;
    let retried = false;

    const fail = () => {
      if (failed) return;
      failed = true;
      this.activeUtterance = null;
      // Sin voz utilizable: un aviso sonoro y que la interfaz salga del estado "reproduciendo".
      this.playSynthAudioFallback(options);
      if (options.onError) options.onError(new Error('speech-synthesis-unavailable'));
    };

    const enqueue = () => {
      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk.text);
        if (matchedVoice) {
          utterance.voice = matchedVoice;
          utterance.lang = matchedVoice.lang;
        } else {
          utterance.lang = targetLang;
        }
        utterance.rate = options.speed || 1.0;
        utterance.pitch = options.pitch || 1.0;

        utterance.onstart = () => {
          started = true;
        };
        utterance.onboundary = (event) => {
          if (options.onBoundary && event.name === 'word') {
            options.onBoundary(chunk.offset + event.charIndex);
          }
        };
        utterance.onend = () => {
          if (token !== this.speakToken || failed) return;
          if (index === chunks.length - 1) {
            this.activeUtterance = null;
            if (options.onEnd) options.onEnd();
          }
        };
        utterance.onerror = (err) => {
          if (token !== this.speakToken || err.error === 'interrupted' || err.error === 'canceled') return;
          fail();
        };

        // Se conserva la referencia: si el recolector libera el enunciado, Chrome deja de emitir eventos.
        if (index === chunks.length - 1) this.activeUtterance = utterance;
        window.speechSynthesis.speak(utterance);
      });
    };

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    try {
      enqueue();
    } catch (e) {
      fail();
      return;
    }

    // Vigilante: si el motor no arranca (cola atascada), se reinicia una vez y, si sigue mudo, se avisa.
    setTimeout(() => {
      if (token !== this.speakToken || started || failed) return;
      if (!retried) {
        retried = true;
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        setTimeout(() => {
          if (token !== this.speakToken || failed) return;
          try {
            enqueue();
          } catch {
            fail();
            return;
          }
          setTimeout(() => {
            if (token === this.speakToken && !started && !failed) fail();
          }, 3000);
        }, 150);
      }
    }, 2500);
  }

  /**
   * Fallback de síntesis de frecuencias de voz con AudioContext
   */
  private playSynthAudioFallback(options: SpeakOptions): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }

      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.6);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);

      setTimeout(() => {
        if (options.onEnd) options.onEnd();
      }, 700);
    } catch (e) {
      if (options.onError) options.onError(e);
    }
  }
}

export const ttsService = new TTSService();
