import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, Users } from "lucide-react";

interface ContestCardProps {
  id: string;
  eventName: string;
  raceName: string;
  type: "H2H" | "CAP_N";
  entryFee: number;
  prize: number;
  capacity: number;
  filled: number;
  lockTime: string;
}

export const ContestCard = ({
  id,
  eventName,
  raceName,
  type,
  entryFee,
  prize,
  capacity,
  filled,
  lockTime,
}: ContestCardProps) => {
  const fillPercentage = (filled / capacity) * 100;
  
  return (
    <Card className="transition-smooth hover:shadow-lg hover:scale-[1.02]">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{eventName}</p>
            <h3 className="font-bold text-lg text-foreground mt-1">{raceName}</h3>
          </div>
          <Badge variant={type === "H2H" ? "default" : "secondary"}>
            {type === "H2H" ? "Head-to-Head" : `${capacity} Entrants`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Entry</p>
              <p className="font-semibold text-foreground">${entryFee}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Prize</p>
              <p className="font-semibold text-success">${prize}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              {filled}/{capacity}
            </span>
            <span className="text-muted-foreground">{fillPercentage.toFixed(0)}% filled</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Locks {lockTime}</span>
        </div>
      </CardContent>

      <CardFooter>
        <Link to={`/contest/${id}`} className="w-full">
          <Button variant="hero" className="w-full">
            View Contest
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
