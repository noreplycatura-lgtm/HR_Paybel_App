
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Search } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateMonthlySalaryComponents, type MonthlySalaryComponents } from "@/lib/salary-calculations";
import { format, parseISO, isValid, getDaysInMonth } from "date-fns";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface SalarySheetEntry extends EmployeeDetail {
  totalDaysInMonth: number;
  daysPaid: number;
  weekOffs: number;
  daysAbsent: number; // Will now reflect 'A' + 0.5 * 'HD'
  monthlyBasic: number;
  monthlyHRA: number;
  monthlyCA: number;
  monthlyOtherAllowance: number;
  monthlyMedical: number;
  // Monthly Gross is already in EmployeeDetail as grossMonthlySalary
  actualBasic: number;
  actualHRA: number;
  actualCA: number;
  actualOtherAllowance: number;
  actualMedical: number;
  arrears: number; // Placeholder
  totalAllowance: number;
  esic: number; // Placeholder
  professionalTax: number; // Placeholder
  providentFund: number; // Placeholder
  tds: number; // Placeholder
  loan: number; // Placeholder
  salaryAdvance: number; // Placeholder
  otherDeduction: number; // Placeholder
  totalDeduction: number;
  netPaid: number;
  employeeStatus: "Active" | "Left"; // To help with CSV generation
}

interface MonthlyEmployeeAttendance {
  code: string;
  attendance: string[];
}

const getDynamicAttendanceStorageKeys = (month: string, year: number) => {
  if (!month || year === 0) return { rawDataKey: null };
  return {
    rawDataKey: `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${month}_${year}`,
  };
};


