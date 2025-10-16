'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SuggestResistanceValuesInput } from '@/ai/flows/suggest-resistance-values';
import { useToast } from '@/hooks/use-toast';
import { getAiSuggestion } from '@/app/actions';
import BridgeSimulation from '@/components/bridge-simulation';
import DataPanel from '@/components/data-panel';
import { produce } from 'immer';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { Zap, Info, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type Reading = {
  id: number;
  rValue: number;
  l1: number;
  l2: number;
  isSwapped: boolean; // Tracks if R and X (or Copper Strip) are swapped
};

export type ExperimentMode = 'findX' | 'findRho';

export type AllReadings = {
  findX: Reading[];
  findRho: Reading[];
};

export default function Home() {
  const [trueX, setTrueX] = useState(5.0);
  const [knownR, setKnownR] = useState(5.0);
  const [jockeyPos, setJockeyPos] = useState(50.0);
  const [allReadings, setAllReadings] = useState<AllReadings>({ findX: [], findRho: [] });
  const [selectedReadingId, setSelectedReadingId] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('findX');
  const [isTrueValueRevealed, setIsTrueValueRevealed] = useState(false);
  const [newTrueXInput, setNewTrueXInput] = useState(trueX.toString());
  const { toast } = useToast();
  const router = useRouter();

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
    const totalWireResistance = WIRE_RESISTANCE_PER_CM * 100;
    return 50 * (1 + (rLeft - rRight) / totalWireResistance);
  }, [rLeft, rRight]);

  const potentialDifference = useMemo(() => {
    const theoreticalJockeyPos = balancePoint;
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
    setAllReadings(prev =>
      produce(prev, draft => {
        draft[experimentMode].push(newReading);
      })
    );
  }, [jockeyPos, knownR, isSwapped, experimentMode]);

  const handleSwap = () => {
    setIsSwapped(prev => !prev);
  };
  
  const readings = useMemo(() => allReadings[experimentMode], [allReadings, experimentMode]);

  const handleReset = useCallback(() => {
    setAllReadings({ findX: [], findRho: [] });
    setKnownR(5.0);
    setJockeyPos(50.0);
    setAiSuggestion('');
    setSelectedReadingId(null);
    setIsSwapped(false);
    setIsTrueValueRevealed(false);
  }, []);

  const handleModeChange = (mode: ExperimentMode) => {
    setExperimentMode(mode);
    setKnownR(5.0);
    setJockeyPos(50.0);
    setAiSuggestion('');
    setSelectedReadingId(null);
    setIsSwapped(false);
    setIsTrueValueRevealed(false); // Keep reveal state per experiment
  }

  const selectedReading = useMemo(() => readings.find(r => r.id === selectedReadingId), [readings, selectedReadingId]);

  const calculatedXForAI = useMemo(() => {
    if(!selectedReading) return 0;
    const { rValue, l1 } = selectedReading;
    if (experimentMode === 'findRho') return 0;
    const approxX = rValue + (2 * l1 - 100) * WIRE_RESISTANCE_PER_CM;
    return approxX;
  }, [selectedReading, experimentMode, WIRE_RESISTANCE_PER_CM]);

  const handleGetSuggestion = useCallback(async () => {
    if (!selectedReading) return;

    setIsAiLoading(true);
    setAiSuggestion('');

    const input: SuggestResistanceValuesInput = {
        R: selectedReading.rValue,
        l1: selectedReading.l1,
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

  const handleTrueXChange = () => {
    const newValue = parseFloat(newTrueXInput);
    if (!isNaN(newValue) && newValue > 0) {
      setTrueX(newValue);
      toast({
        title: 'Success!',
        description: `The unknown resistance (X) has been set to ${newValue.toFixed(2)} Ω.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid Value',
        description: 'Please enter a positive number for the resistance.',
      });
    }
  };

  const handleGenerateReport = () => {
    const reportData = JSON.stringify({
      readings: allReadings,
      trueX: trueXValue,
      trueRho: WIRE_RESISTANCE_PER_CM,
    });
    sessionStorage.setItem('reportData', reportData);
    router.push('/report');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center rounded-lg">
                <Zap className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold font-headline">BridgeSim</h1>
           </div>
           
           <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleGenerateReport} disabled={allReadings.findX.length === 0 && allReadings.findRho.length === 0}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Info className="mr-2 h-4 w-4"/>
                    Instructor Information
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Set the Unknown Resistance (X)</AlertDialogTitle>
                  <AlertDialogDescription>
                    Use the field below to set the true value of the unknown resistance for the experiment. This value will be hidden from the student's view.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="true-x-input" className="text-right">
                      X Value (Ω)
                    </Label>
                    <Input
                      id="true-x-input"
                      type="number"
                      value={newTrueXInput}
                      onChange={(e) => setNewTrueXInput(e.target.value)}
                      className="col-span-3"
                      step="0.1"
                      min="0.1"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleTrueXChange}>Set Value</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
           </div>

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
              isTrueValueRevealed={isTrueValueRevealed}
              onRevealToggle={() => setIsTrueValueRevealed(prev => !prev)}
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
