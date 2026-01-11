
import React, { useState } from 'react';
import { DifficultyLevel, ClassLevel } from '../types';

interface WelcomeScreenProps {
  onStart: (difficulty: DifficultyLevel, durationMinutes: number, classLevel: ClassLevel) => void;
  onInstall?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onInstall }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(DifficultyLevel.MEDIUM);
  const [selectedDuration, setSelectedDuration] = useState<number>(15);
  const [selectedClass, setSelectedClass] = useState<ClassLevel>(ClassLevel.XII);

  const difficultyMeta = {
    [DifficultyLevel.EASY]: {
      label: "Easy",
      desc: "Fundamental concepts in simple Hinglish. Forgiving evaluation.",
      color: "border-green-500/30 text-green-400 hover:bg-green-500/10",
      active: "bg-green-500 text-white border-green-400"
    },
    [DifficultyLevel.MEDIUM]: {
      label: "Medium",
      desc: "Standard Board level. Natural Hindi/English mix with technical rigor.",
      color: "border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10",
      active: "bg-indigo-600 text-white border-indigo-400"
    },
    [DifficultyLevel.HARD]: {
      label: "Hard",
      desc: "Advanced derivations and theoretical edge cases. High pressure Hinglish.",
      color: "border-red-500/30 text-red-400 hover:bg-red-500/10",
      active: "bg-red-600 text-white border-red-400"
    }
  };

  const durations = [5, 10, 15];

  return (
    <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-12 items-center animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 py-8">
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              Board Final Examination
            </div>
            <div className="inline-block px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
              Installable PWA App
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Master Your <span className="text-indigo-500">Physics Viva</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-lg">
            A professional External Examiner simulation.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Academic Level</label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.values(ClassLevel) as ClassLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedClass(level)}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all text-center flex flex-col items-center space-y-1 ${
                    selectedClass === level 
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-900/20" 
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span>Class {level}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Select Difficulty</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.values(DifficultyLevel) as DifficultyLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedDifficulty(level)}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all text-center flex flex-col items-center space-y-1 ${
                    selectedDifficulty === level 
                      ? difficultyMeta[level].active + " shadow-lg shadow-indigo-900/20" 
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span>{difficultyMeta[level].label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Examination Time</label>
            <div className="grid grid-cols-3 gap-3">
              {durations.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDuration(d)}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all text-center flex flex-col items-center space-y-1 ${
                    selectedDuration === d 
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-900/20" 
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span>{d} Minutes</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button 
            onClick={() => onStart(selectedDifficulty, selectedDuration, selectedClass)}
            className="flex-grow px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-indigo-600/30 flex items-center justify-center space-x-3"
          >
            <span>Begin Examination</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          
          {onInstall && (
            <button 
              onClick={onInstall}
              className="flex-grow px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-lg transition-all border border-slate-700 flex items-center justify-center space-x-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span>Install App</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative group hidden lg:block">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <img 
            src="https://images.unsplash.com/photo-1532187863486-abf9d39d9992?auto=format&fit=crop&q=80&w=800" 
            alt="Physics Lab" 
            className="w-full aspect-square object-cover opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent flex flex-col justify-end p-10">
             <div className="space-y-6">
               <p className="text-indigo-400 font-mono text-lg leading-tight">
                 &quot;Beta, explain karo how Lenz&apos;s Law follows the Law of Conservation of Energy?&quot;
               </p>
               <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">Board Standard PWA</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
