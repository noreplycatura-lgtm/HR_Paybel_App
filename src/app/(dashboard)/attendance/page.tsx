
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
import { sampleEmployees, sampleLeaveHistory, type EmployeeDetail } from "@/lib/hr-data"; // Still need sampleEmployees for structure if we were to parse
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

  const [uploadMonth, setUploadMonth] = React.useState<string>('');
  const [uploadYear, setUploadYear] = React.useState<number>(0);

  const [isLoading, setIsLoading] = React.useState(true);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const [uploadContext, setUploadContext] = React.useState<{month: string, year: number} | null>(null);


  React.useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthName = months[now.getMonth()];

    setCurrentYear(year);
    setCurrentMonthName(monthName);

    // Set defaults for view tab
    setSelectedYear(year);
    setSelectedMonth(monthName);
    
    // Set defaults for upload tab
    setUploadYear(year);
    setUploadMonth(monthName);

    // No initial data load here
    setIsLoading(false);
  }, []); // Removed dependencies that might trigger re-setting initial data

  React.useEffect(() => {
    if (isLoading || rawAttendanceData.length === 0 || !selectedYear || !selectedMonth) {
      setProcessedAttendanceData([]); // Ensure processed data is also empty if raw is empty
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
    if (!uploadMonth || !uploadYear) {
      toast({
        title: "Selection Missing",
        description: "Please select the month and year for the attendance data before uploading.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: `File Received for ${uploadMonth} ${uploadYear}`,
      description: `${file.name} has been received. Simulating data processing. (Actual Excel parsing and data update from the file are not implemented in this prototype).`,
    });
    setUploadedFileName(file.name);
    const newUploadContext = {month: uploadMonth, year: uploadYear};
    setUploadContext(newUploadContext);
    
    // Clear existing raw and processed data to signify new file context
    setRawAttendanceData([]); 
    setProcessedAttendanceData([]);
     
    // Switch view to the uploaded month/year
    setSelectedMonth(newUploadContext.month);
    setSelectedYear(newUploadContext.year);
    setIsLoading(false); // Ensure loading is false to trigger re-render with new context
  };

  const handleDownloadReport = () => {
    if (processedAttendanceData.length === 0 || !selectedMonth || !selectedYear) {
      toast({
        title: "No Data",
        description: "No attendance data available to download for the selected period. Please upload a file first.",
        variant: "destructive",
      });
      return;
    }

    const daysInCurrentMonth = new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate();
    const csvRows: string[][] = [];

    const headers = [
      "Code", "Name", "Designation", "DOJ",
      ...Array.from({ length: daysInCurrentMonth }, (_, i) => (i + 1).toString()),
      "Working Days (P)", "Absent-1 (A)", "Absent-2 (A+HD)", "Weekoff (W)",
      "Total CL (Used)", "Total PL (Used)", "Total SL (Used)", "Paid Holiday (PH)",
      "Total Days (Month)", "Paid Days"
    ];
    csvRows.push(headers);

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
      
      const totalDaysInMonthForCalc = daysInCurrentMonth - notJoinedDays; 
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
        (totalDaysInMonthForCalc < 0 ? 0 : totalDaysInMonthForCalc).toString(),
        paidDaysCalculated.toFixed(1)
      ];
      csvRows.push(row);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyy-MM-dd'); 
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
    const daysForTemplate = (uploadYear && uploadMonth) ? new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate() : 31;
    const csvRows: string[][] = [];
    const headers = ["Code", "Name", "Designation", "DOJ", ...Array.from({ length: daysForTemplate }, (_, i) => (i + 1).toString())];
    csvRows.push(headers);

    // Sample employee data for template can be sourced from sampleEmployees or kept generic
    const templateEmployees = sampleEmployees.slice(0,2).map(emp => ({
      code: emp.code, name: emp.name, designation: emp.designation, doj: emp.doj
    }));
    
    templateEmployees.forEach((emp, index) => {
      const rowData = [emp.code, emp.name, emp.designation, emp.doj];
      const dailyStatuses = Array(daysForTemplate).fill("P");
      if (index === 0 && daysForTemplate >= 7) { // Example: John Doe
        dailyStatuses[5] = "W"; 
        dailyStatuses[6] = "W";
        if (daysForTemplate >= 11) dailyStatuses[10] = "CL"; 
      } else if (index === 1 && daysForTemplate >= 15) { // Example: Jane Smith
         dailyStatuses[13] = "A"; 
         dailyStatuses[14] = "HD";
      }
      rowData.push(...dailyStatuses);
      csvRows.push(rowData);
    });
    
    if (templateEmployees.length === 0) { // Fallback if sampleEmployees is empty
        const sampleRow1 = ["E001", "John Doe", "Software Engineer", "2023-01-15", ...Array(daysForTemplate).fill("P")];
        if (daysForTemplate >= 7) { sampleRow1[4+3] = "W"; sampleRow1[5+3] = "W"; }
        if (daysForTemplate >= 11) sampleRow1[10+3] = "CL"; 
        csvRows.push(sampleRow1);
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const monthYearForFilename = (uploadMonth && uploadYear) ? `${uploadMonth}_${uploadYear}` : "sample";
    link.setAttribute("download", `attendance_template_${monthYearForFilename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Sample Template Downloaded",
      description: `attendance_template_${monthYearForFilename}.csv has been downloaded.`,
    });
  };
  
  const daysInSelectedViewMonth = selectedYear && selectedMonth ? new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate() : 0;
  const daysInSelectedUploadMonth = uploadYear && uploadMonth ? new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate() : 31;

  const availableYears = currentYear > 0 ? Array.from({ length: 5 }, (_, i) => currentYear - i) : [];

  return (
    <>
      <PageHeader title="Attendance Dashboard" description="Manage and view employee attendance.">
        <Button variant="outline" onClick={handleDownloadReport} disabled={processedAttendanceData.length === 0 && !uploadedFileName}>
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
              <CardDescription>Filter attendance records by month and year. (More filters like employee/division are illustrative).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
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
              {/* Illustrative filters, not fully implemented for data filtering beyond month/year */}
              <Input placeholder="Filter by Employee Name/Code..." className="w-full sm:w-[250px]" disabled />
              <Select disabled>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">Technology</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled>
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
                if (isLoading) {
                    return <div className="text-center py-8 text-muted-foreground">Initializing...</div>;
                }
                if (uploadedFileName && rawAttendanceData.length === 0 && uploadContext) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Displaying context for uploaded file: '{uploadedFileName}' for {uploadContext.month} {uploadContext.year}.<br />
                      (Full Excel parsing and display from file is not yet implemented in this prototype. Attendance data will appear here once processed.)
                    </div>
                  );
                }
                if (!selectedMonth || !selectedYear) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Please select month and year to view records.
                    </div>
                  );
                }
                if (processedAttendanceData.length === 0 && daysInSelectedViewMonth > 0) {
                     // If not loading, and no file was uploaded to explain empty data, prompt to upload.
                    if (!uploadedFileName) {
                        return (
                            <div className="text-center py-8 text-muted-foreground">
                                No attendance data to display for {selectedMonth} {selectedYear}. <br/>
                                Please upload an attendance file in the 'Upload Attendance Data' tab.
                            </div>
                        );
                    }
                    // If a file was "uploaded" but resulted in no processed data (e.g. if it was empty or couldn't be parsed)
                    // This case is currently covered by the uploadedFileName && rawAttendanceData.length === 0 check above
                    return (
                        <div className="text-center py-8 text-muted-foreground">
                            Processing data for {selectedMonth} {selectedYear}... If this persists, the uploaded file might be empty or in an incorrect format.
                        </div>
                    );
                }

                if (processedAttendanceData.length > 0 && daysInSelectedViewMonth > 0 && processedAttendanceData[0]?.processedAttendance) {
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[80px]">Code</TableHead>
                          <TableHead className="min-w-[150px]">Name</TableHead>
                          <TableHead className="min-w-[150px]">Designation</TableHead>
                          <TableHead className="min-w-[100px]">DOJ</TableHead>
                          {Array.from({ length: daysInSelectedViewMonth }, (_, i) => i + 1).map(day => (
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
                          if (!emp.processedAttendance) { 
                            return <TableRow key={emp.id}><TableCell colSpan={daysInSelectedViewMonth + 14}>Processing data for {emp.name}...</TableCell></TableRow>;
                          }
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

                          const totalDaysInMonthForCalc = daysInSelectedViewMonth - notJoinedDays; 
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
                            <TableCell className="text-center font-semibold">{totalDaysInMonthForCalc < 0 ? 0 : totalDaysInMonthForCalc}</TableCell>
                            <TableCell className="text-center font-semibold">{paidDaysCalculated.toFixed(1)}</TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4} className="font-semibold text-right">Total Employees Displayed:</TableCell>
                          <TableCell colSpan={daysInSelectedViewMonth + 10} className="font-semibold">{processedAttendanceData.filter(e => e.processedAttendance && e.processedAttendance.some(s => s!=='-')).length}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  );
                }
                // Default catch-all if other conditions don't meet, or if daysInSelectedViewMonth is 0
                return (
                  <div className="text-center py-8 text-muted-foreground">
                     No attendance data available to display for the current selection. <br/>
                     Please upload a file via the 'Upload Attendance Data' tab.
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
                Select the month and year, then upload an Excel/CSV file with employee attendance.
                <br/>Expected columns: Code, Name, Designation, DOJ, and daily status columns (1 to {daysInSelectedUploadMonth}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={uploadMonth} onValueChange={setUploadMonth}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Upload Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={uploadYear > 0 ? uploadYear.toString() : ""} onValueChange={(value) => setUploadYear(parseInt(value))}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Upload Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <FileUploadButton 
                  onFileUpload={handleFileUpload} 
                  buttonText="Upload Attendance Excel/CSV" 
                  disabled={!uploadMonth || !uploadYear || uploadYear === 0}
                />
                <Button 
                  variant="link" 
                  onClick={handleDownloadSampleTemplate} 
                  className="p-0 h-auto text-left"
                  disabled={!uploadMonth || !uploadYear || uploadYear === 0}
                >
                  <Download className="mr-2 h-4 w-4 flex-shrink-0" /> Download Sample Template (CSV for {uploadMonth && uploadYear > 0 ? `${uploadMonth} ${uploadYear}` : 'selected period'})
                </Button>
              </div>
               {uploadedFileName && uploadContext && (
                <p className="text-sm text-muted-foreground">
                  Last upload attempt: {uploadedFileName} for {uploadContext.month} {uploadContext.year}. (Data display from file is not implemented in this prototype)
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

