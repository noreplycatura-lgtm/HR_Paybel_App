
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import type { OpeningLeaveBalance } from "@/lib/hr-types";
import { calculateEmployeeLeaveDetailsForPeriod } from "@/lib/hr-calculations";
import { calculateMonthlySalaryComponents } from "@/lib/salary-calculations";
import { format, parseISO, isValid, getDaysInMonth, getMonth, getYear, startOfMonth, addMonths, isBefore, isEqual, endOfMonth } from "date-fns";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX = "novita_salary_sheet_edits_v1_";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MonthlyEmployeeAttendance {
  code: string;
  attendance: string[];
}

interface EditableSalaryFields {
  arrears?: number;
  tds?: number;
  loan?: number;
  salaryAdvance?: number;
  otherDeduction?: number;
}

const getDynamicAttendanceStorageKey = (month: string, year: number) => {
  if (!month || year === 0) return null;
  return `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${month}_${year}`;
};

const getSalaryEditsStorageKey = (month: string, year: number) => {
  if (!month || year === 0) return null;
  return `${LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX}${month}_${year}`;
};


export default function ReportsPage() {
  const { toast } = useToast();
  const [employeeMasterList, setEmployeeMasterList] = React.useState<EmployeeDetail[]>([]);
  const [openingBalances, setOpeningBalances] = React.useState<OpeningLeaveBalance[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = React.useState(false);

  // States for Comprehensive Report
  const [selectedEmpComp, setSelectedEmpComp] = React.useState<string>("");
  const [dateFromComp, setDateFromComp] = React.useState<string>("");
  const [dateToComp, setDateToComp] = React.useState<string>("");

  // States for Leave Usage Report
  const [selectedEmpLeave, setSelectedEmpLeave] = React.useState<string>("");

  // States for Salary Ledger
  const [selectedMonthLedger, setSelectedMonthLedger] = React.useState<string>(months[new Date().getMonth()]);
  const [selectedYearLedger, setSelectedYearLedger] = React.useState<number>(new Date().getFullYear());

  const availableYears = React.useMemo(() => {
    const currentYr = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYr - i);
  }, []);

  React.useEffect(() => {
    setIsLoadingEmployees(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployees) {
          const parsed = JSON.parse(storedEmployees);
          if (Array.isArray(parsed)) setEmployeeMasterList(parsed);
        }
        const storedOB = localStorage.getItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
        if (storedOB) {
            const parsedOB = JSON.parse(storedOB);
            if(Array.isArray(parsedOB)) setOpeningBalances(parsedOB);
        }
      } catch (error) {
        console.error("Error loading data for reports page:", error);
        toast({ title: "Error loading initial data", description: "Could not load employee master or opening balances.", variant: "destructive"});
      }
    }
    setIsLoadingEmployees(false);
  }, [toast]);

  const handleGenerateComprehensiveReport = () => {
    if (!selectedEmpComp || !dateFromComp || !dateToComp) {
        toast({ title: "Selection Missing", description: "Please select an employee and a date range.", variant: "destructive" });
        return;
    }
    toast({
      title: "Report Generation (Prototype)",
      description: "Comprehensive Employee Report (DOJ to DOR) generation is a complex feature planned for the future and is not yet fully implemented in this prototype.",
      duration: 7000,
    });
  };

  const handleGenerateLeaveUsageReport = () => {
    if (!selectedEmpLeave) {
      toast({ title: "Selection Missing", description: "Please select an employee for the leave usage report.", variant: "destructive" });
      return;
    }
    setIsGeneratingReport(true);

    const employee = employeeMasterList.find(emp => emp.id === selectedEmpLeave);
    if (!employee || !employee.doj) {
      toast({ title: "Employee Data Error", description: "Selected employee details or DOJ not found.", variant: "destructive" });
      setIsGeneratingReport(false);
      return;
    }

    const csvRows: string[][] = [];
    const headers = ["Month-Year", "Employee Code", "Employee Name", "CL Used", "SL Used", "PL Used", "CL Balance", "SL Balance", "PL Balance"];
    csvRows.push(headers);

    let currentDate = startOfMonth(parseISO(employee.doj));
    const endDate = endOfMonth(new Date()); // Up to end of current month

    try {
        while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
            const currentReportMonth = months[getMonth(currentDate)];
            const currentReportYear = getYear(currentDate);

            let usedCLInMonth = 0;
            let usedSLInMonth = 0;
            let usedPLInMonth = 0;

            const attendanceKey = getDynamicAttendanceStorageKey(currentReportMonth, currentReportYear);
            if (attendanceKey && typeof window !== 'undefined') {
                const storedAttendance = localStorage.getItem(attendanceKey);
                if (storedAttendance) {
                    const monthlyAttendanceForAll: MonthlyEmployeeAttendance[] = JSON.parse(storedAttendance);
                    const empAttendanceRecord = monthlyAttendanceForAll.find(att => att.code === employee.code);
                    if (empAttendanceRecord && empAttendanceRecord.attendance) {
                        empAttendanceRecord.attendance.forEach(status => {
                            if (status === 'CL') usedCLInMonth += 1;
                            else if (status === 'SL') usedSLInMonth += 1;
                            else if (status === 'PL') usedPLInMonth += 1;
                        });
                    }
                }
            }
            
            // Note: `calculateEmployeeLeaveDetailsForPeriod` gets balance *at end of month*, including that month's accrual.
            // The 'used' leaves from attendance are then conceptually subtracted for the final balance.
            // For this report, we are showing the used leaves from attendance and the *calculated* end-of-month balance
            // which already factors in accruals.
            const leaveDetails = calculateEmployeeLeaveDetailsForPeriod(
                employee,
                currentReportYear,
                getMonth(currentDate),
                [], // We're deriving "used" from attendance, not formal applications for this report
                openingBalances
            );
            
            // The balance from `calculateEmployeeLeaveDetailsForPeriod` is already net of accruals for the month.
            // Now subtract the actual used amounts from attendance for that month.
            const finalCLBalance = leaveDetails.balanceCLAtMonthEnd - usedCLInMonth;
            const finalSLBalance = leaveDetails.balanceSLAtMonthEnd - usedSLInMonth;
            const finalPLBalance = leaveDetails.balancePLAtMonthEnd - usedPLInMonth;


            csvRows.push([
                `${currentReportMonth}-${currentReportYear}`,
                employee.code,
                employee.name,
                usedCLInMonth.toFixed(1),
                usedSLInMonth.toFixed(1),
                usedPLInMonth.toFixed(1),
                finalCLBalance.toFixed(1),
                finalSLBalance.toFixed(1),
                finalPLBalance.toFixed(1),
            ]);

            if (getMonth(currentDate) === getMonth(endDate) && getYear(currentDate) === getYear(endDate)) {
                break; 
            }
            currentDate = addMonths(currentDate, 1);
        }

        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `leave_usage_report_${employee.code}_${format(new Date(), "yyyyMMdd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: "Leave Usage Report Generated", description: "CSV download started." });

    } catch (error) {
        console.error("Error generating leave usage report:", error);
        toast({ title: "Report Generation Error", description: "Could not generate the leave usage report.", variant: "destructive" });
    } finally {
        setIsGeneratingReport(false);
    }
  };

  const handleGenerateSalaryLedger = () => {
    if (!selectedMonthLedger || !selectedYearLedger) {
      toast({ title: "Selection Missing", description: "Please select month and year for the salary ledger.", variant: "destructive" });
      return;
    }
    setIsGeneratingReport(true);

    let attendanceForMonth: MonthlyEmployeeAttendance[] = [];
    let storedEdits: Record<string, EditableSalaryFields> = {};
    let currentEmployeeMaster: EmployeeDetail[] = [];

    if (typeof window !== 'undefined') {
        const attendanceKey = getDynamicAttendanceStorageKey(selectedMonthLedger, selectedYearLedger);
        if (attendanceKey) {
            const storedAttendance = localStorage.getItem(attendanceKey);
            if (storedAttendance) try { attendanceForMonth = JSON.parse(storedAttendance); } catch (e) { console.error(e); }
        }
        const editsKey = getSalaryEditsStorageKey(selectedMonthLedger, selectedYearLedger);
        if (editsKey) {
            const storedEditsStr = localStorage.getItem(editsKey);
            if (storedEditsStr) try { storedEdits = JSON.parse(storedEditsStr); } catch (e) { console.error(e); }
        }
        const empMasterStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (empMasterStr) try { currentEmployeeMaster = JSON.parse(empMasterStr); } catch(e) { console.error(e); }
    }
    
    if (currentEmployeeMaster.length === 0) {
        toast({ title: "No Employees", description: "No employees found in master data.", variant: "destructive"});
        setIsGeneratingReport(false);
        return;
    }
    if (attendanceForMonth.length === 0) {
        toast({ title: "No Attendance Data", description: `No attendance data found for ${selectedMonthLedger} ${selectedYearLedger}.`, variant: "destructive"});
        setIsGeneratingReport(false);
        return;
    }

    const salarySheetDataForLedger = currentEmployeeMaster
      .map(emp => {
        const empAttendanceRecord = attendanceForMonth.find(att => att.code === emp.code);
        if (!empAttendanceRecord || !empAttendanceRecord.attendance) {
            return null; // Skip if no attendance record
        }

        const totalDaysInMonth = getDaysInMonth(new Date(selectedYearLedger, months.indexOf(selectedMonthLedger)));
        const dailyStatuses = empAttendanceRecord.attendance.slice(0, totalDaysInMonth);
        
        let daysPaid = 0, weekOffs = 0, fullAbsentDays = 0, halfDaysTaken = 0;
        dailyStatuses.forEach(status => {
          if (status === 'P' || status === 'CL' || status === 'SL' || status === 'PL' || status === 'PH') daysPaid++;
          else if (status === 'HD') { daysPaid += 0.5; halfDaysTaken++; }
          else if (status === 'W') { weekOffs++; daysPaid++; }
          else if (status === 'A') fullAbsentDays++;
        });
        daysPaid = Math.min(daysPaid, totalDaysInMonth);
        const daysAbsentCalculated = fullAbsentDays + (halfDaysTaken * 0.5);

        const monthlyComponents = calculateMonthlySalaryComponents(emp.grossMonthlySalary);
        const payFactor = totalDaysInMonth > 0 ? daysPaid / totalDaysInMonth : 0;
        const actualBasic = monthlyComponents.basic * payFactor;
        const actualHRA = monthlyComponents.hra * payFactor;
        const actualCA = monthlyComponents.ca * payFactor;
        const actualMedical = monthlyComponents.medical * payFactor;
        const actualOtherAllowance = monthlyComponents.otherAllowance * payFactor;
        
        const empEdits = storedEdits[emp.id] || {};
        const arrears = empEdits.arrears ?? 0;
        const tds = empEdits.tds ?? 0;
        const loan = empEdits.loan ?? 0;
        const salaryAdvance = empEdits.salaryAdvance ?? 0;
        const otherDeduction = empEdits.otherDeduction ?? 0;
        
        const totalAllowance = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;
        const esic = 0, professionalTax = 0, providentFund = 0;
        const totalDeduction = esic + professionalTax + providentFund + tds + loan + salaryAdvance + otherDeduction;
        const netPaid = totalAllowance - totalDeduction;

        return {
          ...emp, employeeStatus: emp.status, totalDaysInMonth, daysPaid, weekOffs, daysAbsent: daysAbsentCalculated,
          monthlyBasic: monthlyComponents.basic, monthlyHRA: monthlyComponents.hra, monthlyCA: monthlyComponents.ca, monthlyOtherAllowance: monthlyComponents.otherAllowance, monthlyMedical: monthlyComponents.medical,
          actualBasic, actualHRA, actualCA, actualOtherAllowance, actualMedical,
          arrears, tds, loan, salaryAdvance, otherDeduction,
          totalAllowance, esic, professionalTax, providentFund, totalDeduction, netPaid,
        };
      })
      .filter(emp => emp !== null);

    if (salarySheetDataForLedger.length === 0) {
      toast({ title: "No Data", description: "No employees had attendance data for the selected period.", variant: "destructive" });
      setIsGeneratingReport(false);
      return;
    }
    
    const headers = [
      "Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ",
      "Total Days", "Day Paid", "Week Off", "Day Absent",
      "Monthly Basic", "Monthly HRA", "Monthly CA", "Monthly Other Allowance", "Monthly Medical", "Monthly Gross",
      "Actual Basic", "Actual HRA", "Actual CA", "Actual Other Allowance", "Actual Medical",
      "Arrears", "Total Allowance",
      "ESIC", "Professional Tax", "PROVFUND", "TDS", "Loan", "Salary Advance", "Other Deduction",
      "Total Deduction", "Net Paid"
    ];
    const csvRows: string[][] = [headers];
    salarySheetDataForLedger.forEach(emp => {
      if (!emp) return;
      const dojFormatted = emp.doj && isValid(parseISO(emp.doj)) ? format(parseISO(emp.doj), 'dd-MM-yyyy') : emp.doj || 'N/A';
      const row = [
        emp.employeeStatus, emp.division || "N/A", emp.code, emp.name, emp.designation, emp.hq || "N/A", dojFormatted,
        emp.totalDaysInMonth.toString(), emp.daysPaid.toFixed(1), emp.weekOffs.toString(), emp.daysAbsent.toFixed(1),
        emp.monthlyBasic.toFixed(2), emp.monthlyHRA.toFixed(2), emp.monthlyCA.toFixed(2), emp.monthlyOtherAllowance.toFixed(2), emp.monthlyMedical.toFixed(2), emp.grossMonthlySalary.toFixed(2),
        emp.actualBasic.toFixed(2), emp.actualHRA.toFixed(2), emp.actualCA.toFixed(2), emp.actualOtherAllowance.toFixed(2), emp.actualMedical.toFixed(2),
        emp.arrears.toFixed(2), emp.totalAllowance.toFixed(2),
        emp.esic.toFixed(2), emp.professionalTax.toFixed(2), emp.providentFund.toFixed(2), emp.tds.toFixed(2), emp.loan.toFixed(2), emp.salaryAdvance.toFixed(2), emp.otherDeduction.toFixed(2),
        emp.totalDeduction.toFixed(2), emp.netPaid.toFixed(2),
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
      csvRows.push(row);
    });
    
    // Add Totals Row for Salary Ledger
    const totals = {
        monthlyBasic: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.monthlyBasic || 0), 0),
        monthlyHRA: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.monthlyHRA || 0), 0),
        // ... (sum all other relevant financial columns)
        grossMonthlySalary: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.grossMonthlySalary || 0), 0),
        actualBasic: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.actualBasic || 0), 0),
        arrears: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.arrears || 0), 0),
        totalAllowance: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.totalAllowance || 0), 0),
        tds: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.tds || 0), 0),
        loan: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.loan || 0), 0),
        salaryAdvance: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.salaryAdvance || 0), 0),
        otherDeduction: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.otherDeduction || 0), 0),
        totalDeduction: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.totalDeduction || 0), 0),
        netPaid: salarySheetDataForLedger.reduce((sum, emp) => sum + (emp?.netPaid || 0), 0),
    };
     const totalRow = [
        "", "", "", "", "", "", "TOTALS:", "", "", "", "",
        totals.monthlyBasic.toFixed(2), totals.monthlyHRA.toFixed(2), /* CA, Other, Medical */ "", "", "", totals.grossMonthlySalary.toFixed(2),
        totals.actualBasic.toFixed(2), /* HRA, CA, Other, Medical */ "", "", "", "",
        totals.arrears.toFixed(2), totals.totalAllowance.toFixed(2),
        /* ESIC, PT, PF */ "", "", "", totals.tds.toFixed(2), totals.loan.toFixed(2), totals.salaryAdvance.toFixed(2), totals.otherDeduction.toFixed(2),
        totals.totalDeduction.toFixed(2), totals.netPaid.toFixed(2),
    ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    csvRows.push(totalRow);


    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `salary_ledger_${selectedMonthLedger}_${selectedYearLedger}_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Salary Ledger Generated", description: "CSV download started." });

    setIsGeneratingReport(false);
  };


  if (isLoadingEmployees) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Reports" description="Generate various HR reports." />
      <div className="space-y-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Comprehensive Employee Report</CardTitle>
            <CardDescription>Attendance, salary, and leave details for an employee over a period. (Prototype - Full report generation not yet implemented)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select value={selectedEmpComp} onValueChange={setSelectedEmpComp}>
                <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                <SelectContent>
                  {employeeMasterList.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code})</SelectItem>)}
                </SelectContent>
              </Select>
              <div>
                <Label htmlFor="dateFromComp">Date From</Label>
                <Input type="date" id="dateFromComp" value={dateFromComp} onChange={e => setDateFromComp(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="dateToComp">Date To</Label>
                <Input type="date" id="dateToComp" value={dateToComp} onChange={e => setDateToComp(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleGenerateComprehensiveReport} disabled={isGeneratingReport || !selectedEmpComp || !dateFromComp || !dateToComp}>
              {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Generate Comprehensive Report
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Employee Leave Usage Report</CardTitle>
            <CardDescription>Monthly leave usage and balance from joining to current date for a selected employee.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full sm:w-1/3">
              <Select value={selectedEmpLeave} onValueChange={setSelectedEmpLeave}>
                <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                <SelectContent>
                  {employeeMasterList.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateLeaveUsageReport} disabled={isGeneratingReport || !selectedEmpLeave}>
              {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Generate Leave Usage Report (CSV)
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Monthly Salary Ledger</CardTitle>
            <CardDescription>Download a detailed salary ledger for all employees for a selected month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select value={selectedMonthLedger} onValueChange={setSelectedMonthLedger}>
                <SelectTrigger><SelectValue placeholder="Select Month" /></SelectTrigger>
                <SelectContent>
                  {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedYearLedger > 0 ? selectedYearLedger.toString() : ""} onValueChange={(value) => setSelectedYearLedger(parseInt(value))}>
                <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateSalaryLedger} disabled={isGeneratingReport || !selectedMonthLedger || selectedYearLedger === 0}>
              {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download Salary Ledger (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

