'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Reading } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

type AllReadings = {
  findX: Reading[];
  findRho: Reading[];
};

type ReportData = {
  readings: AllReadings;
  trueX: number;
  trueRho: number;
  wireRadius: number;
  wireLength: number;
  studentName: string;
  rollNumber: string;
  experimentDate: string;
};

const ReportPage = () => {
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('reportData');
    if (data) {
      try {
        const parsedData = JSON.parse(data);
        if (parsedData && parsedData.readings && parsedData.readings.findX && parsedData.readings.findRho) {
          setReportData(parsedData);
        } else {
           router.push('/');
        }
      } catch (error) {
        console.error("Failed to parse report data:", error);
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [router]);

  const { finalCalculatedX, calculationErrorX, deviationX } = useMemo(() => {
    if (!reportData || !reportData.readings.findX) return { finalCalculatedX: null, calculationErrorX: null, deviationX: null };
    
    const findXReadings = reportData.readings.findX.filter(r => r.l1 !== null && r.l2 !== null);

    if (findXReadings.length === 0) {
      return { finalCalculatedX: null, calculationErrorX: "Requires at least one complete reading (l1 and l2).", deviationX: null };
    }
    
    const calculatedXs = findXReadings.map(reading => {
      const R = reading.rValue;
      const l1_normal = reading.l1!;
      const l2_swapped = reading.l2!; // l2 is the balance point when swapped
      // This is the correct formula for the Carey Foster Bridge for X
      return R + reportData.trueRho * (l2_swapped - l1_normal);
    });
    
    const averageX = calculatedXs.reduce((acc, val) => acc + val, 0) / calculatedXs.length;
    const deviation = reportData.trueX !== 0 ? ((averageX - reportData.trueX) / reportData.trueX) * 100 : 0;

    return { finalCalculatedX: averageX, calculationErrorX: null, deviationX: deviation };
  }, [reportData]);

  const { finalCalculatedRho, calculationErrorRho, deviationRho } = useMemo(() => {
    if (!reportData || !reportData.readings.findRho) return { finalCalculatedRho: null, calculationErrorRho: null, deviationRho: null };
    
    const findRhoReadings = reportData.readings.findRho.filter(r => r.l1 !== null && r.l2 !== null);
    
    if (findRhoReadings.length === 0) {
      return { finalCalculatedRho: null, calculationErrorRho: "Requires at least one complete reading (l1 and l2).", deviationRho: null };
    }

    const calculatedRhos = findRhoReadings.map(reading => {
        const R = reading.rValue;
        const l1_normal = reading.l1! / 100; // convert to meters
        const l2_swapped = reading.l2! / 100; // convert to meters
        
        if (l2_swapped - l1_normal !== 0) {
           return R / (l2_swapped - l1_normal);
        }
        return null;
    }).filter((rho): rho is number => rho !== null);
    
    if(calculatedRhos.length === 0) {
      return { finalCalculatedRho: null, calculationErrorRho: "Could not calculate ρ. Ensure l₁ and l₂ values are different.", deviationRho: null };
    }

    const averageRho = calculatedRhos.reduce((acc, val) => acc + val, 0) / calculatedRhos.length;
    const trueRhoMeters = reportData.trueRho * 100; // convert to Ω/m
    const deviation = trueRhoMeters !== 0 ? ((averageRho - trueRhoMeters) / trueRhoMeters) * 100 : 0;

    return { finalCalculatedRho: averageRho, calculationErrorRho: null, deviationRho: deviation };
  }, [reportData]);

  const specificResistanceS = useMemo(() => {
    if (!reportData || finalCalculatedX === null) return null;
    const r_meters = reportData.wireRadius * 1e-3;
    const L = reportData.wireLength;
    return (Math.PI * r_meters * r_meters * finalCalculatedX) / L;
  }, [reportData, finalCalculatedX]);


  if (!reportData) {
    return <div className="flex items-center justify-center min-h-screen">Loading report...</div>;
  }
  
  const renderReadingsTable = (readings: Reading[], caption: string, mode: 'findX' | 'findRho') => {
    if (readings.length === 0) return <p className="text-muted-foreground text-center py-4">No data for this experiment.</p>;
    return (
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>R (Ω)</TableHead>
            <TableHead>l₁ (cm)</TableHead>
            <TableHead>l₂ (cm)</TableHead>
            <TableHead>l₂-l₁ (cm)</TableHead>
            {mode === 'findX' && <TableHead>Calc. X (Ω)</TableHead>}
            {mode === 'findRho' && <TableHead>ρ (Ω/m)</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.map((reading, index) => {
            const isComplete = reading.l1 !== null && reading.l2 !== null;
            let diff = null;
            let rho = null;
            let calculatedX = null;
            if (isComplete) {
              diff = reading.l2! - reading.l1!;
              if (mode === 'findRho') {
                const diffMeters = diff / 100;
                rho = diffMeters !== 0 ? reading.rValue / diffMeters : null;
              }
              if (mode === 'findX') {
                calculatedX = reading.rValue + reportData.trueRho * diff;
              }
            }
            return (
              <TableRow key={reading.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{reading.rValue.toFixed(2)}</TableCell>
                <TableCell>{reading.l1 !== null ? reading.l1.toFixed(2) : 'N/A'}</TableCell>
                <TableCell>{reading.l2 !== null ? reading.l2.toFixed(2) : 'N/A'}</TableCell>
                <TableCell>{isComplete && diff !== null ? diff.toFixed(2) : 'N/A'}</TableCell>
                {mode === 'findX' && (
                  <TableCell>{isComplete && calculatedX !== null ? calculatedX.toFixed(4) : 'N/A'}</TableCell>
                )}
                {mode === 'findRho' && (
                  <TableCell>{isComplete && rho !== null ? rho.toFixed(4) : 'N/A'}</TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  const renderResults = (title: string, calculatedValue: number | null, trueValue: number, error: string | null, deviation: number | null, unit: string) => {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
           <div className="flex justify-between">
              <span>Mean Calculated Value:</span>
              {calculatedValue !== null ? (
                <span className="font-mono">{calculatedValue.toFixed(4)} {unit}</span>
              ) : (
                <span className="text-xs text-muted-foreground">{error}</span>
              )}
          </div>
          <div className="flex justify-between">
              <span>True Value:</span>
              <span className="font-mono">{trueValue.toFixed(4)} {unit}</span>
          </div>
           {calculatedValue !== null && deviation !== null && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Deviation:</span>
               <Badge variant={Math.abs(deviation) < 5 ? "secondary" : "destructive"}>
                {deviation.toFixed(2)}%
              </Badge>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="py-4 border-b no-print">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4"/>
            Back to Experiment
          </Button>
          <h1 className="text-2xl font-bold font-headline">Experiment Report</h1>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8" id="report-content">
        <Card>
          <CardHeader>
            <CardTitle>Carey Foster Bridge Experiment Summary</CardTitle>
            <CardDescription>
              A summary of the data collected and results calculated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-b pb-6">
                <div><span className="font-semibold">Student Name: </span>{reportData.studentName}</div>
                <div><span className="font-semibold">Roll Number: </span>{reportData.rollNumber}</div>
                <div><span className="font-semibold">Date: </span>{format(new Date(reportData.experimentDate), "PPP")}</div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-2">Experiment: Find Unknown Resistance (X)</h2>
              {renderReadingsTable(reportData.readings.findX, "Readings for determining unknown resistance X.", 'findX')}
              <div className="mt-4">
                {renderResults("Result for X", finalCalculatedX, reportData.trueX, calculationErrorX, deviationX, "Ω")}
              </div>
            </div>

            <div className="pt-8">
              <h2 className="text-xl font-bold mb-2">Experiment: Find Resistance/Length (ρ)</h2>
              {renderReadingsTable(reportData.readings.findRho, "Readings for determining resistance per unit length ρ.", 'findRho')}
              <div className="mt-4">
                {renderResults("Result for ρ", finalCalculatedRho, reportData.trueRho * 100, calculationErrorRho, deviationRho, "Ω/m")}
              </div>
            </div>
            
            <div className="pt-8">
                <h2 className="text-xl font-bold mb-2">Result</h2>
                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div>
                      <h3 className="font-semibold mb-2">Specific Resistance of the Material (S)</h3>
                      <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>(iii) Radius of the wire (r)</span>
                            <span className="font-mono">{reportData.wireRadius.toFixed(2)} x10⁻³ m</span>
                          </div>
                          <div className="flex justify-between">
                            <span>(iv) Length of the wire (L)</span>
                            <span className="font-mono">{reportData.wireLength.toFixed(2)} m</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Specific resistance S = (πr²X)/L</span>
                             {specificResistanceS !== null ? (
                                <span className="font-mono">= {specificResistanceS.toExponential(4)} Ωm</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Calculation requires a value for X.</span>
                              )}
                          </div>
                      </div>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-base">
                      <div className="flex justify-between font-bold">
                          <span>(i) The unknown resistance of the given coil of wire (X)</span>
                          {finalCalculatedX !== null ? (
                              <span className="font-mono">= {finalCalculatedX.toFixed(4)} Ω</span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-normal">{calculationErrorX}</span>
                            )}
                      </div>
                       <div className="flex justify-between font-bold">
                          <span>(ii) Specific resistance of the material (S)</span>
                           {specificResistanceS !== null ? (
                              <span className="font-mono">= {specificResistanceS.toExponential(4)} Ωm</span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-normal">Calculation requires a value for X.</span>
                            )}
                      </div>
                  </div>
                </div>
            </div>

             <div className="pt-8 no-print">
                <h2 className="text-xl font-bold mb-2">Viva Voce Questions</h2>
                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                  <ol className="list-decimal list-outside pl-5 space-y-3 text-sm">
                      <li>What is the principle of the Carey Foster's bridge?</li>
                      <li>Why is this bridge so-named?</li>
                      <li>What is the end resistance, and how is it eliminated in this experiment?</li>
                      <li>Why should the balance point be obtained in the middle of the bridge wire?</li>
                      <li>What is specific resistance? What is its unit?</li>
                      <li>Why is the bridge not suitable for measuring very high or very low resistance?</li>
                  </ol>
                </div>
            </div>

          </CardContent>
        </Card>
      </main>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }
          body {
            background-color: white;
          }
          main {
            padding: 0;
          }
          .card {
            border: none;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ReportPage;
