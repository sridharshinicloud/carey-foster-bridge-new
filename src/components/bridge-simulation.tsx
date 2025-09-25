'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Zap, MoveHorizontal, Save, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface ResistanceControlProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tooltip: string;
}

const ResistanceControl: React.FC<ResistanceControlProps> = ({ label, value, onValueChange, min = 0.1, max = 20, step = 0.1, tooltip }) => {
  return (
    <div className="space-y-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <label className="font-medium text-sm">{label}</label>
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent><p>{tooltip}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex items-center gap-2">
        <Slider
          value={[value]}
          onValueChange={(vals) => onValueChange(vals[0])}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <Input
          type="number"
          value={value.toFixed(1)}
          onChange={(e) => onValueChange(Math.max(min, Math.min(max, parseFloat(e.target.value) || 0)))}
          className="w-24 text-center"
          min={min}
          max={max}
          step={step}
        />
        <span className="text-sm font-medium">Ω</span>
      </div>
    </div>
  );
};


interface BridgeSimulationProps {
  knownR: number;
  onKnownRChange: (value: number) => void;
  jockeyPos: number;
  onJockeyMove: (pos: number) => void;
  potentialDifference: number;
  onRecord: () => void;
  onReset: () => void;
  isBalanced: boolean;
}

const BridgeSimulation: React.FC<BridgeSimulationProps> = ({
  knownR, onKnownRChange, jockeyPos, onJockeyMove, potentialDifference, onRecord, onReset, isBalanced
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
  
  const needleRotation = Math.max(-45, Math.min(45, potentialDifference * 450));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline">Experiment Setup</CardTitle>
        <CardDescription>Adjust the known resistance and slide the jockey to find the balance point.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResistanceControl label="Known Resistance (R)" value={knownR} onValueChange={onKnownRChange} tooltip="This is the standard resistor in your circuit. Adjust it to get a clear balance point." />
          <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="font-medium text-sm">Unknown Resistance (X)</label>
              </div>
              <div className="flex items-center justify-center h-10 w-full rounded-md border border-dashed bg-muted/50">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  <span>Your goal is to find this value.</span>
                </p>
              </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-center">Carey Foster Bridge</h3>
          <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-muted/50 border p-4 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <div className="flex flex-col items-center gap-2 w-32 text-center">
                 <p className="font-medium">Known (R)</p>
                  <div className="w-20 h-20 bg-card border rounded-md flex items-center justify-center">
                    <Zap className="w-8 h-8 text-primary" />
                  </div>
                 <span>{knownR.toFixed(1)} Ω</span>
               </div>
               <div className="flex flex-col items-center gap-2 w-32 text-center">
                 <p className="font-medium">Unknown (X)</p>
                  <div className="w-20 h-20 bg-card border rounded-md flex items-center justify-center">
                    <HelpCircle className="w-8 h-8 text-primary" />
                  </div>
                 <span>? Ω</span>
               </div>
            </div>

            <div className="relative pt-8">
              <div className="absolute w-full top-0 px-[1px] flex justify-between items-end">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-xs font-mono -mb-1">{i * 10}</span>
                    <div className={cn("bg-foreground", i % 5 === 0 ? 'h-4 w-0.5' : 'h-2 w-px')} />
                  </div>
                ))}
              </div>
              <div ref={wireRef} className="relative h-2 bg-primary/20 rounded-full w-full cursor-pointer" onMouseDown={() => setIsDragging(true)}>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-12 bg-accent rounded-sm shadow-lg flex items-center justify-center cursor-ew-resize transition-all duration-75"
                  style={{ left: `${jockeyPos}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <MoveHorizontal className="w-4 h-4 text-accent-foreground" />
                </div>
                <div className="absolute top-full mt-2 text-xs" style={{ left: `${jockeyPos}%`, transform: 'translateX(-50%)' }}>l₁</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <Card className="p-4">
            <CardDescription>Length l₁</CardDescription>
            <CardTitle className="font-mono">{jockeyPos.toFixed(2)} cm</CardTitle>
          </Card>
          <Card className="p-4">
            <CardDescription>Length l₂</CardDescription>
            <CardTitle className="font-mono">{(100 - jockeyPos).toFixed(2)} cm</CardTitle>
          </Card>
          <Card className={cn("p-4 transition-colors flex flex-col items-center justify-center", isBalanced ? "bg-green-100 dark:bg-green-900/30" : "")}>
            <CardDescription>Galvanometer (ΔV)</CardDescription>
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
              {(potentialDifference * 10).toFixed(4)} V
            </CardTitle>
          </Card>
        </div>

        <div className="flex flex-wrap gap-4 justify-center pt-4">
          <Button onClick={onRecord} disabled={!isBalanced}>
            <Save className="mr-2 h-4 w-4" /> Record Data
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reset Experiment
          </Button>
        </div>

      </CardContent>
    </Card>
  );
};

export default BridgeSimulation;
