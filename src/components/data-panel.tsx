'use client';

import React, { useEffect, useMemo } from 'react';
import type { Reading, ExperimentMode } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, Loader2, Repeat, Eye, EyeOff } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DataPanelProps {
  readings: Reading[];
  selectedReadingId: number | null;
  onSelectReading: (id: number | null) => void;
  aiSuggestion: string;
  isAiLoading: boolean;
  onGetSuggestion: () => Promise<void>;
  selectedReading: Reading | undefined;
  trueXValue: number;
  experimentMode: ExperimentMode;
  wireResistancePerCm: number;
  isTrueValueRevealed: boolean;
  onRevealToggle: () => void;
}

const suggestionFormSchema = z.object({
  R: z.number().min(0.1, "Resistance must be positive."),
  l1: z.number().min(0, "Length must be non-negative."),
  X: z.number().min(0, "Resistance must be non-negative."),
});


const DataPanel: React.FC<DataPanelProps> = ({
  readings, selectedReadingId, onSelectReading, aiSuggestion, isAiLoading, onGetSuggestion, selectedReading, trueXValue, experimentMode, wireResistancePerCm, isTrueValueRevealed, onRevealToggle
}) => {
    const isFindXMode = experimentMode === 'findX';

  const form = useForm<z.infer<typeof suggestionFormSchema>>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: { R: 5, l1: 50, X: 5 }
  });

  useEffect(() => {
    if (selectedReading) {
      form.reset({
        R: selectedReading.rValue,
        l1: selectedReading.l1,
        // The concept of X for the AI form changes based on mode
        X: isFindXMode ? selectedReading.rValue : 0, 
      });
    }
  }, [selectedReading, form, isFindXMode]);

  const onSubmit = () => {
    onGetSuggestion();
  };
  
  const { finalCalculatedX, calculationErrorX, deviationX } = useMemo(() => {
    if (experimentMode !== 'findX') return { finalCalculatedX: null, calculationErrorX: null, deviationX: null };
    
    const findXReadings = readings.filter(r => r.isSwapped !== undefined);
    const normalReading = findXReadings.find(r => !r.isSwapped);
    const swappedReading = findXReadings.find(r => r.isSwapped);

    if (normalReading && swappedReading) {
      if (normalReading.rValue !== swappedReading.rValue) {
        return { finalCalculatedX: null, calculationErrorX: "R values must be the same for both readings.", deviationX: null };
      }
      const R = normalReading.rValue;
      const l1_normal = normalReading.l1;
      const l1_swapped = swappedReading.l1;
      
      const calculatedX = R + wireResistancePerCm * (l1_swapped - l1_normal);
      const deviation = trueXValue !== 0 ? ((calculatedX - trueXValue) / trueXValue) * 100 : 0;

      return { finalCalculatedX: calculatedX, calculationErrorX: null, deviationX: deviation };
    }
    return { finalCalculatedX: null, calculationErrorX: "Requires one normal and one swapped reading.", deviationX: null };
  }, [readings, experimentMode, wireResistancePerCm, trueXValue]);

  const { finalCalculatedRho, calculationErrorRho, deviationRho } = useMemo(() => {
    if (experimentMode !== 'findRho') return { finalCalculatedRho: null, calculationErrorRho: null, deviationRho: null };
    
    const findRhoReadings = readings.filter(r => r.isSwapped !== undefined);
    const normalReading = findRhoReadings.find(r => !r.isSwapped); // R in left, Copper in right
    const swappedReading = findRhoReadings.find(r => r.isSwapped); // Copper in left, R in right

    if (normalReading && swappedReading) {
      if (normalReading.rValue !== swappedReading.rValue) {
        return { finalCalculatedRho: null, calculationErrorRho: "R values must be the same for both readings.", deviationRho: null };
      }
      const R = normalReading.rValue;
      const l_normal = normalReading.l1;
      const l_swapped = swappedReading.l1;

      if (l_swapped - l_normal === 0) {
        return { finalCalculatedRho: null, calculationErrorRho: "Balance points cannot be the same.", deviationRho: null };
      }
      
      const calculatedRho = R / (l_swapped - l_normal);
      const deviation = wireResistancePerCm !== 0 ? ((calculatedRho - wireResistancePerCm) / wireResistancePerCm) * 100 : 0;
      return { finalCalculatedRho: calculatedRho, calculationErrorRho: null, deviationRho: deviation };
    }
    return { finalCalculatedRho: null, calculationErrorRho: "Requires one normal and one swapped reading.", deviationRho: null };
  }, [readings, experimentMode, wireResistancePerCm]);

  const renderCalculationResults = () => {
    if (isFindXMode) {
      const isCalculated = finalCalculatedX !== null;
      return (
        <>
          <div className="font-semibold flex justify-between">
              <span>Final Calculated X:</span>
              {isCalculated ? (
                  <span>{finalCalculatedX.toFixed(2)} Ω</span>
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
                  <span>{trueXValue.toFixed(2)} Ω</span>
                </div>
              ) : (
                <span>? Ω</span>
              )}
          </div>
        </>
      );
    } else { // findRho Mode
        const isCalculated = finalCalculatedRho !== null;
        return (
           <>
                <div className="font-semibold flex justify-between">
                    <span>Calculated ρ (rho):</span>
                    {isCalculated ? (
                        <span>{finalCalculatedRho.toFixed(4)} Ω/cm</span>
                    ) : (
                        <span className="text-xs text-muted-foreground">{calculationErrorRho}</span>
                    )}
                </div>
                <div className="font-semibold flex justify-between items-center">
                    <span>True Value of ρ:</span>
                     {isTrueValueRevealed ? (
                        <div className='flex items-center gap-2'>
                          {isCalculated && deviationRho !== null && (
                            <Badge variant={Math.abs(deviationRho) < 5 ? "secondary" : "destructive"}>
                              {deviationRho.toFixed(1)}% dev.
                            </Badge>
                          )}
                          <span>{wireResistancePerCm.toFixed(4)} Ω/cm</span>
                        </div>
                      ) : (
                        <span>? Ω/cm</span>
                      )}
                </div>
           </>
        );
    }
  }


  return (
    <Card className="w-full flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">{isFindXMode ? 'Analysis (Find X)' : 'Analysis (Find ρ)'}</CardTitle>
        <CardDescription>Review your data and perform calculations.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <Tabs defaultValue="data" className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="data">Data Table</TabsTrigger>
            <TabsTrigger value="ai" disabled={!isFindXMode}>AI Help</TabsTrigger>
          </TabsList>
          <TabsContent value="data" className="mt-4 flex-grow">
            <Card className="h-full flex flex-col">
              <ScrollArea className="flex-grow">
                <Table>
                  <TableCaption>Record a reading in both normal and swapped positions.</TableCaption>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>R (Ω)</TableHead>
                      <TableHead>l₁ (cm)</TableHead>
                      <TableHead>l₂ (cm)</TableHead>
                      <TableHead>Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.length > 0 ? readings.map((reading) => (
                      <TableRow
                        key={reading.id}
                        className={cn("cursor-pointer", selectedReadingId === reading.id && 'bg-primary/10')}
                        onClick={() => onSelectReading(reading.id)}
                      >
                        <TableCell>{reading.rValue.toFixed(2)}</TableCell>
                        <TableCell>{reading.l1.toFixed(2)}</TableCell>
                        <TableCell>{reading.l2.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                             {reading.isSwapped ? <Repeat className="w-4 h-4 text-blue-500" /> : <div className="w-4 h-4"/>}
                             {reading.isSwapped ? 'Swapped' : 'Normal'}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-48">No data recorded yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="p-4 border-t space-y-3 bg-muted/50">
                 {renderCalculationResults()}
                 <Button onClick={onRevealToggle} variant="outline" size="sm" className="w-full">
                    {isTrueValueRevealed ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {isTrueValueRevealed ? 'Hide True Value' : 'Reveal True Value'}
                 </Button>
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="ai" className="mt-4 flex-grow">
             <ScrollArea className="h-full">
              <Card className="h-full">
                <CardContent className="p-6 space-y-6">
                  <p className="text-sm text-muted-foreground">
                    If you're stuck, select a reading and ask the AI for advice on how to get a more accurate result.
                  </p>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="R" render={({ field }) => (
                            <FormItem>
                              <FormLabel>R (Ω)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} value={field.value.toFixed(2)}/></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        <FormField control={form.control} name="l1" render={({ field }) => (
                            <FormItem>
                              <FormLabel>l₁ (cm)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} value={field.value.toFixed(2)}/></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                         <FormField control={form.control} name="X" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approx. X (Ω)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} value={field.value.toFixed(2)}/></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={isAiLoading || !selectedReading}>
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
