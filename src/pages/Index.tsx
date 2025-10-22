import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Target, TrendingUp, Shield, Clock, DollarSign, Users, Trophy } from "lucide-react";

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-primary text-white py-20 md:py-32 overflow-hidden">
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
                Draft multiple crews across regatta divisions. Predict finish positions. Earn fantasy points. Win fixed prizes based on skill.
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
                    Select 2-4 crews from different divisions within a regatta. Study seedings and past performance.
                  </p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>2. Predict Finish Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    For each crew, predict their finish position (1st-7th+) and winning margin. Earn points based on accuracy.
                  </p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <CardTitle>3. Win with Fantasy Points</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your crews earn points by finish position (100-10 pts). Highest total wins the fixed prize.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why RowLeague?</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Transparent, skill-based contests designed for rowing fans.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="p-6 rounded-lg border border-border bg-card transition-smooth hover:shadow-md">
                <Shield className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-lg font-semibold mb-2">Fixed Prizes</h3>
                <p className="text-muted-foreground">
                  Know exactly what you can win before you enter. No pooling, no surprises.
                </p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card transition-smooth hover:shadow-md">
                <Target className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-lg font-semibold mb-2">Multi-Team Fantasy</h3>
                <p className="text-muted-foreground">
                  Draft from multiple real crews across divisions. Skill-based fantasy sports that comply with regulations.
                </p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card transition-smooth hover:shadow-md">
                <DollarSign className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-lg font-semibold mb-2">Clear Entry Fees</h3>
                <p className="text-muted-foreground">
                  Transparent pricing. You always know what you're paying to compete.
                </p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card transition-smooth hover:shadow-md">
                <Users className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-lg font-semibold mb-2">Finish-Order Scoring</h3>
                <p className="text-muted-foreground">Earn 100-10 points per crew based on finish position. Margin predictions only break ties.</p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card transition-smooth hover:shadow-md">
                <Clock className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-lg font-semibold mb-2">Real-Time Results</h3>
                <p className="text-muted-foreground">Official race results integrated. Fast, accurate settlement.</p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card transition-smooth hover:shadow-md">
                <Shield className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-lg font-semibold mb-2">Compliant & Secure</h3>
                <p className="text-muted-foreground">
                  Age verification, geo-restrictions, and responsible play tools built in.
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
              Join RowLeague today and put your rowing knowledge to the test.
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
