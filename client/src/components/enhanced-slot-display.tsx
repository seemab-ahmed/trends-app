import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/api-config';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Clock, Lock, Unlock, TrendingUp, TrendingDown, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../hooks/use-language';

import { API_ENDPOINTS } from "@/lib/api-config";
interface Interval {
  intervalNumber: number;
  start: string;
  end: string;
  points: number;
  label: string;
}

interface Slot {
  slotNumber?: number;
  slotStart: Date | string;
  slotEnd: Date | string;
  slotLabel: string;
  points: number;
  isFirstHalf: boolean;
  isActive?: boolean;
  isValid?: boolean;
}

interface LockStatus {
  isLocked: boolean;
  timeUntilLock: number;
  timeUntilStart: number;
  timeUntilUnlock: number;
  lockStartTime: Date;
  slotStartTime: Date;
}

interface EnhancedSlotDisplayProps {
  duration: string;
  onSlotSelect?: (slot: Slot) => void;
  selectedSlot?: Slot | null;
}

export function EnhancedSlotDisplay({ duration, onSlotSelect, selectedSlot }: EnhancedSlotDisplayProps) {
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(new Set());

  // Update current time every second for live countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const { data: slots, isLoading, error } = useQuery({
    queryKey: ['slots', duration],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/slots/${duration}`));
      if (!response.ok) throw new Error('Failed to fetch slots');
      const data = await response.json();
      console.log('Slots data received:', data);
      console.log('First slot structure:', data[0]);
      return data as Slot[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const toggleSlotExpansion = (slotNumber: number) => {
    setExpandedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotNumber)) {
        newSet.delete(slotNumber);
      } else {
        newSet.add(slotNumber);
      }
      return newSet;
    });
  };

  const formatTimeRemaining = (milliseconds: number): string => {
    try {
      console.log('formatTimeRemaining called with:', milliseconds, typeof milliseconds);
      
      if (typeof milliseconds !== 'number' || isNaN(milliseconds)) {
        console.warn('Invalid milliseconds value:', milliseconds);
        return 'Invalid Time';
      }
      
      if (milliseconds <= 0) return '00:00:00';
      
      const seconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      const result = days > 0 
        ? `${days}d ${hours % 24}h ${minutes % 60}m`
        : hours > 0 
        ? `${hours}h ${minutes % 60}m ${seconds % 60}s`
        : minutes > 0 
        ? `${minutes}m ${seconds % 60}s`
        : `${seconds}s`;
      
      console.log('formatTimeRemaining result:', result);
      return result;
    } catch (error) {
      console.error('Error in formatTimeRemaining:', error, milliseconds);
      return 'Error';
    }
  };

  const formatCESTTime = (date: Date | string): string => {
    try {
      console.log('formatCESTTime called with:', date, typeof date);
      
      if (!date) {
        console.warn('formatCESTTime: date is falsy:', date);
        return 'No Date';
      }
      
      const dateObj = date instanceof Date ? date : new Date(date);
      console.log('dateObj created:', dateObj, 'isValid:', !isNaN(dateObj.getTime()));
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn('formatCESTTime: Invalid date object:', dateObj);
        return 'Invalid Date';
      }
      
      const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(dateObj);
      
      console.log('formatCESTTime result:', formatted);
      return formatted;
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid Date';
    }
  };

  const getDurationLabel = (duration: string): string => {
    const labels: Record<string, string> = {
      'short': 'Short Term (1 Week)',
      'medium': 'Medium Term (1 Month)',
      'long': 'Long Term (3 Months)',
    };
    return labels[duration] || duration;
  };

  const getDurationColor = (duration: string): string => {
    const colors: Record<string, string> = {
      'short': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      'medium': 'bg-green-500/20 text-green-300 border border-green-500/30',
      'long': 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    };
    return colors[duration] || 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600 text-center">
            Error loading slots: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No slots available for {duration}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Duration Explanation */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-300">
            <p className="font-medium">Simplified Slot System:</p>
            <p>Each duration has one active period. Points depend on when you make your prediction:</p>
            <p className="mt-1 text-xs">• First half of period: Full points • Second half: 1/3 points</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Available Slots</h3>
        <Badge className={getDurationColor(duration)}>
          {getDurationLabel(duration)}
        </Badge>
      </div>

            {/* Simplified Single Slot Display */}
      <div className="relative">
        <div className="flex justify-center">
          {(() => {
            const validSlots = slots.filter(slot => {
              const isValid = slot.start && slot.end && slot.slotNumber !== undefined;
              return isValid;
            });
            
            return validSlots.map((slot) => {
              // Simplified system - only one slot per duration
              const slotNumber = Number(slot.slotNumber);
              const selectedSlotNumber = selectedSlot ? Number(selectedSlot.slotNumber) : null;
              const isSelected = selectedSlotNumber === slotNumber;
              
              const isLocked = !slot.isValid || slot.isValid === false;
              
              return (
                <Card 
                  key={slotNumber} 
                  className={`w-full max-w-[400px] transition-all duration-200 ${
                    isSelected 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'hover:shadow-md'
                  } ${isLocked ? 'opacity-75' : ''}`}
                >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base">
                      Current Period
                    </CardTitle>
                    <Badge variant={(slot.isActive ?? false) ? "default" : "secondary"}>
                      {(slot.isActive ?? false) ? "Active" : "Upcoming"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isLocked ? (
                      <Badge variant="destructive" className="flex items-center space-x-1">
                        <Lock className="h-3 w-3" />
                        <span>Locked</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Unlock className="h-3 w-3" />
                        <span>Open</span>
                      </Badge>
                    )}
                    
                    <div className="text-sm text-muted-foreground">
                      {slot.points || 0} pts
                    </div>
                  </div>
                </div>
              </CardHeader>

                             <CardContent className="space-y-3">
                 {/* Compact Slot Info */}
                 <div className="space-y-2 text-sm">
                   <div className="bg-muted p-2 rounded">
                     <div className="text-xs text-muted-foreground mb-1">Period</div>
                     <div className="font-medium text-xs">
                       {slot.slotLabel || 'Current Period'}
                     </div>
                     <div className="text-xs text-muted-foreground mt-1">
                       {slot.isFirstHalf ? 'First Half (Full Points)' : 'Second Half (1/3 Points)'}
                     </div>
                   </div>

                                   
                   {slot.timeRemaining && slot.timeRemaining > 0 && (
                     <div className="bg-primary/10 p-2 rounded">
                       <div className="text-xs text-muted-foreground mb-1">
                         {(slot.isActive ?? false) ? "Ends in:" : "Starts in:"}
                       </div>
                       <div className="font-mono font-bold text-primary text-xs">
                         {formatTimeRemaining(slot.timeRemaining)}
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Simplified Points Info */}
                 <div className="bg-primary/10 p-2 rounded">
                   <div className="text-xs text-muted-foreground mb-1">Points Available</div>
                   <div className="font-bold text-primary text-sm">
                     {slot.points || 0} points
                   </div>
                   <div className="text-xs text-muted-foreground">
                     {slot.isFirstHalf ? 'Full points (first half)' : '1/3 points (second half)'}
                   </div>
                 </div>

                {/* Action Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      console.log('Slot selected:', {
                        slot,
                        slotNumber,
                        selectedSlotNumber,
                        isSelected
                      });
                      // Create a new slot object with consistent slotNumber type
                      const slotToSelect = {
                        ...slot,
                        slotNumber: slotNumber // Use the converted number
                      };
                      onSlotSelect?.(slotToSelect);
                    }}
                    disabled={isLocked}
                    variant={isSelected ? "default" : "outline"}
                    className="w-full text-sm h-8"
                  >
                    {isLocked ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </>
                    ) : isSelected ? (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Selected
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Select
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        });
      })()}
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
}

