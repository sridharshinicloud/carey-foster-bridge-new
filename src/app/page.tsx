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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';

export type Reading = {
  id: number;
  rValue: number;
  l1: number | null; // Balance point in normal position
  l2: number | null; // Balance point in swapped position
};

export type ExperimentMode = 'findX' | 'findRho';

export default function Home() {
  const [trueX, setTrueX] = useState(5.0);
  const [knownR, setKnownR] = useState(5.0);
  const [jockeyPos, setJockeyPos] = useState(50.0);
  const [readings, setReadings] = useState<{ findX: Reading[]; findRho: Reading[] }>({
    findX: [],
    findRho: [],
  });
  const [selectedReadingId, setSelectedReadingId] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isTrueValueRevealed, setIsTrueValueRevealed] = useState(false);
  const [newTrueXInput, setNewTrueXInput] = useState(trueX.toString());
  const [isInstructionDialogOpen, setIsInstructionDialogOpen] = useState(true);
  const [isValueLocked, setIsValueLocked] = useState(false);
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('findX');
  const { toast } = useToast();
  const router = useRouter();

  const P = 10; 
  const Q = 10; 
  const WIRE_RESISTANCE_PER_CM = 0.02; // rho
  const SENSITIVITY_FACTOR = 0.005;

  const balancePoint = useMemo(() => {
    let rLeft, rRight;

    if (experimentMode === 'findX') {
      rLeft = isSwapped ? trueX : knownR;
      rRight = isSwapped ? knownR : trueX;
    } else { // findRho
      const copperStripResistance = 0.0;
      rLeft = !isSwapped ? knownR : copperStripResistance;
      rRight = !isSwapped ? copperStripResistance : knownR;
    }

    const resistanceDifference = rRight - rLeft;
    const balanceShift = resistanceDifference / (2 * WIRE_RESISTANCE_PER_CM);
    return 50 + balanceShift;
  }, [isSwapped, knownR, experimentMode, WIRE_RESISTANCE_PER_CM, trueX]);

  const potentialDifference = useMemo(() => {
    return (jockeyPos - balancePoint) * SENSITIVITY_FACTOR;
  }, [jockeyPos, balancePoint]);


  const handleRecord = useCallback(() => {
    const currentPos = parseFloat(jockeyPos.toFixed(2));
    
    setReadings(produce(draft => {
        const currentReadings = draft[experimentMode];
        let existingReadingForR = currentReadings.find(r => r.rValue === knownR);

        if (isSwapped) { // Recording l2
            if (existingReadingForR) {
                if (existingReadingForR.l1 !== null && existingReadingForR.l2 === null) {
                    existingReadingForR.l2 = currentPos;
                    setSelectedReadingId(existingReadingForR.id);
                } else {
                     // This case might mean l1 was not set, or l2 already is.
                     // A toast message might be good here, or just ignore.
                }
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Missing First Reading',
                    description: `Please record l1 for R = ${knownR}Ω before swapping.`,
                });
            }
        } else { // Recording l1
            if (!existingReadingForR) {
                const newReading: Reading = {
                    id: Date.now(),
                    rValue: knownR,
                    l1: currentPos,
                    l2: null,
                };
                currentReadings.push(newReading);
                setSelectedReadingId(newReading.id);
            } else {
                 // Allow overwriting l1 if l2 is not set yet
                if (existingReadingForR.l2 === null) {
                    existingReadingForR.l1 = currentPos;
                    setSelectedReadingId(existingReadingForR.id);
                } else {
                     toast({
                        variant: 'destructive',
                        title: 'Reading Complete',
                        description: `A complete reading for R = ${knownR}Ω already exists. Please change R.`,
                    });
                }
            }
        }
    }));
  }, [jockeyPos, knownR, isSwapped, experimentMode, toast]);

  const handleSwap = () => {
    setIsSwapped(prev => !prev);
  };

  const handleReset = useCallback(() => {
    setReadings({ findX: [], findRho: [] });
    setKnownR(5.0);
    setJockeyPos(50.0);
    setAiSuggestion('');
    setSelectedReadingId(null);
    setIsSwapped(false);
    setIsTrueValueRevealed(false);
    setIsValueLocked(false);
    setTrueX(5.0);
    setNewTrueXInput('5.0');
    setIsInstructionDialogOpen(true);
    setExperimentMode('findX');
  }, []);

  const handleDeleteReading = useCallback((id: number) => {
    setReadings(produce(draft => {
        const currentReadings = draft[experimentMode];
        const index = currentReadings.findIndex(r => r.id === id);
        if (index !== -1) {
            currentReadings.splice(index, 1);
        }
        if (selectedReadingId === id) {
            setSelectedReadingId(null);
            setAiSuggestion('');
        }
    }));
  }, [experimentMode, selectedReadingId]);

  const currentReadings = readings[experimentMode];
  const selectedReading = useMemo(() => currentReadings.find(r => r.id === selectedReadingId), [currentReadings, selectedReadingId]);

  const calculatedXForAI = useMemo(() => {
    if(!selectedReading || experimentMode !== 'findX' || selectedReading.l1 === null) return 0;
    const { rValue, l1 } = selectedReading;
    // This is an approximation for the AI, not the final calculation
    const approxX = rValue + (2 * l1 - 100) * WIRE_RESISTANCE_PER_CM;
    return approxX;
  }, [selectedReading, WIRE_RESISTANCE_PER_CM, experimentMode]);

  const handleGetSuggestion = useCallback(async () => {
    if (!selectedReading || experimentMode === 'findRho' || selectedReading.l1 === null) return;

    setIsAiLoading(true);
    setAiSuggestion('');

    const input: SuggestResistanceValuesInput = {
        R: selectedReading.rValue,
        l1: selectedReading.l1,
        l2: 100 - selectedReading.l1, // Legacy l2 for prompt
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
  }, [selectedReading, calculatedXForAI, toast, experimentMode]);

  const handleTrueXChange = () => {
    const newValue = parseFloat(newTrueXInput);
    if (!isNaN(newValue) && newValue > 0) {
      setTrueX(newValue);
      setIsValueLocked(true);
      setIsInstructionDialogOpen(false);
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
      readings: readings,
      trueX: trueX,
      trueRho: WIRE_RESISTANCE_PER_CM,
    });
    sessionStorage.setItem('reportData', reportData);
    router.push('/report');
  };
  
  const onTabChange = (value: string) => {
    setExperimentMode(value as ExperimentMode);
    setIsSwapped(false);
    setSelectedReadingId(null);
    setAiSuggestion('');
  }


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Image
                src="https://picsum.photos/seed/logo/40/40"
                alt="BridgeSim Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h1 className="text-2xl font-bold font-headline">BridgeSim</h1>
           </div>
           
           <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleGenerateReport} disabled={readings.findX.length === 0 && readings.findRho.length === 0}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
            </Button>

            <AlertDialog open={isInstructionDialogOpen && !isValueLocked} onOpenChange={setIsInstructionDialogOpen}>
              <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isValueLocked}>
                    <Info className="mr-2 h-4 w-4"/>
                    Instructor Information
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Set the Unknown Resistance (X)</AlertDialogTitle>
                  <AlertDialogDescription>
                    Use the field below to set the true value of the unknown resistance for the experiment. This value will be hidden from the student's view. This dialog cannot be opened again until the experiment is reset.
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
                  <AlertDialogAction onClick={handleTrueXChange}>Set Value and Lock</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
           </div>

        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Tabs value={experimentMode} onValueChange={onTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="findX">Find Unknown Resistance (X)</TabsTrigger>
              <TabsTrigger value="findRho">Find Resistance/Length (ρ)</TabsTrigger>
            </TabsList>
            <TabsContent value="findX">
               <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-4">
                  <div className="lg:col-span-3">
                    <BridgeSimulation
                      knownR={knownR}
                      onKnownRChange={setKnownR}
                      jockeyPos={jockeyPos}
                      onJockeyMove={setJockeyPos}
                      onRecord={handleRecord}
                      onReset={handleReset}
                      balancePoint={balancePoint}
                      isSwapped={isSwapped}
                      onSwap={handleSwap}
                      P={P}
                      Q={Q}
                      experimentMode={experimentMode}
                      trueX={trueX}
                      potentialDifference={potentialDifference}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <DataPanel
                      readings={readings.findX}
                      selectedReadingId={selectedReadingId}
                      onSelectReading={setSelectedReadingId}
                      aiSuggestion={aiSuggestion}
                      isAiLoading={isAiLoading}
                      onGetSuggestion={handleGetSuggestion}
                      onDeleteReading={handleDeleteReading}
                      selectedReading={selectedReading}
                      trueXValue={trueX}
                      wireResistancePerCm={WIRE_RESISTANCE_PER_CM}
                      isTrueValueRevealed={isTrueValueRevealed}
                      onRevealToggle={() => setIsTrueValueRevealed(prev => !prev)}
                      experimentMode={experimentMode}
                      isSwapped={isSwapped}
                      knownR={knownR}
                    />
                  </div>
                </div>
            </TabsContent>
            <TabsContent value="findRho">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-4">
                  <div className="lg:col-span-3">
                    <BridgeSimulation
                      knownR={knownR}
                      onKnownRChange={setKnownR}
                      jockeyPos={jockeyPos}
                      onJockeyMove={setJockeyPos}
                      onRecord={handleRecord}
                      onReset={handleReset}
                      balancePoint={balancePoint}
                      isSwapped={isSwapped}
                      onSwap={handleSwap}
                      P={P}
                      Q={Q}
                      experimentMode={experimentMode}
                      trueX={trueX}
                      potentialDifference={potentialDifference}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <DataPanel
                      readings={readings.findRho}
                      selectedReadingId={selectedReadingId}
                      onSelectReading={setSelectedReadingId}
                      aiSuggestion={aiSuggestion}
                      isAiLoading={isAiLoading}
                      onGetSuggestion={handleGetSuggestion}
                      onDeleteReading={handleDeleteReading}
                      selectedReading={selectedReading}
                      trueXValue={trueX}
                      wireResistancePerCm={WIRE_RESISTANCE_PER_CM}
                      isTrueValueRevealed={isTrueValueRevealed}
                      onRevealToggle={() => setIsTrueValueRevealed(prev => !prev)}
                      experimentMode={experimentMode}
                      isSwapped={isSwapped}
                      knownR={knownR}
                    />
                  </div>
                </div>
            </TabsContent>
        </Tabs>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        <p>&copy; {new Date().getFullYear()} BridgeSim. A Virtual Physics Lab.</p>
      </footer>
    </div>
  );
}
