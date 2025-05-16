
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { ATTENDANCE_STATUS_COLORS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter } from "lucide-react";
import { sampleEmployees, sampleLeaveHistory, type EmployeeDetail } from "@/lib/hr-data";
import { getLeaveBalancesAtStartOfMonth, PL_ELIGIBILITY_MONTHS, calculateMonthsOfService } from "@/lib/hr-calculations";
import { startOfDay, parseISO, isBefore, isEqual, format } from "date-fns";

interface EmployeeAttendanceData extends EmployeeDetail {
  attendance: string[]; // Raw attendance from upload/generation
  processedAttendance?: string[]; // Attendance after applying balance rules
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function AttendancePage() {
  const { toast } = useToast();
  const [rawAttendanceData, setRawAttendanceData] = React.useState<EmployeeAttendanceData[]>([]);
  const [processedAttendanceData, setProcessedAttendanceData] = React.useState<EmployeeAttendanceData[]>([]);
  const [currentMonthName, setCurrentMonthName] = React.useState('');
  const [currentYear, setCurrentYear] = React.useState(0);
  const [selectedMonth, setSelectedMonth] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthName = months[now.getMonth()];

    setCurrentYear(year);
    setCurrentMonthName(monthName);
    setSelectedYear(year);
    setSelectedMonth(monthName);

    if (uploadedFileName) {
      setIsLoading(false);
      return;
    }

    const initialAttendanceData = sampleEmployees.map(emp => ({
      ...emp,
      attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)])
    }));
    setRawAttendanceData(initialAttendanceData);
    setIsLoading(false);
  }, [uploadedFileName]);

  React.useEffect(() => {
    if (isLoading || rawAttendanceData.length === 0 || !selectedYear || !selectedMonth) {
      setProcessedAttendanceData([]);
      return;
    }

    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) return;

    const processedData = rawAttendanceData.map(emp => {
      const employeeStartDate = emp.doj ? parseISO(emp.doj) : new Date();
      const startOfSelectedMonth = startOfDay(new Date(selectedYear, monthIndex, 1));
      
      if (isBefore(startOfSelectedMonth, startOfDay(employeeStartDate)) && !isEqual(startOfSelectedMonth, startOfDay(employeeStartDate))) {
         return { ...emp, processedAttendance: Array(new Date(selectedYear, monthIndex + 1, 0).getDate()).fill('-') };
      }

      let balances = getLeaveBalancesAtStartOfMonth(emp, selectedYear, monthIndex, sampleLeaveHistory);
      
      const monthsOfServiceThisMonthStart = calculateMonthsOfService(emp.doj, new Date(selectedYear, monthIndex, 1));
      const isPLEligibleForThisMonth = monthsOfServiceThisMonthStart >= PL_ELIGIBILITY_MONTHS;

      const daysInCurrentMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
      const rawMonthlyAttendance = emp.attendance.slice(0, daysInCurrentMonth);

      const newProcessedAttendance = rawMonthlyAttendance.map(originalStatus => {
        let currentDayStatus = originalStatus;
        
        if (originalStatus === "CL") {
          if (balances.cl >= 1) {
            balances.cl -= 1;
          } else {
            currentDayStatus = "A";
          }
        } else if (originalStatus === "SL") {
          if (balances.sl >= 1) {
            balances.sl -= 1;
          } else {
            currentDayStatus = "A";
          }
        } else if (originalStatus === "PL") {
          if (isPLEligibleForThisMonth && balances.pl >= 1) {
            balances.pl -= 1;
          } else {
            currentDayStatus = "A"; 
          }
        }
        return currentDayStatus;
      });
      return { ...emp, processedAttendance: newProcessedAttendance };
    });
    setProcessedAttendanceData(processedData);
  }, [selectedMonth, selectedYear, rawAttendanceData, isLoading]);


  const handleFileUpload = (file: File) => {
    toast({
      title: "File Received for Upload",
      description: `${file.name} has been received. Simulating data processing. (Actual Excel parsing and data update from the file are not implemented in this prototype).`,
    });
    setUploadedFileName(file.name);
    // Clear existing raw data to simulate it's being replaced by upload
    setRawAttendanceData([]); 
    // Could potentially trigger a re-process here if actual parsing was implemented
    // For now, the useEffect for processedAttendanceData will handle the empty rawData
  };

  const handleDownloadReport = () => {
    if (processedAttendanceData.length === 0 || !selectedMonth || !selectedYear) {
      toast({
        title: "No Data",
        description: "No attendance data available to download for the selected period.",
        variant: "destructive",
      });
      return;
    }

    const daysInCurrentMonth = new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate();
    const csvRows: string[][] = [];

    // Headers
    const headers = [
      "Code", "Name", "Designation", "DOJ",
      ...Array.from({ length: daysInCurrentMonth }, (_, i) => (i + 1).toString()),
      "Working Days (P)", "Absent-1 (A)", "Absent-2 (A+HD)", "Weekoff (W)",
      "Total CL (Used)", "Total PL (Used)", "Total SL (Used)", "Paid Holiday (PH)",
      "Total Days (Month)", "Paid Days"
    ];
    csvRows.push(headers);

    // Data rows
    processedAttendanceData.forEach(emp => {
      if (!emp.processedAttendance) return;
      const finalAttendanceToUse = emp.processedAttendance;

      const workingDaysP = finalAttendanceToUse.filter(s => s === 'P').length;
      const absent1A = finalAttendanceToUse.filter(s => s === 'A').length;
      const halfDays = finalAttendanceToUse.filter(s => s === 'HD').length;
      const absent2AHd = absent1A + (halfDays * 0.5);
      const weekOffsW = finalAttendanceToUse.filter(s => s === 'W').length;
      const totalCLUsed = finalAttendanceToUse.filter(s => s === 'CL').length;
      const totalPLUsed = finalAttendanceToUse.filter(s => s === 'PL').length;
      const totalSLUsed = finalAttendanceToUse.filter(s => s === 'SL').length;
      const paidHolidaysPH = finalAttendanceToUse.filter(s => s === 'PH').length;
      const notJoinedDays = finalAttendanceToUse.filter(s => s === '-').length;
      
      const totalDaysCalculated = daysInCurrentMonth - notJoinedDays; // Show days in month excluding not-joined days
      const paidDaysCalculated = workingDaysP + weekOffsW + totalCLUsed + totalSLUsed + totalPLUsed + paidHolidaysPH + (halfDays * 0.5);

      const row = [
        emp.code,
        emp.name,
        emp.designation,
        emp.doj,
        ...finalAttendanceToUse,
        workingDaysP.toString(),
        absent1A.toString(),
        absent2AHd.toFixed(1),
        weekOffsW.toString(),
        totalCLUsed.toString(),
        totalPLUsed.toString(),
        totalSLUsed.toString(),
        paidHolidaysPH.toString(),
        (totalDaysCalculated < 0 ? 0 : totalDaysCalculated).toString(),
        paidDaysCalculated.toFixed(1)
      ];
      csvRows.push(row);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyy-MM'); // Keep simple date for file name consistency
    link.setAttribute("download", `attendance_report_${selectedMonth}_${selectedYear}_${formattedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: `Attendance report for ${selectedMonth} ${selectedYear} is being downloaded.`,
    });
  };

  const handleDownloadSampleTemplate = () => {
    const csvRows: string[][] = [];
    const headers = ["Code", "Name", "Designation", "DOJ", ...Array.from({ length: 31 }, (_, i) => (i + 1).toString())];
    csvRows.push(headers);

    // Add a couple of sample data rows
    const sampleRow1 = ["E001", "John Doe", "Software Engineer", "2023-01-15", ...Array(31).fill("P")];
    sampleRow1[5] = "W"; // Example Weekoff
    sampleRow1[6] = "W";
    sampleRow1[10] = "CL"; // Example CL
    csvRows.push(sampleRow1);

    const sampleRow2 = ["E002", "Jane Smith", "Project Manager", "2024-03-20", ...Array(31).fill("P")];
    sampleRow2[13] = "A"; // Example Absent
    sampleRow2[14] = "HD"; // Example Half-Day
    csvRows.push(sampleRow2);
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "attendance_template_sample.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Sample Template Downloaded",
      description: "attendance_template_sample.csv has been downloaded.",
    });
  };
  
  const daysInMonth = selectedYear && selectedMonth ? new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate() : 0;
  const availableYears = currentYear > 0 ? Array.from({ length: 5 }, (_, i) => currentYear - i) : [];

  return (
    <>
      <PageHeader title="Attendance Dashboard" description="Manage and view employee attendance.">
        <Button variant="outline" onClick={handleDownloadReport}>
            <Download className="mr-2 h-4 w-4" />
            Download Report (CSV)
        </Button>
      </PageHeader>

      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[450px]">
          <TabsTrigger value="view">View & Filter Attendance</TabsTrigger>
          <TabsTrigger value="upload">Upload Attendance Data</TabsTrigger>
        </TabsList>
        <TabsContent value="view">
          <Card className="my-6 shadow-md">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter attendance records by month, year, employee, or division.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
              {/* Month Selector */}
              {isLoading && !selectedMonth ? (
                <div className="w-full sm:w-[180px] h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {/* Year Selector */}
              {isLoading && selectedYear === 0 ? (
                 <div className="w-full sm:w-[120px] h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Input placeholder="Filter by Employee Name/Code..." className="w-full sm:w-[250px]" />
              <Select>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">Technology</SelectItem>
                  <SelectItem value="hr">Human Resources</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
              <Button>
                <Filter className="mr-2 h-4 w-4" /> Apply Filters
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Attendance Records for {selectedMonth} {selectedYear > 0 ? selectedYear : ''}</CardTitle>
              <CardDescription>
                Color codes: P (Present), A (Absent), HD (Half-Day), W (Week Off), PH (Public Holiday), CL/SL/PL (Leaves).
                <br/> If CL/SL/PL is taken without sufficient balance, it is marked as 'A' (Absent).
                <br/> '-' indicates the employee had not joined by the selected month/day.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
            {(() => {
                if (uploadedFileName && rawAttendanceData.length === 0 && !isLoading) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Attempting to process attendance from '{uploadedFileName}'.<br />
                      (Full Excel parsing and display from file is not yet implemented in this prototype.)
                    </div>
                  );
                }
                if (isLoading || !selectedMonth || !selectedYear) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading initial data or select month/year to view records...
                    </div>
                  );
                }
                // This condition means raw data is present but processing hasn't finished or resulted in no processable employees
                if ((rawAttendanceData.length > 0 && processedAttendanceData.length === 0 && daysInMonth > 0) || (rawAttendanceData.length === 0 && !uploadedFileName)) {
                    // Special check for uploaded file with no raw data yet
                    return <div className="text-center py-8 text-muted-foreground">Processing attendance data...</div>;
                }
                // This condition checks if there's processed data and at least one employee has their processed attendance array.
                if (processedAttendanceData.length > 0 && daysInMonth > 0 && processedAttendanceData[0]?.processedAttendance) {
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[80px]">Code</TableHead>
                          <TableHead className="min-w-[150px]">Name</TableHead>
                          <TableHead className="min-w-[150px]">Designation</TableHead>
                          <TableHead className="min-w-[100px]">DOJ</TableHead>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                            <TableHead key={day} className="text-center min-w-[50px]">{day}</TableHead>
                          ))}
                          <TableHead className="text-center min-w-[100px]">Working Days (P)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Absent-1 (A)</TableHead>
                          <TableHead className="text-center min-w-[110px]">Absent-2 (A+HD)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Weekoff (W)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Total CL (Used)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Total PL (Used)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Total SL (Used)</TableHead>
                          <TableHead className="text-center min-w-[110px]">Paid Holiday (PH)</TableHead>
                          <TableHead className="text-center min-w-[130px]">Total Days (Month)</TableHead>
                          <TableHead className="text-center min-w-[120px]">Paid Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedAttendanceData.map((emp) => {
                          // If processedAttendance is undefined, it means it's still being worked on or failed for this emp
                          if (!emp.processedAttendance) { 
                            return <TableRow key={emp.id}><TableCell colSpan={daysInMonth + 14}>Processing data for {emp.name}...</TableCell></TableRow>;
                          }
                          const finalAttendanceToUse = emp.processedAttendance; // Already processed

                          const workingDaysP = finalAttendanceToUse.filter(s => s === 'P').length;
                          const absent1A = finalAttendanceToUse.filter(s => s === 'A').length;
                          const halfDays = finalAttendanceToUse.filter(s => s === 'HD').length;
                          const absent2AHd = absent1A + (halfDays * 0.5); 
                          const weekOffsW = finalAttendanceToUse.filter(s => s === 'W').length;
                          const totalCLUsed = finalAttendanceToUse.filter(s => s === 'CL').length;
                          const totalPLUsed = finalAttendanceToUse.filter(s => s === 'PL').length;
                          const totalSLUsed = finalAttendanceToUse.filter(s => s === 'SL').length;
                          const paidHolidaysPH = finalAttendanceToUse.filter(s => s === 'PH').length;
                          const notJoinedDays = finalAttendanceToUse.filter(s => s === '-').length;

                          const totalDaysCalculated = daysInMonth - notJoinedDays; 
                          const paidDaysCalculated = workingDaysP + weekOffsW + totalCLUsed + totalSLUsed + totalPLUsed + paidHolidaysPH + (halfDays * 0.5);
                          
                          return (
                          <TableRow key={emp.id}>
                            <TableCell>{emp.code}</TableCell>
                            <TableCell>{emp.name}</TableCell>
                            <TableCell>{emp.designation}</TableCell>
                            <TableCell>{emp.doj}</TableCell>
                            {finalAttendanceToUse.map((status, index) => (
                              <TableCell key={index} className="text-center">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ATTENDANCE_STATUS_COLORS[status] || 'bg-gray-200 text-gray-800'}`}>
                                  {status}
                                </span>
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-semibold">{workingDaysP}</TableCell>
                            <TableCell className="text-center font-semibold">{absent1A}</TableCell>
                            <TableCell className="text-center font-semibold">{absent2AHd.toFixed(1)}</TableCell>
                            <TableCell className="text-center font-semibold">{weekOffsW}</TableCell>
                            <TableCell className="text-center font-semibold">{totalCLUsed}</TableCell>
                            <TableCell className="text-center font-semibold">{totalPLUsed}</TableCell>
                            <TableCell className="text-center font-semibold">{totalSLUsed}</TableCell>
                            <TableCell className="text-center font-semibold">{paidHolidaysPH}</TableCell>
                            <TableCell className="text-center font-semibold">{totalDaysCalculated < 0 ? 0 : totalDaysCalculated}</TableCell>
                            <TableCell className="text-center font-semibold">{paidDaysCalculated.toFixed(1)}</TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4} className="font-semibold text-right">Total Employees:</TableCell>
                          <TableCell colSpan={daysInMonth + 10} className="font-semibold">{processedAttendanceData.filter(e => e.processedAttendance && e.processedAttendance.some(s => s!=='-')).length}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  );
                }
                // Fallback if no processed data for the month, or no days in month (e.g. year not set)
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    No attendance data available for the selected month and year.
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upload">
          <Card className="my-6 shadow-md">
            <CardHeader>
              <CardTitle>Upload Attendance Data</CardTitle>
              <CardDescription>
                Upload an Excel file with employee attendance.
                <br/>Expected columns: Code, Name, Designation, DOJ, and daily status columns (e.g., 1 to {daysInMonth > 0 ? daysInMonth : '31'}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <FileUploadButton onFileUpload={handleFileUpload} buttonText="Upload Attendance Excel" />
                <Button variant="link" onClick={handleDownloadSampleTemplate} className="p-0 h-auto">
                  <Download className="mr-2 h-4 w-4" /> Download Sample Template (CSV)
                </Button>
              </div>
               {uploadedFileName && (
                <p className="text-sm text-muted-foreground">
                  Last uploaded: {uploadedFileName}. (Data processing is simulated in prototype)
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

    

    

      