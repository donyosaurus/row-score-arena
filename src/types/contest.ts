// Contest and Draft Types for Multi-Team Fantasy Format

export type ContestType = "H2H" | "SMALL_FIELD" | "FULL_REGATTA";

export interface Division {
  id: string;
  name: string;
  boatClass: string; // e.g., "Varsity 8+", "Lightweight 4+"
  category: string; // e.g., "Men's", "Women's", "Lightweight Men's"
}

export interface Crew {
  id: string;
  name: string;
  institution: string;
  divisionId: string;
  seedPosition?: number;
}

export interface DraftPick {
  crewId: string;
  divisionId: string;
  predictedFinish: number; // 1-7+
  predictedMargin: number; // seconds relative to 2nd place
}

export interface Contest {
  id: string;
  regattaName: string;
  type: ContestType;
  entryFee: number;
  prize: number;
  capacity: number;
  filled: number;
  lockTime: string;
  minPicks: number; // minimum 2
  maxPicks: number; // typically 2-4
  divisions: Division[];
  crews: Crew[];
}

export interface ContestEntry {
  userId: string;
  contestId: string;
  picks: DraftPick[];
  totalPoints: number;
  marginError: number;
  rank?: number;
}

// Finish position scoring
export const FINISH_POINTS: Record<number, number> = {
  1: 100,
  2: 80,
  3: 65,
  4: 50,
  5: 35,
  6: 20,
  7: 10, // 7th or worse
};

export function getFinishPoints(position: number): number {
  return FINISH_POINTS[position] || 10;
}
