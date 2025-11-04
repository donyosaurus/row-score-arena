import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, DollarSign, Info, Target, Plus, Trash2, Trophy } from "lucide-react";
import { Regatta, DraftPick, FINISH_POINTS, EntryTier } from "@/types/contest";
import { toast } from "sonner";

// Mock regatta data - must match RegattaDetail data
const mockRegattas: Record<string, Regatta> = {
  "1": {
    id: "1",
    regattaName: "Eastern Sprints Regatta 2026",
    genderCategory: "Men's",
    lockTime: "May 17, 2026 at 8:00 AM EST",
    minPicks: 2,
    maxPicks: 3,
    divisions: [
      { id: "div1", name: "Heavyweight Varsity 8+", boatClass: "Varsity 8+", category: "Heavyweight" },
      { id: "div2", name: "Lightweight Varsity 8+", boatClass: "Varsity 8+", category: "Lightweight" },
      { id: "div3", name: "Varsity 4+", boatClass: "Four", category: "Heavyweight" },
    ],
    crews: [
      { id: "crew1", name: "Harvard", institution: "Harvard University", divisionId: "div1", seedPosition: 1 },
      { id: "crew2", name: "Yale", institution: "Yale University", divisionId: "div1", seedPosition: 2 },
      { id: "crew3", name: "Princeton", institution: "Princeton University", divisionId: "div1", seedPosition: 3 },
      { id: "crew4", name: "Brown", institution: "Brown University", divisionId: "div1", seedPosition: 4 },
      { id: "crew5", name: "Cornell", institution: "Cornell University", divisionId: "div2", seedPosition: 1 },
      { id: "crew6", name: "Columbia", institution: "Columbia University", divisionId: "div2", seedPosition: 2 },
      { id: "crew7", name: "Princeton", institution: "Princeton University", divisionId: "div2", seedPosition: 3 },
      { id: "crew8", name: "Harvard", institution: "Harvard University", divisionId: "div3", seedPosition: 1 },
    ],
    entryTiers: [
      { id: "h2h-10", type: "H2H", entryFee: 10, prize: 18.50, capacity: 2, filled: 0 },
      { id: "h2h-25", type: "H2H", entryFee: 25, prize: 47.50, capacity: 2, filled: 1 },
      { id: "h2h-100", type: "H2H", entryFee: 100, prize: 195.50, capacity: 2, filled: 0 },
      { id: "5p-20", type: "5_PERSON", entryFee: 20, prize: 62.50, capacity: 5, filled: 2 },
    ],
  },
  "2": {
    id: "2",
    regattaName: "IRA National Championship 2026",
    genderCategory: "Men's",
    lockTime: "May 29, 2026 at 9:00 AM PST",
    minPicks: 2,
    maxPicks: 4,
    divisions: [
      { id: "div1", name: "Heavyweight Varsity 8+", boatClass: "Varsity 8+", category: "Heavyweight" },
      { id: "div2", name: "Lightweight Varsity 8+", boatClass: "Varsity 8+", category: "Lightweight" },
      { id: "div3", name: "Second Varsity 8+", boatClass: "Second Varsity 8+", category: "Heavyweight" },
    ],
    crews: [
      { id: "crew1", name: "Washington", institution: "University of Washington", divisionId: "div1", seedPosition: 1 },
      { id: "crew2", name: "Yale", institution: "Yale University", divisionId: "div1", seedPosition: 2 },
      { id: "crew3", name: "California", institution: "University of California", divisionId: "div1", seedPosition: 3 },
      { id: "crew4", name: "Harvard", institution: "Harvard University", divisionId: "div1", seedPosition: 4 },
      { id: "crew5", name: "Princeton", institution: "Princeton University", divisionId: "div2", seedPosition: 1 },
      { id: "crew6", name: "Yale", institution: "Yale University", divisionId: "div2", seedPosition: 2 },
      { id: "crew7", name: "Harvard", institution: "Harvard University", divisionId: "div2", seedPosition: 3 },
      { id: "crew8", name: "Washington", institution: "University of Washington", divisionId: "div3", seedPosition: 1 },
    ],
    entryTiers: [
      { id: "h2h-10", type: "H2H", entryFee: 10, prize: 18.50, capacity: 2, filled: 0 },
      { id: "h2h-25", type: "H2H", entryFee: 25, prize: 47.50, capacity: 2, filled: 1 },
      { id: "h2h-100", type: "H2H", entryFee: 100, prize: 195.50, capacity: 2, filled: 0 },
      { id: "5p-20", type: "5_PERSON", entryFee: 20, prize: 62.50, capacity: 5, filled: 3 },
    ],
  },
  "3": {
    id: "3",
    regattaName: "Women's NCAA Championship 2026",
    genderCategory: "Women's",
    lockTime: "May 30, 2026 at 10:00 AM EST",
    minPicks: 2,
    maxPicks: 3,
    divisions: [
      { id: "div1", name: "Varsity 8+", boatClass: "Varsity 8+", category: "Open" },
      { id: "div2", name: "Second Varsity 8+", boatClass: "Second Varsity 8+", category: "Open" },
      { id: "div3", name: "Varsity 4+", boatClass: "Four", category: "Open" },
    ],
    crews: [
      { id: "crew1", name: "Texas", institution: "University of Texas", divisionId: "div1", seedPosition: 1 },
      { id: "crew2", name: "Stanford", institution: "Stanford University", divisionId: "div1", seedPosition: 2 },
      { id: "crew3", name: "Washington", institution: "University of Washington", divisionId: "div1", seedPosition: 3 },
      { id: "crew4", name: "Brown", institution: "Brown University", divisionId: "div1", seedPosition: 4 },
      { id: "crew5", name: "Stanford", institution: "Stanford University", divisionId: "div2", seedPosition: 1 },
      { id: "crew6", name: "Washington", institution: "University of Washington", divisionId: "div2", seedPosition: 2 },
      { id: "crew7", name: "Texas", institution: "University of Texas", divisionId: "div3", seedPosition: 1 },
    ],
    entryTiers: [
      { id: "h2h-10", type: "H2H", entryFee: 10, prize: 18.50, capacity: 2, filled: 1 },
      { id: "h2h-25", type: "H2H", entryFee: 25, prize: 47.50, capacity: 2, filled: 0 },
      { id: "h2h-100", type: "H2H", entryFee: 100, prize: 195.50, capacity: 2, filled: 0 },
      { id: "5p-20", type: "5_PERSON", entryFee: 20, prize: 62.50, capacity: 5, filled: 2 },
    ],
  },
  "9": {
    id: "9",
    regattaName: "World Rowing Championships 2026",
    genderCategory: "Men's",
    lockTime: "August 25, 2026 at 3:00 AM EST",
    minPicks: 2,
    maxPicks: 5,
    divisions: [
      { id: "div1", name: "Men's Eight", boatClass: "Eight", category: "Open" },
      { id: "div2", name: "Men's Four", boatClass: "Four", category: "Open" },
      { id: "div3", name: "Men's Pair", boatClass: "Pair", category: "Open" },
      { id: "div4", name: "Men's Single Sculls", boatClass: "Single Sculls", category: "Open" },
      { id: "div5", name: "Men's Quad Sculls", boatClass: "Quad Sculls", category: "Open" },
    ],
    crews: [
      { id: "crew1", name: "Great Britain", institution: "Great Britain", divisionId: "div1", seedPosition: 1 },
      { id: "crew2", name: "Netherlands", institution: "Netherlands", divisionId: "div1", seedPosition: 2 },
      { id: "crew3", name: "Australia", institution: "Australia", divisionId: "div2", seedPosition: 1 },
      { id: "crew4", name: "New Zealand", institution: "New Zealand", divisionId: "div2", seedPosition: 2 },
      { id: "crew5", name: "Croatia", institution: "Croatia", divisionId: "div3", seedPosition: 1 },
      { id: "crew6", name: "Oliver Zeidler", institution: "Germany", divisionId: "div4", seedPosition: 1 },
      { id: "crew7", name: "Netherlands", institution: "Netherlands", divisionId: "div5", seedPosition: 1 },
    ],
    entryTiers: [
      { id: "h2h-10", type: "H2H", entryFee: 10, prize: 18.50, capacity: 2, filled: 1 },
      { id: "h2h-25", type: "H2H", entryFee: 25, prize: 47.50, capacity: 2, filled: 2 },
      { id: "h2h-100", type: "H2H", entryFee: 100, prize: 195.50, capacity: 2, filled: 0 },
      { id: "5p-20", type: "5_PERSON", entryFee: 20, prize: 62.50, capacity: 5, filled: 3 },
    ],
  },
};

