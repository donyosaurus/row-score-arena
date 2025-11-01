import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Waves, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Header = () => {
  const { user, signOut } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
  });

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 transition-smooth hover:opacity-80">
            <Waves className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-primary">RowFantasy</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-base">
              Home
            </Link>
            <Link to="/lobby" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-base">
              Contests
            </Link>
            {user && (
              <>
                <Link to="/profile" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-base">
                  Profile
                </Link>
                <Link to="/my-entries" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-base">
                  My Entries
                </Link>
              </>
            )}
            {isAdmin && (
              <Link to="/admin" className="text-sm font-medium text-accent hover:text-accent/80 transition-base">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-accent/10">
                  <User className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">@{profile?.username || 'user'}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
