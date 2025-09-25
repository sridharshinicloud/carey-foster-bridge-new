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

// Function to generate a random resistance value for X
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
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('findX');
  const { toast } = useToast();

  const P = 10; // Fixed inner resistance
  const Q = 10; // Fixed inner resistance
  const WIRE_RESISTANCE_PER_CM = 0.02; // rho, resistance per cm of the wire (2 Ohm / 100cm)

  useEffect(() => {
    // Set a random resistance when the component mounts on the client
    setTrueX(getRandomResistance());
  }, []);
  
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
    // (rLeft + alpha) / (rRight + beta) = (P + l1*rho) / (Q + (100-l1)*rho)
    // For simplicity, let's assume ideal wires and P=Q, so the condition simplifies to finding the point where the potential is equal.
    // The potential at the jockey is proportional to its position.
    // Potential at junction of P and Q is V_battery / 2 (assuming P=Q)
    // Potential along the wire: V(l) = V_left_terminal + (V_right_terminal - V_left_terminal) * l / 100
    // Simplified model: We want the potential divider from the top branch (R-X) to match the bottom (wire)
    // (rLeft + l1*rho) should be equal to (rRight + (100-l1)*rho) for the galvanometer to show zero.
    // rLeft + l1*rho = rRight + 100*rho - l1*rho
    // 2*l1*rho = rRight - rLeft + 100*rho
    // l1 = (rRight - rLeft)/(2*rho) + 50
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
        // In each mode, only readings for that mode are kept.
        // But we need to keep track of readings per experiment type
        // Let's just add the reading. The data panel will filter them.
        draft.push(newReading);
      })
    );
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
