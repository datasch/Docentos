import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, Sparkles, Shield, Award, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { TTSGuide } from '../types';
import { ttsService } from '../lib/ttsService';

interface MentorTTSGuideWidgetProps {
  guide: TTSGuide;
  onRewardEarned?: (xp: number) => void;
}

export const MentorTTSGuideWidget: React.FC<MentorTTSGuideWidgetProps> = ({ guide, onRewardEarned }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [claimedReward, setClaimedReward] = useState(false);
  const [speechProgress, setSpeechProgress] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setSpeechProgress(0);
    setClaimedReward(false);
    ttsService.stop();
  }, [guide.id]);

  const handlePlayTTS = () => {
    if (isPlaying) {
      ttsService.stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    ttsService.speak({
      text: guide.scriptText,
      voiceId: guide.voiceId || 'es-ES-Carlos',
      speed: guide.voiceSpeed || 1.0,
      onBoundary: (charIdx) => {
        const pct = Math.round((charIdx / guide.scriptText.length) * 100);
        setSpeechProgress(pct);
      },
      onEnd: () => {
        setIsPlaying(false);
        setSpeechProgress(100);
        if (!claimedReward) {
          setClaimedReward(true);
          if (onRewardEarned) {
            onRewardEarned(guide.xpReward || 50);
          }
        }
      },
      onError: () => {
        setIsPlaying(false);
      },
    });
  };

  const handleStopTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setSpeechProgress(0);
  };

  return (
    <div className="bg-[#141420] border border-[#2d2d44] hover:border-[#06b6d4]/40 rounded-2xl p-4 sm:p-5 shadow-xl transition-all space-y-3 relative overflow-hidden">
      
      {/* Background Subtle Gradient Glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#06b6d4]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-[#a855f7]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          
          {/* Animated Mentor Avatar with Audio Reactive Pulse Ring */}
          <div className="relative shrink-0">
            <img
              src={guide.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={guide.mentorName}
              className={`w-11 h-11 rounded-full object-cover ring-2 transition-all ${
                isPlaying ? 'ring-[#06b6d4] scale-105 shadow-lg shadow-[#06b6d4]/30' : 'ring-[#2d2d44]'
              }`}
            />
            {isPlaying && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#06b6d4] rounded-full border-2 border-[#141420] flex items-center justify-center animate-ping" />
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#06b6d4] rounded-full border-2 border-[#141420] flex items-center justify-center text-[8px] font-bold text-black">
              AI
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-white">{guide.title}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-gradient text-white uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#eab308]" /> Guía TTS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Shield className="w-3 h-3 text-[#06b6d4]" /> Mentor: <strong className="text-slate-200">{guide.mentorName}</strong>
            </p>
          </div>
        </div>

        {/* Right Controls: Play Button & Expand Toggle */}
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <button
            onClick={handlePlayTTS}
            className={`flex-1 justify-center sm:flex-none px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md ${
              isPlaying
                ? 'bg-[#a855f7] text-white shadow-[#a855f7]/30 ring-2 ring-[#a855f7]/50'
                : 'btn-brand-primary shadow-[#06b6d4]/20'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pausar Voz</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Escuchar Guía</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 p-2 rounded-xl bg-[#1a1a2e] border border-[#2d2d44] text-slate-400 hover:text-white"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content & Script Caption Box */}
      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-[#2d2d44]/60 animate-fade-in">
          
          {/* Animated Equalizer Waveform & Progress */}
          <div className="bg-[#0a0a0f] p-3 rounded-xl border border-[#2d2d44] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 h-4 shrink-0">
              {[0.4, 0.8, 0.3, 0.9, 0.5, 0.7, 0.2, 0.8].map((val, idx) => (
                <div
                  key={idx}
                  className={`w-1 bg-[#06b6d4] rounded-full transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : 'opacity-40'
                  }`}
                  style={{
                    height: isPlaying ? `${Math.max(20, Math.sin((idx + 1) * 2) * 100)}%` : '25%',
                    backgroundColor: idx % 2 === 0 ? '#06b6d4' : '#a855f7',
                  }}
                />
              ))}
            </div>

            {/* Audio Progress Bar */}
            <div className="flex-1 bg-[#1a1a2e] h-2 rounded-full overflow-hidden border border-[#2d2d44] relative">
              <div
                className="bg-brand-gradient h-full transition-all duration-300 rounded-full"
                style={{ width: `${speechProgress}%` }}
              />
            </div>

            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              {speechProgress}%
            </span>
          </div>

          {/* Script Text Display */}
          <div className="bg-[#0a0a0f] p-3.5 rounded-xl border border-[#2d2d44] text-xs text-slate-200 leading-relaxed font-sans relative">
            <p className="italic text-slate-300">
              "{guide.scriptText}"
            </p>
          </div>

          {/* Gamified Reward Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#1a1a2e] border border-[#2d2d44] text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <Award className="w-4 h-4 text-[#eab308]" />
              <span className="text-slate-300">Recompensa Gamificada de Lección:</span>
              <strong className="text-[#06b6d4]">+{guide.xpReward || 50} XP</strong>
            </div>

            {claimedReward ? (
              <span className="text-[11px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ¡+50 XP Reclamados!
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">Escucha la guía completa para ganar XP</span>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
