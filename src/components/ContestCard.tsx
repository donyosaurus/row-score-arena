import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";

type GenderCategory = "Men's" | "Women's";

interface ContestCardProps {
  id: string;
  regattaName: string;
  genderCategory: GenderCategory;
  lockTime: string;
  divisions?: string[];
  entryTiers: number;
}

export const ContestCard = ({
  id,
  regattaName,
  genderCategory,
  lockTime,
  divisions = [],
  entryTiers,
}: ContestCardProps) => {
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
            {entryTiers} Entry Options Available
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

        {/* Entry Options */}
        <div className="space-y-3 pt-2">
          <div className="p-3 rounded-lg bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Head-to-Head</span>
              <span className="text-sm text-muted-foreground">3 options</span>
            </div>
            <p className="text-xs text-muted-foreground">$10, $25, or $100 entry</p>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">5-Person Contest</span>
              <span className="text-sm text-muted-foreground">1 option</span>
            </div>
            <p className="text-xs text-muted-foreground">$20 entry</p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Locks in
            </span>
            <span className="font-semibold">{lockTime}</span>
          </div>
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
