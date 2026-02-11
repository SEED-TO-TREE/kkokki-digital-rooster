
import React from 'react';

interface HeaderProps {
  onSearch: (query: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  return (
    <div className="z-20 px-4 pt-6 pb-4 bg-background-dark/95 border-b-2 border-[#393228]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-xl font-bold tracking-widest uppercase flex items-center">
          <span className="text-primary mr-2 text-2xl">⚔️</span>
          WORLD MAP QUEST
        </h1>
        <div className="bg-retro-dark p-2 border border-white/20 rounded-sm hover:border-primary transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-primary">notifications</span>
        </div>
      </div>
      
      <div className="relative flex w-full h-12 shadow-retro-sm">
        <div className="flex w-full flex-1 items-stretch border-2 border-white bg-retro-dark group focus-within:border-primary">
          <div className="text-primary flex items-center justify-center pl-4 pr-2">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input 
            className="flex w-full min-w-0 flex-1 text-white focus:outline-none border-none bg-transparent placeholder:text-[#b9ae9d] px-2 text-sm font-bold tracking-widest uppercase"
            placeholder="SEARCH DESTINATION"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default Header;
