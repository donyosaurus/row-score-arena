// Contest and Draft Types for Multi-Team Fantasy Format

export type ContestType = "H2H" | "5_PERSON";
export type GenderCategory = "Men's" | "Women's";

export interface EntryTier {
  id: string;
  type: ContestType;
  entryFee: number;
  prize: number;
  capacity: number;
  filled: number;
}

export interface Division {
  id: string;
  name: string;
  boatClass: string; // e.g., "Varsity 8+", "Lightweight 4+"
  category: string; // e.g., "Heavyweight", "Lightweight"
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
  predictedMargin: number; // seconds relative to 2nd place (tie-breaker only)
}

export interface Regatta {
  id: string;
  regattaName: string;
  genderCategory: GenderCategory; // Men's or Women's only
  lockTime: string;
  minPicks: number; // minimum 2
  maxPicks: number; // typically 2-4
  divisions: Division[];
  crews: Crew[];
  entryTiers: EntryTier[]; // The 5 entry options
}

export interface Contest {
  id: string;
  regattaId: string;
  tierId: string;
  userId: string;
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
