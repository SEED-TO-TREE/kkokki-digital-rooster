
import React from 'react';

const BottomNav: React.FC = () => {
  return (
    <nav className="flex gap-2 border-t-2 border-[#393228] bg-background-dark px-2 pb-8 pt-3 z-20">
      <NavItem icon="swords" label="Quests" />
      <NavItem icon="map" label="Map" active />
      <NavItem icon="backpack" label="Items" />
      <NavItem icon="settings" label="System" />
    </nav>
  );
};

interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active }) => (
  <button className={`group flex flex-1 flex-col items-center justify-center gap-1 transition-all ${active ? 'text-primary' : 'text-[#b9ae9d]'}`}>
    <div className={`flex h-10 w-10 items-center justify-center transition-all ${
      active 
      ? 'bg-retro-dark border-2 border-primary shadow-[2px_2px_0px_0px_rgba(238,160,43,0.4)]' 
      : 'group-hover:bg-retro-dark'
    }`}>
      <span className={`material-symbols-outlined text-2xl ${active ? '' : 'group-hover:scale-110'}`}>{icon}</span>
    </div>
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);

export default BottomNav;
