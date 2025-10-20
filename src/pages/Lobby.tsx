import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContestCard } from "@/components/ContestCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

// Mock data for demonstration
const mockContests = [
  {
    id: "1",
    eventName: "NCAA Championship Final",
    raceName: "Varsity Men's Eight",
    type: "H2H" as const,
    entryFee: 9,
    prize: 15,
    capacity: 2,
    filled: 1,
    lockTime: "2h 34m",
    teams: ["Harvard", "Yale", "Princeton", "+1 more"],
  },
  {
    id: "2",
    eventName: "IRA National Championships",
    raceName: "Women's Varsity Four",
    type: "CAP_N" as const,
    entryFee: 5,
    prize: 40,
    capacity: 10,
    filled: 7,
    lockTime: "5h 12m",
    teams: ["Washington", "Stanford", "Cal", "+1 more"],
  },
  {
    id: "3",
    eventName: "Head of the Charles",
    raceName: "Championship Eights",
    type: "H2H" as const,
    entryFee: 20,
    prize: 35,
    capacity: 2,
    filled: 0,
    lockTime: "1h 08m",
    teams: ["Cambridge", "Oxford", "Yale", "+1 more"],
  },
  {
    id: "4",
    eventName: "ACRA Championships",
    raceName: "Women's Novice Eight",
    type: "CAP_N" as const,
    entryFee: 5,
    prize: 40,
    capacity: 10,
    filled: 3,
    lockTime: "6h 45m",
    teams: ["Boston University", "Northeastern", "MIT"],
  },
];

const Lobby = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Featured Contests</h1>
            <p className="text-xl text-muted-foreground">
              Join contests with fixed prizes. Pick the winner and predict the margin.
            </p>
          </div>

          {/* Filters */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by event or race..."
                className="pl-10"
              />
            </div>
            
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Contest Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="h2h">Head-to-Head</SelectItem>
                <SelectItem value="cap_n">Small Field</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Entry Fee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fees</SelectItem>
                <SelectItem value="low">Under $10</SelectItem>
                <SelectItem value="mid">$10-$20</SelectItem>
                <SelectItem value="high">$20+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contest Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockContests.map((contest) => (
              <ContestCard key={contest.id} {...contest} />
            ))}
          </div>

          {/* Empty State (hidden when contests exist) */}
          {mockContests.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground mb-4">
                No contests available right now
              </p>
              <p className="text-muted-foreground">
                Check back soon for new rowing contests
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Lobby;
