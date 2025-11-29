import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api-config";

interface Prediction {
  id: string;
  direction: "up" | "down";
  status: string;
  createdAt: string;
  asset: {
    name: string;
    symbol: string;
    type: "crypto" | "stock" | "forex";
  };
}

export default function PredictionHistory() {
  const { user } = useAuth();

  const { data: predictions, isLoading } = useQuery<Prediction[]>({
    queryKey: [API_ENDPOINTS.PREDICTIONS(), user?.id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const getLogo = (type: string) => {
    switch (type) {
      case "crypto":
        return "/images/crypto-logo2.jpeg";
      case "stock":
        return "/images/stock-logo2.jpeg";
      case "forex":
        return "/images/forex-logo2.jpeg";
      default:
        return "/images/crypto-logo2.jpeg";
    }
  };

  // ✅ Always show up to 5 rows
  const allPredictions = Array.isArray(predictions)
    ? predictions.slice(0, 5)
    : [];
  const placeholders = Array.from({ length: 5 - allPredictions.length });

  return (
    <Card className="bg-white  h-full border-0 rounded-2xl  text-black font-poppins shadow-[0_0_10px_rgba(0,0,0,0.15)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-black text-lg">Prediction History</CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          // 🧱 Static placeholders (no animation)
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={`loading-${i}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-[#2f343a]" />
                  <div>
                    <div className="h-4 w-24 bg-[#2f343a] rounded mb-1"></div>
                    <div className="h-3 w-16 bg-[#2f343a] rounded"></div>
                  </div>
                </div>
                <div className="h-4 w-20 bg-[#2f343a] rounded"></div>
              </div>
            ))}
          </div>
        ) : allPredictions.length === 0 ? (
          // ✅ Show message when no predictions exist
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            No predictions yet
          </div>
        ) : (
          // ✅ Real predictions
          <div className="space-y-4">
            {allPredictions.map((prediction) => {
              const isUp = prediction.direction === "up";

              // Safe fallback for any date field
              const rawDate =
                (prediction as any).timestampCreated ||
                (prediction as any).createdAt ||
                (prediction as any).date ||
                null;

              const date = rawDate
                ? new Date(rawDate).toLocaleDateString("en-GB")
                : "-";

              return (
                <div
                  key={prediction.id}
                  className="flex items-center justify-between min-h-[58px]"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={getLogo(prediction.asset.type)}
                      alt={prediction.asset.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-sm font-medium">
                        {prediction.asset.name}
                      </div>
                      <div className="text-xs text-gray-400 capitalize">
                        {prediction.status}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-gray-400">{date}</div>
                    <div
                      className={`flex items-center justify-end text-sm font-semibold ${
                        isUp ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {isUp ? (
                        <>
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Up
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 mr-1" />
                          Down
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
