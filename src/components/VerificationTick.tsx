import React from 'react';
import { SealCheck } from '@phosphor-icons/react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerificationTickProps {
  planId?: 'edge' | 'spark' | 'none' | string | null;
  size?: number;
  className?: string;
}

export const VerificationTick: React.FC<VerificationTickProps> = ({ 
  planId, 
  size = 16,
  className = ""
}) => {
  // Only show for edge
  if (!planId || planId !== 'edge') return null;
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center justify-center ml-1 shrink-0 ${className}`}>
            <SealCheck 
              size={size} 
              weight="fill" 
              className="text-blue-500" 
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-background border-border text-xs font-black">
          <div className="flex items-center gap-2">
            <span className="text-blue-500">Verified Edge User</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
