'use client';

import React, { useMemo } from 'react';
import type { Reading, ExperimentMode } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, AlertTriangle, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';


interface DataPanelProps {
  readings: Reading[];
  selectedReadingId: number | null;
  onSelectReading: (id: number | null) => void;
  aiSuggestion: string;
  isAiLoading: boolean;
  onGetSuggestion: () => Promise<void>;
  onDeleteReading: (id: number) => void;
  selectedReading: Reading | undefined;
  trueXValue: number;
  wireResistancePerCm: number;
  isTrueValueRevealed: boolean;
  onRevealToggle: () => void;
  experimentMode: ExperimentMode;
  isSwapped: boolean;
  knownR: number;
}


const DataPanel: React.FC<DataPanelProps> = ({
  readings, selectedReadingId, onSelectReading, onDeleteReading, trueXValue, wireResistancePerCm, isTrueValueRevealed, onRevealToggle, experimentMode, isSwapped, knownR
}) => {

  const completeReadings = useMemo(() => readings.filter(r => r.l1 !== null && r.l2 !== null), [readings]);
  const canReveal = completeReadings.length >= 4;

  const { finalCalculatedX, calculationErrorX, deviationX } = useMemo(() => {
    if (experimentMode !== 'findX') return { finalCalculatedX: null, calculationErrorX: null, deviationX: null };
    
    if (completeReadings.length === 0) {
      return { finalCalculatedX: null, calculationErrorX: "Requires a complete reading (l1 & l2).", deviationX: null };
    }

    const calculatedXs = completeReadings.map(r => {
      return r.rValue + wireResistancePerCm * (r.l2! - r.l1!);
    });

    const averageX = calculatedXs.reduce((sum, x) => sum + x, 0) / calculatedXs.length;
    const deviation = trueXValue !== 0 ? ((averageX - trueXValue) / trueXValue) * 100 : 0;

    return { finalCalculatedX: averageX, calculationErrorX: null, deviationX: deviation };
  }, [completeReadings, wireResistancePerCm, trueXValue, experimentMode]);

  const { finalCalculatedRho, calculationErrorRho, deviationRho } = useMemo(() => {
    if (experimentMode !== 'findRho') return { finalCalculatedRho: null, calculationErrorRho: null, deviationRho: null };
    
    if (completeReadings.length === 0) {
        return { finalCalculatedRho: null, calculationErrorRho: "Requires a complete reading (l1 & l2).", deviationRho: null };
    }
    
    const rhos = completeReadings.map(r => {
        const diff = r.l2! - r.l1!;
        return diff !== 0 ? r.rValue / diff : null;
    }).filter((rho): rho is number => rho !== null);

    if (rhos.length === 0) {
        return { finalCalculatedRho: null, calculationErrorRho: "l1 and l2 cannot be the same.", deviationRho: null };
    }

    const avgRho = rhos.reduce((a, b) => a + b, 0) / rhos.length;
    const deviation = wireResistancePerCm !== 0 ? ((avgRho - wireResistancePerCm) / wireResistancePerCm) * 100 : 0;

    return { finalCalculatedRho: avgRho, calculationErrorRho: null, deviationRho: deviation };
  }, [completeReadings, experimentMode, wireResistancePerCm]);


  const renderCalculationResults = () => {
      const revealButton = (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full mt-2">
                 <Button onClick={onRevealToggle} variant="outline" size="sm" className="w-full" disabled={!canReveal}>
                    {isTrueValueRevealed ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {isTrueValueRevealed ? 'Hide True Value' : 'Reveal True Value'}
                </Button>
              </div>
            </TooltipTrigger>
            {!canReveal && (
               <TooltipContent>
                 <p>Take at least 4 complete readings to reveal the true value.</p>
               </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      );

      if (experimentMode === 'findX') {
        const isCalculated = finalCalculatedX !== null;
        return (
          <>
            <div className="font-semibold flex justify-between">
                <span>Mean Calculated X:</span>
                {isCalculated ? (
                    <span className="font-mono">{finalCalculatedX.toFixed(4)} Ω</span>
                ) : (
                    <span className="text-xs text-muted-foreground">{calculationErrorX}</span>
                )}
            </div>
            <div className="font-semibold flex justify-between items-center">
                <span>True Value of X:</span>
                {isTrueValueRevealed ? (
                  <div className='flex items-center gap-2'>
                    {isCalculated && deviationX !== null && (
                      <Badge variant={Math.abs(deviationX) < 5 ? "secondary" : "destructive"}>
                        {deviationX.toFixed(1)}% dev.
                      </Badge>
                    )}
                    <span className="font-mono">{trueXValue.toFixed(4)} Ω</span>
                  </div>
                ) : (
                  <span className='font-mono'>? Ω</span>
                )}
            </div>
            {revealButton}
          </>
        );
      }
      if (experimentMode === 'findRho') {
        const isCalculated = finalCalculatedRho !== null;
        return (
             <>
                <div className="font-semibold flex justify-between">
                    <span>Mean Calculated ρ:</span>
                    {isCalculated ? (
                        <span className='font-mono'>{finalCalculatedRho.toFixed(4)} Ω/cm</span>
                    ) : (
                        <span className="text-xs text-muted-foreground">{calculationErrorRho}</span>
                    )}
                </div>
                <div className="font-semibold flex justify-between">
                    <span>True Value of ρ:</span>
                    {isTrueValueRevealed ? (
                      <div className='flex items-center gap-2'>
                          {isCalculated && deviationRho !== null && (
                            <Badge variant={Math.abs(deviationRho) < 5 ? "secondary" : "destructive"}>
                              {deviationRho.toFixed(1)}% dev.
                            </Badge>
                          )}
                          <span className='font-mono'>{wireResistancePerCm.toFixed(4)} Ω/cm</span>
                      </div>
                    ) : (
                      <span className='font-mono'>? Ω/cm</span>
                    )}
                </div>
                {revealButton}
             </>
        )
      }
      return null;
  }
  
  const getInstruction = () => {
      const readingForCurrentR = readings.find(r => r.rValue === knownR);

      if (!readingForCurrentR || readingForCurrentR.l1 === null) {
          return "Find balance point for l₁ (normal position).";
      }
      if (readingForCurrentR.l2 === null) {
          if (isSwapped) {
              return "Find balance point for l₂ (swapped position).";
          } else {
              return "Swap gaps to find balance point for l₂.";
          }
      }
      return "Reading complete for this R. Change R for a new set.";
  };


  return (
    <Card className="w-full flex flex-col h-full">
      <CardHeader>
        <CardTitle className="font-headline">Analysis</CardTitle>
        <CardDescription>Review your collected data and calculations.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
            <Card className="h-full flex flex-col">
               <div className="p-3 border-b bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <div className="text-sm font-medium">
                            <p>Next Step:</p>
                            <p className="font-semibold">{getInstruction()}</p>
                        </div>
                    </div>
                </div>
              <ScrollArea className="flex-grow">
                <Table>
                  <TableCaption>
                    {experimentMode === 'findX' ? 'Your recorded readings for determining X.' : 'Your recorded readings for determining ρ.'}
                  </TableCaption>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>R (Ω)</TableHead>
                      <TableHead>l₁ (cm)</TableHead>
                      <TableHead>l₂ (cm)</TableHead>
                      {experimentMode === 'findX' && (
                        <>
                          <TableHead>l₂-l₁ (cm)</TableHead>
                          <TableHead>Calc. X (Ω)</TableHead>
                        </>
                      )}
                      {experimentMode === 'findRho' && (
                        <>
                          <TableHead>l₂-l₁ (cm)</TableHead>
                          <TableHead>ρ (Ω/cm)</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.length > 0 ? readings.map((reading) => {
                      const isComplete = reading.l1 !== null && reading.l2 !== null;
                      let diff = null;
                      let rho = null;
                      let calculatedX = null;

                      if (isComplete) {
                        diff = reading.l2! - reading.l1!;
                        if (experimentMode === 'findRho') {
                          rho = diff !== 0 ? reading.rValue / diff : null;
                        }
                        if (experimentMode === 'findX') {
                          calculatedX = reading.rValue + wireResistancePerCm * diff;
                        }
                      }

                      return (
                        <TableRow
                          key={reading.id}
                          className={cn(selectedReadingId === reading.id && 'bg-primary/10')}
                          onClick={() => onSelectReading(reading.id)}
                        >
                          <TableCell>{reading.rValue.toFixed(2)}</TableCell>
                          <TableCell>{reading.l1 !== null ? reading.l1.toFixed(2) : '...'}</TableCell>
                          <TableCell>{reading.l2 !== null ? reading.l2.toFixed(2) : '...'}</TableCell>
                           {experimentMode === 'findX' && (
                            <>
                              <TableCell>{isComplete && diff !== null ? diff.toFixed(2) : '...'}</TableCell>
                              <TableCell>{isComplete && calculatedX !== null ? calculatedX.toFixed(4) : '...'}</TableCell>
                            </>
                          )}
                           {experimentMode === 'findRho' && (
                            <>
                              <TableCell>{isComplete && diff !== null ? diff.toFixed(2) : '...'}</TableCell>
                              <TableCell>{isComplete && rho !== null ? rho.toFixed(4) : '...'}</TableCell>
                            </>
                          )}
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteReading(reading.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={experimentMode === 'findRho' ? 6 : 6} className="text-center h-48">No data recorded yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="p-4 border-t space-y-3 bg-muted/50">
                 {renderCalculationResults()}
              </div>
            </Card>
      </CardContent>
    </Card>
  );
};

export default DataPanel;
