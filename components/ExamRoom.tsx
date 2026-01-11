
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ExamStatus, DifficultyLevel, ClassLevel, TranscriptionEntry } from '../types';
import AudioVisualizer from './AudioVisualizer';

interface ExamRoomProps {
  onEnd: (transcript: TranscriptionEntry[]) => void;
  onStatusChange: (status: ExamStatus) => void;
  difficulty: DifficultyLevel;
  classLevel: ClassLevel;
  initialTimeSeconds?: number;
}

interface Persona {
  id: string;
  label: string;
  description: string;
  icon: string;
  instruction: string;
  voiceName: string;
}

const PERSONAS: Persona[] = [
  { 
    id: 'Charon', 
    label: 'Prof. Sterling', 
    description: 'The Academic: Strict, formal, and demands mathematical rigor. Speaks fluent Hinglish.', 
    icon: '👨‍💼',
    voiceName: 'Charon',
    instruction: 'You are Prof. Sterling. You are very strict and only accept precise, textbook definitions. You often interrupt students if they are vague. You use Hindi for transitions but expect technical terms in pure English. You are cold and professional.'
  },
  { 
    id: 'Puck', 
    label: 'Dr. Ray', 
    description: 'The Innovator: Energetic and focuses on tech applications. Interactive in Hindi/English.', 
    icon: '👦',
    voiceName: 'Puck',
    instruction: 'You are Dr. Ray, a young, excited researcher. You care about how physics changes the world. You ask questions about real-life tech like EVs or Space Travel. You are friendly and use lots of Hinglish.'
  },
  { 
    id: 'Kore', 
    label: 'Dr. Elena', 
    description: 'The Analyst: Calm, precise, and laboratory-focused. Precise bilingual examiner.', 
    icon: '👩‍🏫',
    voiceName: 'Kore',
    instruction: 'You are Dr. Elena. You focus exclusively on experiments. You ask about instruments like Screw Gauges, Vernier Calipers, and Multimeters. You want to know about least counts and zero errors. You are calm and methodical.'
  },
  { 
    id: 'Fenrir', 
    label: 'Prof. Magnus', 
    description: 'The Veteran: Stern, brief, and values direct answers. Direct Hinglish commands.', 
    icon: '👴',
    voiceName: 'Fenrir',
    instruction: 'You are Prof. Magnus. You have 40 years of experience and are very tired. You want short, one-word or one-sentence answers. If a student rambles, you tell them to get to the point. You are very grumpy.'
  },
  { 
    id: 'Zephyr', 
    label: 'Mr. Aris', 
    description: 'The Mentor: Friendly, warm, and encourages best efforts in your native style.', 
    icon: '👤',
    voiceName: 'Zephyr',
    instruction: 'You are Mr. Aris. You are like a supportive teacher. You guide the student if they get stuck. You use simple Hindi to explain the question if the student is nervous. You are very kind.'
  },
];

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ExamRoom: React.FC<ExamRoomProps> = ({ onEnd, onStatusChange, difficulty, classLevel, initialTimeSeconds = 900 }) => {
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [isExaminerSpeaking, setIsExaminerSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentInputText, setCurrentInputText] = useState('');
  const [currentOutputText, setCurrentOutputText] = useState('');
  const currentInputTextRef = useRef('');
  const currentOutputTextRef = useRef('');
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(initialTimeSeconds);
  const [isActive, setIsActive] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState('Charon');

  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const nextStartTimeRef = useRef(0);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);

  const selectedPersona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];

  useEffect(() => {
    let timer: number | undefined;
    if (isActive && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      onEnd(transcriptions);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isActive, timeLeft, onEnd, transcriptions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions, currentInputText, currentOutputText]);

  const stopActiveSession = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    for (const source of sourcesRef.current.values()) {
      try { source.stop(); } catch(e) {}
    }
    sourcesRef.current.clear();
    setIsExaminerSpeaking(false);
  }, []);

  const startSession = useCallback(async () => {
    try {
      setErrorMessage(null);
      stopActiveSession();
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();

      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 640, height: 480 } });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }

      const difficultyInstructions = {
        [DifficultyLevel.EASY]: "Difficulty: EASY. Ask basic questions, use Hinglish, be lenient.",
        [DifficultyLevel.MEDIUM]: "Difficulty: MEDIUM. Standard Board level. Mix Hindi/English. Grade fairly.",
        [DifficultyLevel.HARD]: "Difficulty: HARD. Tough derivations. Demand technical English. Grade strictly."
      };

      const syllabusFocus = classLevel === ClassLevel.XI 
        ? "Class 11 Syllabus: Units and Measurements, Kinematics, Laws of Motion, Work, Energy and Power, Thermodynamics, Oscillations and Waves."
        : "Class 12 Syllabus: Electrostatics, Current Electricity, Magnetic Effects, Optics, Dual Nature of Radiation, Atoms and Nuclei, Electronic Devices.";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            onStatusChange(ExamStatus.ACTIVE);
            setIsActive(true);
            
            const source = inputAudioContextRef.current!.createMediaStreamSource(streamRef.current!);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (event) => {
              if (isClosingRef.current || !sessionRef.current) return;
              const inputData = event.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => {
                 if (s && !isClosingRef.current) s.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);

            frameIntervalRef.current = window.setInterval(() => {
              if (videoRef.current && canvasRef.current && !isClosingRef.current && sessionRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  canvas.width = 320; 
                  canvas.height = 240;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
                  const base64Data = dataUrl.split(',')[1];
                  
                  setIsAnalyzing(true);
                  setTimeout(() => setIsAnalyzing(false), 200);

                  sessionPromise.then(s => {
                    if (s && !isClosingRef.current) s.sendRealtimeInput({
                      media: { data: base64Data, mimeType: 'image/jpeg' }
                    });
                  });
                }
              }
            }, 3000);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsExaminerSpeaking(true);
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsExaminerSpeaking(false);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputTextRef.current += text;
              setCurrentOutputText(prev => prev + text);
            } else if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputTextRef.current += text;
              setCurrentInputText(prev => prev + text);
            }

            if (message.serverContent?.turnComplete) {
              const finalInput = currentInputTextRef.current;
              const finalOutput = currentOutputTextRef.current;
              
              setTranscriptions(prev => {
                const next = [...prev];
                if (finalInput) {
                  next.push({ 
                    role: 'user', 
                    text: finalInput, 
                    timestamp: Date.now(),
                    avatar: '👤',
                    senderName: 'Candidate'
                  });
                }
                if (finalOutput) {
                  next.push({ 
                    role: 'examiner', 
                    text: finalOutput, 
                    timestamp: Date.now(),
                    avatar: selectedPersona.icon,
                    senderName: selectedPersona.label
                  });
                }
                return next;
              });
              
              currentInputTextRef.current = '';
              currentOutputTextRef.current = '';
              setCurrentInputText('');
              setCurrentOutputText('');
            }

            if (message.serverContent?.interrupted) {
              for (const source of sourcesRef.current.values()) {
                try { source.stop(); } catch(e) {}
              }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsExaminerSpeaking(false);
            }
          },
          onerror: async (e: any) => {
            console.error("Session Error:", e);
            setErrorMessage("System error. Restarting...");
            setTimeout(startSession, 1500);
          },
          onclose: () => {
            setIsActive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          thinkingConfig: { thinkingBudget: 0 },
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: selectedPersona.voiceName 
              } 
            } 
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are a Board Physics Examiner for Class ${classLevel}. 
          Language: Hinglish (Hindi + English). Technical terms MUST be in English.
          Persona: ${selectedPersona.instruction}
          Difficulty: ${difficultyInstructions[difficulty]}
          ${syllabusFocus}
          Goal: Conduct a concise, high-speed ${Math.floor(initialTimeSeconds / 60)}-minute viva. Ask questions STRICTLY from the Class ${classLevel} syllabus. Observe the camera feed for any diagrams or equipment shown and ask questions about them.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Connection Catch:", err);
      setErrorMessage("Microphone/Camera access error.");
      onStatusChange(ExamStatus.ERROR);
    }
  }, [onStatusChange, selectedPersona, difficulty, classLevel, stopActiveSession, initialTimeSeconds]);

  useEffect(() => {
    isClosingRef.current = false;
    startSession();
    return () => {
      isClosingRef.current = true;
      stopActiveSession();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [selectedPersonaId, startSession, stopActiveSession]);

  return (
    <div className="w-full max-w-7xl min-h-[80vh] grid lg:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-700">
      
      {/* Sidebar: Examiner & Personas */}
      <div className="lg:col-span-1 flex flex-col space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/30 via-transparent to-transparent"></div>
          </div>
          
          <div className={`w-24 h-24 rounded-full border-2 ${isExaminerSpeaking ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'border-slate-800'} transition-all flex items-center justify-center bg-slate-950 overflow-hidden relative group`}>
            {isExaminerSpeaking ? <div className="px-4 w-full h-10"><AudioVisualizer isSpeaking={true} /></div> : 
              <span className="text-4xl group-hover:scale-110 transition-transform">
                {selectedPersona.icon}
              </span>
            }
          </div>

          <div className="space-y-1 z-10">
            <h3 className="text-lg font-bold tracking-tight text-indigo-50">{selectedPersona.label}</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Physics Evaluator • Class {classLevel}</p>
          </div>

          <div className="w-full space-y-2 z-10">
            <div className="grid grid-cols-5 gap-1.5">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersonaId(p.id)}
                  title={p.label}
                  className={`p-2 rounded-lg text-sm transition-all border ${
                    selectedPersonaId === p.id 
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p.icon}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-indigo-300/60 font-medium leading-relaxed min-h-[3em]">
              {selectedPersona.description}
            </p>
          </div>

          <div className={`w-full p-3 rounded-xl flex items-center justify-between border transition-all ${timeLeft < 60 ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-950 border-slate-800'}`}>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Remaining</span>
            <span className={`font-mono font-bold text-sm ${timeLeft < 60 ? 'text-red-400 animate-pulse' : 'text-indigo-400'}`}>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Vision Feed */}
        <div className="h-64 lg:flex-grow bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden relative group shadow-inner">
           <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className={`w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 ${isAnalyzing ? 'brightness-125 saturate-150' : ''}`} 
           />
           
           <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className={`w-full h-[1px] bg-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,1)] absolute transition-all duration-[2000ms] ease-in-out ${isAnalyzing ? 'top-[95%] opacity-100' : 'top-0 opacity-0'} animate-scan`} />
              <div className="absolute top-4 left-4 flex items-center space-x-2">
                 <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                 <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest bg-black/40 px-2 py-1 rounded backdrop-blur-sm">SECURE FEED</span>
              </div>
           </div>
           <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

      {/* Main Protocol Log */}
      <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col shadow-2xl relative min-h-[60vh] lg:min-h-0">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 backdrop-blur-md rounded-t-3xl">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Board Transcript Feed • Class {classLevel}</span>
          </div>
          {errorMessage && (
            <div className="text-[10px] font-bold text-red-400 animate-pulse bg-red-900/20 px-3 py-1 rounded-full border border-red-900/40">
              {errorMessage}
            </div>
          )}
        </div>

        <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent max-h-[50vh] lg:max-h-[60vh]">
          {transcriptions.length === 0 && !currentInputText && !currentOutputText && (
            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30 text-center px-10 py-20">
               <svg className="w-12 h-12 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
               </svg>
               <p className="text-xs font-mono uppercase tracking-widest">
                 {isActive ? "Examiner is listening..." : "Connecting to Board Protocol..."}
               </p>
            </div>
          )}
          {transcriptions.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end space-x-3 space-x-reverse animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              {/* Avatar Circle */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center bg-slate-950 text-xl shadow-lg ${t.role === 'user' ? 'ml-2 ring-2 ring-indigo-500/20' : 'mr-2 ring-2 ring-slate-700/50'}`}>
                {t.avatar}
              </div>
              
              <div className={`max-w-[75%] p-4 rounded-2xl ${t.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-900/20' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none shadow-black/20'} shadow-md`}>
                <div className="flex justify-between items-center mb-1.5 border-b border-white/10 pb-1">
                   <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      {t.senderName}
                   </span>
                   <span className="text-[9px] opacity-40 font-mono">
                      {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{t.text}</p>
              </div>
            </div>
          ))}
          
          {currentInputText && (
            <div className="flex flex-row-reverse items-end space-x-3 space-x-reverse animate-pulse">
               <div className="flex-shrink-0 w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center bg-slate-950 text-xl ml-2 ring-2 ring-indigo-500/20">👤</div>
               <div className="max-w-[75%] p-4 rounded-2xl bg-indigo-600/50 text-white/70 rounded-br-none italic text-sm border border-indigo-500/30">{currentInputText}</div>
            </div>
          )}
          
          {currentOutputText && (
            <div className="flex flex-row items-end space-x-3 animate-pulse">
               <div className="flex-shrink-0 w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center bg-slate-950 text-xl mr-2 ring-2 ring-slate-700/50">{selectedPersona.icon}</div>
               <div className="max-w-[75%] p-4 rounded-2xl bg-slate-800/50 text-slate-400 rounded-bl-none italic text-sm border border-slate-700/30">{currentOutputText}</div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950/60 rounded-b-3xl flex items-center space-x-6">
          <div className="flex-grow h-12">
             <AudioVisualizer isSpeaking={isActive && (isExaminerSpeaking || !!currentInputText)} />
          </div>
          <button 
            onClick={() => onEnd(transcriptions)} 
            className="px-8 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 rounded-xl font-bold transition-all text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-red-900/10"
          >
            End Session
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: 100%; }
        }
        .animate-scan {
          animation: scan 4s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ExamRoom;