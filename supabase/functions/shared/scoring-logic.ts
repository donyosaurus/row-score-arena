// Shared Scoring Logic - Extracted for direct use without HTTP calls

// Updated Points Distribution per requirements:
// 1st: 100, 2nd: 75, 3rd: 60, 4th: 45, 5th: 35, 6th: 25, 7th: 15, 8th+: 10
export const FINISH_POINTS: Record<number, number> = {
  1: 100,
  2: 75,
  3: 60,
  4: 45,
  5: 35,
  6: 25,
  7: 15,
};

export function getFinishPoints(position: number): number {
  if (position < 1) return 0;
  if (position >= 8) return 10; // 8th place and beyond get 10 points
  return FINISH_POINTS[position] || 10;
}

export function calculateMarginBonus(predictedMargin: number, actualMargin: number): number {
  if (actualMargin === undefined || actualMargin === null) return 0;
  
  const error = Math.abs(predictedMargin - actualMargin);
  // Perfect prediction: 20 bonus points
  // Error reduces bonus: -2 points per 0.5 seconds of error
  // Minimum 0 bonus
  const bonus = Math.max(0, 20 - Math.floor(error / 0.5) * 2);
  return bonus;
}

/**
 * Parse race time string "MM:SS.ms" into total seconds (float)
 * Examples:
 *   "05:30.50" -> 330.50 seconds
 *   "06:15.00" -> 375.00 seconds
 *   "05:30" -> 330.00 seconds (no milliseconds)
 */
export function parseRaceTime(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0;
  }

  // Handle format MM:SS.ms or MM:SS
  const match = timeStr.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (!match) {
    console.warn('[parseRaceTime] Invalid time format:', timeStr);
    return 0;
  }

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const milliseconds = match[3] ? parseInt(match[3].padEnd(2, '0').slice(0, 2), 10) : 0;

  return minutes * 60 + seconds + milliseconds / 100;
}

/**
 * Calculate official margin between 1st and 2nd place crews
 */
export function calculateOfficialMargin(
  crews: Array<{ crew_id: string; manual_finish_order: number | null; manual_result_time: string | null }>
): number {
  // Sort by finish order
  const sortedCrews = crews
    .filter(c => c.manual_finish_order !== null)
    .sort((a, b) => (a.manual_finish_order ?? 999) - (b.manual_finish_order ?? 999));

  if (sortedCrews.length < 2) {
    return 0; // No margin if fewer than 2 crews
  }

  const firstPlaceTime = parseRaceTime(sortedCrews[0].manual_result_time || '');
  const secondPlaceTime = parseRaceTime(sortedCrews[1].manual_result_time || '');

  if (firstPlaceTime === 0 || secondPlaceTime === 0) {
    return 0; // Can't calculate if times are missing/invalid
  }

  return Math.round(Math.abs(secondPlaceTime - firstPlaceTime) * 100) / 100;
}

// Race result interface for scoring - uses eventId instead of divisionId
export interface RaceResult {
  crewId: string;
  eventId: string;
  finishOrder: number;
  actualMargin?: number; // Only for 1st place finishers
}

// Entry pick interface (as stored in contest_entries.picks)
interface EntryPick {
  crewId: string;
  predictedMargin: number;
}

/**
 * Score a contest pool by calculating points and rankings for all entries
 * Uses contest_pools table instead of contest_instances
 */
