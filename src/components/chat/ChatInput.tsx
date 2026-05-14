import React, { useEffect, useRef, useState } from 'react';
import { File as FileIcon, Ghost, Image as ImageIcon, Loader2, Mic, MicOff, Paperclip, Send, Smile, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
    length: number;
  }>;
};

type MediaRecorderLike = {
  ondataavailable: ((event: BlobEvent) => void) | null;
  onstop: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const VOICE_START_THRESHOLD = 12;
const SILENCE_STOP_DELAY_MS = 1400;

function getRecorderStartErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone permission is blocked. Allow microphone access for this site and try again.';
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone was found. Connect a microphone and try again.';
    }
    if (error.name === 'NotReadableError') {
      return 'Your microphone is busy or unavailable right now. Close other apps using it and try again.';
    }
    if (error.name === 'SecurityError') {
      return 'Microphone access is blocked by browser security settings.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Could not start recording.';
}

interface ChatInputProps {
  onSendMessage: (text: string, media?: { url: string, type: 'image' | 'video' | 'file' }) => Promise<void>;
  onTyping: () => void;
  sending: boolean;
  onUploadMedia: (file: File) => Promise<{ url: string, type: 'image' | 'video' | 'file' }>;
  enableVoiceForAi?: boolean;
  voiceAssistantSpeaking?: boolean;
  onVoiceModeChange?: (enabled: boolean) => void;
  vanishMode?: boolean;
}

const EMOJIS = ['😊', '😂', '🔥', '👍', '❤️', '🙌', '🎉', '💡', '💯', '🚀', '✨', '👏', '🤔', '😎', '🎓', '📚'];

