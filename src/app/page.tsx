'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { SuggestResistanceValuesInput } from '@/ai/flows/suggest-resistance-values';
import { useToast } from '@/hooks/use-toast';
import { getAiSuggestion } from '@/app/actions';
import BridgeSimulation from '@/components/bridge-simulation';
import DataPanel from '@/components/data-panel';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { produce } from 'immer';

export type Reading = {
  id: number;
  rValue: number;
  l1: number;
  l2: number;
  calculatedX: number;
  isSwapped: boolean; // Add this to track the state when the reading was taken
};

// Function to generate a random resistance value
const getRandomResistance = () => parseFloat((Math.random() * 2 + 4).toFixed(1)); // From 4.0 to 6.0

export default function Home() {
  const [trueX, setTrueX] = useState(5.0);
  const [knownR, setKnownR] = useState(5.0);
  const [jockeyPos, setJockeyPos] = useState(50.0);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedReadingId, setSelectedReadingId] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const { toast } = useToast();

  const P = 10; // Fixed inner resistance
  const Q = 10; // Fixed inner resistance

  useEffect(() => {
    // Set a random resistance when the component mounts on the client
    setTrueX(getRandomResistance());
  }, []);
  
  // The balance point calculation needs to be updated for the new setup.
  // In a Carey Foster bridge, we're comparing the ratio of the outer resistances (R and X)
  // to the ratio of the bridge wire segments. The inner resistances (P and Q) should be equal.
  const rLeft = isSwapped ? trueX : knownR;
  const rRight = isSwapped ? knownR : trueX;
  
  // The potential difference is more complex. A simplified model is used here for simulation.
  // The balance point is where the potential ratio is equal.
  // P/Q = (R_left + resistance of l1) / (R_right + resistance of l2)
  // For simulation purposes, let's keep it simple. The core idea is that swapping R and X moves the balance point.
  // Let's assume the wire has a total resistance, and jockeyPos divides it.
  const wireTotalResistance = 2; // Assume 2 Ohm for the 100cm wire
  const balancePoint = useMemo(() => {
    // This formula simulates the shift in balance point when R and X are swapped.
    // It's a simplified model for the simulation effect.
    return 50 * (1 + (rLeft - rRight) / (rLeft + rRight) * (P/Q));
  }, [rLeft, rRight, P, Q]);

  const potentialDifference = useMemo(() => {
    // A simplified representation of the potential difference for the galvanometer
    const theoreticalJockeyPos = balancePoint;
    return (jockeyPos - theoreticalJockeyPos) / 50; // Normalize to get a deflection value
  }, [jockeyPos, balancePoint]);

  const handleRecord = useCallback(() => {
    const l1 = jockeyPos;
    const l2 = 100 - l1;

    // The calculation of X now depends on whether R and X are swapped.
    // This logic is complex. For now, let's record l1 and l2.
    // The user will need two readings (swapped and not-swapped) to calculate X accurately.
    // X = R * (l2_swapped / l1_swapped) based on the second reading.
    // Let's provide a simplified calculation for a single reading.
    const calculatedX = isSwapped ? (knownR * l1) / l2 : (knownR * l2) / l1;

    const newReading: Reading = {
      id: Date.now(),
      rValue: knownR,
      l1: parseFloat(l1.toFixed(2)),
      l2: parseFloat(l2.toFixed(2)),
      calculatedX: parseFloat(calculatedX.toFixed(2)),
      isSwapped: isSwapped,
    };
    setReadings(prev => [...prev, newReading]);
  }, [jockeyPos, knownR, isSwapped]);
  
  const handleSwap = () => {
    setIsSwapped(prev => !prev);
  };

  const handleReset = useCallback(() => {
    setReadings([]);
    setTrueX(getRandomResistance());
    setKnownR(5.0);
    setJockeyPos(50.0);
    setAiSuggestion('');
    setSelectedReadingId(null);
    setIsSwapped(false);
  }, []);
  
  const selectedReading = useMemo(() => readings.find(r => r.id === selectedReadingId), [readings, selectedReadingId]);

  const handleGetSuggestion = useCallback(async () => {
    if (!selectedReading) return;

    setIsAiLoading(true);
    setAiSuggestion('');

    const input: SuggestResistanceValuesInput = {
        R: selectedReading.rValue,
        l1: selectedReading.l1,
        // In a Carey Foster bridge, we don't use l2 directly in the same way.
        // And the concept of X is what we are trying to find.
        // Let's pass the calculated X as the approximate value.
        l2: 100 - selectedReading.l1,
        X: selectedReading.calculatedX,
    };

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
  }, [selectedReading, toast]);

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
              isBalanced={Math.abs(potentialDifference) < 0.005} // Looser threshold for balance
              isSwapped={isSwapped}
              onSwap={handleSwap}
              P={P}
              Q={Q}
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