export async function scoreContestPool(
  supabase: any,
  contestPoolId: string,
  results: RaceResult[]
): Promise<{ entriesScored: number; winnerId?: string }> {
  console.log('[scoring-logic] Processing results for pool:', contestPoolId);

  // Get pool details
  const { data: pool, error: poolError } = await supabase
    .from('contest_pools')
    .select('*, contest_templates(*)')
    .eq('id', contestPoolId)
    .single();

  if (poolError || !pool) {
    throw new Error('Contest pool not found');
  }

  // Get all entries for this pool (using pool_id column)
  const { data: entries, error: entriesError } = await supabase
    .from('contest_entries')
    .select('*')
    .eq('pool_id', contestPoolId)
    .eq('status', 'confirmed');

  if (entriesError || !entries) {
    throw new Error('Failed to fetch entries');
  }

  if (entries.length === 0) {
    console.log('[scoring-logic] No entries to score');
    return { entriesScored: 0 };
  }

  console.log('[scoring-logic] Scoring', entries.length, 'entries');

  // Build a map of crewId -> result for quick lookup
  const resultMap = new Map<string, RaceResult>();
  for (const r of results) {
    resultMap.set(r.crewId, r);
  }

  // Score each entry
  interface EntryScore {
    entry_id: string;
    user_id: string;
    total_points: number;
    margin_bonus: number;
    rank?: number;
    payout_cents?: number;
    is_tiebreak_resolved?: boolean;
    is_winner?: boolean;
    crew_scores: any[];
  }
  
  const scores: EntryScore[] = [];
  
  for (const entry of entries) {
    let picks: EntryPick[] = [];
    
    // Parse picks - handle both old and new formats
    try {
      if (Array.isArray(entry.picks)) {
        picks = entry.picks.map((p: any) => {
          if (typeof p === 'string') {
            return { crewId: p, predictedMargin: 0 };
          }
          return { crewId: p.crewId, predictedMargin: p.predictedMargin || 0 };
        });
      }
    } catch (e) {
      console.error('[scoring-logic] Failed to parse picks for entry:', entry.id, e);
      continue;
    }

    let totalPoints = 0;
    let totalMarginBonus = 0;
    const crewScores = [];

    for (const pick of picks) {
      const result = resultMap.get(pick.crewId);

      if (result) {
        // Calculate finish points (primary scoring)
        const finishPoints = getFinishPoints(result.finishOrder);
        totalPoints += finishPoints;

        // Calculate margin bonus - only for 1st place finishers with predicted margin
        let marginBonus = 0;
        if (result.finishOrder === 1 && result.actualMargin !== undefined && pick.predictedMargin > 0) {
          marginBonus = calculateMarginBonus(pick.predictedMargin, result.actualMargin);
          totalMarginBonus += marginBonus;
        }

        crewScores.push({
          crew_id: pick.crewId,
          event_id: result.eventId,
          predicted_margin: pick.predictedMargin,
          actual_margin: result.actualMargin,
          finish_order: result.finishOrder,
          finish_points: finishPoints,
          margin_bonus: marginBonus,
        });
      } else {
        console.warn('[scoring-logic] No result found for crew:', pick.crewId);
        crewScores.push({
          crew_id: pick.crewId,
          predicted_margin: pick.predictedMargin,
          finish_order: null,
          finish_points: 0,
          margin_bonus: 0,
        });
      }
    }

    scores.push({
      entry_id: entry.id,
      user_id: entry.user_id,
      total_points: totalPoints,
      margin_bonus: totalMarginBonus,
      crew_scores: crewScores,
    });
  }

  // Sort by total points (descending), then by margin bonus (descending)
  scores.sort((a, b) => {
    if (a.total_points !== b.total_points) {
      return b.total_points - a.total_points;
    }
    return b.margin_bonus - a.margin_bonus;
  });

  // Assign ranks
  let currentRank = 1;
  for (let i = 0; i < scores.length; i++) {
    if (i > 0) {
      const prev = scores[i - 1];
      const curr = scores[i];
      
      // Check if tied
      if (prev.total_points === curr.total_points && 
          prev.margin_bonus === curr.margin_bonus) {
        // Same rank as previous
        scores[i].rank = scores[i - 1].rank;
        scores[i].is_tiebreak_resolved = false;
      } else {
        scores[i].rank = currentRank;
        scores[i].is_tiebreak_resolved = prev.total_points === curr.total_points;
      }
    } else {
      scores[i].rank = 1;
      scores[i].is_tiebreak_resolved = false;
    }
    currentRank++;
  }

  // Determine winners (rank 1)
  const winnerIds = scores
    .filter(s => s.rank === 1)
    .map(s => s.user_id);

  // Calculate payouts based on prize structure
  const prizePool = pool.prize_pool_cents || 0;
  const prizeStructure = pool.prize_structure || { 1: 1.0 }; // Default: winner takes all

  for (const score of scores) {
    const payoutPercent = (prizeStructure as Record<number, number>)[score.rank!] || 0;
    score.payout_cents = Math.floor(prizePool * payoutPercent);
    score.is_winner = score.rank === 1;
  }

  // Insert/update scores - using instance_id column (which maps to pool)
  for (const score of scores) {
    const { error: upsertError } = await supabase
      .from('contest_scores')
      .upsert({
        entry_id: score.entry_id,
        instance_id: contestPoolId, // Using instance_id column for pool reference
        user_id: score.user_id,
        total_points: score.total_points,
        margin_bonus: score.margin_bonus,
        rank: score.rank,
        payout_cents: score.payout_cents,
        is_tiebreak_resolved: score.is_tiebreak_resolved,
        is_winner: score.is_winner,
        crew_scores: score.crew_scores,
      }, { onConflict: 'entry_id' });

    if (upsertError) {
      console.error('[scoring-logic] Error upserting score:', upsertError);
    }

    // Also update the contest_entries table with score summary
    await supabase
      .from('contest_entries')
      .update({
        total_points: score.total_points,
        rank: score.rank,
        payout_cents: score.payout_cents,
        status: 'scored',
      })
      .eq('id', score.entry_id);
  }

  // Update pool status
  await supabase
    .from('contest_pools')
    .update({ 
      status: 'scoring_completed',
      winner_ids: winnerIds,
    })
    .eq('id', contestPoolId);

  // Log to compliance
  await supabase.from('compliance_audit_logs').insert({
    event_type: 'contest_scored',
    severity: 'info',
    description: `Contest scored: ${pool.contest_templates?.regatta_name || 'Unknown'} - Pool ${contestPoolId}`,
    metadata: {
      contest_pool_id: contestPoolId,
      entries_scored: scores.length,
      winner_ids: winnerIds,
      winner_points: scores[0]?.total_points,
    },
  });

  console.log('[scoring-logic] Scoring complete for pool:', contestPoolId);

  return {
    entriesScored: scores.length,
    winnerId: winnerIds[0],
  };
}
