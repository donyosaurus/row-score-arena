import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, Trophy, Clock } from "lucide-react";

type ContestType = "H2H" | "CAP_N" | "SMALL_FIELD" | "FULL_REGATTA";
type GenderCategory = "Men's" | "Women's";

interface ContestCardProps {
  id: string;
  regattaName: string;
  type: ContestType;
  genderCategory: GenderCategory;
  entryFee: number;
  prize: number;
  capacity: number;
  filled: number;
  lockTime: string;
  divisions?: string[];
  minPicks?: number;
  maxPicks?: number;
}

export const ContestCard = ({
  id,
  regattaName,
  type,
  genderCategory,
  entryFee,
  prize,
  capacity,
  filled,
  lockTime,
  divisions = [],
  minPicks = 2,
  maxPicks = 4,
}: ContestCardProps) => {
  const contestTypeLabel = type === "H2H" ? "H2H" : type === "SMALL_FIELD" ? `Cap-${capacity}` : "Full Regatta";

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
              {contestTypeLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {genderCategory} • Pick {minPicks}-{maxPicks} crews
          </p>
        </div>

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

        {/* Details */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Entry Fee
            </span>
            <span className="font-semibold text-lg">${entryFee.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="h-4 w-4 text-accent" />
              Fixed Prize
            </span>
            <span className="font-bold text-lg text-accent">${prize.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Entries
            </span>
            <span className="font-semibold">
              {filled} of {capacity}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Locks in
            </span>
            <span className="font-semibold">{lockTime}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Link to={`/contest/${id}`} className="w-full">
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-6 rounded-xl"
          >
            Enter Contest
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
