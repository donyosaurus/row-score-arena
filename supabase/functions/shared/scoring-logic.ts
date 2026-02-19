// Shared Scoring Logic - Extracted for direct use without HTTP calls

export const FINISH_POINTS: Record<number, number> = {
  1: 100,
  2: 75,
  3: 60,
  4: 45,
  5: 30,
  6: 15,
  7: 10,
};

export function getFinishPoints(position: number): number {
  if (position < 1) return 0;
  if (position >= 7) return 10; // 7th place and beyond get 10 points
  return FINISH_POINTS[position] || 10;
}

export function calculateMarginBonus(predictedMargin: number, actualMargin: number): number {
  if (actualMargin === undefined || actualMargin === null) return 0;
  const error = Math.abs(predictedMargin - actualMargin);
  const bonus = Math.max(0, 20 - Math.floor(error / 0.5) * 2);
  return bonus;
}

/**
 * Parse race time string "MM:SS.ms" into total seconds (float)
 */
export function parseRaceTime(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const match = timeStr.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (!match) {
    console.warn("[parseRaceTime] Invalid time format:", timeStr);
    return 0;
  }
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const milliseconds = match[3] ? parseInt(match[3].padEnd(2, "0").slice(0, 2), 10) : 0;
  return minutes * 60 + seconds + milliseconds / 100;
}

/**
 * Calculate official margin between 1st and 2nd place crews
 */
export function calculateOfficialMargin(
  crews: Array<{ crew_id: string; manual_finish_order: number | null; manual_result_time: string | null }>,
): number {
  const sortedCrews = crews
    .filter((c) => c.manual_finish_order !== null)
    .sort((a, b) => (a.manual_finish_order ?? 999) - (b.manual_finish_order ?? 999));

  if (sortedCrews.length < 2) return 0;

  const firstPlaceTime = parseRaceTime(sortedCrews[0].manual_result_time || "");
  const secondPlaceTime = parseRaceTime(sortedCrews[1].manual_result_time || "");

  if (firstPlaceTime === 0 || secondPlaceTime === 0) return 0;

  return Math.round(Math.abs(secondPlaceTime - firstPlaceTime) * 100) / 100;
}

export interface RaceResult {
  crewId: string;
  eventId: string;
  finishOrder: number;
  actualMargin?: number;
}

interface EntryPick {
  crewId: string;
  event_id?: string;
  predictedMargin: number;
}

/**
 * Score a contest pool — calculates points and rankings for all entries
 */
