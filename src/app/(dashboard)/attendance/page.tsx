
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

interface EmployeeAttendance {
  id: string;
  code: string;
  name: string;
  designation: string;
  doj: string;
  attendance: string[];
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function AttendancePage() {
  const { toast } = useToast();
  const [attendanceData, setAttendanceData] = React.useState<EmployeeAttendance[]>([]);
  const [currentMonthName, setCurrentMonthName] = React.useState('');
  const [currentYear, setCurrentYear] = React.useState(0);
  const [selectedMonth, setSelectedMonth] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);


  React.useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthName = months[now.getMonth()];

    setCurrentYear(year);
    setCurrentMonthName(monthName);
    setSelectedYear(year);
    setSelectedMonth(monthName);

    // Generate sample data on client mount to avoid hydration issues
    const generateSampleData = (): EmployeeAttendance[] => [
      { id: "E001", code: "E001", name: "John Doe", designation: "Software Engineer", doj: "2022-01-15", attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)]) },
      { id: "E002", code: "E002", name: "Jane Smith", designation: "Project Manager", doj: "2021-05-20", attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)]) },
      { id: "E003", code: "E003", name: "Mike Johnson", designation: "UI/UX Designer", doj: "2023-03-01", attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)]) },
    ];
    setAttendanceData(generateSampleData());
  }, []);


  const handleFileUpload = (file: File) => {
    toast({
      title: "File Uploaded",
      description: `${file.name} is being processed.`,
    });
  };

  const handleDownloadReport = () => {
    toast({
      title: "Feature Not Implemented",
      description: "Excel report download is not yet available.",
      variant: "default",
    });
  };
  
  const daysInMonth = selectedYear && selectedMonth ? new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate() : 31;
  const availableYears = currentYear > 0 ? [currentYear, currentYear - 1, currentYear - 2, currentYear -3, currentYear -4] : [];


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
          {selectedMonth && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {selectedYear > 0 && availableYears.length > 0 && (
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
            <br/> Format Info: Excel should contain Code, Name, Designation, DOJ, and daily status columns (1 to {daysInMonth}).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
         {attendanceData.length === 0 ? (
            <div className="text-center py-8">Loading attendance data...</div>
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
                 <TableHead className="text-center min-w-[130px]">Total Days</TableHead>
                 <TableHead className="text-center min-w-[120px]">Paid Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceData.map((emp) => {
                const relevantAttendance = emp.attendance.slice(0, daysInMonth);
                const workingDaysP = relevantAttendance.filter(s => s === 'P').length;
                const absent1A = relevantAttendance.filter(s => s === 'A').length;
                const halfDays = relevantAttendance.filter(s => s === 'HD').length;
                const absent2AHd = absent1A + (halfDays / 2);
                const weekOffsW = relevantAttendance.filter(s => s === 'W').length;
                const totalCLUsed = relevantAttendance.filter(s => s === 'CL').length;
                const totalPLUsed = relevantAttendance.filter(s => s === 'PL').length;
                const totalSLUsed = relevantAttendance.filter(s => s === 'SL').length;
                const paidHolidaysPH = relevantAttendance.filter(s => s === 'PH').length;

                const totalDaysCalculated = workingDaysP + weekOffsW + absent2AHd + totalCLUsed + totalSLUsed + totalPLUsed + paidHolidaysPH;
                const paidDaysCalculated = workingDaysP + weekOffsW + totalCLUsed + totalSLUsed + totalPLUsed + paidHolidaysPH;
                
                return (
                <TableRow key={emp.id}>
                  <TableCell>{emp.code}</TableCell>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell>{emp.designation}</TableCell>
                  <TableCell>{emp.doj}</TableCell>
                  {relevantAttendance.map((status, index) => (
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
                  <TableCell className="text-center font-semibold">{totalDaysCalculated.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{paidDaysCalculated}</TableCell>
                </TableRow>
              )})}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold text-right">Total Employees:</TableCell>
                <TableCell colSpan={daysInMonth + 10} className="font-semibold">{attendanceData.length}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

