import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StateAvailabilityMap } from "@/components/StateAvailabilityMap";
import { Target, TrendingUp, Shield, Clock, Trophy } from "lucide-react";
import heroRowing from "@/assets/hero-rowing.jpeg";

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-primary text-white py-20 md:py-32 overflow-hidden">
          {/* Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url(${heroRowing})`,
              backgroundPosition: 'center',
            }}
          />
          
          {/* Overlay gradient for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/75 via-primary/65 to-primary/85" />
          
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(
                90deg,
                transparent,
                transparent 50px,
                rgba(255,255,255,0.03) 50px,
                rgba(255,255,255,0.03) 51px
              )`,
              }}
            />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-accent/30 bg-primary/50 backdrop-blur-sm">
                <Shield className="h-4 w-4 text-accent" />
                <span className="text-accent font-medium">Live Contests • Cash Prizes • Secure Transactions</span>
              </div>

              {/* Main Headline */}
              <div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">Predict, Compete, Win.</h1>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight text-accent mt-2">
                  #1 Rowing Fantasy Platform.
                </h1>
              </div>

              {/* Description */}
              <p className="text-xl md:text-2xl text-white/90 max-w-3xl leading-relaxed">
                Draft multiple crews from a single regatta. They automatically earn points based on their actual finish. Win fixed prizes based on skill.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <Link to="/signup">
                  <Button size="lg" className="text-lg px-8 py-6 bg-accent hover:bg-accent/90 text-white rounded-xl">
                    Get Started →
                  </Button>
                </Link>
                <Link to="/how-it-works">
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-6 border-2 border-white/30 text-white hover:bg-white/10 rounded-xl bg-transparent"
                  >
                    How It Works
                  </Button>
                </Link>
              </div>

              {/* Feature Pills */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Trophy className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Fixed Prizes</h3>
                    <p className="text-white/70 text-sm">Pre-posted payouts</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Skill-Based</h3>
                    <p className="text-white/70 text-sm">Knowledge wins</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Secure & Fair</h3>
                    <p className="text-white/70 text-sm">KYC verified</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 gradient-subtle">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How it Works</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Compete on skill and rowing knowledge. Fixed prizes make it transparent.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <Card className="transition-smooth hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>1. Draft Multiple Crews</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Select 2-4 crews from different divisions within a Men's or Women's regatta. Study seedings and past performance.
                  </p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>2. Automatic Scoring</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your crews automatically earn points based on their actual finish position. 1st = 100pts down to 7th+ = 10pts. No predictions needed!
                  </p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <CardTitle>3. Win Fixed Prizes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your crews earn points by finish position (100-10 pts). Highest total wins the fixed prize. Margin predictions only break ties.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <Link to="/contests">
                <Button size="lg" variant="cta" className="text-lg px-8 py-6">
                  View Available Contests
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* State Availability */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">State Availability</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Check if RowFantasy contests are available in your state
              </p>
            </div>
            <StateAvailabilityMap />
          </div>
        </section>

        {/* How to Play */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How to Play</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Complete guide to competing in fantasy rowing contests
              </p>
            </div>

            <div className="space-y-6">
              <div className="border rounded-2xl p-8 bg-card">
                <h3 className="text-2xl font-bold mb-4">Contest Selection</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Browse available regattas from the Contests lobby. Each regatta offers multiple entry tiers with different entry fees and prize structures. Choose from Head-to-Head (H2H) contests where you compete against one opponent, or 5-Person contests for small field competition. Entry tiers range from $10 to $100 with corresponding prize payouts.
                </p>
              </div>

              <div className="border rounded-2xl p-8 bg-card">
                <h3 className="text-2xl font-bold mb-4">Drafting Your Lineups</h3>
                <p className="text-muted-foreground leading-relaxed">
                  After selecting your entry tier, you must draft at least 2 crews from the competing teams in the regatta. For each crew selection, predict the winner and enter your predicted margin of victory in seconds (to hundredths of a second). Your predictions should be based on crew performance history, current form, racing conditions, and head-to-head records.
                </p>
              </div>

              <div className="border rounded-2xl p-8 bg-card">
                <h3 className="text-2xl font-bold mb-4">Time Margins and Lock Times</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Victory margins are calculated as the time difference between 1st and 2nd place finishers in each race. Precision matters - the closer your predicted margin to the actual result, the better your score. All entries must be submitted before the contest lock time, which is typically at the scheduled race start. Once locked, no changes can be made to your lineup.
                </p>
              </div>

              <div className="border rounded-2xl p-8 bg-card">
                <h3 className="text-2xl font-bold mb-4">Scoring System</h3>
                <ul className="space-y-2 text-muted-foreground leading-relaxed">
                  <li>• You must correctly predict the winning crew to be eligible for prizes</li>
                  <li>• Among participants who picked the correct winner, the closest margin prediction wins</li>
                  <li>• If multiple participants have identical predictions, the earliest entry timestamp wins</li>
                  <li>• Scoring is applied across all your drafted crews for an aggregate score</li>
                </ul>
              </div>

              <div className="border rounded-2xl p-8 bg-card">
                <h3 className="text-2xl font-bold mb-4">Contest Outcomes</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Results are determined after official race results are posted. In Head-to-Head contests, the winner takes the full prize amount. In 5-Person contests, top finishers split the prize pool according to the tier structure. Prizes are automatically credited to your wallet and available for withdrawal or entry into new contests.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Voids & Refunds:</strong> If a race is canceled, postponed significantly, or results are unavailable, contests automatically void and entry fees are refunded to your wallet within 24 hours.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="gradient-hero text-white py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Compete?</h2>
            <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
              Join RowFantasy today and put your rowing knowledge to the test.
            </p>
            <Link to="/signup">
              <Button size="lg" variant="cta" className="text-lg px-8 py-6">
                Sign Up Now
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
