
// 3columns code

import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api-config";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Trophy, Crown } from "lucide-react";
import { Image } from "@radix-ui/react-avatar";


import img1 from "../../public/images/bach1.png";
import img2 from "../../public/images/bach2.png";
import img3 from "../../public/images/bach3.png";

const images = [img1, img2, img3];

type MiniLeaderboardResponse = {
  topThree: Array<{
    userId: string;
    username: string;
    points: number;
    totalPredictions: number;
    correctPredictions: number;
  }>; // now contains up to 7 users (top 7)
  stockKing: { userId: string; username: string; points: number } | null;
  cryptoKing: { userId: string; username: string; points: number } | null;
};

function RankMedal({ rank }: { rank: number }) {
  const colors = {
    1: "text-black text-[20px] ml-3",
    2: "text-black text-[20px] ml-3",
    3: "text-black text-[20px] ml-3",
  } as const;
  const emojis = { 1: "#1", 2: "#2", 3: "#3" } as const;

  // 🏅 Show medals for top 3, numeric badges for rest
  if (rank <= 3) {
    return (
      <span className={`text-lg ${colors[rank as 1 | 2 | 3]}`}>
        {emojis[rank as 1 | 2 | 3]}
      </span>
    );
  }

  return (
    <span className="text-xs bg-red-400 text-white px-2 py-1 rounded-md">
      #{rank}
    </span>
  );
}

