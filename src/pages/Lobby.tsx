import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContestCard } from "@/components/ContestCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

// 2026 Season Regattas
const mockRegattas = [
  {
    id: "1",
    regattaName: "Eastern Sprints Regatta 2026",
    genderCategory: "Men's" as const,
    lockTime: "May 17, 2026 at 8:00 AM",
    divisions: ["Heavyweight Varsity 8+", "Lightweight Varsity 8+", "Varsity 4+"],
    entryTiers: 4,
  },
  {
    id: "2",
    regattaName: "IRA National Championship 2026",
    genderCategory: "Men's" as const,
    lockTime: "May 29, 2026 at 9:00 AM",
    divisions: ["Heavyweight Varsity 8+", "Lightweight Varsity 8+", "Second Varsity 8+"],
    entryTiers: 4,
  },
  {
    id: "3",
    regattaName: "Women's NCAA Championship 2026",
    genderCategory: "Women's" as const,
    lockTime: "May 30, 2026 at 10:00 AM",
    divisions: ["Varsity 8+", "Second Varsity 8+", "Varsity 4+"],
    entryTiers: 4,
  },
  {
    id: "4",
    regattaName: "World Rowing Cup II 2026",
    genderCategory: "Men's" as const,
    lockTime: "June 13, 2026 at 3:00 AM",
    divisions: ["Men's Eight", "Men's Four", "Men's Pair", "Men's Single Sculls"],
    entryTiers: 4,
  },
  {
    id: "5",
    regattaName: "U23 World Rowing Championships 2026",
    genderCategory: "Men's" as const,
    lockTime: "June 24, 2026 at 4:00 AM",
    divisions: ["Men's Eight", "Men's Four", "Men's Pair", "Men's Double Sculls"],
    entryTiers: 4,
  },
  {
    id: "6",
    regattaName: "World Rowing Cup III 2026",
    genderCategory: "Women's" as const,
    lockTime: "June 27, 2026 at 3:00 AM",
    divisions: ["Women's Eight", "Women's Four", "Women's Pair", "Women's Single Sculls"],
    entryTiers: 4,
  },
  {
    id: "7",
    regattaName: "European Rowing Championships 2026",
    genderCategory: "Men's" as const,
    lockTime: "July 31, 2026 at 3:00 AM",
    divisions: ["Men's Eight", "Men's Four", "Men's Pair", "Men's Quad Sculls"],
    entryTiers: 4,
  },
  {
    id: "8",
    regattaName: "U19 World Rowing Championships 2026",
    genderCategory: "Women's" as const,
    lockTime: "August 7, 2026 at 3:00 AM",
    divisions: ["Women's Eight", "Women's Four", "Women's Pair", "Women's Quad Sculls"],
    entryTiers: 4,
  },
  {
    id: "9",
    regattaName: "World Rowing Championships 2026",
    genderCategory: "Men's" as const,
    lockTime: "August 25, 2026 at 3:00 AM",
    divisions: ["Men's Eight", "Men's Four", "Men's Pair", "Men's Single Sculls", "Men's Quad Sculls"],
    entryTiers: 4,
  },
];

const Lobby = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Available Regattas</h1>
            <p className="text-xl text-muted-foreground">
              2026 Season • Select a regatta and choose from 4 entry options: 3 Head-to-Head ($10, $25, $100) or 1 5-Person ($20) contest
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
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="mens">Men's</SelectItem>
                <SelectItem value="womens">Women's</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue placeholder="Lock Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Times</SelectItem>
                <SelectItem value="soon">Next 6 hours</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Regatta Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockRegattas
              .filter(regatta => regatta.id !== "1" && regatta.id !== "3") // Temporarily hide Eastern Sprints and Women's NCAA
              .map((regatta) => (
                <ContestCard 
                  key={regatta.id} 
                  id={regatta.id}
                  regattaName={regatta.regattaName}
                  genderCategory={regatta.genderCategory}
                  lockTime={regatta.lockTime}
                  divisions={regatta.divisions}
                  entryTiers={regatta.entryTiers}
                />
              ))}
          </div>

          {/* Empty State (hidden when contests exist) */}
          {mockRegattas.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground mb-4">
                No regattas available right now
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
