'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Zap, MoveHorizontal, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlaceHolderImages } from '@/lib/placeholder-images';


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
  trueX: number;
  onTrueXChange: (value: number) => void;
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
  trueX, onTrueXChange, knownR, onKnownRChange, jockeyPos, onJockeyMove, potentialDifference, onRecord, onReset, isBalanced
}) => {
  const wireRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const resistorImage = PlaceHolderImages.find(p => p.id === 'resistor');
  const galvanometerImage = PlaceHolderImages.find(p => p.id === 'galvanometer');

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline">Experiment Setup</CardTitle>
        <CardDescription>Adjust resistances and find the balance point.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResistanceControl label="Known Resistance (R)" value={knownR} onValueChange={onKnownRChange} tooltip="This is the standard resistor in your circuit." />
          <ResistanceControl label="Unknown Resistance (X)" value={trueX} onValueChange={onTrueXChange} tooltip="This is the resistor you are trying to measure." />
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-center">Carey Foster Bridge</h3>
          <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-muted/50 border p-4 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <div className="flex flex-col items-center gap-2 w-32 text-center">
                 <p className="font-medium">Known (R)</p>
                 {resistorImage && 
                    <Image src={resistorImage.imageUrl} alt="Known Resistor" width={80} height={80} className="rounded-md object-cover" data-ai-hint={resistorImage.imageHint} />
                  }
                 <span>{knownR.toFixed(1)} Ω</span>
               </div>
               <div className="flex flex-col items-center gap-2 w-32 text-center">
                 <p className="font-medium">Unknown (X)</p>
                 {resistorImage && 
                    <Image src={resistorImage.imageUrl} alt="Unknown Resistor" width={80} height={80} className="rounded-md object-cover" data-ai-hint={resistorImage.imageHint} />
                  }
                 <span>{trueX.toFixed(1)} Ω</span>
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
             {galvanometerImage &&
              <div className="relative w-20 h-12 mt-2">
                <Image src={galvanometerImage.imageUrl} alt="Galvanometer" layout="fill" objectFit="contain" data-ai-hint={galvanometerImage.imageHint}/>
                <div 
                  className="absolute bottom-1/2 left-1/2 w-px h-1/2 bg-red-600 origin-bottom transition-transform duration-300" 
                  style={{ transform: `translateX(-50%) rotate(${potentialDifference * 450}deg)` }}
                />
              </div>
            }
            <CardTitle className={cn("font-mono transition-colors text-sm mt-1", isBalanced ? "text-green-600 dark:text-green-400" : "")}>
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
