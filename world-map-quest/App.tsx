
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Map from './components/Map';
import QuestInfo from './components/QuestInfo';
import BottomNav from './components/BottomNav';
import { TransportMode, QuestData } from './types';
import { getQuestInsights } from './services/geminiService';

const App: React.FC = () => {
  const [transport, setTransport] = useState<TransportMode>(TransportMode.CAR);
  const [searchQuery, setSearchQuery] = useState('');
  const [questData, setQuestData] = useState<QuestData>({
    title: 'Quest Route',
    time: '25 min',
    destination: 'Castle Office',
    status: 'Heavy traffic on Dragon Bridge.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBX4fEWng4TLpNYrJrI-R9kd7wb6Gn5ElgVPP83j3RSs7ytmDXme6OKxLoSidWfP_NPv2BVXaSi5V53i8kH5NE6EeWR7N6rzaqACnsOAHJlgo7CKw48qmtf8mekpsb17dLoPBWLtTRqhhh1glKxlVzsHd0vxRczyLfjWdyOpV1wvEuM0ntmoBEuwBHdpMKmrEnzl890nxqfsNhDDfNeKQ38X25JQqaIbUgZNqBLlIclcbAhTQPZj4Br4oew0pE1klyYm70uMMjHNII'
  });

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 3) {
      const insights = await getQuestInsights(query);
      if (insights) {
        setQuestData({
          ...questData,
          title: insights.title || 'Quest Route',
          status: insights.status || 'Scouting path...',
          time: insights.timeEstimate || '15 min',
          destination: query
        });
      }
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-dark max-w-md mx-auto border-x border-zinc-800 overflow-hidden relative">
      <Header onSearch={handleSearch} />
      
      <main className="flex-1 relative overflow-hidden">
        <Map />
        
        <div className="absolute bottom-0 w-full z-10">
          <div className="px-4 pb-4 pt-12 bg-gradient-to-t from-black via-black/90 to-transparent">
            {/* Transport Selector */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar mb-4 py-2">
              <TransportButton 
                mode={TransportMode.CAR} 
                active={transport === TransportMode.CAR} 
                onClick={() => setTransport(TransportMode.CAR)}
                icon="directions_car"
              />
              <TransportButton 
                mode={TransportMode.SUBWAY} 
                active={transport === TransportMode.SUBWAY} 
                onClick={() => setTransport(TransportMode.SUBWAY)}
                icon="directions_subway"
              />
              <TransportButton 
                mode={TransportMode.BIKE} 
                active={transport === TransportMode.BIKE} 
                onClick={() => setTransport(TransportMode.BIKE)}
                icon="pedal_bike"
              />
            </div>

            <QuestInfo data={questData} />
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

interface TransportBtnProps {
  mode: TransportMode;
  active: boolean;
  onClick: () => void;
  icon: string;
}

const TransportButton: React.FC<TransportBtnProps> = ({ mode, active, onClick, icon }) => (
  <button 
    onClick={onClick}
    className={`flex h-10 shrink-0 items-center justify-center gap-x-2 border-2 px-4 shadow-retro-sm transition-all transform active:translate-y-1 active:shadow-none ${
      active ? 'bg-primary border-white text-black font-bold' : 'bg-retro-dark border-[#b9ae9d] text-white'
    }`}
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
    <span className="text-sm uppercase tracking-wider">{mode}</span>
  </button>
);

export default App;
