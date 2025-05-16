
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { ATTENDANCE_STATUS_COLORS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter } from "lucide-react";
import { sampleEmployees, sampleLeaveHistory, type EmployeeDetail } from "@/lib/hr-data";
import { getLeaveBalancesAtStartOfMonth, PL_ELIGIBILITY_MONTHS, calculateMonthsOfService } from "@/lib/hr-calculations";
import { startOfDay, parseISO, isBefore, isEqual } from "date-fns"; // Added isBefore and isEqual

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

  React.useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthName = months[now.getMonth()];

    setCurrentYear(year);
    setCurrentMonthName(monthName);
    setSelectedYear(year);
    setSelectedMonth(monthName);

    // Generate sample attendance patterns for the shared employees
    const initialAttendanceData = sampleEmployees.map(emp => ({
      ...emp,
      attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)])
    }));
    setRawAttendanceData(initialAttendanceData);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    if (isLoading || rawAttendanceData.length === 0 || !selectedYear || !selectedMonth) {
      setProcessedAttendanceData([]); // Clear processed data if inputs are not ready
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
      title: "File Uploaded",
      description: `${file.name} is being processed. (Functionality not fully implemented)`,
    });
  };

  const handleDownloadReport = () => {
    toast({
      title: "Feature Not Implemented",
      description: "Excel report download is not yet available.",
      variant: "default",
    });
  };
  
  const daysInMonth = selectedYear && selectedMonth ? new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate() : 0;
  const availableYears = currentYear > 0 ? Array.from({ length: 5 }, (_, i) => currentYear - i) : [];


  return (
    <>
      <PageHeader title="Attendance Dashboard" description="Manage and view employee attendance.">
        <FileUploadButton onFileUpload={handleFileUpload} buttonText="Upload Attendance (Excel)" />
        <Button variant="outline" onClick={handleDownloadReport}>
            <Download className="mr-2 h-4 w-4" />
            Download Report
        </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter attendance records by month, year, employee, or division.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
          {isLoading || !selectedMonth ? (
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
          {isLoading || selectedYear === 0 || availableYears.length === 0 ? (
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
            <br/> Format Info: Excel should contain Code, Name, Designation, DOJ, and daily status columns (1 to {daysInMonth > 0 ? daysInMonth : 'current month'}).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
         {isLoading || processedAttendanceData.length === 0 || daysInMonth === 0 || !processedAttendanceData[0]?.processedAttendance ? (
            <div className="text-center py-8 text-muted-foreground">Loading attendance data or select month/year...</div>
          ) : (
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
                if (!emp.processedAttendance) { 
                  return <TableRow key={emp.id}><TableCell colSpan={daysInMonth + 14}>Processing data for {emp.name}...</TableCell></TableRow>;
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
          )}
        </CardContent>
      </Card>
    </>
  );
}

