'use client';

import React, { useEffect } from 'react';
import type { Reading } from '@/app/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SuggestResistanceValuesInput } from '@/ai/flows/suggest-resistance-values';

interface DataPanelProps {
  readings: Reading[];
  selectedReadingId: number | null;
  onSelectReading: (id: number | null) => void;
  aiSuggestion: string;
  isAiLoading: boolean;
  onGetSuggestion: (data: SuggestResistanceValuesInput) => Promise<void>;
  selectedReading: Reading | undefined;
}

const suggestionFormSchema = z.object({
  R: z.number().min(0.1, "Resistance must be positive."),
  l1: z.number().min(0, "Length must be non-negative."),
  l2: z.number().min(0, "Length must be non-negative."),
  X: z.number().min(0.1, "Resistance must be positive."),
});

const DataPanel: React.FC<DataPanelProps> = ({
  readings, selectedReadingId, onSelectReading, aiSuggestion, isAiLoading, onGetSuggestion, selectedReading
}) => {
  const form = useForm<z.infer<typeof suggestionFormSchema>>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: { R: 5, l1: 50, l2: 50, X: 5 }
  });

  useEffect(() => {
    if (selectedReading) {
      form.reset({
        R: selectedReading.rValue,
        l1: selectedReading.l1,
        l2: selectedReading.l2,
        X: selectedReading.calculatedX,
      });
    }
  }, [selectedReading, form]);

  const onSubmit = (values: z.infer<typeof suggestionFormSchema>) => {
    onGetSuggestion(values);
  };
  
  const averageX = readings.length > 0
    ? (readings.reduce((acc, r) => acc + r.calculatedX, 0) / readings.length).toFixed(2)
    : 'N/A';

  return (
    <Card className="w-full flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">Analysis</CardTitle>
        <CardDescription>Review your recorded data and get AI-powered suggestions.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <Tabs defaultValue="data" className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="data">Data Table</TabsTrigger>
            <TabsTrigger value="ai">AI Suggestions</TabsTrigger>
          </TabsList>
          <TabsContent value="data" className="mt-4 flex-grow">
            <Card className="h-full flex flex-col">
              <ScrollArea className="flex-grow">
                <Table>
                  <TableCaption>A list of your recorded measurements.</TableCaption>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-[50px]">S.No.</TableHead>
                      <TableHead>R (Ω)</TableHead>
                      <TableHead>l₁ (cm)</TableHead>
                      <TableHead>l₂ (cm)</TableHead>
                      <TableHead>X (calc. Ω)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.length > 0 ? readings.map((reading) => (
                      <TableRow
                        key={reading.id}
                        className={cn("cursor-pointer", selectedReadingId === reading.id && 'bg-primary/10')}
                        onClick={() => onSelectReading(reading.id)}
                      >
                        <TableCell>{reading.id}</TableCell>
                        <TableCell>{reading.rValue}</TableCell>
                        <TableCell>{reading.l1}</TableCell>
                        <TableCell>{reading.l2}</TableCell>
                        <TableCell>{reading.calculatedX}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-48">No data recorded yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="p-4 border-t font-semibold flex justify-end">
                Average Calculated X: {averageX} Ω
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="ai" className="mt-4 flex-grow">
             <ScrollArea className="h-full">
              <Card className="h-full">
                <CardContent className="p-6 space-y-6">
                  <p className="text-sm text-muted-foreground">
                    Select a reading from the data table to populate the form, then get AI suggestions to improve your experiment's accuracy.
                  </p>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="R" render={({ field }) => (
                            <FormItem>
                              <FormLabel>R (Ω)</FormLabel>
                              <FormControl><Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        <FormField control={form.control} name="X" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approx. X (Ω)</FormLabel>
                              <FormControl><Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        <FormField control={form.control} name="l1" render={({ field }) => (
                            <FormItem>
                              <FormLabel>l₁ (cm)</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        <FormField control={form.control} name="l2" render={({ field }) => (
                            <FormItem>
                              <FormLabel>l₂ (cm)</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                      </div>
                      <Button type="submit" className="w-full" disabled={isAiLoading}>
                        {isAiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Get Suggestions
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
