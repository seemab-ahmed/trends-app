import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface Props {
  participants: number;
  monthYear: string;
}

export default function PreviousMonthCard({ participants, monthYear }: Props) {
  return (
    <Card className="rounded-3xl bg-white border-0 shadow-[0_0_10px_rgba(0,0,0,0.15)]  px-6 py-4 font-poppins text-black">
      <CardHeader className="pb-3 px-0">
        <CardTitle className="text-base font-semibold text-black">
          Previous Month Participants
        </CardTitle>
      </CardHeader>

      <CardContent className="px-0 pt-0">
        <div className="flex items-center justify-between">
          {/* Left: Month Box */}
          <div className="bg-gray-300 rounded-full px-6 py-1.5 min-w-[220px] text-center">
            <span className="text-xs text-black font-medium tracking-wide">
              {monthYear || "2025-09"}
            </span>
          </div>

          {/* Right: Participant Number */}
          <div className="text-4xl font-bold text-black leading-none">
            {participants || 0}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
