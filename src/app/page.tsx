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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Zap, Info, FileText, BookOpen, Sigma } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"


export type Reading = {
  id: number;
  rValue: number;
  l1: number | null; // Balance point in normal position
  l2: number | null; // Balance point in swapped position
};

export type ExperimentMode = 'findX' | 'findRho';
export type TabMode = ExperimentMode | 'aim' | 'formula';

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
  const [isReportInputDialogOpen, setIsReportInputDialogOpen] = useState(false);
  const [wireRadius, setWireRadius] = useState('');
  const [wireLength, setWireLength] = useState('');
  const [isValueLocked, setIsValueLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>('aim');
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
    setActiveTab('aim');
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
      setActiveTab('findX'); // Switch to experiment after setup
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid Value',
        description: 'Please enter a positive number for the resistance.',
      });
    }
  };
  
  const handleGenerateReport = () => {
    const radius = parseFloat(wireRadius);
    const length = parseFloat(wireLength);

    if (isNaN(radius) || radius <= 0 || isNaN(length) || length <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please enter valid, positive numbers for radius and length.',
      });
      return;
    }
    
    const reportData = JSON.stringify({
      readings: readings,
      trueX: trueX,
      trueRho: WIRE_RESISTANCE_PER_CM,
      wireRadius: radius,
      wireLength: length,
    });
    sessionStorage.setItem('reportData', reportData);
    router.push('/report');
  };
  
  const onTabChange = (value: string) => {
    const newTab = value as TabMode;
    setActiveTab(newTab);
    if (newTab === 'findX' || newTab === 'findRho') {
        setExperimentMode(newTab);
        setIsSwapped(false);
        setSelectedReadingId(null);
        setAiSuggestion('');
    }
  }


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Image
                src="https://picsum.photos/seed/snulogo/150/39"
                alt="Logo"
                width={150}
                height={39}
                className="rounded-lg"
              />
              <h1 className="text-2xl font-bold font-headline">Carey - Foster Bridge</h1>
           </div>
           
           <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setIsReportInputDialogOpen(true)} disabled={readings.findX.length === 0 && readings.findRho.length === 0}>
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
                  <AlertDialogAction onClick={handleTrueXChange}>Set Value and Start</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
           </div>
        </div>
      </header>

      <Dialog open={isReportInputDialogOpen} onOpenChange={setIsReportInputDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Wire Dimensions</DialogTitle>
            <DialogDescription>
              Provide the dimensions of the unknown resistance wire to calculate its specific resistance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wire-radius" className="text-right">
                Radius (r)
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="wire-radius"
                  type="number"
                  value={wireRadius}
                  onChange={(e) => setWireRadius(e.target.value)}
                  placeholder="e.g., 0.2"
                />
                <span>x10⁻³ m</span>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wire-length" className="text-right">
                Length (L)
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="wire-length"
                  type="number"
                  value={wireLength}
                  onChange={(e) => setWireLength(e.target.value)}
                  placeholder="e.g., 1.5"
                />
                <span>m</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportInputDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerateReport}>Confirm & Generate Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="aim"><BookOpen className="mr-2 h-4 w-4"/>Aim</TabsTrigger>
              <TabsTrigger value="formula"><Sigma className="mr-2 h-4 w-4"/>Formula</TabsTrigger>
              <TabsTrigger value="findX">Find Unknown Resistance (X)</TabsTrigger>
              <TabsTrigger value="findRho">Find Resistance/Length (ρ)</TabsTrigger>
            </TabsList>
            <TabsContent value="aim" className="mt-4">
               <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Carey Foster's Bridge</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Aim</h3>
                        <p className="text-muted-foreground">To determine (i) The specific resistance of the material of a wire and (ii) the unknown resistance of the given wire.</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Apparatus Required</h3>
                        <p className="text-muted-foreground">Meter bridge, Leclanché cell, two equal resistances, variable resistance box, unknown resistance, wire, high resistance, switches, galvanometer, jockey.</p>
                    </div>
                </CardContent>
               </Card>
            </TabsContent>
            <TabsContent value="formula" className="mt-4">
               <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Formula and Symbols</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Formulas Used</h3>
                      <div className="p-4 bg-muted/50 rounded-lg space-y-4 font-mono text-center">
                        <p className="flex items-center justify-center gap-2">
                           <span className='w-48 text-left'>(i) Resistance (X)</span>
                           <span>X = R + (l₁ - l₂)ρ &nbsp; [Ω]</span>
                        </p>
                        <p className="flex items-center justify-center gap-2">
                           <span className='w-48 text-left'>(ii) Specific Resistance (S)</span>
                           <span>S = (Xπr²)/L &nbsp; [Ωm]</span>
                        </p>
                      </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Symbols</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Symbol</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Unit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-mono font-semibold">X</TableCell>
                              <TableCell>Unknown resistance</TableCell>
                              <TableCell>Ω</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-mono font-semibold">R</TableCell>
                              <TableCell>Known value of resistance in the resistance box</TableCell>
                              <TableCell>Ω</TableCell>
                            </TableRow>
                             <TableRow>
                              <TableCell className="font-mono font-semibold">l₁, l₂</TableCell>
                              <TableCell>Balancing lengths</TableCell>
                              <TableCell>m</TableCell>
                            </TableRow>
                             <TableRow>
                              <TableCell className="font-mono font-semibold">ρ</TableCell>
                              <TableCell>Resistivity of the bridge wire</TableCell>
                              <TableCell>Ω/m</TableCell>
                            </TableRow>
                             <TableRow>
                              <TableCell className="font-mono font-semibold">r</TableCell>
                              <TableCell>Radius of the given coil of wire</TableCell>
                              <TableCell>m</TableCell>
                            </TableRow>
                             <TableRow>
                              <TableCell className="font-mono font-semibold">L</TableCell>
                              <TableCell>Length of the given wire</TableCell>
                              <TableCell>m</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                    </div>
                </CardContent>
               </Card>
            </TabsContent>
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