export function ChatInput({
  onSendMessage,
  onTyping,
  sending,
  onUploadMedia,
  enableVoiceForAi = false,
  voiceAssistantSpeaking = false,
  onVoiceModeChange,
  vanishMode
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<{ url: string, type: 'image' | 'video' | 'file', file: File } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [recorderSupported, setRecorderSupported] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [speechRecognitionFailed, setSpeechRecognitionFailed] = useState(false);
  const [isVoiceArmed, setIsVoiceArmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorderLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const voiceLoopEnabledRef = useRef(false);
  const isRecordingAudioRef = useRef(false);
  const assistantSpeakingRef = useRef(false);

  const canSend = !!text.trim() || !!attachedMedia;

  useEffect(() => {
    isRecordingAudioRef.current = isRecordingAudio;
  }, [isRecordingAudio]);

  useEffect(() => {
    assistantSpeakingRef.current = voiceAssistantSpeaking;
  }, [voiceAssistantSpeaking]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSend || sending || isUploading) return;

    const msg = text.trim();
    const media = attachedMedia ? { url: attachedMedia.url, type: attachedMedia.type } : undefined;

    setText('');
    setAttachedMedia(null);
    setShowEmojis(false);

    try {
      await onSendMessage(msg, media);
    } catch (err) {
      toast.error('Failed to send message.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await onUploadMedia(file);
      setAttachedMedia({ ...result, file });
      toast.success('Attachment ready.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Media upload failed.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(SpeechRecognitionCtor));
    setRecorderSupported(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');

    if (!SpeechRecognitionCtor) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const nextText = (finalTranscript || interimTranscript).trim();
      if (nextText) {
        setText(nextText);
        onTyping();
      }

      if (finalTranscript.trim() && !sending && !isUploading) {
        const voiceText = finalTranscript.trim();
        setText('');
        void onSendMessage(voiceText).catch(() => {
          toast.error('Voice message failed to send.');
        });
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setSpeechRecognitionFailed(true);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        void 0;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      recognitionRef.current = null;
    };
  }, [isUploading, onSendMessage, onTyping, sending, voiceAssistantSpeaking]);

  useEffect(() => {
    onVoiceModeChange?.(voiceModeEnabled);
  }, [onVoiceModeChange, voiceModeEnabled]);

  const stopVoiceMode = () => {
    voiceLoopEnabledRef.current = false;
    setVoiceModeEnabled(false);
    setIsListening(false);
    setIsRecordingAudio(false);
    setIsVoiceArmed(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      void 0;
    }
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      void 0;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  };

  const transcribeBlobAndSend = async (blob: Blob) => {
    const file = new File([blob], 'voice.webm', { type: blob.type || 'audio/webm' });
    const formData = new FormData();
    formData.append('file', file);
    if (typeof navigator !== 'undefined' && navigator.language) {
      formData.append('language', navigator.language);
    }

    const response = await fetch('/api/ai/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok || !payload?.text?.trim()) {
      throw new Error(payload?.error || 'Could not understand your voice.');
    }

    await onSendMessage(payload.text.trim());
  };

  const monitorVoiceActivity = () => {
    if (!voiceLoopEnabledRef.current || !analyserRef.current || !mediaRecorderRef.current) return;

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (!voiceLoopEnabledRef.current || !analyserRef.current || !mediaRecorderRef.current) return;

      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i += 1) {
        peak = Math.max(peak, Math.abs(data[i] - 128));
      }

      if (peak > VOICE_START_THRESHOLD) {
        if (!isRecordingAudioRef.current && !assistantSpeakingRef.current) {
          try {
            mediaRecorderRef.current.start();
            setIsRecordingAudio(true);
            setIsListening(true);
          } catch {
            void 0;
          }
        }

        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (isRecordingAudioRef.current && !silenceTimerRef.current) {
        silenceTimerRef.current = window.setTimeout(() => {
          silenceTimerRef.current = null;
          try {
            mediaRecorderRef.current?.stop();
          } catch {
            void 0;
          }
        }, SILENCE_STOP_DELAY_MS);
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  const startRecorderMode = async () => {
    if (!recorderSupported) {
      toast.error('Voice chat is not supported in this browser.');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    audioChunksRef.current = [];
    const candidateMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    const supportedMimeType = candidateMimeTypes.find((type) => {
      try {
        return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
          ? MediaRecorder.isTypeSupported(type)
          : false;
      } catch {
        return false;
      }
    });

    let recorder: MediaRecorderLike;
    try {
      recorder = supportedMimeType
        ? (new MediaRecorder(stream, { mimeType: supportedMimeType }) as unknown as MediaRecorderLike)
        : (new MediaRecorder(stream) as unknown as MediaRecorderLike);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      throw error;
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: supportedMimeType || 'audio/webm' });
      audioChunksRef.current = [];
      setIsRecordingAudio(false);
      setIsListening(false);

      if (blob.size > 0) {
        void transcribeBlobAndSend(blob).catch((error) => {
          toast.error(error instanceof Error ? error.message : 'Voice input is not available right now.');
        });
      }
    };

    mediaRecorderRef.current = recorder;

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('Live voice mode is not supported in this browser.');
    }

    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    setIsVoiceArmed(true);
    monitorVoiceActivity();
  };

  const stopRecorderMode = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      void 0;
    }
  };

  const toggleVoiceMode = () => {
    if (!recorderSupported) {
      toast.error('Voice chat is not supported in this browser.');
      return;
    }

    if (!voiceModeEnabled) {
      setVoiceModeEnabled(true);
      voiceLoopEnabledRef.current = true;
      void startRecorderMode().then(() => {
        toast.success('Live voice chat on. Start speaking.');
      }).catch((error) => {
        setVoiceModeEnabled(false);
        voiceLoopEnabledRef.current = false;
        toast.error(getRecorderStartErrorMessage(error));
      });
      return;
    }

    stopVoiceMode();
  };

  return (
    <div className="absolute bottom-4 md:bottom-8 left-4 right-4 md:left-10 md:right-10 z-30 flex flex-col gap-3 overflow-hidden">
      <AnimatePresence>
        {enableVoiceForAi && voiceModeEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="ml-4 inline-flex w-fit items-center gap-3 rounded-2xl border border-primary/30 bg-card/90 px-4 py-3 text-xs font-bold text-foreground shadow-2xl"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${isListening || isRecordingAudio ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {voiceAssistantSpeaking
              ? 'AI is speaking...'
              : isListening
                ? 'Listening...'
                : isRecordingAudio
                  ? 'Recording... tap mic again to send'
                  : speechRecognitionFailed || !voiceSupported
                    ? 'Voice chat on'
                    : 'Voice chat on'}
            <button
              type="button"
              onClick={stopVoiceMode}
              className="rounded-full p-1 text-foreground/50 transition hover:bg-white/5 hover:text-foreground"
              aria-label="Stop voice chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {attachedMedia && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="flex items-center gap-4 p-3 bg-card/90 backdrop-blur-3xl border border-primary/30 rounded-2xl w-fit shadow-2xl ml-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
              {attachedMedia.type === 'image' ? (
                <img src={attachedMedia.url} className="w-full h-full object-cover" alt="Attachment preview" />
              ) : attachedMedia.type === 'video' ? (
                <ImageIcon className="w-6 h-6 text-primary" />
              ) : (
                <FileIcon className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="flex flex-col pr-4">
              <span className="text-[10px] font-black text-foreground uppercase truncate max-w-[120px]">{attachedMedia.file.name}</span>
              <span className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">{attachedMedia.type}</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedMedia(null)}
              className="p-1.5 hover:bg-white/5 rounded-full text-foreground/40 hover:text-rose-500 transition-colors"
              aria-label="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmojis && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-24 left-4 p-4 bg-card/95 backdrop-blur-3xl border border-border rounded-3xl shadow-3xl grid grid-cols-4 gap-2 z-40"
          >
            {EMOJIS.map(emoji => (
              <button
                type="button"
                key={emoji}
                onClick={() => { setText(p => p + emoji); setShowEmojis(false); }}
                className="w-10 h-10 flex items-center justify-center text-xl hover:bg-foreground/5 rounded-xl transition-all hover:scale-110 active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit}
        className={`p-1.5 backdrop-blur-3xl border rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-1 group transition-all ${vanishMode ? 'bg-primary/5 border-primary/20 focus-within:border-primary/50' : 'bg-card/90 border-border focus-within:border-primary/30'}`}
      >
        <div className="flex items-center">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 md:p-3 text-foreground/20 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5 disabled:opacity-30 flex-shrink-0"
            aria-label="Attach file"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowEmojis(!showEmojis)}
            className={`hidden sm:block p-3 transition-colors rounded-full hover:bg-foreground/5 ${showEmojis ? 'text-primary' : 'text-foreground/20 hover:text-foreground'}`}
            aria-label="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Type your message..."
          className="flex-1 min-w-0 bg-transparent border-none text-foreground font-medium py-3 md:py-4 px-2 md:px-3 focus:outline-none placeholder:text-foreground/10 text-sm md:text-base selection:bg-primary/30"
        />

        <div className="flex items-center pr-1 gap-1 flex-shrink-0">
          {enableVoiceForAi && (
            <button
              type="button"
              onClick={toggleVoiceMode}
              className={`p-2 md:p-3 rounded-full transition-all flex-shrink-0 ${
                voiceModeEnabled
                  ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                  : 'text-foreground/20 hover:text-foreground hover:bg-foreground/5'
              }`}
              aria-label={voiceModeEnabled ? 'Stop voice chat' : 'Start voice chat'}
            >
              {voiceModeEnabled ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            type="submit"
            disabled={sending || isUploading || !canSend}
            className={`p-3 md:p-3.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-30 disabled:grayscale flex items-center justify-center flex-shrink-0 ${vanishMode ? 'bg-primary text-white shadow-primary/20' : 'bg-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : vanishMode ? <Ghost className="w-5 h-5 fill-white/10" /> : <Send className="w-5 h-5 fill-white/10" />}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
