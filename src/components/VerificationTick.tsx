import React from 'react';
import { SealCheck } from '@phosphor-icons/react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerificationTickProps {
  planId?: 'elite' | 'edge' | 'spark' | 'none' | string | null;
  size?: number;
  className?: string;
}

export const VerificationTick: React.FC<VerificationTickProps> = ({ 
  planId, 
  size = 16,
  className = ""
}) => {
  // Only show for elite and edge
  if (!planId || (planId !== 'elite' && planId !== 'edge')) return null;

  const isElite = planId === 'elite';
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center justify-center ml-1 shrink-0 ${className}`}>
            <SealCheck 
              size={size} 
              weight="fill" 
              className={isElite ? "text-amber-400" : "text-blue-500"} 
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-black/90 border-white/10 backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-white">
            Verified
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
