import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

interface MonthSelectorProps {
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  getAvailableMonths: () => { value: string; label: string }[];
}

export default function MonthSelector({
  selectedMonth,
  setSelectedMonth,
  getAvailableMonths,
}: MonthSelectorProps) {
  return (
    <div
      className="rounded-3xl bg-white  border-0 shadow-[0_0_10px_rgba(0,0,0,0.15)]  p-5 font-poppins 
                 w-full h-full flex flex-col justify-between"
    >
      {/* Top Section: Select Boxes */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 flex-grow">
        {/* Left Side: Two stacked selects */}
        <div className="flex flex-col gap-3 w-full sm:w-auto">
          {/* First select: Select Month */}
          <div className="flex items-center gap-3">
            <div className="bg-gray-300 p-3 rounded-full flex items-center justify-center">
              <Calendar className="h-4 w-4 text-black" />
            </div>
            <Select
              value={selectedMonth}
              onValueChange={(value) => setSelectedMonth(value)}
            >
              <SelectTrigger className="relative w-64 bg-gray-300 text-black border-0 rounded-full h-10 text-sm font-medium focus:ring-0 focus:ring-offset-0">
                <SelectValue
                  placeholder="Select Month"
                  className="text-black data-[placeholder]:text-black placeholder:text-black"
                />
                {/* Custom white arrow */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="white"
                  className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 9l6 6 6-6"
                  />
                </svg>
              </SelectTrigger>
              <SelectContent className="bg-gray-300 text-black border-0 rounded-md">
                {getAvailableMonths().map((month) => (
                  <SelectItem
                    key={month.value}
                    value={month.value}
                    className="hover:bg-gray-400 cursor-pointer"
                  >
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Second select: Previous Month */}
         
        </div>

        {/* Right Side: Current Month Button */}
        <div className="w-full sm:w-auto flex justify-end items-end">
          <Button
            variant="default"
            onClick={() => setSelectedMonth("current")}
            className="bg-blue-600 hover:bg-[#1d4ed8] text-white rounded-full px-6 py-2 text-sm font-medium transition-colors duration-150"
          >
            Current Month
          </Button>
        </div>
      </div>
    </div>
  );
}




//  <div className="flex items-center gap-3">
//             <div className="bg-gray-300 p-3 rounded-full flex items-center justify-center">
//               <Calendar className="h-4 w-4 text-black" />
//             </div>
//             <Select
//               value={selectedMonth}
//               onValueChange={(value) => setSelectedMonth(value)}
//             >
//               <SelectTrigger className="relative w-64 bg-gray-300 text-black border-0 rounded-full h-10 text-sm font-medium focus:ring-0 focus:ring-offset-0">
//                 <SelectValue
//                   placeholder="Previous Month"
//                   className="text-black data-[placeholder]:text-black placeholder:text-black"
//                 />
//                 {/* Custom white arrow */}
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   strokeWidth={2}
//                   stroke="white"
//                   className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     d="M6 9l6 6 6-6"
//                   />
//                 </svg>
//               </SelectTrigger>
//               <SelectContent className="bg-gray-300 text-black border-0 rounded-md">
//                 {getAvailableMonths().map((month) => (
//                   <SelectItem
//                     key={month.value}
//                     value={month.value}
//                     className="hover:bg-gray-400 cursor-pointer"
//                   >
//                     {month.label}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>