export default function MiniLeaderboard() {
  const { data, isLoading } = useQuery<MiniLeaderboardResponse>({
    queryKey: [API_ENDPOINTS.LEADERBOARD_MINI()],
  });

  const allUsers = data?.topThree || [];
  const topThree = allUsers.slice(0, 3);
  const nextFour = allUsers.slice(3, 7);
  const stockKing = data?.stockKing || null;
  const cryptoKing = data?.cryptoKing || null;

  return (
    // bg-gradient-to-r from-gray-100 to-white
    <Card className="rounded-3xl bg-white p-6  border-0 font-poppins shadow-[0_0_10px_rgba(0,0,0,0.15)]">
      <CardHeader className=" p-0 pb-2 ">
        <CardTitle className="text-[24px] flex items-center gap-2 text-black">
          <Trophy className="h-4 w-4 text-yellow-400" />
          Top 3 All Time
        </CardTitle>
        <CardDescription className="text-neutral-400 text-xs">
          Total points across all evaluated predictions
        </CardDescription>
      </CardHeader>

      <CardContent className="px-3 py-6 shadow-[0_0_10px_rgba(0,0,0,0.15)] grid rounded-[10px] xl:grid-cols-3 lg:grid-cols-2 grid-cols-1 gap-4 ">
        {/* --- Leaderboard --- */}
        {isLoading ? (
          <div className="text-xs text-neutral-400">Loading...</div>
        ) : allUsers.length === 0 ? (
          <div className="text-xs text-neutral-400">No data yet</div>
        ) : (

          <>
          <div className="grid bg-gradient-to-r from-blue-600 to-blue-400  grid-cols-1 gap-4 shadow-[0_0_10px_rgba(0,0,0,0.15)]  px-4 py-3 rounded-[10px]">
            {/* Top 3 */}
            {/* grid  grid-cols-3 gap-4  px-3 py-6 shadow-[0_0_10px_rgba(0,0,0,0.15)]*/}
            <div className="space-y-2 rounded-[10px] from-blue-600 to-blue-400 text-white font-[700]  ">
             {topThree.map((u, i) => {
              const bgColor =
                i === 0  
                // bg-[radial-gradient(circle_at_30%_30%,#f7d681_0%,#d9a441_60%,#c3872c_100%)] , bg-[radial-gradient(circle_at_30%_30%,#e9ecef_0%,#cdd2d6_50%,#9aa0a6_100%)] ,bg-[radial-gradient(circle_at_30%_30%,#f0c3a1_0%,#c78b56_50%,#9b6233_100%)]
                  ? "text-white font-[700] rounded-[10px] p-1 shadow-[0_0_10px_rgba(0,0,0,0.15)]  "
                  : i === 1
                  ? "text-white font-[700] rounded-[10px] p-1 shadow-[0_0_10px_rgba(0,0,0,0.15)]  "
                  : "text-white font-[700] rounded-[10px] p-1 shadow-[0_0_10px_rgba(0,0,0,0.15)]  ";

              return (
                <div
                  key={u.userId}
                  className={` flex relative items-start  gap-2 flex-col justify-start  ${bgColor}`}
                >
                  {/* <RankMedal rank={i + 1} /> */}
                  <div className="flex justify-between gap-3 items-center w-full"> 

                  <div className="flex items-center gap-0">
                    <Avatar className="w-[50x] h-[50px]">
                      <AvatarImage src={images[i]} alt={u.username} />
                      <AvatarFallback>{u.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                     
                   <div className="flex flex-col ">
                     <span className="text-[16px] text-white   ">
                      {u.username}
                    </span>
                    <span className="text-[10px] text-white ">{u.points} Points</span>
                   </div>
                    
                  
                  </div>

                    </div>
                  {/* IMAGE */}
                     {/* <Avatar className="w-[100x] h-[100px] !absolute top-0 bottom-0 m-auto right-[10px]">
                      <AvatarImage src={images[i]} alt={u.username} />
                      <AvatarFallback>{u.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar> */}
               </div>
              );
            })}
            </div>

            {/* Divider */}
            {/* {nextFour.length > 0 && (
              <div className="pt-3 border-t border-[#2a2d33]" />
            )} */}

            {/* Ranks 4–7 */}
            {/* {nextFour.length > 0 && (
              <div className="space-y-1 rounded-[10px] bg-white px-4 py-6 shadow-[0_0_10px_rgba(0,0,0,0.15)]">
                {nextFour.map((u, i) => (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between text-neutral-300 p-2 bg-gray-100 rounded-[10px]"
                  >
                    <div className="flex items-center gap-2">
                      <RankMedal rank={i + 4} />
                      <span className="text-xs font-[700] text-black">
                        {u.username}
                      </span>
                    </div>
                    <div className="text-xs tabular-nums  font-[700] text-green-700">
                      {u.points}
                    </div>
                  </div>
                ))}
              </div>
            )} */}
            </div>
          </>
        )}
        {/* Divider before crowns */}
        {/* <div className="pt-3 border-t border-[#2a2d33]" /> */}

        {/* --- Special Titles --- */}
        
          {/* 🏆 Stock King */}
          <div className="flex h-[214px] items-start relative justify-center flex-col gap-3  rounded-[10px]  p-6 bg-gradient-to-r from-red-600 to-red-400">
            <div className="flex items-center gap-4 mt-[-30px]  ">
              <Crown className="h-[50px] w-[50px] text-white" />
              <span className="text-[20px] font-[600] text-white">Stock King</span>
            </div>
            {stockKing ? (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-[36px] tabular-nums font-[700] text-white ">
                  {stockKing.points}
                </span>
                <span className="text-[18px] text-white">{stockKing.username}</span>
                
              </div>
            ) : (
              <span className="text-xs text-white">—</span>
            )}
            <div className="absolute bottom-[15px] right-[-30px]">
              <svg width="220" height="90" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
                <rect x="15"  y="60" width="12" height="20" fill="rgba(255,255,255,0.55)" />
                  <rect x="45"  y="50" width="12" height="30" fill="rgba(255,255,255,0.55)" />
                  <rect x="75"  y="45" width="12" height="35" fill="rgba(255,255,255,0.55)" />
                  <rect x="105" y="35" width="12" height="45" fill="rgba(255,255,255,0.55)" />
                  <rect x="135" y="25" width="12" height="55" fill="rgba(255,255,255,0.55)" />
                  <polyline
                    points="21,60 51,50 81,45 111,35 141,25"
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>

            </div>
          </div>

          {/* 👑 Crypto King */}
          <div className="flex h-[214px] justify-center relative bg-gradient-to-r from-yellow-600 to-yellow-300 flex-col gap-3 items-start  rounded-[10px]  p-6">
            <div className="flex items-center gap-4 mt-[-30px]">
              <Crown className="h-[50px] w-[50px] text-white" />
              <span className="text-[20px] font-[600] text-white">
                Crypto King
              </span>
            </div>
            {cryptoKing ? (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-[36px] tabular-nums font-[600] text-white ">
                  {cryptoKing.points}
                </span>
                <span className="text-[18px] text-white">
                  {cryptoKing.username}
                </span>
                
              </div>
            ) : (
              <span className="text-xs text-white">—</span>
            )}
            <div className="absolute bottom-[15px] right-[-30px]">
             <svg width="220" height="90" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="
                    M15 55
                    L50 48
                    L75 60
                    L110 35
                    L140 60
                    L170 45
                    L170 90
                    L15 90
                    Z
                  "
                  fill="rgba(255,255,255,0.20)"
                />
                <polyline
                  points="15,55 50,48 75,60 110,35 140,60 170,45"
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>


            </div>

          </div>
          
      </CardContent>
    </Card>
  );
}















// 2 columns code 


// import { useQuery } from "@tanstack/react-query";
// import { API_ENDPOINTS } from "@/lib/api-config";
// import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// import {
//   Card,
//   CardHeader,
//   CardTitle,
//   CardContent,
//   CardDescription,
// } from "@/components/ui/card";
// import { Trophy, Crown } from "lucide-react";
// import { Image } from "@radix-ui/react-avatar";


// import img1 from "../../public/images/bach1.png";
// import img2 from "../../public/images/bach2.png";
// import img3 from "../../public/images/bach3.png";

// const images = [img1, img2, img3];

// type MiniLeaderboardResponse = {
//   topThree: Array<{
//     userId: string;
//     username: string;
//     points: number;
//     totalPredictions: number;
//     correctPredictions: number;
//   }>; // now contains up to 7 users (top 7)
//   stockKing: { userId: string; username: string; points: number } | null;
//   cryptoKing: { userId: string; username: string; points: number } | null;
// };

// function RankMedal({ rank }: { rank: number }) {
//   const colors = {
//     1: "text-black text-[20px] ml-3",
//     2: "text-black text-[20px] ml-3",
//     3: "text-black text-[20px] ml-3",
//   } as const;
//   const emojis = { 1: "#1", 2: "#2", 3: "#3" } as const;

//   // 🏅 Show medals for top 3, numeric badges for rest
//   if (rank <= 3) {
//     return (
//       <span className={`text-lg ${colors[rank as 1 | 2 | 3]}`}>
//         {emojis[rank as 1 | 2 | 3]}
//       </span>
//     );
//   }

//   return (
//     <span className="text-xs bg-red-400 text-white px-2 py-1 rounded-md">
//       #{rank}
//     </span>
//   );
// }

// export default function MiniLeaderboard() {
//   const { data, isLoading } = useQuery<MiniLeaderboardResponse>({
//     queryKey: [API_ENDPOINTS.LEADERBOARD_MINI()],
//   });

//   const allUsers = data?.topThree || [];
//   const topThree = allUsers.slice(0, 3);
//   const nextFour = allUsers.slice(3, 7);
//   const stockKing = data?.stockKing || null;
//   const cryptoKing = data?.cryptoKing || null;

//   return (
//     // bg-gradient-to-r from-gray-100 to-white
//     <Card className="rounded-3xl bg-white p-6  border-0 font-poppins shadow-[0_0_10px_rgba(0,0,0,0.15)]">
//       <CardHeader className=" p-0 pb-2 ">
//         <CardTitle className="text-[24px] flex items-center gap-2 text-black">
//           <Trophy className="h-4 w-4 text-yellow-400" />
//           Top 3 All Time
//         </CardTitle>
//         <CardDescription className="text-neutral-400 text-xs">
//           Total points across all evaluated predictions
//         </CardDescription>
//       </CardHeader>

//       <CardContent className="px-3 py-6 shadow-[0_0_10px_rgba(0,0,0,0.15)] grid rounded-[10px] grid-cols-2 gap-4 ">
//         {/* --- Leaderboard --- */}
//         {isLoading ? (
//           <div className="text-xs text-neutral-400">Loading...</div>
//         ) : allUsers.length === 0 ? (
//           <div className="text-xs text-neutral-400">No data yet</div>
//         ) : (

//           <>
//           <div className="grid bg-gradient-to-r from-blue-600 to-blue-400  grid-cols-1 gap-4 shadow-[0_0_10px_rgba(0,0,0,0.15)]  px-4 py-3 rounded-[10px]">
//             {/* Top 3 */}
//             {/* grid  grid-cols-3 gap-4  px-3 py-6 shadow-[0_0_10px_rgba(0,0,0,0.15)]*/}
//             <div className="space-y-2 rounded-[10px] from-blue-600 to-blue-400 text-white font-[700]  ">
//              {topThree.map((u, i) => {
//               const bgColor =
//                 i === 0  
//                 // bg-[radial-gradient(circle_at_30%_30%,#f7d681_0%,#d9a441_60%,#c3872c_100%)] , bg-[radial-gradient(circle_at_30%_30%,#e9ecef_0%,#cdd2d6_50%,#9aa0a6_100%)] ,bg-[radial-gradient(circle_at_30%_30%,#f0c3a1_0%,#c78b56_50%,#9b6233_100%)]
//                   ? "bg-[radial-gradient(circle_at_30%_30%,#f7d681_0%,#d9a441_60%,#c3872c_100%)] text-white font-[700] rounded-[10px] p-2 shadow-[0_0_10px_rgba(0,0,0,0.15)]  "
//                   : i === 1
//                   ? "bg-[radial-gradient(circle_at_30%_30%,#e9ecef_0%,#cdd2d6_50%,#9aa0a6_100%)] text-white font-[700] rounded-[10px] p-2 shadow-[0_0_10px_rgba(0,0,0,0.15)]  "
//                   : "bg-[radial-gradient(circle_at_30%_30%,#f0c3a1_0%,#c78b56_50%,#9b6233_100%)] text-white font-[700] rounded-[10px] p-2 shadow-[0_0_10px_rgba(0,0,0,0.15)]  ";

//               return (
//                 <div
//                   key={u.userId}
//                   className={` flex relative items-start  gap-2 flex-col justify-start  ${bgColor}`}
//                 >
//                   <RankMedal rank={i + 1} />
//                   <div className="flex justify-between gap-3 items-center w-full"> 

//                   <div className="flex items-center gap-2">
//                     <Avatar className="w-[80x] h-[80px]">
//                       <AvatarImage src={images[i]} alt={u.username} />
//                       <AvatarFallback>{u.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
//                     </Avatar>
                     
//                    <div className="flex flex-col ">
//                      <span className="text-[16px] text-black   ">
//                       {u.username}
//                     </span>
//                     <span className="text-[10px] text-black ">total points</span>
//                    </div>
                    
                  
//                   </div>
//                   <div className="text-sm w-[50px] text-black h-[50px]  flex items-center justify-center tabular-nums font-[600] rounded-[50px] bg-white border-[7px] border-gray-400 p-2 ">
//                         {u.points}
//                     </div>

//                     </div>
//                   {/* IMAGE */}
//                      {/* <Avatar className="w-[100x] h-[100px] !absolute top-0 bottom-0 m-auto right-[10px]">
//                       <AvatarImage src={images[i]} alt={u.username} />
//                       <AvatarFallback>{u.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
//                     </Avatar> */}
//                </div>
//               );
//             })}
//             </div>

//             {/* Divider */}
//             {/* {nextFour.length > 0 && (
//               <div className="pt-3 border-t border-[#2a2d33]" />
//             )} */}

//             {/* Ranks 4–7 */}
//             {/* {nextFour.length > 0 && (
//               <div className="space-y-1 rounded-[10px] bg-white px-4 py-6 shadow-[0_0_10px_rgba(0,0,0,0.15)]">
//                 {nextFour.map((u, i) => (
//                   <div
//                     key={u.userId}
//                     className="flex items-center justify-between text-neutral-300 p-2 bg-gray-100 rounded-[10px]"
//                   >
//                     <div className="flex items-center gap-2">
//                       <RankMedal rank={i + 4} />
//                       <span className="text-xs font-[700] text-black">
//                         {u.username}
//                       </span>
//                     </div>
//                     <div className="text-xs tabular-nums  font-[700] text-green-700">
//                       {u.points}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )} */}
//             </div>
//           </>
//         )}
//         {/* Divider before crowns */}
//         {/* <div className="pt-3 border-t border-[#2a2d33]" /> */}

//         {/* --- Special Titles --- */}
//         <div className="grid  grid-cols-1 gap-4">
//           {/* 🏆 Stock King */}
//           <div className="flex items-start relative justify-center flex-col gap-5  rounded-[10px]  p-6 bg-gradient-to-r from-red-600 to-red-400">
//             <div className="flex items-center gap-4  pb-3 ">
//               <Crown className="h-[50px] w-[50px] text-white" />
//               <span className="text-[20px] font-[600] text-white">Stock King</span>
//             </div>
//             {stockKing ? (
//               <div className="flex items-center gap-2 ml-4">
//                 <span className="text-[36px] tabular-nums font-[700] text-white ">
//                   {stockKing.points}
//                 </span>
//                 <span className="text-[18px] text-white">{stockKing.username}</span>
                
//               </div>
//             ) : (
//               <span className="text-xs text-white">—</span>
//             )}
//             <div className="absolute bottom-[15px] right-[-30px]">
//               <svg width="220" height="90" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
//   <rect x="15"  y="60" width="12" height="20" fill="rgba(255,255,255,0.55)" />
//   <rect x="45"  y="50" width="12" height="30" fill="rgba(255,255,255,0.55)" />
//   <rect x="75"  y="45" width="12" height="35" fill="rgba(255,255,255,0.55)" />
//   <rect x="105" y="35" width="12" height="45" fill="rgba(255,255,255,0.55)" />
//   <rect x="135" y="25" width="12" height="55" fill="rgba(255,255,255,0.55)" />
//   <polyline
//     points="21,60 51,50 81,45 111,35 141,25"
//     fill="none"
//     stroke="rgba(255,255,255,0.9)"
//     stroke-width="2.5"
//     stroke-linecap="round"
//     stroke-linejoin="round"
//   />
// </svg>

//             </div>
//           </div>

//           {/* 👑 Crypto King */}
//           <div className="flex justify-center relative bg-gradient-to-r from-yellow-600 to-yellow-300 flex-col gap-5 items-start  rounded-[10px]  p-6">
//             <div className="flex items-center gap-4  pb-3">
//               <Crown className="h-[50px] w-[50px] text-white" />
//               <span className="text-[20px] font-[600] text-white">
//                 Crypto King
//               </span>
//             </div>
//             {cryptoKing ? (
//               <div className="flex items-center gap-2 ml-4">
//                 <span className="text-[36px] tabular-nums font-[600] text-white ">
//                   {cryptoKing.points}
//                 </span>
//                 <span className="text-[18px] text-white">
//                   {cryptoKing.username}
//                 </span>
                
//               </div>
//             ) : (
//               <span className="text-xs text-white">—</span>
//             )}
//             <div className="absolute bottom-[15px] right-[-30px]">
//              <svg width="220" height="90" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
//                 <path
//                   d="
//                     M15 55
//                     L50 48
//                     L75 60
//                     L110 35
//                     L140 60
//                     L170 45
//                     L170 90
//                     L15 90
//                     Z
//                   "
//                   fill="rgba(255,255,255,0.20)"
//                 />
//                 <polyline
//                   points="15,55 50,48 75,60 110,35 140,60 170,45"
//                   fill="none"
//                   stroke="rgba(255,255,255,0.45)"
//                   stroke-width="2.5"
//                   stroke-linecap="round"
//                   stroke-linejoin="round"
//                 />
//               </svg>


//             </div>

//           </div>
          
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
