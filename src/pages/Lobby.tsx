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
    eventName: "IRA National Championship",
    raceName: "Men's Varsity Eight Grand Final",
    type: "H2H" as const,
    entryFee: 9,
    prize: 15,
    capacity: 2,
    filled: 1,
    lockTime: "in 2 hours",
  },
  {
    id: "2",
    eventName: "Georgetown Spring Invitational",
    raceName: "Women's Varsity Four",
    type: "CAP_N" as const,
    entryFee: 5,
    prize: 40,
    capacity: 10,
    filled: 7,
    lockTime: "tomorrow at 9:00 AM",
  },
  {
    id: "3",
    eventName: "Dad Vail Regatta",
    raceName: "Men's Lightweight Eight Final",
    type: "H2H" as const,
    entryFee: 9,
    prize: 15,
    capacity: 2,
    filled: 0,
    lockTime: "in 4 hours",
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
    lockTime: "in 6 hours",
  },
];

const Lobby = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 gradient-subtle py-12">
        <div className="container mx-auto px-4">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Contest Lobby</h1>
            <p className="text-xl text-muted-foreground">
              Browse available contests and make your picks
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
