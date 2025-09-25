'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { SuggestResistanceValuesInput } from '@/ai/flows/suggest-resistance-values';
import { useToast } from '@/hooks/use-toast';
import { getAiSuggestion } from '@/app/actions';
import BridgeSimulation from '@/components/bridge-simulation';
import DataPanel from '@/components/data-panel';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

export type Reading = {
  id: number;
  rValue: number;
  l1: number;
  l2: number;
  calculatedX: number;
};

// Function to generate a random resistance value
const getRandomResistance = () => parseFloat((Math.random() * 19 + 1).toFixed(1));

export default function Home() {
  const [trueX, setTrueX] = useState(5.0);
  const [knownR, setKnownR] = useState(5.0);
  const [jockeyPos, setJockeyPos] = useState(50.0);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedReadingId, setSelectedReadingId] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set a random resistance when the component mounts on the client
    setTrueX(getRandomResistance());
  }, []);

  const balancePoint = useMemo(() => (100 * knownR) / (knownR + trueX), [knownR, trueX]);
  const potentialDifference = useMemo(() => (jockeyPos / 100) - (knownR / (knownR + trueX)), [jockeyPos, knownR, trueX]);

  const handleRecord = useCallback(() => {
    const l1 = jockeyPos;
    const l2 = 100 - l1;
    const calculatedX = (knownR * l2) / l1;
    const newReading: Reading = {
      id: readings.length + 1,
      rValue: knownR,
      l1: parseFloat(l1.toFixed(2)),
      l2: parseFloat(l2.toFixed(2)),
      calculatedX: parseFloat(calculatedX.toFixed(2)),
    };
    setReadings(prev => [...prev, newReading]);
  }, [jockeyPos, knownR, readings.length]);

  const handleReset = useCallback(() => {
    setReadings([]);
    setTrueX(getRandomResistance());
    setKnownR(5.0);
    setJockeyPos(50.0);
    setAiSuggestion('');
    setSelectedReadingId(null);
  }, []);

  const handleGetSuggestion = useCallback(async (input: SuggestResistanceValuesInput) => {
    setIsAiLoading(true);
    setAiSuggestion('');
    const result = await getAiSuggestion(input);
    if (result.success && result.suggestion) {
      setAiSuggestion(result.suggestion);
    } else {
      toast({
        variant: 'destructive',
        title: 'AI Suggestion Failed',
        description: result.error || 'An unknown error occurred.',
      });
    }
    setIsAiLoading(false);
  }, [toast]);
  
  const selectedReading = useMemo(() => readings.find(r => r.id === selectedReadingId), [readings, selectedReadingId]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4 flex items-center gap-3">
           <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center rounded-lg">
            <Zap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold font-headline">BridgeSim</h1>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <BridgeSimulation
              knownR={knownR}
              onKnownRChange={setKnownR}
              jockeyPos={jockeyPos}
              onJockeyMove={setJockeyPos}
              potentialDifference={potentialDifference}
              onRecord={handleRecord}
              onReset={handleReset}
              isBalanced={Math.abs(potentialDifference) < 0.001}
            />
          </div>
          <div className="lg:col-span-2">
            <DataPanel
              readings={readings}
              selectedReadingId={selectedReadingId}
              onSelectReading={setSelectedReadingId}
              aiSuggestion={aiSuggestion}
              isAiLoading={isAiLoading}
              onGetSuggestion={handleGetSuggestion}
              selectedReading={selectedReading}
              trueXValue={trueX}
            />
          </div>
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        <p>&copy; {new Date().getFullYear()} BridgeSim. A Virtual Physics Lab.</p>
      </footer>
    </div>
  );
}
