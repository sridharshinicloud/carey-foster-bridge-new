'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import BridgeSimulation from '@/components/bridge-simulation';
import DataPanel from '@/components/data-panel';
import { produce } from 'immer';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Info, FileText, BookOpen, Sigma, HelpCircle } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export type Reading = {
  id: number;
  rValue: number;
  l1: number | null; // Balance point in normal position
  l2: number | null; // Balance point in swapped position
};

export type ExperimentMode = 'findX' | 'findRho';
export type TabMode = ExperimentMode | 'aim' | 'formula' | 'instructions';

export default function Home() {
  const [trueX, setTrueX] = useState(5.0);
  const [wireResistancePerCm, setWireResistancePerCm] = useState(0.008);
  const [knownR, setKnownR] = useState(5.0);
  const [jockeyPos, setJockeyPos] = useState(50.0);
  const [readings, setReadings] = useState<{ findX: Reading[]; findRho: Reading[] }>({
    findX: [],
    findRho: [],
  });
  const [selectedReadingId, setSelectedReadingId] = useState<number | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [isTrueValueRevealed, setIsTrueValueRevealed] = useState(false);
  const [newTrueXInput, setNewTrueXInput] = useState(trueX.toString());
  const [isInstructionDialogOpen, setIsInstructionDialogOpen] = useState(true);
  const [isStudentInfoDialogOpen, setIsStudentInfoDialogOpen] = useState(false);
  const [isReportInputDialogOpen, setIsReportInputDialogOpen] = useState(false);
  
  const [wireRadius, setWireRadius] = useState('');
  const [wireRadiusUnit, setWireRadiusUnit] = useState('mm');
  const [wireLength, setWireLength] = useState('');
  const [wireLengthUnit, setWireLengthUnit] = useState('m');

  const [isValueLocked, setIsValueLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>('aim');
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('findX');
  
  const [studentName, setStudentName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [experimentDate, setExperimentDate] = useState(new Date().toISOString().split('T')[0]);

  const { toast } = useToast();
  const router = useRouter();

  const P = 10; 
  const Q = 10; 
  const SENSITIVITY_FACTOR = 0.005;
  
  useEffect(() => {
    // Set a random resistivity value (in ohm/cm) on component mount to avoid hydration mismatch
    // Range: 0.7 ohm/m to 0.9 ohm/m is 0.007 ohm/cm to 0.009 ohm/cm
    setWireResistancePerCm(Math.random() * (0.009 - 0.007) + 0.007);
  }, []);

  const balancePoint = useMemo(() => {
    let rLeft, rRight;

    if (experimentMode === 'findX') {
      rLeft = isSwapped ? trueX : knownR;
      rRight = isSwapped ? knownR : trueX;
    } else { // findRho
      const metallicStripResistance = 0.0;
      rLeft = !isSwapped ? knownR : metallicStripResistance;
      rRight = !isSwapped ? metallicStripResistance : knownR;
    }

    const resistanceDifference = rRight - rLeft;
    const balanceShift = resistanceDifference / (2 * wireResistancePerCm);
    return 50 + balanceShift;
  }, [isSwapped, knownR, experimentMode, wireResistancePerCm, trueX]);

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
    setSelectedReadingId(null);
    setIsSwapped(false);
    setIsTrueValueRevealed(false);
    setIsValueLocked(false);
    setTrueX(5.0);
    setNewTrueXInput('5.0');
    setIsInstructionDialogOpen(true);
    setIsStudentInfoDialogOpen(false);
    setExperimentMode('findX');
    setActiveTab('aim');
    setStudentName('');
    setRollNumber('');
    setExperimentDate(new Date().toISOString().split('T')[0]);
    // Generate a new random value on reset
    setWireResistancePerCm(Math.random() * (0.009 - 0.007) + 0.007);
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
        }
    }));
  }, [experimentMode, selectedReadingId]);

  const handleTrueXChange = () => {
    const newValue = parseFloat(newTrueXInput);
    if (!isNaN(newValue) && newValue > 0) {
      setTrueX(newValue);
      setIsValueLocked(true);
      setIsInstructionDialogOpen(false);
      setIsStudentInfoDialogOpen(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid Value',
        description: 'Please enter a positive number for the resistance.',
      });
    }
  };

  const handleStudentInfoSubmit = () => {
      if (!studentName.trim() || !rollNumber.trim()) {
          toast({
              variant: 'destructive',
              title: 'Missing Information',
              description: 'Please enter your name and roll number.',
          });
          return;
      }
      setIsStudentInfoDialogOpen(false);
      setActiveTab('instructions'); // Switch to instructions after setup
  }
  
  const handleGenerateReport = () => {
    const radiusValue = parseFloat(wireRadius);
    const lengthValue = parseFloat(wireLength);

    if (isNaN(radiusValue) || radiusValue <= 0 || isNaN(lengthValue) || lengthValue <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please enter valid, positive numbers for radius and length.',
      });
      return;
    }
    
    let radiusInMeters = radiusValue;
    switch(wireRadiusUnit) {
      case 'mm': radiusInMeters *= 1e-3; break;
      case 'cm': radiusInMeters *= 1e-2; break;
    }
    
    let lengthInMeters = lengthValue;
    switch(wireLengthUnit) {
      case 'cm': lengthInMeters /= 100; break;
      case 'mm': lengthInMeters /= 1000; break;
    }
    
    const reportData = JSON.stringify({
      readings: readings,
      trueX: trueX,
      trueRho: wireResistancePerCm * 100, // Convert from ohm/cm to ohm/m for the report
      wireRadius: radiusInMeters,
      wireLength: lengthInMeters,
      studentName: studentName,
      rollNumber: rollNumber,
      experimentDate: experimentDate,
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
    }
  }


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Image
                src="https://picsum.photos/seed/logo/150/39"
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
                    Instructor Setup
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
                  <AlertDialogAction onClick={handleTrueXChange}>Set Value and Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
           </div>
        </div>
      </header>

      <Dialog open={isStudentInfoDialogOpen} onOpenChange={setIsStudentInfoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Information</DialogTitle>
            <DialogDescription>
              Please enter your details for the experiment report.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="student-name" className="text-right">
                Name
              </Label>
              <Input
                id="student-name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="roll-number" className="text-right">
                Roll Number
              </Label>
              <Input
                id="roll-number"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="experiment-date" className="text-right">
                Date
              </Label>
              <Input
                id="experiment-date"
                type="date"
                value={experimentDate}
                onChange={(e) => setExperimentDate(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleStudentInfoSubmit}>Start Experiment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  className="flex-1"
                />
                <Select value={wireRadiusUnit} onValueChange={setWireRadiusUnit}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                  </SelectContent>
                </Select>
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
                  className="flex-1"
                />
                 <Select value={wireLengthUnit} onValueChange={setWireLengthUnit}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="mm">mm</SelectItem>
                  </SelectContent>
                </Select>
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="aim"><BookOpen className="mr-2 h-4 w-4"/>Aim</TabsTrigger>
              <TabsTrigger value="instructions"><HelpCircle className="mr-2 h-4 w-4"/>Instructions</TabsTrigger>
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
            <TabsContent value="instructions" className="mt-4">
               <Card>
                <CardHeader>
                    <CardTitle className="font-headline">How to Use the Virtual Lab</CardTitle>
                    <CardDescription>Follow these steps to perform the experiment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <ol className="list-decimal list-outside pl-5 space-y-3">
                            <li>
                              <strong>Select Experiment:</strong> Choose either the "Find Unknown Resistance (X)" or "Find Resistance/Length (ρ)" tab to begin the respective experiment.
                            </li>
                            <li>
                              <strong>Set Known Resistance (R):</strong> In the "Experiment Setup" panel, use the slider or the input box to set a value for the known resistance `R`.
                            </li>
                            <li>
                              <strong>Find Balance Point (l₁):</strong>
                              <ul className="list-disc list-outside pl-5 mt-2 space-y-1">
                                  <li>Click and drag the jockey (the small slider on the wire) or use your keyboard's left/right arrow keys for precise movement.</li>
                                  <li>Watch the Galvanometer. Your goal is to make the needle point to zero, which indicates the bridge is "Balanced".</li>
                                  <li>When the Galvanometer shows 'Balanced', click the <Button size="sm" variant="secondary" className="inline-flex h-auto p-1 leading-none">Record Data</Button> button to save the balance length `l₁`.</li>
                              </ul>
                            </li>
                            <li>
                              <strong>Swap the Gaps:</strong> Click the <Button size="sm" variant="outline" className="inline-flex h-auto p-1 leading-none">Swap Gaps</Button> button. This will exchange the positions of the resistances in the gaps.
                            </li>
                             <li>
                              <strong>Find New Balance Point (l₂):</strong> Repeat step 3 to find the new balance point and record the value `l₂`. The data table will now show a complete reading.
                            </li>
                            <li>
                              <strong>Repeat for More Readings:</strong> Change the value of `R` and repeat steps 3-5 to take multiple readings. It's recommended to take at least 4 readings for an accurate result.
                            </li>
                            <li>
                              <strong>Generate Report:</strong> Once you have collected enough data, click the <Button size="sm" variant="secondary" className="inline-flex h-auto p-1 leading-none">Generate Report</Button> button at the top of the page to view and print your results.
                            </li>
                        </ol>
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
                           <span>X = R + (l₂ - l₁)ρ &nbsp; [Ω]</span>
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
                      onDeleteReading={handleDeleteReading}
                      trueXValue={trueX}
                      wireResistancePerCm={wireResistancePerCm}
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
                      onDeleteReading={handleDeleteReading}
                      trueXValue={trueX}
                      wireResistancePerCm={wireResistancePerCm}
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

    