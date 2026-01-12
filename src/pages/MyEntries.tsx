import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, DollarSign, TrendingUp, Users } from "lucide-react";

interface PickNew {
  crewId: string;
  predictedMargin: number;
}

interface Entry {
  id: string;
  created_at: string;
  status: string;
  entry_fee_cents: number;
  pool_id: string;
  picks: PickNew[] | string[] | unknown;
  contest_templates: {
    regatta_name: string;
    lock_time: string;
  };
  contest_pools: {
    status: string;
    prize_pool_cents: number;
    max_entries: number;
    current_entries: number;
  };
  contest_scores?: Array<{
    rank: number;
    total_points: number;
    margin_bonus: number;
    is_winner: boolean;
    payout_cents: number;
  }>;
}

interface CrewInfo {
  crew_id: string;
  crew_name: string;
  contest_pool_id: string;
}

const MyEntries = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [crewMap, setCrewMap] = useState<Map<string, CrewInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEntries: 0,
    activeEntries: 0,
    totalWinnings: 0,
    winRate: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    loadEntries();
  }, [user, navigate]);

  const loadEntries = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contest_entries')
        .select(`
          id,
          created_at,
          status,
          entry_fee_cents,
          pool_id,
          picks,
          contest_templates!inner (regatta_name, lock_time),
          contest_pools!inner (status, prize_pool_cents, max_entries, current_entries),
          contest_scores (rank, total_points, margin_bonus, is_winner, payout_cents)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading entries:', error);
        return;
      }

      const entriesData = (data || []) as unknown as Entry[];
      setEntries(entriesData);

      // Collect all pool IDs to fetch crew info
      const poolIds = [...new Set(entriesData.map(e => e.pool_id).filter(Boolean))];
      
      if (poolIds.length > 0) {
        const { data: crewsData, error: crewsError } = await supabase
          .from('contest_pool_crews')
          .select('crew_id, crew_name, contest_pool_id')
          .in('contest_pool_id', poolIds);

        if (!crewsError && crewsData) {
          const newCrewMap = new Map<string, CrewInfo>();
          crewsData.forEach(crew => {
            // Key by pool_id + crew_id for uniqueness
            newCrewMap.set(`${crew.contest_pool_id}-${crew.crew_id}`, crew);
          });
          setCrewMap(newCrewMap);
        }
      }

      // Calculate stats
      const completed = entriesData.filter(e => e.contest_pools?.status === 'completed');
      const wins = completed.filter(e => e.contest_scores?.[0]?.is_winner);
      const totalWinnings = completed.reduce(
        (sum, e) => sum + (e.contest_scores?.[0]?.payout_cents || 0),
        0
      );

      setStats({
        totalEntries: entriesData.length,
        activeEntries: entriesData.filter(e => e.status === 'active' && e.contest_pools?.status !== 'completed').length,
        totalWinnings: totalWinnings / 100,
        winRate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
      });
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      open: { label: 'Open', variant: 'default' as const },
      locked: { label: 'Live', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.open;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Parse picks and get crew names with margins
  const getParsedPicks = (entry: Entry): { crewName: string; margin: number | null }[] => {
    const picks = entry.picks;
    if (!picks || !Array.isArray(picks)) return [];

    return picks.map((pick) => {
      // New format: { crewId, predictedMargin }
      if (typeof pick === 'object' && pick !== null && 'crewId' in pick) {
        const pickObj = pick as PickNew;
        const crewInfo = crewMap.get(`${entry.pool_id}-${pickObj.crewId}`);
        return {
          crewName: crewInfo?.crew_name || pickObj.crewId,
          margin: pickObj.predictedMargin,
        };
      }
      // Old format: just crew ID string
      if (typeof pick === 'string') {
        const crewInfo = crewMap.get(`${entry.pool_id}-${pick}`);
        return {
          crewName: crewInfo?.crew_name || pick,
          margin: null,
        };
      }
      return { crewName: 'Unknown', margin: null };
    });
  };

  const activeEntries = entries.filter(
    e => e.status === 'active' && e.contest_pools?.status !== 'completed'
  );
  const completedEntries = entries.filter(
    e => e.contest_pools?.status === 'completed'
  );

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading your entries...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const renderEntryCard = (entry: Entry, showScore = false) => {
    const score = entry.contest_scores?.[0];
    const parsedPicks = getParsedPicks(entry);
    const potentialPrize = entry.contest_pools?.prize_pool_cents 
      ? (entry.contest_pools.prize_pool_cents / 100).toFixed(2)
      : '0.00';

    return (
      <Card key={entry.id}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">
                {entry.contest_templates.regatta_name}
              </CardTitle>
              <CardDescription className="space-y-1">
                <div>
                  Entry Fee: ${(entry.entry_fee_cents / 100).toFixed(2)} • 
                  Prize Pool: ${potentialPrize}
                </div>
                {!showScore && (
                  <div>Locks: {new Date(entry.contest_templates.lock_time).toLocaleString()}</div>
                )}
                {showScore && (
                  <div>Entered: {new Date(entry.created_at).toLocaleDateString()}</div>
                )}
              </CardDescription>
            </div>
            {getStatusBadge(entry.contest_pools?.status || 'open')}
          </div>
        </CardHeader>
        <CardContent>
          {/* Display Picks */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Your Picks ({parsedPicks.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {parsedPicks.map((pick, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm">
                  {pick.crewName}
                  {pick.margin !== null && (
                    <span className="ml-1 text-primary font-semibold">
                      (+{pick.margin.toFixed(1)}s)
                    </span>
                  )}
                </Badge>
              ))}
              {parsedPicks.length === 0 && (
                <span className="text-sm text-muted-foreground">No picks recorded</span>
              )}
            </div>
          </div>

          {/* Show score for completed entries */}
          {showScore && score && (
            <div className="flex items-center gap-4 text-sm pt-3 border-t">
              <span className="font-semibold">Rank: #{score.rank}</span>
              <span>Points: {score.total_points}</span>
              <span>Margin Bonus: +{score.margin_bonus}</span>
              {score.is_winner && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  Won ${(score.payout_cents / 100).toFixed(2)}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 gradient-subtle py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">My Entries</h1>
            <p className="text-muted-foreground">Track your contest history and performance</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEntries}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeEntries}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Winnings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalWinnings.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Entries List */}
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">
                Active ({activeEntries.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedEntries.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">You don't have any active entries</p>
                    <Button onClick={() => navigate('/lobby')} variant="hero">
                      Browse Contests
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                activeEntries.map((entry) => renderEntryCard(entry, false))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No completed entries yet</p>
                  </CardContent>
                </Card>
              ) : (
                completedEntries.map((entry) => renderEntryCard(entry, true))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MyEntries;
