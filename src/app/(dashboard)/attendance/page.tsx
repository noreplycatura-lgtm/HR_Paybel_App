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

const sampleAttendanceData = [
  { id: "E001", code: "E001", name: "John Doe", designation: "Software Engineer", doj: "2022-01-15", attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)]) },
  { id: "E002", code: "E002", name: "Jane Smith", designation: "Project Manager", doj: "2021-05-20", attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)]) },
  { id: "E003", code: "E003", name: "Mike Johnson", designation: "UI/UX Designer", doj: "2023-03-01", attendance: Array(31).fill(null).map(() => ["P", "A", "HD", "W", "PH", "CL", "SL", "PL"][Math.floor(Math.random() * 8)]) },
];

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentMonth = months[new Date().getMonth()];

export default function AttendancePage() {
  const { toast } = useToast();
  const [attendanceData, setAttendanceData] = React.useState(sampleAttendanceData);
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);

  const handleFileUpload = (file: File) => {
    // Simulate file processing
    toast({
      title: "File Uploaded",
      description: `${file.name} is being processed.`,
    });
    // Here you would parse the Excel and update attendanceData
  };
  
  const daysInMonth = new Date(new Date().getFullYear(), months.indexOf(selectedMonth) + 1, 0).getDate();


  return (
    <>
      <PageHeader title="Attendance Dashboard" description="Manage and view employee attendance.">
        <FileUploadButton onFileUpload={handleFileUpload} buttonText="Upload Attendance (Excel)" />
        <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Report
        </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter attendance records by month, employee, or division.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <CardTitle>Attendance Records for {selectedMonth}</CardTitle>
          <CardDescription>
            Color codes: P (Present), A (Absent), HD (Half-Day), W (Week Off), PH (Public Holiday), CL/SL/PL (Leaves).
            <br/> Format Info: Excel should contain Code, Name, Designation, DOJ, and daily status columns (1 to {daysInMonth}).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                 <TableHead className="text-center min-w-[60px]">Total P</TableHead>
                 <TableHead className="text-center min-w-[60px]">Total A</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceData.map((emp) => {
                const totalP = emp.attendance.slice(0, daysInMonth).filter(s => s === 'P').length;
                const totalA = emp.attendance.slice(0, daysInMonth).filter(s => s === 'A').length;
                return (
                <TableRow key={emp.id}>
                  <TableCell>{emp.code}</TableCell>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell>{emp.designation}</TableCell>
                  <TableCell>{emp.doj}</TableCell>
                  {emp.attendance.slice(0, daysInMonth).map((status, index) => (
                    <TableCell key={index} className="text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ATTENDANCE_STATUS_COLORS[status] || 'bg-gray-200 text-gray-800'}`}>
                        {status}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold">{totalP}</TableCell>
                  <TableCell className="text-center font-semibold">{totalA}</TableCell>
                </TableRow>
              )})}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold text-right">Total Employees:</TableCell>
                <TableCell colSpan={daysInMonth + 2} className="font-semibold">{attendanceData.length}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
