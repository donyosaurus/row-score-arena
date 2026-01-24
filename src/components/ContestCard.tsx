import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Trophy, Award, Medal } from "lucide-react";

type GenderCategory = "Men's" | "Women's";

interface ContestCardProps {
  id: string;
  regattaName: string;
  genderCategory: GenderCategory;
  lockTime: string;
  divisions?: string[];
  entryTiers: number;
  payoutStructure?: Record<string, number> | null;
  prizePoolCents?: number;
}

// Format cents to dollars (always show 2 decimal places)
const formatCents = (cents: number): string => {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
};

// Get ordinal suffix for ranks
const getOrdinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const ContestCard = ({
  id,
  regattaName,
  genderCategory,
  lockTime,
  divisions = [],
  entryTiers,
  payoutStructure,
  prizePoolCents = 0,
}: ContestCardProps) => {
  // Calculate total prizes from payout structure
  const hasPayoutStructure = payoutStructure && Object.keys(payoutStructure).length > 0;
  const firstPlacePrize = hasPayoutStructure ? payoutStructure["1"] : 0;
  const totalPrizes = hasPayoutStructure 
    ? Object.values(payoutStructure).reduce((sum, val) => sum + val, 0)
    : prizePoolCents;

  return (
    <Card className="flex flex-col h-full transition-smooth hover:shadow-md border-border/50">
      <CardContent className="flex-1 p-6 space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-xl leading-tight">{regattaName}</h3>
            <Badge 
              variant="secondary" 
              className="flex-shrink-0 bg-primary/10 text-primary border-primary/20 font-medium px-3 py-1"
            >
              {genderCategory}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Join fantasy contests at every popular regatta
          </p>
        </div>

        {/* Prize Pool Display */}
        {(hasPayoutStructure || totalPrizes > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                <Trophy className="h-3 w-3 mr-1" />
                Guaranteed Prizes
              </Badge>
            </div>
            
            {hasPayoutStructure ? (
              <div className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200/50 dark:border-amber-800/30">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    1st Place: {formatCents(firstPlacePrize)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total Prizes: {formatCents(totalPrizes)}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/30">
                <span className="font-semibold">Prize Pool: {formatCents(totalPrizes)}</span>
              </div>
            )}
          </div>
        )}

        {/* Divisions */}
        {divisions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Available Divisions</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {divisions.slice(0, 3).map((division, idx) => (
                <Badge key={idx} variant="outline" className="font-normal">
                  {division}
                </Badge>
              ))}
              {divisions.length > 3 && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  +{divisions.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Lock Time */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Locks in
          </span>
          <span className="font-semibold">{lockTime}</span>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Link to={`/regatta/${id}`} className="w-full">
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-6 rounded-xl"
          >
            View Entry Options
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
