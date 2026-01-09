import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContestCard } from "@/components/ContestCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ContestPool {
  id: string;
  lock_time: string;
  status: string;
  entry_fee_cents: number;
  contest_templates: {
    regatta_name: string;
  };
  contest_pool_crews: {
    event_id: string;
  }[];
}

interface MappedContest {
  id: string;
  regattaName: string;
  genderCategory: "Men's" | "Women's";
  lockTime: string;
  divisions: string[];
  entryTiers: number;
}

const Lobby = () => {
  const [contests, setContests] = useState<MappedContest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContests = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("contest_pools")
        .select(`
          id,
          lock_time,
          status,
          entry_fee_cents,
          contest_templates(regatta_name),
          contest_pool_crews(event_id)
        `)
        .in("status", ["open", "locked"]);

      if (error) {
        console.error("Error fetching contests:", error);
        setLoading(false);
        return;
      }

      const mapped: MappedContest[] = (data as unknown as ContestPool[]).map((pool) => {
        const regattaName = pool.contest_templates?.regatta_name || "Unknown Regatta";
        const genderCategory: "Men's" | "Women's" = regattaName.toLowerCase().includes("women") 
          ? "Women's" 
          : "Men's";
        
        const divisions = [...new Set(pool.contest_pool_crews?.map(c => c.event_id) || [])];
        
        const lockTime = new Date(pool.lock_time).toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        return {
          id: pool.id,
          regattaName,
          genderCategory,
          lockTime,
          divisions,
          entryTiers: 1,
        };
      });

      setContests(mapped);
      setLoading(false);
    };

    fetchContests();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 bg-background py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Available Contests</h1>
            <p className="text-xl text-muted-foreground">
              Browse open contests and enter to compete
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

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Contest Grid */}
          {!loading && contests.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {contests.map((contest) => (
                <ContestCard 
                  key={contest.id} 
                  id={contest.id}
                  regattaName={contest.regattaName}
                  genderCategory={contest.genderCategory}
                  lockTime={contest.lockTime}
                  divisions={contest.divisions}
                  entryTiers={contest.entryTiers}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && contests.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground mb-4">
                No contests available right now
              </p>
              <p className="text-muted-foreground">
                Check back soon for new contests
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
