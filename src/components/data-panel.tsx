'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { Reading } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, Loader2, Lightbulb, Eye, Repeat } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SuggestResistanceValuesInput } from '@/ai/flows/suggest-resistance-values';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface DataPanelProps {
  readings: Reading[];
  selectedReadingId: number | null;
  onSelectReading: (id: number | null) => void;
  aiSuggestion: string;
  isAiLoading: boolean;
  onGetSuggestion: () => Promise<void>;
  selectedReading: Reading | undefined;
  trueXValue: number;
}

const suggestionFormSchema = z.object({
  R: z.number().min(0.1, "Resistance must be positive."),
  l1: z.number().min(0, "Length must be non-negative."),
  X: z.number().min(0.1, "Resistance must be positive."),
});


const DataPanel: React.FC<DataPanelProps> = ({
  readings, selectedReadingId, onSelectReading, aiSuggestion, isAiLoading, onGetSuggestion, selectedReading, trueXValue
}) => {
  const form = useForm<z.infer<typeof suggestionFormSchema>>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: { R: 5, l1: 50, X: 5 }
  });

  const [showTrueX, setShowTrueX] = useState(false);

  useEffect(() => {
    if (selectedReading) {
      form.reset({
        R: selectedReading.rValue,
        l1: selectedReading.l1,
        X: selectedReading.calculatedX,
      });
    }
  }, [selectedReading, form]);

  const onSubmit = () => {
    onGetSuggestion();
  };
  
  const { finalCalculatedX, calculationError } = useMemo(() => {
    const normalReading = readings.find(r => !r.isSwapped);
    const swappedReading = readings.find(r => r.isSwapped);

    if (normalReading && swappedReading) {
      if (normalReading.rValue !== swappedReading.rValue) {
        return { finalCalculatedX: null, calculationError: "R values must be the same for both readings." };
      }
      // Carey Foster Bridge formula: X/R = l2/l1 (not swapped), and R/X = l2/l1 (swapped)
      // A more accurate formula is X = R * (l1_swapped / l2_swapped) or similar, depending on setup
      // Using the principle X = R * (l1_swapped/l1_normal)
      // Let's use the standard formula for the two-reading method:
      // X = R * ((l1_normal - l1_swapped) / (l2_normal - l2_swapped)) is complex.
      // Let's use ρ = (R * (l2 - l1)) / (l1 + l2) and X = R...
      // Simplified approach for this simulation:
      // X/R = (50 + (l1_swapped - 50)) / (50 - (l1_normal - 50))
      // The most common textbook formula: X = R * (l2_normal / l1_normal) and then averaged.
      // Let's use the swapping formula: X/R = (R_gap_resistance + l1_resistance) / (X_gap_resistance + l2_resistance)
      // ρ = resistance per cm. R_wire = 100 * ρ
      // (X-R) = ρ * (l1_swapped - l1_normal)
      // This is too complex to calculate here without ρ.
      // We will use the two separate calculations and average them.
      const x_normal = normalReading.rValue * normalReading.l2 / normalReading.l1;
      const x_swapped = swappedReading.rValue * swappedReading.l1 / swappedReading.l2;
      return { finalCalculatedX: ((x_normal + x_swapped) / 2).toFixed(2), calculationError: null };
    }
    return { finalCalculatedX: null, calculationError: "Requires one normal and one swapped reading." };
  }, [readings]);


  const deviation = (finalCalculatedX && trueXValue)
    ? Math.abs(((parseFloat(finalCalculatedX) - trueXValue) / trueXValue) * 100).toFixed(2)
    : 'N/A';

  return (
    <Card className="w-full flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">Analysis</CardTitle>
        <CardDescription>Review your data and calculate the unknown resistance.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <Tabs defaultValue="data" className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="data">Data Table</TabsTrigger>
            <TabsTrigger value="ai">AI Help</TabsTrigger>
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
                        <TableCell>{reading.rValue}</TableCell>
                        <TableCell>{reading.l1}</TableCell>
                        <TableCell>{reading.l2}</TableCell>
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
                 <div className="font-semibold flex justify-between">
                    <span>Final Calculated X:</span>
                    {finalCalculatedX ? (
                        <span>{finalCalculatedX} Ω</span>
                    ) : (
                        <span className="text-xs text-muted-foreground">{calculationError}</span>
                    )}
                </div>
                {finalCalculatedX && (
                  <>
                    <div className="font-semibold flex justify-between items-center">
                       <div className="flex items-center gap-2">
                         <span>True Value of X:</span>
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-6 w-6">
                               <Eye className="w-4 h-4" />
                             </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>Reveal True Value?</AlertDialogTitle>
                               <AlertDialogDescription>
                                 This will reveal the actual value of the unknown resistance.
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel>Cancel</AlertDialogCancel>
                               <AlertDialogAction onClick={() => setShowTrueX(true)}>Reveal</AlertDialogAction>
                             </AlertDialogFooter>
                           </AlertDialogContent>
                         </AlertDialog>
                       </div>
                      <span>{showTrueX ? `${trueXValue.toFixed(2)} Ω` : '? Ω'}</span>
                    </div>
                    {showTrueX && (
                      <div className="font-semibold flex justify-between text-destructive">
                        <span>Deviation:</span>
                        <span>{deviation} %</span>
                      </div>
                    )}
                  </>
                )}
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
                              <FormControl><Input readOnly type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        <FormField control={form.control} name="l1" render={({ field }) => (
                            <FormItem>
                              <FormLabel>l₁ (cm)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                         <FormField control={form.control} name="X" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approx. X (Ω)</FormLabel>
                              <FormControl><Input readOnly type="number" {...field} /></FormControl>
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
