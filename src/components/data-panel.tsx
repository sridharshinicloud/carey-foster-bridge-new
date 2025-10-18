'use client';

import React, { useEffect, useMemo } from 'react';
import type { Reading, ExperimentMode } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, Loader2, Eye, EyeOff, AlertTriangle, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


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

const suggestionFormSchema = z.object({
  R: z.number().min(0.1, "Resistance must be positive."),
  l1: z.number().min(0, "Length must be non-negative."),
  X: z.number().min(0, "Resistance must be non-negative."),
});


const DataPanel: React.FC<DataPanelProps> = ({
  readings, selectedReadingId, onSelectReading, aiSuggestion, isAiLoading, onGetSuggestion, onDeleteReading, selectedReading, trueXValue, wireResistancePerCm, isTrueValueRevealed, onRevealToggle, experimentMode, isSwapped, knownR
}) => {

  const form = useForm<z.infer<typeof suggestionFormSchema>>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: { R: 5, l1: 50, X: 5 }
  });

  useEffect(() => {
    if (selectedReading && selectedReading.l1 !== null) {
      const approxX = experimentMode === 'findX' ? (selectedReading.rValue + (2 * selectedReading.l1 - 100) * wireResistancePerCm) : 0;
      form.reset({
        R: selectedReading.rValue,
        l1: selectedReading.l1,
        X: approxX,
      });
    }
  }, [selectedReading, form, experimentMode, wireResistancePerCm]);

  const onSubmit = () => {
    onGetSuggestion();
  };
  
  const { finalCalculatedX, calculationErrorX, deviationX } = useMemo(() => {
    if (experimentMode !== 'findX') return { finalCalculatedX: null, calculationErrorX: null, deviationX: null };
    
    const completeReadings = readings.filter(r => r.l1 !== null && r.l2 !== null);
    if (completeReadings.length === 0) {
      return { finalCalculatedX: null, calculationErrorX: "Requires a complete reading (l1 & l2).", deviationX: null };
    }

    const calculatedXs = completeReadings.map(r => {
      return r.rValue + wireResistancePerCm * (r.l2! - r.l1!);
    });

    const averageX = calculatedXs.reduce((sum, x) => sum + x, 0) / calculatedXs.length;
    const deviation = trueXValue !== 0 ? ((averageX - trueXValue) / trueXValue) * 100 : 0;

    return { finalCalculatedX: averageX, calculationErrorX: null, deviationX: deviation };
  }, [readings, wireResistancePerCm, trueXValue, experimentMode]);

  const { finalCalculatedRho, calculationErrorRho } = useMemo(() => {
    if (experimentMode !== 'findRho') return { finalCalculatedRho: null, calculationErrorRho: null };
    
    const completeReadings = readings.filter(r => r.l1 !== null && r.l2 !== null);
    if (completeReadings.length === 0) {
        return { finalCalculatedRho: null, calculationErrorRho: "Requires a complete reading (l1 & l2)." };
    }
    
    const rhos = completeReadings.map(r => {
        const diff = r.l2! - r.l1!;
        return diff !== 0 ? r.rValue / diff : null;
    }).filter((rho): rho is number => rho !== null);

    if (rhos.length === 0) {
        return { finalCalculatedRho: null, calculationErrorRho: "l1 and l2 cannot be the same." };
    }

    const avgRho = rhos.reduce((a, b) => a + b, 0) / rhos.length;
    return { finalCalculatedRho: avgRho, calculationErrorRho: null };
  }, [readings, experimentMode]);


  const renderCalculationResults = () => {
      if (experimentMode === 'findX') {
        const isCalculated = finalCalculatedX !== null;
        return (
          <>
            <div className="font-semibold flex justify-between">
                <span>Final Calculated X:</span>
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
            <Button onClick={onRevealToggle} variant="outline" size="sm" className="w-full mt-2">
                {isTrueValueRevealed ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {isTrueValueRevealed ? 'Hide True Value' : 'Reveal True Value'}
            </Button>
          </>
        );
      }
      if (experimentMode === 'findRho') {
        const isCalculated = finalCalculatedRho !== null;
        return (
             <div className="font-semibold flex justify-between">
                <span>Calculated Avg. ρ:</span>
                {isCalculated ? (
                    <span className='font-mono'>{finalCalculatedRho.toFixed(4)} Ω/cm</span>
                ) : (
                    <span className="text-xs text-muted-foreground">{calculationErrorRho}</span>
                )}
            </div>
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
        <CardDescription>Review your data and get help.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <Tabs defaultValue="data" className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="data">Data Table</TabsTrigger>
            <TabsTrigger value="ai" disabled={experimentMode === 'findRho'}>AI Help</TabsTrigger>
          </TabsList>
          <TabsContent value="data" className="mt-4 flex-grow flex flex-col">
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
                    {experimentMode === 'findX' ? 'Select a row to use it for AI suggestions.' : 'Completed readings for ρ calculation.'}
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
                          className={cn("cursor-pointer", selectedReadingId === reading.id && 'bg-primary/10')}
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
          </TabsContent>
          <TabsContent value="ai" className="mt-4 flex-grow">
             <ScrollArea className="h-full">
              <Card className="h-full">
                <CardContent className="p-6 space-y-6">
                  <p className="text-sm text-muted-foreground">
                    If you're stuck, select a reading with at least l₁ recorded and ask the AI for advice.
                  </p>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="R" render={({ field }) => (
                            <FormItem>
                              <FormLabel>R (Ω)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} value={field.value?.toFixed(2) ?? ''}/></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        <FormField control={form.control} name="l1" render={({ field }) => (
                            <FormItem>
                              <FormLabel>l₁ (cm)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} value={field.value?.toFixed(2) ?? ''}/></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                         <FormField control={form.control} name="X" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approx. X (Ω)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} value={field.value?.toFixed(2) ?? ''}/></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={isAiLoading || !selectedReading || selectedReading.l1 === null}>
                        {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Get Help
                      </Button>
                    </form>
                  </Form>
                  {(isAiLoading || aiSuggestion) && (
                    <div className="pt-4">
                      <h4 className="font-semibold flex items-center gap-2"><Bot className="w-5 h-5"/> AI Assistant</h4>
                      <Card className="mt-2 bg-muted/50 p-4 min-h-[100px]">
                        {isAiLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{aiSuggestion}</p>
                        )}
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DataPanel;
