// Shared Scoring Logic - Extracted for direct use without HTTP calls

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

// Scoring rules
const FINISH_POINTS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 3,
  4: 0,
  5: 0,
  6: 0,
  7: 0,
};

function getFinishPoints(position: number): number {
  return FINISH_POINTS[position] || 0;
}

function calculateMarginBonus(predictedMargin: number, actualMargin: number): number {
  const error = Math.abs(predictedMargin - actualMargin);
  const bonus = Math.max(0, 10 - error);
  return Math.min(10, bonus);
}

export interface RaceResult {
  crewId: string;
  divisionId: string;
  finishPosition: number;
  finishTime?: number | string;
  marginSeconds?: number;
}

export async function scoreContestInstance(
  supabase: any,
  instanceId: string,
  results: RaceResult[]
): Promise<{ entriesScored: number; winnerId?: string }> {
  console.log('[scoring-logic] Processing results for instance:', instanceId);

  // Get instance
  const { data: instance, error: instanceError } = await supabase
    .from('contest_instances')
    .select('*, contest_templates(*)')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance) {
    throw new Error('Contest instance not found');
  }

  // Get all entries for this instance
  const { data: entries, error: entriesError } = await supabase
    .from('contest_entries')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('status', 'active');

  if (entriesError || !entries) {
    throw new Error('Failed to fetch entries');
  }

  console.log('[scoring-logic] Scoring', entries.length, 'entries');

  // Score each entry
  interface EntryScore {
    entry_id: string;
    user_id: string;
    total_points: number;
    margin_bonus: number;
    rank?: number;
    is_tiebreak_resolved?: boolean;
    crew_scores: any[];
  }
  
  const scores: EntryScore[] = [];
  for (const entry of entries) {
    const picks = entry.picks as any[];
    let totalPoints = 0;
    let totalMarginBonus = 0;
    const crewScores = [];

    for (const pick of picks) {
      // Find result for this crew
      const result = results.find(
        r => r.crewId === pick.crewId && r.divisionId === pick.divisionId
      );

      if (result) {
        // Calculate finish points (primary scoring)
        const finishPoints = getFinishPoints(result.finishPosition);
        totalPoints += finishPoints;

        // Calculate margin bonus (tie-breaker only)
        let marginBonus = 0;
        if (result.marginSeconds !== undefined && pick.predictedMargin !== undefined) {
          marginBonus = calculateMarginBonus(pick.predictedMargin, result.marginSeconds);
          totalMarginBonus += marginBonus;
        }

        crewScores.push({
          crew_id: pick.crewId,
          division_id: pick.divisionId,
          predicted_margin: pick.predictedMargin,
          actual_margin: result.marginSeconds,
          finish_position: result.finishPosition,
          finish_points: finishPoints,
          margin_bonus: marginBonus,
        });
      } else {
        console.warn('[scoring-logic] No result found for crew:', pick.crewId);
        crewScores.push({
          crew_id: pick.crewId,
          division_id: pick.divisionId,
          predicted_margin: pick.predictedMargin,
          finish_position: null,
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

  // Insert/update scores
  for (const score of scores) {
    const { error: upsertError } = await supabase
      .from('contest_scores')
      .upsert({
        entry_id: score.entry_id,
        instance_id: instanceId,
        user_id: score.user_id,
        total_points: score.total_points,
        margin_bonus: score.margin_bonus,
        rank: score.rank,
        is_tiebreak_resolved: score.is_tiebreak_resolved,
        crew_scores: score.crew_scores,
      }, { onConflict: 'entry_id' });

    if (upsertError) {
      console.error('[scoring-logic] Error upserting score:', upsertError);
    }
  }

  // Update instance status
  await supabase
    .from('contest_instances')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', instanceId);

  // Log to compliance
  await supabase.from('compliance_audit_logs').insert({
    event_type: 'contest_scored',
    severity: 'info',
    description: `Contest scored: ${instance.contest_templates.regatta_name} - Pool ${instance.pool_number}`,
    metadata: {
      instance_id: instanceId,
      entries_scored: scores.length,
      winner_id: scores[0]?.entry_id,
      winner_points: scores[0]?.total_points,
    },
  });

  console.log('[scoring-logic] Scoring complete for instance:', instanceId);

  return {
    entriesScored: scores.length,
    winnerId: scores[0]?.entry_id,
  };
}
