import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, Trophy, User, Edit2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

// Mock user data for stats (to be replaced with real data later)
const mockUser = {
  joined: "March 2025",
  contests: 12,
  wins: 5,
};

const mockTransactions = [
  { id: "1", type: "Deposit", amount: 50.00, date: "May 10, 2025", status: "Completed" },
  { id: "2", type: "Entry Fee", amount: -9.00, date: "May 11, 2025", status: "Completed" },
  { id: "3", type: "Prize", amount: 15.00, date: "May 12, 2025", status: "Completed" },
];

const mockHistory = [
  { 
    id: "1", 
    eventName: "IRA Championship",
    raceName: "Men's Varsity Eight",
    result: "Won",
    prize: 15.00,
    date: "May 12, 2025"
  },
  { 
    id: "2", 
    eventName: "Dad Vail Regatta",
    raceName: "Women's Four",
    result: "Lost",
    prize: 0,
    date: "May 10, 2025"
  },
];

const usernameSchema = z.string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be less than 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

const inappropriateWords = ['admin', 'moderator', 'fuck', 'shit', 'damn', 'ass', 'bitch'];

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ username: string; email: string; username_last_changed_at: string } | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [canChangeUsername, setCanChangeUsername] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchProfileData = async () => {
      try {
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("username, email, username_last_changed_at")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);
        setNewUsername(profileData.username || "");

        // Check if user can change username (3 months = 90 days)
        if (profileData.username_last_changed_at) {
          const lastChanged = new Date(profileData.username_last_changed_at);
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          setCanChangeUsername(lastChanged <= threeMonthsAgo);
        } else {
          setCanChangeUsername(true);
        }

        // Fetch wallet balance
        const { data: walletData, error: walletError } = await supabase
          .from("wallets")
          .select("available_balance")
          .eq("user_id", user.id)
          .single();

        if (walletError) throw walletError;
        setBalance(Number(walletData.available_balance) || 0);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, navigate]);

  const handleUsernameChange = async () => {
    if (!user || !profile) return;

    try {
      // Validate username format
      usernameSchema.parse(newUsername);

      // Check for inappropriate words
      const lowerUsername = newUsername.toLowerCase();
      const hasInappropriateWord = inappropriateWords.some(word => 
        lowerUsername.includes(word)
      );

      if (hasInappropriateWord) {
        toast.error("Username contains inappropriate content");
        return;
      }

      // Check if username is different
      if (newUsername === profile.username) {
        toast.error("New username must be different from current username");
        return;
      }

      setIsUpdating(true);

      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", newUsername)
        .neq("id", user.id)
        .single();

      if (existingUser) {
        toast.error("Username is already taken");
        setIsUpdating(false);
        return;
      }

      // Update username
      const { error } = await supabase
        .from("profiles")
        .update({ 
          username: newUsername,
          username_last_changed_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Username updated successfully!");
      setProfile({ ...profile, username: newUsername, username_last_changed_at: new Date().toISOString() });
      setCanChangeUsername(false);
      setDialogOpen(false);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to update username");
        console.error(error);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextChangeDate = () => {
    if (!profile?.username_last_changed_at) return null;
    const lastChanged = new Date(profile.username_last_changed_at);
    const nextChange = new Date(lastChanged);
    nextChange.setMonth(nextChange.getMonth() + 3);
    return nextChange.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 gradient-subtle py-12">
          <div className="container mx-auto px-4 max-w-6xl">
            <p className="text-center">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 gradient-subtle py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl font-bold mb-8">My Profile</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                      <User className="h-10 w-10 text-accent" />
                    </div>
                    <div className="w-full">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <h2 className="text-xl font-bold">{profile?.username || "Loading..."}</h2>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              disabled={!canChangeUsername}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Change Username</DialogTitle>
                              <DialogDescription>
                                {canChangeUsername 
                                  ? "You can change your username once every 3 months."
                                  : `You can change your username again on ${getNextChangeDate()}`
                                }
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">New Username</label>
                                <Input
                                  value={newUsername}
                                  onChange={(e) => setNewUsername(e.target.value)}
                                  placeholder="Enter new username"
                                  disabled={isUpdating}
                                />
                                <p className="text-xs text-muted-foreground">
                                  3-20 characters, letters, numbers, and underscores only
                                </p>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={isUpdating}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleUsernameChange}
                                disabled={isUpdating || !newUsername}
                              >
                                {isUpdating ? "Updating..." : "Update Username"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <p className="text-sm text-muted-foreground">{profile?.email || "Loading..."}</p>
                      <p className="text-xs text-muted-foreground mt-1">Member since {mockUser.joined}</p>
                      {!canChangeUsername && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Next username change: {getNextChangeDate()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    Wallet Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-3xl font-bold text-success">${balance.toFixed(2)}</p>
                  <div className="space-y-2">
                    <Button variant="hero" className="w-full">
                      Deposit Funds
                    </Button>
                    <Button variant="outline" className="w-full">
                      Withdraw
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-accent" />
                    Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Contests</span>
                    <span className="font-semibold">{mockUser.contests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wins</span>
                    <span className="font-semibold text-success">{mockUser.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className="font-semibold">
                      {((mockUser.wins / mockUser.contests) * 100).toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="history" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="history">Contest History</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Contests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockHistory.map((contest) => (
                          <div 
                            key={contest.id}
                            className="p-4 rounded-lg border border-border hover:bg-accent/5 transition-base"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold">{contest.raceName}</p>
                                <p className="text-sm text-muted-foreground">{contest.eventName}</p>
                              </div>
                              <Badge variant={contest.result === "Won" ? "default" : "secondary"}>
                                {contest.result}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{contest.date}</span>
                              {contest.prize > 0 && (
                                <span className="font-semibold text-success">
                                  +${contest.prize.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transactions" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Transaction History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockTransactions.map((tx) => (
                          <div 
                            key={tx.id}
                            className="p-4 rounded-lg border border-border hover:bg-accent/5 transition-base"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{tx.type}</p>
                                <p className="text-sm text-muted-foreground">{tx.date}</p>
                              </div>
                              <div className="text-right">
                                <p className={`font-semibold ${
                                  tx.amount > 0 ? 'text-success' : 'text-foreground'
                                }`}>
                                  {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {tx.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;
