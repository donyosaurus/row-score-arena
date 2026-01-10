import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, DollarSign, Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PoolCrew {
  id: string;
  crew_id: string;
  crew_name: string;
  event_id: string;
}

interface ContestPool {
  id: string;
  lock_time: string;
  status: string;
  entry_fee_cents: number;
  max_entries: number;
  current_entries: number;
  prize_pool_cents: number;
  contest_templates: {
    regatta_name: string;
    gender_category: string;
    min_picks: number;
    max_picks: number;
  };
  contest_pool_crews: PoolCrew[];
}

const RegattaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Data state
  const [contestPool, setContestPool] = useState<ContestPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedCrews, setSelectedCrews] = useState<string[]>([]);
  const [tiebreakerMargin, setTiebreakerMargin] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch pool data
  useEffect(() => {
    const fetchPoolData = async () => {
      if (!id) {
        setError("No contest ID provided");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("contest_pools")
          .select(`
            *,
            contest_templates (
              regatta_name,
              gender_category,
              min_picks,
              max_picks
            ),
            contest_pool_crews (
              id,
              crew_id,
              crew_name,
              event_id
            )
          `)
          .eq("id", id)
          .single();

        if (fetchError) {
          console.error("Error fetching pool:", fetchError);
          setError("Contest not found");
          setLoading(false);
          return;
        }

        setContestPool(data as ContestPool);
        setLoading(false);
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to load contest");
        setLoading(false);
      }
    };

    fetchPoolData();
  }, [id]);

  // Group crews by event_id (division)
  const crewsByDivision = useMemo(() => {
    if (!contestPool?.contest_pool_crews) return {};
    
    const grouped: Record<string, PoolCrew[]> = {};
    for (const crew of contestPool.contest_pool_crews) {
      if (!grouped[crew.event_id]) {
        grouped[crew.event_id] = [];
      }
      grouped[crew.event_id].push(crew);
    }
    return grouped;
  }, [contestPool?.contest_pool_crews]);

  const divisions = Object.keys(crewsByDivision);

  // Handle crew selection
  const toggleCrewSelection = (crewId: string) => {
    setSelectedCrews(prev => {
      if (prev.includes(crewId)) {
        return prev.filter(id => id !== crewId);
      }
      // Max 10 picks
      if (prev.length >= 10) {
        toast.error("Maximum 10 picks allowed");
        return prev;
      }
      return [...prev, crewId];
    });
  };

  // Check if contest is still open
  const isContestOpen = contestPool?.status === "open" && 
    new Date(contestPool.lock_time) > new Date();

  // Format lock time
  const formattedLockTime = contestPool?.lock_time 
    ? new Date(contestPool.lock_time).toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      })
    : "";

  // Format entry fee
  const entryFeeDollars = contestPool?.entry_fee_cents 
    ? (contestPool.entry_fee_cents / 100).toFixed(2) 
    : "0.00";

  // Submit entry
  const handleSubmitEntry = async () => {
    if (!id || !user) return;

    if (selectedCrews.length < 2) {
      toast.error("Please select at least 2 crews");
      return;
    }

    // Count unique divisions in selection
    const selectedDivisions = new Set<string>();
    for (const crewId of selectedCrews) {
      const crew = contestPool?.contest_pool_crews.find(c => c.crew_id === crewId);
      if (crew) {
        selectedDivisions.add(crew.event_id);
      }
    }

    if (selectedDivisions.size < 2) {
      toast.error("You must select crews from at least 2 different divisions");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("contest-enter", {
        body: {
          contestPoolId: id,
          picks: selectedCrews,
          tiebreakerMargin: tiebreakerMargin
        }
      });

      if (error) throw error;

      toast.success("Entry Confirmed! Good luck!");
      navigate("/my-entries");
    } catch (err: any) {
      console.error("Error submitting entry:", err);
      // Parse error context for better messages
      let errorMessage = "Failed to enter contest";
      if (err.context?.json) {
        try {
          const contextData = typeof err.context.json === 'string' 
            ? JSON.parse(err.context.json) 
            : err.context.json;
          errorMessage = contextData.error || contextData.message || errorMessage;
        } catch {
          errorMessage = err.message || errorMessage;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading contest...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !contestPool) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Contest Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || "Unable to load contest details"}</p>
            <Link to="/lobby">
              <Button>Back to Lobby</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 gradient-subtle py-12 pb-32">
        <div className="container mx-auto px-4 max-w-5xl">
          <Link to="/lobby" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-base">
            <ArrowLeft className="h-4 w-4" />
            Back to Lobby
          </Link>

          {/* Regatta Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold mb-2">{contestPool.contest_templates.regatta_name}</h1>
                <p className="text-lg text-muted-foreground">
                  {contestPool.contest_templates.gender_category} Multi-Team Fantasy • Pick 2-10 crews from different divisions
                </p>
              </div>
              <Badge variant={isContestOpen ? "default" : "secondary"} className="text-sm">
                {isContestOpen ? "Open" : contestPool.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contest Locks</p>
                      <p className="text-lg font-semibold">{formattedLockTime}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Entry Fee</p>
                      <p className="text-lg font-semibold">${entryFeeDollars}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Contest Closed Warning */}
          {!isContestOpen && (
            <Card className="mb-6 border-destructive/50 bg-destructive/5">
              <CardContent className="pt-6">
                <p className="text-center text-destructive font-medium">
                  This contest is no longer accepting entries.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Crew Selection by Division */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Select Your Crews</h2>
            <p className="text-muted-foreground mb-6">
              Pick 2-10 crews from at least 2 different divisions. Your entry will be matched with other players.
            </p>
            
            {divisions.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No crews available for this contest.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {divisions.map((divisionId) => (
                  <Card key={divisionId}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Badge variant="outline">{divisionId}</Badge>
                        <span className="text-muted-foreground text-sm font-normal">
                          ({crewsByDivision[divisionId].length} crews)
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {crewsByDivision[divisionId].map((crew) => {
                          const isSelected = selectedCrews.includes(crew.crew_id);
                          return (
                            <div
                              key={crew.id}
                              onClick={() => isContestOpen && toggleCrewSelection(crew.crew_id)}
                              className={`
                                flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                                ${isContestOpen ? "cursor-pointer hover:border-primary/50" : "opacity-60 cursor-not-allowed"}
                                ${isSelected ? "border-primary bg-primary/5" : "border-border"}
                              `}
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={!isContestOpen}
                                onCheckedChange={() => toggleCrewSelection(crew.crew_id)}
                                className="pointer-events-none"
                              />
                              <div className="flex-1">
                                <p className="font-medium">{crew.crew_name}</p>
                                <p className="text-xs text-muted-foreground">{crew.crew_id}</p>
                              </div>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Tiebreaker Input */}
          {isContestOpen && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">Tiebreaker</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
                  <Label htmlFor="tiebreaker">Predicted Winning Margin (seconds)</Label>
                  <Input
                    id="tiebreaker"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g., 5.5"
                    value={tiebreakerMargin || ""}
                    onChange={(e) => setTiebreakerMargin(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used to break ties if you have the same score as another player.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Sticky Footer for Submit */}
      {isContestOpen && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-lg z-50">
          <div className="container mx-auto px-4 py-4 max-w-5xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">
                  {selectedCrews.length} crew{selectedCrews.length !== 1 ? "s" : ""} selected
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedCrews.length < 2 
                    ? "Select at least 2 crews to enter" 
                    : `Entry fee: $${entryFeeDollars}`}
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleSubmitEntry}
                disabled={submitting || selectedCrews.length < 2}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Enter Contest"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default RegattaDetail;
