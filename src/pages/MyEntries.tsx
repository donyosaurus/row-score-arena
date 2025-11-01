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
import { Trophy, Calendar, DollarSign, TrendingUp } from "lucide-react";

interface Entry {
  id: string;
  created_at: string;
  status: string;
  entry_fee_cents: number;
  contest_templates: {
    regatta_name: string;
    lock_time: string;
  };
  contest_instances: {
    pool_number: string;
    status: string;
  };
  contest_scores?: Array<{
    rank: number;
    total_points: number;
    margin_bonus: number;
    is_winner: boolean;
    payout_cents: number;
  }>;
}

const MyEntries = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
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
          *,
          contest_templates!inner (regatta_name, lock_time),
          contest_instances!inner (pool_number, status),
          contest_scores (rank, total_points, margin_bonus, is_winner, payout_cents)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading entries:', error);
        return;
      }

      setEntries(data as any || []);

      // Calculate stats
      const completed = data?.filter(e => e.contest_instances?.status === 'completed') || [];
      const wins = completed.filter(e => e.contest_scores?.[0]?.is_winner);
      const totalWinnings = completed.reduce(
        (sum, e) => sum + (e.contest_scores?.[0]?.payout_cents || 0),
        0
      );

      setStats({
        totalEntries: data?.length || 0,
        activeEntries: data?.filter(e => e.status === 'active' && e.contest_instances?.status !== 'completed').length || 0,
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
      open: { label: 'Active', variant: 'default' as const },
      locked: { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.open;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const activeEntries = entries.filter(
    e => e.status === 'active' && e.contest_instances?.status !== 'completed'
  );
  const completedEntries = entries.filter(
    e => e.contest_instances?.status === 'completed'
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
                    <p className="text-muted-foreground mb-4">You don't have any active entries</p>
                    <Button onClick={() => navigate('/lobby')} variant="hero">
                      Browse Contests
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                activeEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {entry.contest_templates.regatta_name} - Pool {entry.contest_instances.pool_number}
                          </CardTitle>
                          <CardDescription>
                            Entry Fee: ${(entry.entry_fee_cents / 100).toFixed(2)} • 
                            Locks: {new Date(entry.contest_templates.lock_time).toLocaleString()}
                          </CardDescription>
                        </div>
                        {getStatusBadge(entry.contest_instances.status)}
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedEntries.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No completed entries yet</p>
                  </CardContent>
                </Card>
              ) : (
                completedEntries.map((entry) => {
                  const score = entry.contest_scores?.[0];
                  return (
                    <Card key={entry.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {entry.contest_templates.regatta_name} - Pool {entry.contest_instances.pool_number}
                            </CardTitle>
                            <CardDescription>
                              Entry Fee: ${(entry.entry_fee_cents / 100).toFixed(2)} • 
                              Completed: {new Date(entry.created_at).toLocaleDateString()}
                            </CardDescription>
                            {score && (
                              <div className="mt-2 flex items-center gap-4 text-sm">
                                <span className="font-semibold">Rank: #{score.rank}</span>
                                <span>Points: {score.total_points}</span>
                                {score.is_winner && (
                                  <Badge variant="default" className="bg-green-600">
                                    Won ${(score.payout_cents / 100).toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {getStatusBadge(entry.contest_instances.status)}
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })
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
