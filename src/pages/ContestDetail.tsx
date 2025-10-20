import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Clock, DollarSign, Info, Target } from "lucide-react";

// Mock data
const mockContest = {
  id: "1",
  eventName: "IRA National Championship",
  raceName: "Men's Varsity Eight Grand Final",
  type: "H2H",
  entryFee: 9,
  prize: 15,
  capacity: 2,
  filled: 1,
  lockTime: "May 15, 2025 at 10:00 AM EST",
  crews: [
    { id: "crew1", name: "Yale Bulldogs", institution: "Yale University", lane: 3 },
    { id: "crew2", name: "Harvard Crimson", institution: "Harvard University", lane: 4 },
    { id: "crew3", name: "Princeton Tigers", institution: "Princeton University", lane: 2 },
    { id: "crew4", name: "Brown Bears", institution: "Brown University", lane: 5 },
    { id: "crew5", name: "Penn Quakers", institution: "University of Pennsylvania", lane: 1 },
    { id: "crew6", name: "Cornell Big Red", institution: "Cornell University", lane: 6 },
  ],
};

const ContestDetail = () => {
  const { id } = useParams();
  const [selectedCrew, setSelectedCrew] = useState("");
  const [marginSeconds, setMarginSeconds] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement pick submission
    console.log("Pick submitted:", { selectedCrew, marginSeconds });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 gradient-subtle py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <Link to="/lobby" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-base">
            <ArrowLeft className="h-4 w-4" />
            Back to Lobby
          </Link>

          {/* Contest Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-muted-foreground mb-1">{mockContest.eventName}</p>
                <h1 className="text-4xl font-bold mb-2">{mockContest.raceName}</h1>
              </div>
              <Badge className="text-lg px-4 py-2">
                {mockContest.type === "H2H" ? "Head-to-Head" : "Small Field"}
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
                      <p className="text-2xl font-bold">${mockContest.entryFee}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <Target className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fixed Prize</p>
                      <p className="text-2xl font-bold text-success">${mockContest.prize}</p>
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
                      <p className="text-sm font-semibold">{mockContest.lockTime}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pick Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Make Your Pick</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Select Winner */}
                    <div className="space-y-4">
                      <Label className="text-lg font-semibold">
                        Step 1: Pick the Winner
                      </Label>
                      <RadioGroup value={selectedCrew} onValueChange={setSelectedCrew}>
                        <div className="space-y-3">
                          {mockContest.crews.map((crew) => (
                            <label
                              key={crew.id}
                              className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-smooth ${
                                selectedCrew === crew.id
                                  ? "border-accent bg-accent/5"
                                  : "border-border hover:border-accent/50 hover:bg-accent/5"
                              }`}
                            >
                              <RadioGroupItem value={crew.id} id={crew.id} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold">{crew.name}</p>
                                    <p className="text-sm text-muted-foreground">{crew.institution}</p>
                                  </div>
                                  <Badge variant="outline">Lane {crew.lane}</Badge>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Predict Margin */}
                    <div className="space-y-4">
                      <Label htmlFor="margin" className="text-lg font-semibold">
                        Step 2: Predict Margin of Victory
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            id="margin"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="1.37"
                            value={marginSeconds}
                            onChange={(e) => setMarginSeconds(e.target.value)}
                            className="text-lg"
                            required
                          />
                          <span className="text-muted-foreground font-medium">seconds</span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          Enter the time difference between 1st and 2nd place (e.g., 1.37 for 1.37 seconds)
                        </p>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      variant="hero" 
                      size="lg" 
                      className="w-full"
                      disabled={!selectedCrew || !marginSeconds}
                    >
                      Submit Pick (${mockContest.entryFee})
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Rules Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How Scoring Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">1. Correct Winner</h4>
                    <p className="text-muted-foreground">
                      Your predicted winner must finish in 1st place
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">2. Closest Margin</h4>
                    <p className="text-muted-foreground">
                      The entry with the smallest absolute error wins
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">3. Tie Breakers</h4>
                    <p className="text-muted-foreground">
                      Closest without going over, then earliest entry time
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
                    This contest has a pre-posted, fixed prize. No pooling.
                  </p>
                  <div className="p-4 rounded-lg bg-background border border-border">
                    <p className="text-2xl font-bold text-success text-center">
                      ${mockContest.prize}
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
