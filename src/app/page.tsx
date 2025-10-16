'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { SuggestResistanceValuesInput } from '@/ai/flows/suggest-resistance-values';
import { useToast } from '@/hooks/use-toast';
import { getAiSuggestion } from '@/app/actions';
import BridgeSimulation from '@/components/bridge-simulation';
import DataPanel from '@/components/data-panel';
import { produce } from 'immer';
import { Zap } from 'lucide-react';


export type Reading = {
  id: number;
  rValue: number;
  l1: number;
  l2: number;
  isSwapped: boolean; // Tracks if R and X (or Copper Strip) are swapped
};

export type ExperimentMode = 'findX' | 'findRho';

export default function Home() {
  const [trueX, setTrueX] = useState(5.0);
  const [knownR, setKnownR] = useState(5.0);
  const [jockeyPos, setJockeyPos] = useState(50.0);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedReadingId, setSelectedReadingId] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('findX');
  const { toast } = useToast();

  const P = 10; // Fixed inner resistance
  const Q = 10; // Fixed inner resistance
  const WIRE_RESISTANCE_PER_CM = 0.02; // rho, resistance per cm of the wire (2 Ohm / 100cm)
  
  const rLeft = useMemo(() => {
    if (experimentMode === 'findX') {
      return isSwapped ? trueX : knownR;
    }
    // findRho mode
    return isSwapped ? 0 : knownR; // Copper strip has ~0 resistance
  }, [isSwapped, knownR, trueX, experimentMode]);

  const rRight = useMemo(() => {
    if (experimentMode === 'findX') {
      return isSwapped ? knownR : trueX;
    }
    // findRho mode
    return isSwapped ? knownR : 0;
  }, [isSwapped, knownR, trueX, experimentMode]);
  
  const balancePoint = useMemo(() => {
    // We assume P = Q. The balance condition is:
    // (rLeft) / (rRight) = (l1*rho) / ((100-l1)*rho) assuming ideal bridge with no end resistances
    // But for Carey Foster, the formula is l1 = 50 + (rRight - rLeft) / (2 * rho)
    // This simplified model gives the ideal balance point on the wire.
    return 50 + (rRight - rLeft) / (2 * WIRE_RESISTANCE_PER_CM);
  }, [rLeft, rRight]);

  const potentialDifference = useMemo(() => {
    const theoreticalJockeyPos = balancePoint;
    // The difference from the ideal balance point creates a potential difference
    // This is a simplified model for visualization.
    // A larger difference means a larger deflection. The divisor scales the effect.
    return (jockeyPos - theoreticalJockeyPos) / 25; // Normalization factor for deflection
  }, [jockeyPos, balancePoint]);

  const handleRecord = useCallback(() => {
    const l1 = jockeyPos;

    const newReading: Reading = {
      id: Date.now(),
      rValue: knownR,
      l1: parseFloat(l1.toFixed(2)),
      l2: parseFloat((100 - l1).toFixed(2)),
      isSwapped: isSwapped,
    };
    setReadings(prev => 
      produce(prev, draft => {
        draft.push(newReading);
      })
    );
  }, [jockeyPos, knownR, isSwapped]);
  
  const handleSwap = () => {
    setIsSwapped(prev => !prev);
  };

  const handleReset = useCallback(() => {
    setReadings([]);
    setKnownR(5.0);
    setJockeyPos(50.0);
    setAiSuggestion('');
    setSelectedReadingId(null);
    setIsSwapped(false);
  }, []);
  
  const handleModeChange = (mode: ExperimentMode) => {
    setExperimentMode(mode);
    // Reset relevant state when mode changes
    handleReset();
  }

  const selectedReading = useMemo(() => readings.find(r => r.id === selectedReadingId), [readings, selectedReadingId]);
  
  // This is a simplified calculation for the AI prompt, not the primary result
  const calculatedXForAI = useMemo(() => {
    if(!selectedReading) return 0;
    const { rValue, l1 } = selectedReading;
    // Basic Wheatstone bridge formula approximation for a single reading
    if (experimentMode === 'findRho') return 0; // X is not relevant here
    
    // This is a rough approximation. The proper calculation needs two readings.
    // P/Q = (R+l1*rho)/(X+(100-l1)*rho), assuming P=Q, R+l1*rho = X+(100-l1)*rho
    // X = R + (2*l1 - 100) * rho
    const approxX = rValue + (2 * l1 - 100) * WIRE_RESISTANCE_PER_CM;
    return approxX;

  }, [selectedReading, experimentMode]);


  const handleGetSuggestion = useCallback(async () => {
    if (!selectedReading) return;

    setIsAiLoading(true);
    setAiSuggestion('');

    const input: SuggestResistanceValuesInput = {
        R: selectedReading.rValue,
        l1: selectedReading.l1,
        // The AI prompt expects l2, which is 100 - l1
        l2: 100 - selectedReading.l1,
        X: parseFloat(calculatedXForAI.toFixed(2))
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
  }, [selectedReading, calculatedXForAI, toast]);

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
              trueX={trueX}
              onTrueXChange={setTrueX}
              jockeyPos={jockeyPos}
              onJockeyMove={setJockeyPos}
              potentialDifference={potentialDifference}
              onRecord={handleRecord}
              onReset={handleReset}
              isBalanced={Math.abs(potentialDifference) < 0.01}
              isSwapped={isSwapped}
              onSwap={handleSwap}
              P={P}
              Q={Q}
              experimentMode={experimentMode}
              onModeChange={handleModeChange}
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
              experimentMode={experimentMode}
              wireResistancePerCm={WIRE_RESISTANCE_PER_CM}
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
