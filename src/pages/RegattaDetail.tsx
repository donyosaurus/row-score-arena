import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Users, DollarSign, Trophy } from "lucide-react";
import { Regatta } from "@/types/contest";

// Mock regatta data with 5 entry tiers
const mockRegatta: Regatta = {
  id: "1",
  regattaName: "IRA National Championship 2025",
  genderCategory: "Men's",
  lockTime: "May 30, 2025 at 9:00 AM EST",
  minPicks: 2,
  maxPicks: 3,
  divisions: [
    { id: "div1", name: "Heavyweight Varsity 8+", boatClass: "Varsity 8+", category: "Heavyweight" },
    { id: "div2", name: "Lightweight Varsity 8+", boatClass: "Varsity 8+", category: "Lightweight" },
  ],
  crews: [
    { id: "crew1", name: "Yale", institution: "Yale University", divisionId: "div1", seedPosition: 1 },
    { id: "crew2", name: "Harvard", institution: "Harvard University", divisionId: "div1", seedPosition: 2 },
    { id: "crew3", name: "Washington", institution: "University of Washington", divisionId: "div1", seedPosition: 3 },
    { id: "crew4", name: "California", institution: "University of California", divisionId: "div1", seedPosition: 4 },
    { id: "crew5", name: "Princeton", institution: "Princeton University", divisionId: "div1", seedPosition: 5 },
    { id: "crew6", name: "Princeton", institution: "Princeton University", divisionId: "div2", seedPosition: 1 },
    { id: "crew7", name: "Yale", institution: "Yale University", divisionId: "div2", seedPosition: 2 },
    { id: "crew8", name: "Harvard", institution: "Harvard University", divisionId: "div2", seedPosition: 3 },
    { id: "crew9", name: "Columbia", institution: "Columbia University", divisionId: "div2", seedPosition: 4 },
  ],
  entryTiers: [
    { id: "h2h-10", type: "H2H", entryFee: 10, prize: 18.50, capacity: 2, filled: 0 },
    { id: "h2h-25", type: "H2H", entryFee: 25, prize: 47.50, capacity: 2, filled: 1 },
    { id: "h2h-100", type: "H2H", entryFee: 100, prize: 195.50, capacity: 2, filled: 0 },
    { id: "5p-20", type: "5_PERSON", entryFee: 20, prize: 65, capacity: 5, filled: 2 },
  ],
};

const RegattaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleSelectTier = (tierId: string) => {
    navigate(`/contest/${id}/${tierId}`);
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

          {/* Regatta Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold mb-2">{mockRegatta.regattaName}</h1>
                <p className="text-lg text-muted-foreground">
                  {mockRegatta.genderCategory} Multi-Team Fantasy • Pick {mockRegatta.minPicks}-{mockRegatta.maxPicks} crews from different divisions
                </p>
              </div>
            </div>

            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contest Locks</p>
                    <p className="text-lg font-semibold">{mockRegatta.lockTime}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Entry Tiers Selection */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-6">Select Your Entry Level</h2>
            
            {/* Head-to-Head Options */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20">Head-to-Head</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mockRegatta.entryTiers
                  .filter(tier => tier.type === "H2H")
                  .map((tier) => (
                    <Card key={tier.id} className="hover:shadow-lg transition-smooth cursor-pointer border-2 hover:border-primary/50">
                      <CardContent className="p-6 space-y-4">
                        <div className="text-center space-y-2">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <DollarSign className="h-5 w-5" />
                            <span className="text-sm">Entry Fee</span>
                          </div>
                          <p className="text-3xl font-bold">${tier.entryFee}</p>
                        </div>

                        <div className="text-center space-y-2 pt-2 border-t">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Trophy className="h-5 w-5 text-accent" />
                            <span className="text-sm">Prize</span>
                          </div>
                          <p className="text-3xl font-bold text-accent">${tier.prize.toFixed(2)}</p>
                        </div>

                        <div className="flex items-center justify-between text-sm pt-2 border-t">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Entries
                          </span>
                          <span className="font-semibold">{tier.filled} of {tier.capacity}</span>
                        </div>

                        <Button 
                          onClick={() => handleSelectTier(tier.id)}
                          className="w-full"
                          variant="default"
                        >
                          Enter Contest
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>

            {/* 5-Person Options */}
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Badge className="bg-accent/10 text-accent border-accent/20">5-Person Contest</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockRegatta.entryTiers
                  .filter(tier => tier.type === "5_PERSON")
                  .map((tier) => (
                    <Card key={tier.id} className="hover:shadow-lg transition-smooth cursor-pointer border-2 hover:border-accent/50">
                      <CardContent className="p-6 space-y-4">
                        <div className="text-center space-y-2">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <DollarSign className="h-5 w-5" />
                            <span className="text-sm">Entry Fee</span>
                          </div>
                          <p className="text-3xl font-bold">${tier.entryFee}</p>
                        </div>

                        <div className="text-center space-y-2 pt-2 border-t">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Trophy className="h-5 w-5 text-accent" />
                            <span className="text-sm">Prizes</span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-2xl font-bold text-accent">${tier.prize.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">1st Place</p>
                            <p className="text-xl font-semibold text-accent/80">$30.00</p>
                            <p className="text-sm text-muted-foreground">2nd Place</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm pt-2 border-t">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Entries
                          </span>
                          <span className="font-semibold">{tier.filled} of {tier.capacity}</span>
                        </div>

                        <Button 
                          onClick={() => handleSelectTier(tier.id)}
                          className="w-full"
                          variant="default"
                        >
                          Enter Contest
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </div>

          {/* Divisions Info */}
          <Card>
            <CardHeader>
              <CardTitle>Available Divisions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockRegatta.divisions.map((div) => (
                  <div key={div.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="font-semibold">{div.name}</span>
                    <Badge variant="outline">{div.category}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RegattaDetail;
