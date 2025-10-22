import { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { useToast } from "@/hooks/use-toast";
import stateStatuses from "@/data/stateStatuses.json";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const STATE_NAMES: Record<string, string> = {
  "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas", "06": "California",
  "08": "Colorado", "09": "Connecticut", "10": "Delaware", "12": "Florida", "13": "Georgia",
  "15": "Hawaii", "16": "Idaho", "17": "Illinois", "18": "Indiana", "19": "Iowa",
  "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine", "24": "Maryland",
  "25": "Massachusetts", "26": "Michigan", "27": "Minnesota", "28": "Mississippi", "29": "Missouri",
  "30": "Montana", "31": "Nebraska", "32": "Nevada", "33": "New Hampshire", "34": "New Jersey",
  "35": "New Mexico", "36": "New York", "37": "North Carolina", "38": "North Dakota", "39": "Ohio",
  "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island", "45": "South Carolina",
  "46": "South Dakota", "47": "Tennessee", "48": "Texas", "49": "Utah", "50": "Vermont",
  "51": "Virginia", "53": "Washington", "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming"
};

const STATE_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA",
  "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV",
  "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN",
  "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"
};

const statusColors: Record<string, string> = {
  permitted: "hsl(var(--success))",
  restricted: "hsl(var(--warning))",
  banned: "hsl(var(--muted))",
};

export const StateAvailabilityMap = () => {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const { toast } = useToast();

  const getStateStatus = (geoId: string): string => {
    const abbr = STATE_ABBR[geoId];
    return abbr ? stateStatuses[abbr as keyof typeof stateStatuses] || "unknown" : "unknown";
  };

  const getStateName = (geoId: string): string => {
    return STATE_NAMES[geoId] || "Unknown";
  };

  const handleStateClick = (geoId: string) => {
    const stateName = getStateName(geoId);
    const status = getStateStatus(geoId);
    const text = `${stateName}: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: text,
      duration: 2000,
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="relative">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{
            scale: 1000,
          }}
          className="w-full h-auto"
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const status = getStateStatus(geo.id);
                const isHovered = hoveredState === geo.id;
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={statusColors[status] || statusColors.banned}
                    stroke="hsl(var(--border))"
                    strokeWidth={isHovered ? 2 : 0.5}
                    opacity={hoveredState && !isHovered ? 0.5 : 1}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", cursor: "pointer" },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={() => setHoveredState(geo.id)}
                    onMouseLeave={() => setHoveredState(null)}
                    onClick={() => handleStateClick(geo.id)}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>

        {/* Hover Tooltip */}
        {hoveredState && (
          <div className="absolute top-4 left-4 bg-card border border-border rounded-lg px-4 py-2 shadow-lg pointer-events-none">
            <p className="font-semibold text-sm">{getStateName(hoveredState)}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {getStateStatus(hoveredState)}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: statusColors.permitted }}
          />
          <span className="text-sm font-medium">Permitted</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: statusColors.restricted }}
          />
          <span className="text-sm font-medium">Restricted</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: statusColors.banned }}
          />
          <span className="text-sm font-medium">Banned</span>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Click any state to copy its status to clipboard
      </p>
    </div>
  );
};
