
import React from 'react';
import { MapMarker } from '../types';

const MARKERS: MapMarker[] = [
  { id: '1', label: 'HOME', type: 'home', x: '30%', y: '30%', color: '#2a9d8f', icon: 'flag' },
  { id: '2', label: 'CASTLE', type: 'castle', x: '65%', y: '65%', color: '#e63946', icon: 'fort' }
];

const Map: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full bg-[#1a1a1a]">
      {/* Background Pixel Map */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-70"
        style={{ 
          backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBtxoFBKScaGiSW2i6rFv05GuZ-G3nFaeDvmBkZRy_Rae__kx7bjewaeNSUd5QioJyaQDH_2BVKpoXNyk0vwqrYAcEk2XRhqrayqywMgtdXjphrzppZlAF2f9iPcE1F2pGvkWPXA2jvgFB-PX7HJ7WQ-MV9Wg28fqe5cNOLS4L8VHx7G32dKJ5IJxyWX00ZCavPAnrWTHEf6QczInwaPWYCtGthV_KMJTCHzkevLI6P2n1zlf9y8fg82yDdHFX2uKVNTpRAG_nWvFA')",
          imageRendering: 'pixelated'
        }}
      />
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')]"></div>

      {/* Route Line SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path 
          d="M 120 180 Q 180 350 260 480" 
          fill="none" 
          stroke="#eea02b" 
          strokeWidth="4" 
          strokeDasharray="8 8" 
          strokeLinecap="round"
          className="animate-dash"
          style={{ filter: 'url(#glow)' }}
        />
      </svg>

      {/* Pins */}
      {MARKERS.map(marker => (
        <div 
          key={marker.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: marker.x, top: marker.y }}
        >
          <div 
            className="border-2 border-white p-1 shadow-retro-sm mb-1 z-10 scale-110"
            style={{ backgroundColor: marker.color }}
          >
            <span className="material-symbols-outlined text-white text-lg">{marker.icon}</span>
          </div>
          <div 
            className="bg-black/80 px-2 py-0.5 text-[10px] font-bold border"
            style={{ color: marker.color, borderColor: `${marker.color}44` }}
          >
            {marker.label}
          </div>
        </div>
      ))}

      {/* Map Controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-3 z-10">
        <div className="flex flex-col shadow-retro-sm">
          <button className="flex size-10 items-center justify-center bg-retro-dark border-2 border-white hover:bg-[#393228] active:bg-primary transition-colors">
            <span className="material-symbols-outlined text-white">add</span>
          </button>
          <button className="flex size-10 items-center justify-center bg-retro-dark border-2 border-white border-t-0 hover:bg-[#393228] active:bg-primary transition-colors">
            <span className="material-symbols-outlined text-white">remove</span>
          </button>
        </div>
        <button className="flex size-10 items-center justify-center bg-primary border-2 border-white shadow-retro-sm hover:brightness-110 active:scale-95 transition-all text-black">
          <span className="material-symbols-outlined">navigation</span>
        </button>
      </div>
    </div>
  );
};

export default Map;
