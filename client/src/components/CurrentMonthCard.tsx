import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

interface Props {
  participants: number;
  monthYear: string;
}

export default function CurrentMonthCard({ participants, monthYear }: Props) {
  return (
    <Card className="bg-[#1E1F25] border border-[#2C2F36] rounded-xl px-6 py-4 font-poppins text-white">
      <CardHeader className="pb-3 px-0">
        <CardTitle className="text-base font-semibold text-white">
          Current Month Participants
        </CardTitle>
      </CardHeader>

      <CardContent className="px-0 pt-0">
        <div className="flex items-center justify-between">
          {/* Left: Month Box */}
          <div className="bg-[#2C2F36] rounded-full px-6 py-1.5 min-w-[220px] text-center">
            <span className="text-xs text-gray-400 font-medium tracking-wide">
              {monthYear || "2025-10"}
            </span>
          </div>

          {/* Right: Participant Number */}
          <div className="text-4xl font-bold text-white leading-none">
            {participants || 0}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
