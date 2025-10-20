import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Waves } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 transition-smooth hover:opacity-80">
            <Waves className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-primary">RowLeague</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/lobby" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-base">
              Contests
            </Link>
            <Link to="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-base">
              How It Works
            </Link>
            <Link to="/rules" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-base">
              Rules
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                Profile
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="hero" size="sm">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
