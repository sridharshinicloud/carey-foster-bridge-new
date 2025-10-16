'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Zap, Save, RefreshCw, AlertCircle, HelpCircle, Settings, Repeat } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';


interface ResistanceBoxProps {
    label: string;
    value: string | number;
    Icon: React.ElementType;
    position: 'left' | 'right' | 'inner-left' | 'inner-right';
}

const ResistanceBox: React.FC<ResistanceBoxProps> = ({ label, value, Icon, position }) => {
    return (
        <div className={cn("flex flex-col items-center gap-1 w-24 text-center", 
            position === 'left' && 'absolute left-4 top-1/2 -translate-y-[calc(50%+2rem)]',
            position === 'right' && 'absolute right-4 top-1/2 -translate-y-[calc(50%+2rem)]',
            position === 'inner-left' && 'absolute left-1/2 -translate-x-[calc(100%+2rem)] top-8',
            position === 'inner-right' && 'absolute right-1/2 translate-x-[calc(100%+2rem)] top-8',
            )}>
            <p className="font-medium text-sm">{label}</p>
            <div className="w-16 h-12 bg-card border-2 border-primary/50 rounded-md flex items-center justify-center">
                <Icon className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm font-semibold">{typeof value === 'number' ? `${value.toFixed(1)} Ω` : value}</span>
        </div>
    )
}

interface BridgeSimulationProps {
  knownR: number;
  onKnownRChange: (value: number) => void;
  jockeyPos: number;
  onJockeyMove: (pos: number) => void;
  potentialDifference: number;
  onRecord: () => void;
  onReset: () => void;
  isBalanced: boolean;
  isSwapped: boolean;
  onSwap: () => void;
  P: number;
  Q: number;
}

const BridgeSimulation: React.FC<BridgeSimulationProps> = ({
  knownR, onKnownRChange, jockeyPos, onJockeyMove, potentialDifference, onRecord, onReset, isBalanced, isSwapped, onSwap, P, Q
}) => {
  const wireRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && wireRef.current) {
      const rect = wireRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newPos = (newX / rect.width) * 100;
      onJockeyMove(Math.max(0, Math.min(100, newPos)));
    }
  }, [isDragging, onJockeyMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  const needleRotation = Math.max(-45, Math.min(45, potentialDifference));

  const rBoxLabel = isSwapped ? "X" : "R";
  const xBoxLabel = isSwapped ? "R" : "X";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline">Experiment Setup</CardTitle>
        <CardDescription>Adjust the resistance and slide the jockey to find the balance point.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <label className="font-medium text-sm">Known Resistance (R)</label>
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Adjust the standard resistor. Try to make it close to the unknown resistance.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex items-center gap-2">
                <Slider
                  value={[knownR]}
                  onValueChange={(vals) => onKnownRChange(vals[0])}
                  min={0.0}
                  max={20.0}
                  step={0.1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={knownR.toFixed(1)}
                  onChange={(e) => onKnownRChange(parseFloat(e.target.value) || 0)}
                  className="w-24 text-center"
                  min={0.0}
                  max={20.0}
                  step={0.1}
                />
                <span className="text-sm font-medium">Ω</span>
              </div>
            </div>
        </div>
        <div className="flex justify-end">
             <Button onClick={onSwap} variant="outline">
                <Repeat className="mr-2 h-4 w-4" /> Swap Gaps
            </Button>
        </div>


        <Separator />


        <div className="space-y-4 pt-4">
          <h3 className="font-medium text-center">Carey Foster Bridge</h3>
          <div className="relative aspect-[16/10] w-full rounded-lg bg-muted/30 border-2 border-dashed p-4 flex flex-col justify-end">
            
            {/* Resistors */}
            <ResistanceBox label={rBoxLabel} value={isSwapped ? '?' : knownR} Icon={isSwapped ? HelpCircle : Zap} position="left" />
            <ResistanceBox label={xBoxLabel} value={isSwapped ? knownR : '?'} Icon={isSwapped ? Zap : HelpCircle} position="right" />
            <ResistanceBox label="P" value={P} Icon={Settings} position="inner-left" />
            <ResistanceBox label="Q" value={Q} Icon={Settings} position="inner-right" />
            
             {/* Battery and Key - Visual only */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                 <span className="text-2xl font-light text-muted-foreground/50">+</span>
                 <div className="h-4 w-10 border-y-2 border-muted-foreground/50"></div>
                 <span className="text-3xl font-light text-muted-foreground/50 -mt-1.5 ">-</span>
            </div>


            {/* Bridge Wire and Scale */}
            <div className="relative pt-8">
              <div className="absolute w-full top-0 left-0 px-[1px] flex justify-between items-end">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-xs font-mono -mb-1">{i * 10}</span>
                    <div className={cn("bg-foreground", i % 5 === 0 ? 'h-3 w-0.5' : 'h-2 w-px')} />
                  </div>
                ))}
              </div>
              <div ref={wireRef} className="relative h-1.5 bg-primary/30 rounded-full w-full cursor-pointer" onMouseDown={() => setIsDragging(true)}>
                 {/* Main wire */}
              </div>
               {/* Jockey */}
                <div
                  className="absolute top-1/2 w-3 h-3 bg-accent rounded-sm shadow-lg cursor-ew-resize transition-all duration-75"
                  style={{ left: `${jockeyPos}%`, transform: 'translateX(-50%)' }}
                  onMouseDown={() => setIsDragging(true)}
                >
                </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          <Card className={cn("p-4 transition-colors flex flex-col items-center justify-center", isBalanced ? "bg-green-100 dark:bg-green-900/30" : "")}>
            <CardDescription>Galvanometer (G)</CardDescription>
              <div className="relative w-32 h-20 mt-1">
                <svg viewBox="0 0 100 60" className="w-full h-full">
                  {/* Scale */}
                  <path d="M 10 50 A 40 40 0 0 1 90 50" stroke="hsl(var(--muted-foreground))" strokeWidth="1" fill="none" />
                  {/* Markings */}
                  {[-45, -22.5, 0, 22.5, 45].map(angle => {
                    const x1 = 50 + 40 * Math.sin(angle * Math.PI / 180);
                    const y1 = 50 - 40 * Math.cos(angle * Math.PI / 180);
                    const x2 = 50 + 35 * Math.sin(angle * Math.PI / 180);
                    const y2 = 50 - 35 * Math.cos(angle * Math.PI / 180);
                    return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground))" strokeWidth="1" />;
                  })}
                  <line x1="50" y1="10" x2="50" y2="15" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" />

                  {/* Needle */}
                  <g style={{ transform: `rotate(${needleRotation}deg)`, transformOrigin: '50px 50px', transition: 'transform 300ms ease-out' }}>
                    <polygon points="50,50 49,15 51,15" fill="hsl(var(--destructive))" />
                  </g>

                  {/* Pivot */}
                  <circle cx="50" cy="50" r="3" fill="hsl(var(--foreground))" />
                </svg>
              </div>
            <CardTitle className={cn("font-mono transition-colors text-sm -mt-3", isBalanced ? "text-green-600 dark:text-green-400" : "")}>
              {isBalanced ? 'Balanced' : 'Unbalanced'}
            </CardTitle>
          </Card>
          <div className="flex flex-col gap-4 justify-center">
              <Button onClick={onRecord} disabled={!isBalanced}>
                <Save className="mr-2 h-4 w-4" /> Record Data
              </Button>
              <Button variant="outline" onClick={onReset}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reset Experiment
              </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default BridgeSimulation;

    