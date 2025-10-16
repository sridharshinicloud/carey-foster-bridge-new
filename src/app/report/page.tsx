'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Reading } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft } from 'lucide-react';

type AllReadings = {
  findX: Reading[];
  findRho: Reading[];
};

type ReportData = {
  readings: AllReadings;
  trueX: number;
  trueRho: number;
};

const ReportPage = () => {
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('reportData');
    if (data) {
      setReportData(JSON.parse(data));
    } else {
      // Redirect if no data
      router.push('/');
    }
  }, [router]);

  const { finalCalculatedX, calculationErrorX, deviationX } = useMemo(() => {
    if (!reportData || !reportData.readings.findX) return { finalCalculatedX: null, calculationErrorX: null, deviationX: null };
    
    const findXReadings = reportData.readings.findX;
    const normalReadings = findXReadings.filter(r => !r.isSwapped);
    const swappedReadings = findXReadings.filter(r => r.isSwapped);

    if (normalReadings.length === 0 || swappedReadings.length === 0) {
      return { finalCalculatedX: null, calculationErrorX: "Requires at least one normal and one swapped reading.", deviationX: null };
    }
    
    if (normalReadings.length !== swappedReadings.length) {
      return { finalCalculatedX: null, calculationErrorX: "The number of normal and swapped readings must be equal.", deviationX: null };
    }

    const calculatedXs = [];
    for (let i = 0; i < normalReadings.length; i++) {
        const normalReading = normalReadings[i];
        const swappedReading = swappedReadings.find(sr => sr.rValue === normalReading.rValue);
        if (!swappedReading) {
            return { finalCalculatedX: null, calculationErrorX: `No matching swapped reading found for R=${normalReading.rValue}.`, deviationX: null };
        }
        const R = normalReading.rValue;
        const l1_normal = normalReading.l1;
        const l1_swapped = swappedReading.l1;
        
        calculatedXs.push(R + reportData.trueRho * (l1_swapped - l1_normal));
    }
    
    if(calculatedXs.length === 0) {
      return { finalCalculatedX: null, calculationErrorX: "Could not calculate X. Ensure R values match between normal and swapped readings.", deviationX: null };
    }

    const averageX = calculatedXs.reduce((acc, val) => acc + val, 0) / calculatedXs.length;
    const deviation = reportData.trueX !== 0 ? ((averageX - reportData.trueX) / reportData.trueX) * 100 : 0;

    return { finalCalculatedX: averageX, calculationErrorX: null, deviationX: deviation };
  }, [reportData]);

  if (!reportData) {
    return <div className="flex items-center justify-center min-h-screen">Loading report...</div>;
  }
  
  const renderReadingsTable = (readings: Reading[], caption: string) => {
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
            <TableHead>Position</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.map((reading, index) => (
            <TableRow key={reading.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{reading.rValue.toFixed(2)}</TableCell>
              <TableCell>{reading.l1.toFixed(2)}</TableCell>
              <TableCell>{reading.l2.toFixed(2)}</TableCell>
              <TableCell>{reading.isSwapped ? 'Swapped' : 'Normal'}</TableCell>
            </TableRow>
          ))}
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
              <span>Calculated Value:</span>
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
              A summary of the data collected and results calculated on {new Date().toLocaleDateString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-2">Experiment: Find Unknown Resistance (X)</h2>
              {renderReadingsTable(reportData.readings.findX, "Readings for determining unknown resistance X.")}
              <div className="mt-4">
                {renderResults("Result for X", finalCalculatedX, reportData.trueX, calculationErrorX, deviationX, "Ω")}
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

    