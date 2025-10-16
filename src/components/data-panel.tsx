'use client';

import React, { useEffect, useMemo } from 'react';
import type { Reading, ExperimentMode } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface DataPanelProps {
  readings: Reading[];
  selectedReadingId: number | null;
  onSelectReading: (id: number | null) => void;
  aiSuggestion: string;
  isAiLoading: boolean;
  onGetSuggestion: () => Promise<void>;
  selectedReading: Reading | undefined;
  trueXValue: number;
  wireResistancePerCm: number;
  isTrueValueRevealed: boolean;
  onRevealToggle: () => void;
  experimentMode: ExperimentMode;
}

const suggestionFormSchema = z.object({
  R: z.number().min(0.1, "Resistance must be positive."),
  l1: z.number().min(0, "Length must be non-negative."),
  X: z.number().min(0, "Resistance must be non-negative."),
});


const DataPanel: React.FC<DataPanelProps> = ({
  readings, selectedReadingId, onSelectReading, aiSuggestion, isAiLoading, onGetSuggestion, selectedReading, trueXValue, wireResistancePerCm, isTrueValueRevealed, onRevealToggle, experimentMode
}) => {

  const form = useForm<z.infer<typeof suggestionFormSchema>>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: { R: 5, l1: 50, X: 5 }
  });

  useEffect(() => {
    if (selectedReading) {
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
    
    const normalReading = readings.find(r => !r.isSwapped);
    const swappedReading = readings.find(r => r.isSwapped);

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
  }, [readings, wireResistancePerCm, trueXValue, experimentMode]);

  const { finalCalculatedRho, calculationErrorRho } = useMemo(() => {
    if (experimentMode !== 'findRho' || readings.length < 2) return { finalCalculatedRho: null, calculationErrorRho: "Requires paired readings." };
    
    const normalReadings = readings.filter(r => !r.isSwapped);
    const swappedReadings = readings.filter(r => r.isSwapped);
    
    const rhos = [];
    for (const rNormal of normalReadings) {
        const rSwapped = swappedReadings.find(r => r.rValue === rNormal.rValue);
        if (rSwapped) {
            const rho = rNormal.rValue / (rSwapped.l1 - rNormal.l1);
            if(isFinite(rho)) rhos.push(rho);
        }
    }

    if(rhos.length > 0) {
        const avgRho = rhos.reduce((a, b) => a + b, 0) / rhos.length;
        return { finalCalculatedRho: avgRho, calculationErrorRho: null };
    }

    return { finalCalculatedRho: null, calculationErrorRho: "No matching normal/swapped pairs." };
  }, [readings, experimentMode]);


  const renderCalculationResults = () => {
      if (experimentMode === 'findX') {
        const isCalculated = finalCalculatedX !== null;
        return (
          <>
            <div className="font-semibold flex justify-between">
                <span>Final Calculated X:</span>
                {isCalculated ? (
                    <span>{finalCalculatedX.toFixed(4)} Ω</span>
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
                    <span>{trueXValue.toFixed(4)} Ω</span>
                  </div>
                ) : (
                  <span>? Ω</span>
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
        return (
             <div className="font-semibold flex justify-between">
                <span>Calculated ρ:</span>
                {finalCalculatedRho !== null ? (
                    <span>{finalCalculatedRho.toFixed(4)} Ω/cm</span>
                ) : (
                    <span className="text-xs text-muted-foreground">{calculationErrorRho}</span>
                )}
            </div>
        )
      }
      return null;
  }


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
              <ScrollArea className="flex-grow">
                <Table>
                  <TableCaption>
                    {experimentMode === 'findX' 
                      ? "Record a reading in both normal and swapped positions." 
                      : "Record readings for different R values in normal and swapped positions."}
                  </TableCaption>
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
