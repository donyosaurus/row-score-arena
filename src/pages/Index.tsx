import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Target, TrendingUp, Shield, Clock, DollarSign, Users } from "lucide-react";

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="gradient-hero text-white py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Pick the Winner. <br />
                <span className="text-accent-foreground/90">Nail the Margin.</span>
              </h1>
              <p className="text-xl md:text-2xl text-primary-foreground/90 max-w-2xl mx-auto">
                Skill-based rowing contests with fixed prizes. 
                No pools. No odds. Just your prediction vs. the clock.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/signup">
                  <Button size="lg" variant="cta" className="text-lg px-8 py-6">
                    Get Started
                  </Button>
                </Link>
                <Link to="/how-it-works">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-white/10 border-white/30 text-white hover:bg-white/20">
                    How It Works
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-primary-foreground/70">
                Age 18+. Skill-based contests. State restrictions apply.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 gradient-subtle">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Three Simple Steps</h2>
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
                  <CardTitle>1. Pick Your Winner</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Choose which crew you predict will win the race. Study the lineups, review past performances.
                  </p>
                </CardContent>
              </Card>

              <Card className="transition-smooth hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>2. Predict the Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Enter your predicted time margin of victory to the hundredth of a second. Precision matters.
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
                    If your winner is correct and your margin is closest, win the pre-posted prize. No pools, no splits.
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
                <h3 className="text-lg font-semibold mb-2">Skill-Based</h3>
                <p className="text-muted-foreground">
                  Outcome knowledge and precision predictions determine winners. Not chance.
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
                <h3 className="text-lg font-semibold mb-2">Head-to-Head or Groups</h3>
                <p className="text-muted-foreground">
                  Compete 1v1 or join small-field contests. Your choice.
                </p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card transition-smooth hover:shadow-md">
                <Clock className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-lg font-semibold mb-2">Real-Time Results</h3>
                <p className="text-muted-foreground">
                  Official race results integrated. Fast, accurate settlement.
                </p>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Compete?
            </h2>
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
