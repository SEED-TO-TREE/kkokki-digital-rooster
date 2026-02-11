import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  Coffee, 
  Bell, 
  Settings, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  ArrowRight
} from 'lucide-react';

const App = () => {
  const [step, setStep] = useState('home'); // home, settings, active
  const [loading, setLoading] = useState(false);
  
  // User Settings State
  const [settings, setSettings] = useState({
    start: '파크시엘아파트',
    end: 'KT 우면연구센터',
    arrivalTime: '08:30',
    prepTime: 30,
    bufferTime: 10
  });

  // Derived Values (Mocked from Engine Logic)
  const [analysis, setAnalysis] = useState({
    travelTime: 32,
    distance: 14.5,
    wakeUpTime: '07:18',
    leaveTime: '07:48',
    status: 'optimal' // optimal, tight, late
  });

  const handleStartOrchestration = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('active');
    }, 1500);
  };

  const renderHome = () => (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-6 pt-12 pb-6">
        <h1 className="text-3xl font-black text-slate-900">Kkokki</h1>
        <p className="text-slate-500 font-medium">좋은 아침을 지휘할 준비가 되었나요?</p>
      </header>

      <main className="flex-1 px-6 space-y-6">
        {/* Status Card */}
        <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-[32px] p-6 text-white shadow-xl shadow-orange-200">
          <div className="flex justify-between items-start mb-8">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <Clock className="w-6 h-6" />
            </div>
            <span className="bg-black/10 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">NEXT MORNING</span>
          </div>
          <p className="text-orange-100 text-sm font-semibold mb-1 uppercase tracking-wider">목표 도착 시간</p>
          <h2 className="text-5xl font-black mb-6">{settings.arrivalTime}</h2>
          <div className="flex items-center gap-2 text-orange-50 text-sm font-medium">
            <MapPin className="w-4 h-4 opacity-70" />
            <span>{settings.end}</span>
          </div>
        </div>

        {/* Quick Settings Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Route & Prep</h3>
          
          <button 
            onClick={() => setStep('settings')}
            className="w-full flex items-center justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-2xl">
                <Navigation className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">From - To</p>
                <p className="text-sm font-bold text-slate-700">{settings.start} → {settings.end}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>

          <button 
            onClick={() => setStep('settings')}
            className="w-full flex items-center justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-green-50 p-3 rounded-2xl">
                <Coffee className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Preparation</p>
                <p className="text-sm font-bold text-slate-700">{settings.prepTime}분 소요</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
        </section>
      </main>

      <footer className="p-6 pb-10">
        <button 
          onClick={handleStartOrchestration}
          className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-bold shadow-xl shadow-slate-200 flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              아침 지휘 시작하기
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </footer>
    </div>
  );

  const renderSettings = () => (
    <div className="flex flex-col h-full bg-white animate-in slide-in-from-right-8 duration-300">
      <header className="px-6 pt-12 pb-6 flex items-center gap-4">
        <button onClick={() => setStep('home')} className="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <h2 className="text-xl font-bold">오케스트레이션 설정</h2>
      </header>

      <main className="flex-1 px-6 space-y-8 overflow-y-auto">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">출발지</label>
            <div className="flex items-center bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100 focus-within:border-orange-200 transition-all">
              <MapPin className="w-5 h-5 text-slate-400 mr-3" />
              <input 
                className="bg-transparent outline-none w-full font-semibold text-slate-700"
                value={settings.start}
                onChange={(e) => setSettings({...settings, start: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">목적지</label>
            <div className="flex items-center bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100 focus-within:border-orange-200 transition-all">
              <Navigation className="w-5 h-5 text-slate-400 mr-3" />
              <input 
                className="bg-transparent outline-none w-full font-semibold text-slate-700"
                value={settings.end}
                onChange={(e) => setSettings({...settings, end: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">도착 목표</label>
              <div className="flex items-center bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100">
                <Clock className="w-5 h-5 text-slate-400 mr-3" />
                <input 
                  type="time"
                  className="bg-transparent outline-none w-full font-bold text-slate-700"
                  value={settings.arrivalTime}
                  onChange={(e) => setSettings({...settings, arrivalTime: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">준비 시간(분)</label>
              <div className="flex items-center bg-slate-50 rounded-2xl px-4 py-4 border border-slate-100">
                <Coffee className="w-5 h-5 text-slate-400 mr-3" />
                <input 
                  type="number"
                  className="bg-transparent outline-none w-full font-bold text-slate-700"
                  value={settings.prepTime}
                  onChange={(e) => setSettings({...settings, prepTime: parseInt(e.target.value)})}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-3xl p-5 border border-orange-100">
          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800 leading-relaxed font-medium">
              Kkokki가 실시간 교통 상황을 분석하여 기상 시간을 자동으로 제안할 것입니다.
            </p>
          </div>
        </div>
      </main>

      <footer className="p-6 pb-10">
        <button 
          onClick={() => setStep('home')}
          className="w-full bg-orange-500 text-white py-5 rounded-[24px] font-bold shadow-xl shadow-orange-100"
        >
          설정 저장하기
        </button>
      </footer>
    </div>
  );

  const renderActive = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white animate-in zoom-in-95 duration-500">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Orchestrating...</h2>
          <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live Monitoring
          </div>
        </div>
        <button onClick={() => setStep('home')} className="p-2 bg-white/10 rounded-full">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 px-6 pt-8 space-y-8 overflow-y-auto">
        <div className="text-center space-y-2">
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Recommended Wake-up</p>
          <h3 className="text-7xl font-black text-white">{analysis.wakeUpTime}</h3>
        </div>

        {/* Dynamic Status Display */}
        <div className="bg-white/5 rounded-[32px] p-6 border border-white/10 backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Navigation className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-slate-300">실시간 소요 시간</span>
            </div>
            <span className="text-xl font-black">{analysis.travelTime}분</span>
          </div>

          <div className="h-px bg-white/10 w-full"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="font-semibold text-slate-300">기상 상태</span>
            </div>
            <span className="text-sm font-bold bg-green-500/20 text-green-400 px-3 py-1 rounded-full uppercase">Optimal</span>
          </div>

          <div className="h-px bg-white/10 w-full"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-orange-400" />
              <span className="font-semibold text-slate-300">Slack 연동</span>
            </div>
            <span className="text-sm font-bold text-orange-400">자동 발송 대기</span>
          </div>
        </div>

        {/* Insight Card */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-3xl p-5 flex gap-4">
          <div className="bg-orange-500 p-2 rounded-xl h-fit">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-orange-500 mb-1">Kkokki's Insight</h4>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              내일 아침 {settings.start} 인근에 비 예보가 있습니다. <br/>
              소요 시간이 10분 정도 늘어날 수 있어 기상 알람을 7시 8분으로 당길 예정입니다.
            </p>
          </div>
        </div>
      </main>

      <footer className="p-6 pb-10">
        <button 
          onClick={() => setStep('home')}
          className="w-full bg-white/10 border border-white/10 text-white py-5 rounded-[24px] font-bold"
        >
          오케스트레이션 중단
        </button>
      </footer>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-0 sm:p-4">
      <div className="relative w-full max-w-[430px] h-[100dvh] sm:h-[850px] bg-slate-50 overflow-hidden sm:rounded-[60px] sm:shadow-[0_0_80px_rgba(0,0,0,0.1)] border-[8px] border-slate-900 flex flex-col">
        {/* Dynamic Content */}
        {step === 'home' && renderHome()}
        {step === 'settings' && renderSettings()}
        {step === 'active' && renderActive()}

        {/* iPhone Style Bottom Bar */}
        <div className="h-1 w-32 bg-slate-300 rounded-full mx-auto mb-2 shrink-0"></div>
      </div>
    </div>
  );
};

export default App;