export async function scoreContestPool(
  supabase: any,
  contestPoolId: string,
  results: RaceResult[],
): Promise<{ entriesScored: number; winnerId?: string }> {
  console.log("[scoring-logic] Processing results for pool:", contestPoolId);

  const { data: pool, error: poolError } = await supabase
    .from("contest_pools")
    .select("*, contest_templates(*)")
    .eq("id", contestPoolId)
    .single();

  if (poolError || !pool) throw new Error("Contest pool not found");

  // Accept entries in any active-equivalent status
  const { data: entries, error: entriesError } = await supabase
    .from("contest_entries")
    .select("*")
    .eq("pool_id", contestPoolId)
    .in("status", ["active", "confirmed", "scored"]);

  if (entriesError || !entries) throw new Error("Failed to fetch entries");

  if (entries.length === 0) {
    console.log("[scoring-logic] No entries to score");
    return { entriesScored: 0 };
  }

  console.log("[scoring-logic] Scoring", entries.length, "entries");

  const resultMap = new Map<string, RaceResult>();
  for (const r of results) {
    resultMap.set(r.crewId, r);
  }

  interface EntryScore {
    entry_id: string;
    user_id: string;
    total_points: number;
    margin_error: number; // lower is better — used only as tiebreaker
    rank?: number;
    payout_cents?: number;
    is_tiebreak_resolved?: boolean;
    is_winner?: boolean;
    crew_scores: any[];
  }

  const scores: EntryScore[] = [];

  for (const entry of entries) {
    let picks: EntryPick[] = [];
    try {
      if (Array.isArray(entry.picks)) {
        picks = entry.picks.map((p: any) => {
          if (typeof p === "string") return { crewId: p, predictedMargin: 0 };
          return { crewId: p.crewId, predictedMargin: p.predictedMargin || 0 };
        });
      }
    } catch (e) {
      console.error("[scoring-logic] Failed to parse picks for entry:", entry.id, e);
      continue;
    }

    let totalPoints = 0;
    let totalMarginError = 0;
    const crewScores = [];

    for (const pick of picks) {
      const result = resultMap.get(pick.crewId);
      if (result) {
        const finishPoints = getFinishPoints(result.finishOrder);
        totalPoints += finishPoints;

        // Margin is ONLY used as tiebreaker — not added to points
        let marginError = 0;
        if (result.actualMargin !== undefined && pick.predictedMargin > 0) {
          marginError = Math.abs(pick.predictedMargin - result.actualMargin);
          totalMarginError += marginError;
        }

        crewScores.push({
          crew_id: pick.crewId,
          event_id: result.eventId,
          predicted_margin: pick.predictedMargin,
          actual_margin: result.actualMargin,
          finish_order: result.finishOrder,
          finish_points: finishPoints,
          margin_error: marginError,
        });
      } else {
        console.warn("[scoring-logic] No result found for crew:", pick.crewId);
        crewScores.push({
          crew_id: pick.crewId,
          predicted_margin: pick.predictedMargin,
          finish_order: null,
          finish_points: 0,
          margin_error: 0,
        });
      }
    }

    scores.push({
      entry_id: entry.id,
      user_id: entry.user_id,
      total_points: totalPoints,
      margin_error: totalMarginError,
      crew_scores: crewScores,
    });
  }

  // Sort: highest points wins. If tied, lowest margin error wins (tiebreaker).
  scores.sort((a, b) => {
    if (a.total_points !== b.total_points) return b.total_points - a.total_points;
    return a.margin_error - b.margin_error; // lower error wins tiebreak
  });

  // Assign ranks
  let currentRank = 1;
  for (let i = 0; i < scores.length; i++) {
    if (i > 0) {
      const prev = scores[i - 1];
      const curr = scores[i];
      const isTied = prev.total_points === curr.total_points && prev.margin_error === curr.margin_error;
      scores[i].rank = isTied ? scores[i - 1].rank : currentRank;
      scores[i].is_tiebreak_resolved = prev.total_points === curr.total_points && !isTied;
    } else {
      scores[i].rank = 1;
      scores[i].is_tiebreak_resolved = false;
    }
    currentRank++;
  }

  const winnerIds = scores.filter((s) => s.rank === 1).map((s) => s.user_id);

  const prizePool = pool.prize_pool_cents || 0;
  const prizeStructure = pool.payout_structure || { 1: prizePool };

  for (const score of scores) {
    score.payout_cents = (prizeStructure as Record<number, number>)[score.rank!] || 0;
    score.is_winner = score.rank === 1;
  }

  // Upsert scores
  for (const score of scores) {
    const { error: upsertError } = await supabase.from("contest_scores").upsert(
      {
        entry_id: score.entry_id,
        instance_id: contestPoolId,
        user_id: score.user_id,
        total_points: score.total_points,
        margin_bonus: 0, // margin is tiebreaker only, not a bonus
        rank: score.rank,
        payout_cents: score.payout_cents,
        is_tiebreak_resolved: score.is_tiebreak_resolved,
        is_winner: score.is_winner,
        crew_scores: score.crew_scores,
      },
      { onConflict: "entry_id" },
    );

    if (upsertError) console.error("[scoring-logic] Error upserting score:", upsertError);

    await supabase
      .from("contest_entries")
      .update({
        total_points: score.total_points,
        rank: score.rank,
        payout_cents: score.payout_cents,
        status: "scored",
      })
      .eq("id", score.entry_id);
  }

  await supabase
    .from("contest_pools")
    .update({ status: "scoring_completed", winner_ids: winnerIds })
    .eq("id", contestPoolId);

  await supabase.from("compliance_audit_logs").insert({
    event_type: "contest_scored",
    severity: "info",
    description: `Contest scored: ${pool.contest_templates?.regatta_name || "Unknown"} - Pool ${contestPoolId}`,
    metadata: { contest_pool_id: contestPoolId, entries_scored: scores.length, winner_ids: winnerIds },
  });

  console.log("[scoring-logic] Scoring complete for pool:", contestPoolId);
  return { entriesScored: scores.length, winnerId: winnerIds[0] };
}
