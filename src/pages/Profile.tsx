import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Trophy, User } from "lucide-react";

// Mock user data
const mockUser = {
  name: "John Rower",
  email: "john@example.com",
  joined: "March 2025",
  contests: 12,
  wins: 5,
  balance: 47.50,
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

const Profile = () => {
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
                    <div>
                      <h2 className="text-xl font-bold">{mockUser.name}</h2>
                      <p className="text-sm text-muted-foreground">{mockUser.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">Member since {mockUser.joined}</p>
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
                  <p className="text-3xl font-bold text-success">${mockUser.balance.toFixed(2)}</p>
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
