
export enum TransportMode {
  CAR = 'CAR',
  SUBWAY = 'SUBWAY',
  BIKE = 'BIKE'
}

export interface QuestData {
  title: string;
  time: string;
  destination: string;
  status: string;
  imageUrl: string;
}

export interface MapMarker {
  id: string;
  label: string;
  type: 'home' | 'castle';
  x: string;
  y: string;
  color: string;
  icon: string;
}
