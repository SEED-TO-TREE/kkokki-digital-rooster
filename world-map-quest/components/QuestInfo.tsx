
import React from 'react';
import { QuestData } from '../types';

interface QuestInfoProps {
  data: QuestData;
}

const QuestInfo: React.FC<QuestInfoProps> = ({ data }) => {
  return (
    <div className="w-full bg-retro-dark border-2 border-white p-4 shadow-retro relative mb-2 overflow-hidden">
      {/* Retro Pixel Corners */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-white"></div>
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white"></div>
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white"></div>
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white"></div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-white text-lg font-bold uppercase tracking-wider">{data.title}</h2>
            <span className="bg-retro-accent text-white text-[9px] px-1 font-black animate-pulse">LIVE</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-primary font-bold">
            <span className="material-symbols-outlined text-base">timer</span>
            <span className="text-sm">{data.time} to {data.destination}</span>
          </div>
          
          <p className="text-[#b9ae9d] text-xs font-medium leading-tight">
            {data.status}
          </p>
        </div>

        {/* Thumbnail Preview */}
        <div className="w-24 h-24 bg-[#393228] border-2 border-[#5c5042] p-1 shrink-0 overflow-hidden">
          <div 
            className="w-full h-full bg-cover bg-center grayscale contrast-125 brightness-75 hover:grayscale-0 transition-all duration-500"
            style={{ backgroundImage: `url(${data.imageUrl})` }}
          />
        </div>
      </div>

      <button className="mt-4 flex w-full items-center justify-center h-12 bg-primary border-2 border-white text-black font-bold tracking-widest gap-2 shadow-retro-sm active:translate-y-[2px] active:shadow-none hover:brightness-110 transition-all">
        <span>START ADVENTURE</span>
        <span className="material-symbols-outlined font-black">arrow_forward</span>
      </button>
    </div>
  );
};

export default QuestInfo;