export default function SalarySheetPage() {
  const { toast } = useToast();
  const [allEmployees, setAllEmployees] = React.useState<EmployeeDetail[]>([]);
  const [salarySheetData, setSalarySheetData] = React.useState<SalarySheetEntry[]>([]);
  const [filteredSalarySheetData, setFilteredSalarySheetData] = React.useState<SalarySheetEntry[]>([]);
  
  const [currentYearState, setCurrentYearState] = React.useState(0);
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
  const [isLoadingCalculations, setIsLoadingCalculations] = React.useState(false);

  React.useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    setCurrentYearState(currentYear);
    setSelectedMonth(months[now.getMonth()]);
    setSelectedYear(currentYear);
  }, []);

  React.useEffect(() => {
    setIsLoadingEmployees(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployeesStr) {
          const parsedEmployees = JSON.parse(storedEmployeesStr) as EmployeeDetail[];
          setAllEmployees(Array.isArray(parsedEmployees) ? parsedEmployees : []);
        } else {
          setAllEmployees([]);
          toast({ title: "No Employee Data", description: "Employee master data not found. Please set up employees first.", variant: "destructive", duration: 7000 });
        }
      } catch (error) {
        setAllEmployees([]);
        toast({ title: "Data Load Error", description: "Could not load employee master data. It might be corrupted.", variant: "destructive", duration: 7000 });
        console.error("Error loading employee master from localStorage:", error);
      }
    }
    setIsLoadingEmployees(false);
  }, [toast]);

  React.useEffect(() => {
    if (isLoadingEmployees || !selectedMonth || !selectedYear || selectedYear === 0) {
      setSalarySheetData([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoadingCalculations(true);
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) {
      setSalarySheetData([]);
      setIsLoadingCalculations(false);
      setIsLoading(false);
      return;
    }

    const targetDateForMonth = new Date(selectedYear, monthIndex, 1);
    const totalDaysInMonth = getDaysInMonth(targetDateForMonth);
    let attendanceForMonth: MonthlyEmployeeAttendance[] = [];

    if (typeof window !== 'undefined') {
        const { rawDataKey } = getDynamicAttendanceStorageKeys(selectedMonth, selectedYear);
        if (rawDataKey) {
            const storedAttendance = localStorage.getItem(rawDataKey);
            if (storedAttendance) {
                try {
                    attendanceForMonth = JSON.parse(storedAttendance);
                } catch (e) {
                    console.warn(`Could not parse attendance for ${selectedMonth} ${selectedYear}: ${e}`);
                    toast({ title: "Attendance Data Issue", description: `Could not load attendance for ${selectedMonth} ${selectedYear}. Salary sheet calculations might be incomplete.`, variant: "destructive", duration: 7000 });
                }
            } else {
                 toast({ title: "No Attendance Data", description: `Attendance data for ${selectedMonth} ${selectedYear} not found. Salary sheet calculations will be affected. Please upload attendance.`, variant: "destructive", duration: 7000 });
            }
        }
    }

    const newSalarySheetData = allEmployees.map(emp => {
      const empAttendance = attendanceForMonth.find(att => att.code === emp.code)?.attendance || Array(totalDaysInMonth).fill('A'); // Default to all Absent if no data
      
      let daysPaid = 0;
      let weekOffs = 0;
      let fullAbsentDays = 0; // For 'A'
      let halfDaysTaken = 0;   // For 'HD'

      empAttendance.slice(0, totalDaysInMonth).forEach(status => {
        if (status === 'P' || status === 'CL' || status === 'SL' || status === 'PL' || status === 'PH') {
          daysPaid++;
        } else if (status === 'HD') {
          daysPaid += 0.5;
          halfDaysTaken++; 
        } else if (status === 'W') {
          weekOffs++;
          daysPaid++; 
        } else if (status === 'A') {
          fullAbsentDays++;
        }
      });
      
      daysPaid = Math.min(daysPaid, totalDaysInMonth);
      const daysAbsentDisplay = fullAbsentDays + (halfDaysTaken * 0.5);


      const monthlyComponents = calculateMonthlySalaryComponents(emp.grossMonthlySalary);
      const payFactor = totalDaysInMonth > 0 ? daysPaid / totalDaysInMonth : 0;

      const actualBasic = monthlyComponents.basic * payFactor;
      const actualHRA = monthlyComponents.hra * payFactor;
      const actualCA = monthlyComponents.ca * payFactor;
      const actualMedical = monthlyComponents.medical * payFactor;
      const actualOtherAllowance = monthlyComponents.otherAllowance * payFactor;
      
      const arrears = 0; 
      const totalAllowance = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;

      const esic = 0; 
      const professionalTax = 0; 
      const providentFund = 0; 
      const tds = 0; 
      const loan = 0; 
      const salaryAdvance = 0; 
      const otherDeduction = 0; 
      const totalDeduction = esic + professionalTax + providentFund + tds + loan + salaryAdvance + otherDeduction;
      
      const netPaid = totalAllowance - totalDeduction;

      return {
        ...emp,
        totalDaysInMonth,
        daysPaid,
        weekOffs,
        daysAbsent: daysAbsentDisplay,
        monthlyBasic: monthlyComponents.basic,
        monthlyHRA: monthlyComponents.hra,
        monthlyCA: monthlyComponents.ca,
        monthlyOtherAllowance: monthlyComponents.otherAllowance,
        monthlyMedical: monthlyComponents.medical,
        actualBasic,
        actualHRA,
        actualCA,
        actualOtherAllowance,
        actualMedical,
        arrears,
        totalAllowance,
        esic,
        professionalTax,
        providentFund,
        tds,
        loan,
        salaryAdvance,
        otherDeduction,
        totalDeduction,
        netPaid,
        employeeStatus: emp.status,
      };
    });

    setSalarySheetData(newSalarySheetData);
    setIsLoadingCalculations(false);
    setIsLoading(false);
  }, [allEmployees, selectedMonth, selectedYear, isLoadingEmployees, toast]);


  React.useEffect(() => {
    if (!searchTerm) {
      setFilteredSalarySheetData(salarySheetData.filter(emp => emp.employeeStatus === "Active"));
    } else {
      const lowerSearchTerm = searchTerm.toLowerCase();
      setFilteredSalarySheetData(
        salarySheetData.filter(emp =>
          emp.employeeStatus === "Active" &&
          (emp.name.toLowerCase().includes(lowerSearchTerm) || emp.code.toLowerCase().includes(lowerSearchTerm))
        )
      );
    }
  }, [salarySheetData, searchTerm]);


  const handleDownloadSheet = () => {
    if (salarySheetData.length === 0) {
      toast({ title: "No Data", description: "No salary data to download.", variant: "destructive" });
      return;
    }

    const headers = [
      "Employee Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ",
      "Total Days", "Day Paid", "Week Off", "Day Absent",
      "Monthly Basic", "Monthly HRA", "Monthly CA", "Monthly Other Allowance", "Monthly Medical",
      "Monthly Gross",
      "Actual Basic", "Actual HRA", "Actual CA", "Actual Other Allowance", "Actual Medical",
      "Arrears", "Total Allowance",
      "ESIC", "Professional Tax", "PROVFUND", "TDS", "Loan", "Salary Advance", "Other Deduction",
      "Total Deduction", "Net Paid"
    ];

    const csvRows = [headers.join(',')];

    salarySheetData.forEach(emp => { 
      const dojFormatted = emp.doj && isValid(parseISO(emp.doj)) ? format(parseISO(emp.doj), 'dd-MM-yyyy') : emp.doj || 'N/A';
      const row = [
        emp.employeeStatus, emp.division, emp.code, emp.name, emp.designation, emp.hq, dojFormatted,
        emp.totalDaysInMonth.toString(), emp.daysPaid.toFixed(1), emp.weekOffs.toString(), emp.daysAbsent.toFixed(1),
        emp.monthlyBasic.toFixed(2), emp.monthlyHRA.toFixed(2), emp.monthlyCA.toFixed(2), emp.monthlyOtherAllowance.toFixed(2), emp.monthlyMedical.toFixed(2),
        emp.grossMonthlySalary.toFixed(2),
        emp.actualBasic.toFixed(2), emp.actualHRA.toFixed(2), emp.actualCA.toFixed(2), emp.actualOtherAllowance.toFixed(2), emp.actualMedical.toFixed(2),
        emp.arrears.toFixed(2), emp.totalAllowance.toFixed(2),
        emp.esic.toFixed(2), emp.professionalTax.toFixed(2), emp.providentFund.toFixed(2), emp.tds.toFixed(2), emp.loan.toFixed(2), emp.salaryAdvance.toFixed(2), emp.otherDeduction.toFixed(2),
        emp.totalDeduction.toFixed(2), emp.netPaid.toFixed(2),
      ].join(',');
      csvRows.push(row);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyyMMdd');
    link.setAttribute("download", `salary_sheet_${selectedMonth}_${selectedYear}_${formattedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Download Started", description: "Salary sheet CSV is being downloaded." });
  };
  
  const availableYears = currentYearState > 0 ? Array.from({ length: 5 }, (_, i) => currentYearState - i) : [];

  if (isLoading || isLoadingEmployees) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Salary Sheet" description="Generate and download month-wise salary sheets.">
        <Button onClick={handleDownloadSheet} disabled={salarySheetData.length === 0 || isLoadingCalculations}>
          {isLoadingCalculations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download Sheet (CSV)
        </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-auto sm:flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by Name/Code..."
              className="w-full sm:w-[250px] pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Salary Details for {selectedMonth} {selectedYear > 0 ? selectedYear : ''}</CardTitle>
          <CardDescription>Displaying active employees. Download includes all employees (Active & Left). Ensure attendance for the selected month is uploaded for accurate 'Day Paid' calculations.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoadingCalculations ? (
             <div className="text-center py-8 text-muted-foreground flex items-center justify-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating salaries...
            </div>
          ) : filteredSalarySheetData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Division</TableHead>
                  <TableHead className="min-w-[80px]">Code</TableHead>
                  <TableHead className="min-w-[150px]">Name</TableHead>
                  <TableHead className="min-w-[150px]">Designation</TableHead>
                  <TableHead className="min-w-[100px]">HQ</TableHead>
                  <TableHead className="min-w-[100px]">DOJ</TableHead>
                  <TableHead className="text-center min-w-[80px]">Total Days</TableHead>
                  <TableHead className="text-center min-w-[80px]">Day Paid</TableHead>
                  <TableHead className="text-center min-w-[80px]">Week Off</TableHead>
                  <TableHead className="text-center min-w-[80px]">Absent</TableHead>
                  <TableHead className="text-right min-w-[100px]">Gross (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Total Earning (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Total Deduction (₹)</TableHead>
                  <TableHead className="text-right min-w-[110px] font-semibold">Net Paid (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalarySheetData.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>{emp.division || "N/A"}</TableCell>
                    <TableCell>{emp.code}</TableCell>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.designation}</TableCell>
                    <TableCell>{emp.hq || "N/A"}</TableCell>
                    <TableCell>{emp.doj && isValid(parseISO(emp.doj)) ? format(parseISO(emp.doj), 'dd MMM yyyy') : emp.doj || "N/A"}</TableCell>
                    <TableCell className="text-center">{emp.totalDaysInMonth}</TableCell>
                    <TableCell className="text-center">{emp.daysPaid.toFixed(1)}</TableCell>
                    <TableCell className="text-center">{emp.weekOffs}</TableCell>
                    <TableCell className="text-center">{emp.daysAbsent.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{emp.grossMonthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.totalAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-semibold">{emp.netPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
               <TableFooter>
                <TableRow>
                    <TableCell colSpan={10} className="text-right font-semibold">
                        {searchTerm ? `Filtered Active Employees Total:` : `Total Active Employees Displayed:`}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                       {filteredSalarySheetData.reduce((acc, curr) => acc + curr.grossMonthlySalary, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                       {filteredSalarySheetData.reduce((acc, curr) => acc + curr.totalAllowance, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                     <TableCell className="text-right font-bold">
                       {filteredSalarySheetData.reduce((acc, curr) => acc + curr.totalDeduction, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                       {filteredSalarySheetData.reduce((acc, curr) => acc + curr.netPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {allEmployees.length === 0 ? "No employees found in Employee Master. Please add employees first." :
               !selectedMonth || !selectedYear || selectedYear === 0 ? "Please select Month and Year to view salary sheet." :
               searchTerm && salarySheetData.length > 0 ? `No active employees found matching "${searchTerm}".` :
               "No active employees to display for the selected criteria, or attendance data might be missing."}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}