const ContestDetail = () => {
  const { id, tierId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [currentDivision, setCurrentDivision] = useState<string>("");
  const [currentCrew, setCurrentCrew] = useState<string>("");
  const [currentMargin, setCurrentMargin] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  const mockRegatta = mockRegattas[id || "1"] || mockRegattas["1"];

  if (loading) {
    return null;
  }

  const selectedTier = mockRegatta.entryTiers.find(t => t.id === tierId);
  if (!selectedTier) {
    return <div>Tier not found</div>;
  }

  const addPick = () => {
    if (!currentCrew || !currentMargin) {
      toast.error("Please fill in all fields");
      return;
    }

    const crew = mockRegatta.crews.find(c => c.id === currentCrew);
    if (!crew) return;

    // Check if division already picked
    if (draftPicks.some(p => p.divisionId === crew.divisionId)) {
      toast.error("You've already picked from this division");
      return;
    }

    // Check max picks
    if (draftPicks.length >= mockRegatta.maxPicks) {
      toast.error(`Maximum ${mockRegatta.maxPicks} picks allowed`);
      return;
    }

    const newPick: DraftPick = {
      crewId: currentCrew,
      divisionId: crew.divisionId,
      predictedMargin: parseFloat(currentMargin),
    };

    setDraftPicks([...draftPicks, newPick]);
    setCurrentCrew("");
    setCurrentMargin("");
    setCurrentDivision("");
    toast.success("Crew added to draft");
  };

  const removePick = (index: number) => {
    setDraftPicks(draftPicks.filter((_, i) => i !== index));
    toast.info("Pick removed");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (draftPicks.length < mockRegatta.minPicks) {
      toast.error(`You must draft at least ${mockRegatta.minPicks} teams`);
      return;
    }

    // TODO: Submit to backend
    console.log("Draft submitted:", draftPicks);
    toast.success("Draft submitted successfully!");
  };

  const availableDivisions = mockRegatta.divisions.filter(
    div => !draftPicks.some(p => p.divisionId === div.id)
  );

  const availableCrews = currentDivision
    ? mockRegatta.crews.filter(c => c.divisionId === currentDivision)
    : [];

  const getCrewName = (crewId: string) => {
    const crew = mockRegatta.crews.find(c => c.id === crewId);
    return crew ? `${crew.name} (${crew.institution})` : "";
  };

  const getDivisionName = (divisionId: string) => {
    const div = mockRegatta.divisions.find(d => d.id === divisionId);
    return div?.name || "";
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 gradient-subtle py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <Link to={`/regatta/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-base">
            <ArrowLeft className="h-4 w-4" />
            Back to Entry Options
          </Link>

          {/* Contest Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold mb-2">{mockRegatta.regattaName}</h1>
                <p className="text-lg text-muted-foreground">
                  {mockRegatta.genderCategory} Multi-Team Fantasy • Pick {mockRegatta.minPicks}-{mockRegatta.maxPicks} crews from different events
                </p>
              </div>
              <Badge className="text-lg px-4 py-2">
                {selectedTier.type === "H2H" ? "Head-to-Head" : "5-Person"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Entry Fee</p>
                      <p className="text-2xl font-bold">${selectedTier.entryFee}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-2">Prize Payouts</p>
                      {selectedTier.type === "5_PERSON" ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">1st Place:</span>
                            <span className="text-xl font-bold text-success">${selectedTier.prize.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">2nd Place:</span>
                            <span className="text-lg font-bold text-success/80">$30.00</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-success">${selectedTier.prize.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Locks</p>
                      <p className="text-sm font-semibold">{mockRegatta.lockTime}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Draft Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Current Picks */}
              {draftPicks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Your Draft ({draftPicks.length}/{mockRegatta.maxPicks})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {draftPicks.map((pick, index) => (
                      <div key={index} className="flex items-center justify-between p-4 rounded-lg border-2 border-accent/20 bg-accent/5">
                        <div className="flex-1">
                          <p className="font-semibold">{getCrewName(pick.crewId)}</p>
                          <p className="text-sm text-muted-foreground">{getDivisionName(pick.divisionId)}</p>
                          <p className="text-sm mt-1">
                            Margin prediction (tie-breaker): <span className="font-medium">{pick.predictedMargin}s</span>
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePick(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Add Pick Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Add Crew to Draft</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    {draftPicks.length < mockRegatta.minPicks 
                      ? `You need ${mockRegatta.minPicks - draftPicks.length} more crew(s)`
                      : `Optional: Add up to ${mockRegatta.maxPicks - draftPicks.length} more crew(s)`
                    }
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Step 1: Select Division */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">
                      Step 1: Choose Division
                    </Label>
                    <Select value={currentDivision} onValueChange={(value) => {
                      setCurrentDivision(value);
                      setCurrentCrew("");
                    }}>
                      <SelectTrigger className="text-base">
                        <SelectValue placeholder="Select a division..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDivisions.map((div) => (
                          <SelectItem key={div.id} value={div.id} className="text-base">
                            {div.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 2: Select Crew */}
                  {currentDivision && (
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">
                        Step 2: Select Crew
                      </Label>
                      <Select value={currentCrew} onValueChange={setCurrentCrew}>
                        <SelectTrigger className="text-base">
                          <SelectValue placeholder="Select a crew..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCrews.map((crew) => (
                            <SelectItem key={crew.id} value={crew.id} className="text-base">
                              {crew.name} - {crew.institution} {crew.seedPosition && `(Seed #${crew.seedPosition})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Step 3: Predict Margin */}
                  {currentCrew && (
                    <div className="space-y-3">
                      <Label htmlFor="margin" className="text-base font-semibold">
                        Step 3: Predict Winning Margin (Tie-Breaker)
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            id="margin"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="1.42"
                            value={currentMargin}
                            onChange={(e) => setCurrentMargin(e.target.value)}
                            className="text-base"
                          />
                          <span className="text-muted-foreground font-medium">seconds</span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          Time difference between 1st and 2nd place. Used only as a tie-breaker if users have equal points.
                        </p>
                      </div>
                    </div>
                  )}

                  <Button 
                    type="button"
                    onClick={addPick}
                    variant="outline" 
                    size="lg" 
                    className="w-full"
                    disabled={!currentCrew || !currentMargin || draftPicks.length >= mockRegatta.maxPicks}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Crew to Draft
                  </Button>
                </CardContent>
              </Card>

              {/* Submit Draft */}
              {draftPicks.length >= mockRegatta.minPicks && (
                <Button 
                  onClick={handleSubmit}
                  variant="hero" 
                  size="lg" 
                  className="w-full text-lg py-6"
                >
                  Submit Draft (${selectedTier.entryFee})
                </Button>
              )}
            </div>

            {/* Rules Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-accent" />
                    Finish-Order Scoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-accent/5">
                      <span className="font-medium">1st Place</span>
                      <span className="font-bold text-accent">100 pts</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>2nd Place</span>
                      <span className="font-semibold">80 pts</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>3rd Place</span>
                      <span className="font-semibold">65 pts</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>4th Place</span>
                      <span className="font-semibold">50 pts</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>5th Place</span>
                      <span className="font-semibold">35 pts</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>6th Place</span>
                      <span className="font-semibold">20 pts</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>7th+ Place</span>
                      <span className="font-semibold">10 pts</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Your total score = sum of all your crews' finish points
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How to Win</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">1. Automatic Finish Points</h4>
                    <p className="text-muted-foreground">
                      Your drafted crews automatically earn points based on their actual finish positions. No prediction needed!
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">2. Margin Accuracy (Tie-Breaker)</h4>
                    <p className="text-muted-foreground">
                      If tied on points, lowest total margin prediction error wins
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-medium mb-1">Example:</p>
                    <p className="text-xs text-muted-foreground">
                      Draft Yale and Harvard. Yale finishes 1st (100pts), Harvard finishes 3rd (65pts) = 165 total points
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-accent/20 bg-accent/5">
                <CardHeader>
                  <CardTitle className="text-lg">Fixed Prize</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pre-posted prize. No pooling. Skill-based fantasy contest.
                  </p>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-2xl font-bold text-success text-center">
                      ${selectedTier.prize.toFixed(2)}
                    </p>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      Winner takes all
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContestDetail;
