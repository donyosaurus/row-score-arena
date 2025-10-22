import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContestCard } from "@/components/ContestCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

// Mock regatta fantasy contests - separated by gender
const mockContests = [
  {
    id: "1",
    regattaName: "IRA Men's Championship 2025",
    type: "H2H" as const,
    genderCategory: "Men's" as const,
    entryFee: 15,
    prize: 25,
    capacity: 2,
    filled: 1,
    lockTime: "2 hours",
    divisions: ["Heavyweight V8+", "Lightweight V8+", "V4+"],
    minPicks: 2,
    maxPicks: 3,
  },
  {
    id: "2",
    regattaName: "NCAA Women's Championship 2025",
    type: "SMALL_FIELD" as const,
    genderCategory: "Women's" as const,
    entryFee: 10,
    prize: 50,
    capacity: 5,
    filled: 3,
    lockTime: "6 hours",
    divisions: ["Varsity 8+", "Second Varsity 8+", "Varsity 4+"],
    minPicks: 2,
    maxPicks: 3,
  },
  {
    id: "3",
    regattaName: "Eastern Sprints Men's 2025",
    type: "FULL_REGATTA" as const,
    genderCategory: "Men's" as const,
    entryFee: 25,
    prize: 200,
    capacity: 20,
    filled: 12,
    lockTime: "1 day",
    divisions: ["Heavyweight V8+", "Lightweight V8+", "V4+", "Freshman 8+"],
    minPicks: 3,
    maxPicks: 5,
  },
  {
    id: "4",
    regattaName: "Head of the Charles Women's 2025",
    type: "SMALL_FIELD" as const,
    genderCategory: "Women's" as const,
    entryFee: 12,
    prize: 80,
    capacity: 8,
    filled: 5,
    lockTime: "12 hours",
    divisions: ["Championship Eights", "Collegiate Eights", "Youth Eights"],
    minPicks: 2,
    maxPicks: 4,
  },
];

const Lobby = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Regatta Fantasy Contests</h1>
            <p className="text-xl text-muted-foreground">
              Draft multiple crews, earn automatic points based on race results. Skill-based, fixed prizes.
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
