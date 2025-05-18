
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, Loader2, Printer, XCircle } from "lucide-react";
import Image from "next/image";
import { getDaysInMonth, parseISO, isValid, format, getMonth, getYear, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";

import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateMonthlySalaryComponents } from "@/lib/salary-calculations";
import { calculateEmployeeLeaveDetailsForPeriod, CL_ACCRUAL_RATE, SL_ACCRUAL_RATE, PL_ACCRUAL_RATE, calculateMonthsOfService, MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL } from "@/lib/hr-calculations";
import type { OpeningLeaveBalance } from "@/lib/hr-types";


const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface CompanyDetail {
  name: string;
  address: string;
  logoText: string;
  dataAiHint: string;
  logoWidth: number;
  logoHeight: number;
}

const COMPANY_DETAILS_MAP: Record<string, CompanyDetail> = {
  FMCG: {
    name: "Novita Healthcare",
    address: "37B, Mangal Compound, Dewas Naka, Lasudia Mori, Indore, Madhya Pradesh 452010.",
    logoText: "Novita",
    dataAiHint: "company logo healthcare",
    logoWidth: 150,
    logoHeight: 50,
  },
  Wellness: {
    name: "Catura Shine Pharma LLP.",
    address: "35,FF, JP Estate, Sanathal Changodar Highway, Navapura,\nTa- Sanand, Dist-Ahmedabad Gujrat (382210).",
    logoText: "Catura Shine Pharma",
    dataAiHint: "company logo pharma wellness",
    logoWidth: 180,
    logoHeight: 55,
  },
  Default: {
    name: "HR Payroll App",
    address: "123 Placeholder St, Placeholder City, PC 12345",
    logoText: "HR App",
    dataAiHint: "company logo",
    logoWidth: 150,
    logoHeight: 50,
  }
};

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX = "novita_salary_sheet_edits_v1_";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "novita_performance_deductions_v1";


interface SalarySlipDataType {
  employeeId: string;
  name: string;
  designation: string;
  joinDate: string;
  division: string;
  totalDaysInMonth: number;
  actualPayDays: number;
  earnings: Array<{ component: string; amount: number }>;
  deductions: Array<{ component: string; amount: number }>;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  leaveUsedThisMonth: { cl: number; sl: number; pl: number };
  leaveBalanceNextMonth: { cl: number; sl: number; pl: number };
  absentDays: number;
  weekOffs: number;
  paidHolidays: number;
  totalLeavesTakenThisMonth: number;
}

interface MonthlyEmployeeAttendance {
  code: string;
  attendance: string[];
}

interface EditableSalaryFields {
  arrears?: number;
  tds?: number;
  loan?: number;
  salaryAdvance?: number;
  manualOtherDeduction?: number;
}

interface PerformanceDeductionEntry {
  id: string;
  employeeCode: string;
  month: string;
  year: number;
  amount: number;
}


export default function SalarySlipPage() {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = React.useState(0);
  const [availableYears, setAvailableYears] = React.useState<number[]>([]);

  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | undefined>();
  const [selectedDivision, setSelectedDivision] = React.useState<string | undefined>();
  
  const [allEmployees, setAllEmployees] = React.useState<EmployeeDetail[]>([]);
  const [filteredEmployeesForSlip, setFilteredEmployeesForSlip] = React.useState<EmployeeDetail[]>([]);
  const [openingBalances, setOpeningBalances] = React.useState<OpeningLeaveBalance[]>([]);
  const [allPerformanceDeductions, setAllPerformanceDeductions] = React.useState<PerformanceDeductionEntry[]>([]);


  const [slipData, setSlipData] = React.useState<SalarySlipDataType | null>(null);
  const [bulkSlipsData, setBulkSlipsData] = React.useState<SalarySlipDataType[]>([]);
  const [isBulkPrintingView, setIsBulkPrintingView] = React.useState(false);
  const [showSlip, setShowSlip] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);

  React.useEffect(() => {
    const year = new Date().getFullYear();
    setCurrentYear(year);
    setAvailableYears(Array.from({ length: 5 }, (_, i) => year - i));
    setSelectedMonth(months[new Date().getMonth()]);
    setSelectedYear(year);
  }, []);

  React.useEffect(() => {
    setIsLoadingEmployees(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployeesStr) {
          const parsed = JSON.parse(storedEmployeesStr);
          setAllEmployees(Array.isArray(parsed) ? parsed : []);
        } else {
          setAllEmployees([]);
          toast({title: "Employee Data Missing", description: "Employee master data not found. Please add employees first.", variant: "destructive", duration: 7000});
        }
        const storedOBStr = localStorage.getItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
        if (storedOBStr) {
          const parsedOB = JSON.parse(storedOBStr);
          setOpeningBalances(Array.isArray(parsedOB) ? parsedOB : []);
        } else {
          setOpeningBalances([]);
        }
         const storedPerfDeductions = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
        if (storedPerfDeductions) {
            const parsed = JSON.parse(storedPerfDeductions);
            setAllPerformanceDeductions(Array.isArray(parsed) ? parsed : []);
        } else {
            setAllPerformanceDeductions([]);
        }
      } catch (error) {
        console.error("Error loading initial data for salary slip:", error);
        toast({ title: "Data Load Error", description: "Could not load employee, opening balance, or performance deduction data.", variant: "destructive" });
        setAllEmployees([]);
        setOpeningBalances([]);
        setAllPerformanceDeductions([]);
      }
    }
    setIsLoadingEmployees(false);
  }, [toast]);

  React.useEffect(() => {
    if (selectedDivision && allEmployees.length > 0) {
      const filtered = allEmployees.filter(emp => emp.division === selectedDivision);
      setFilteredEmployeesForSlip(filtered);
      if (selectedEmployeeId && !filtered.find(emp => emp.id === selectedEmployeeId)) {
        setSelectedEmployeeId(undefined);
        setSlipData(null); 
        setShowSlip(false);
      }
    } else if (selectedDivision) { 
      setFilteredEmployeesForSlip([]);
      setSelectedEmployeeId(undefined);
      setSlipData(null);
      setShowSlip(false);
    } else { 
      setFilteredEmployeesForSlip([]); 
      setSelectedEmployeeId(undefined); 
      setSlipData(null);
      setShowSlip(false);
    }
  }, [selectedDivision, allEmployees, selectedEmployeeId]);

  const generateSlipDataForEmployee = (
    employee: EmployeeDetail,
    month: string,
    year: number
  ): SalarySlipDataType | null => {
    const monthIndex = months.indexOf(month);
    if (monthIndex === -1) return null;

    let attendanceStatuses: string[] = [];
    if (typeof window !== 'undefined') {
      const attendanceKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${month}_${year}`;
      const storedAttendanceData = localStorage.getItem(attendanceKey);
      if (storedAttendanceData) {
        try {
          const allMonthAttendance: MonthlyEmployeeAttendance[] = JSON.parse(storedAttendanceData);
          const attendanceForMonth = allMonthAttendance.find(att => att.code === employee.code);
          if (attendanceForMonth) {
            attendanceStatuses = attendanceForMonth.attendance;
          } else {
            return null; // No attendance for this employee this month
          }
        } catch (e) {
          console.warn(`Could not parse attendance for ${month} ${year}: ${e}`);
          return null; 
        }
      } else {
         return null; // No attendance file for this month
      }
    }

    if (attendanceStatuses.length === 0) {
      return null;
    }

    let salaryEdits: EditableSalaryFields = {};
    if (typeof window !== 'undefined') {
      const editsKey = `${LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX}${month}_${year}`;
      const storedEditsStr = localStorage.getItem(editsKey);
      if (storedEditsStr) {
        try {
          const allEdits: Record<string, EditableSalaryFields> = JSON.parse(storedEditsStr);
          salaryEdits = allEdits[employee.id] || {};
        } catch (e) { console.warn(`Could not parse salary edits for ${month} ${year}: ${e}`); }
      }
    }
    
    const performanceDeductionEntry = allPerformanceDeductions.find(
      pd => pd.employeeCode === employee.code && pd.month === month && pd.year === year
    );
    const performanceDeductionAmount = performanceDeductionEntry?.amount || 0;

    const totalDaysInMonthValue = getDaysInMonth(new Date(year, monthIndex));
    const dailyStatuses = attendanceStatuses.slice(0, totalDaysInMonthValue);

    let actualPayDaysValue = 0;
    let usedCLInMonth = 0, usedSLInMonth = 0, usedPLInMonth = 0;
    let absentDaysCount = 0;
    let weekOffsCount = 0;
    let paidHolidaysCount = 0;

    dailyStatuses.forEach(status => {
      if (status === 'P' || status === 'W' || status === 'PH') actualPayDaysValue++;
      else if (status === 'CL') { actualPayDaysValue++; usedCLInMonth++; }
      else if (status === 'SL') { actualPayDaysValue++; usedSLInMonth++; }
      else if (status === 'PL') { actualPayDaysValue++; usedPLInMonth++; }
      else if (status === 'HD') actualPayDaysValue += 0.5;

      if (status === 'A') absentDaysCount += 1;
      else if (status === 'HD') absentDaysCount += 0.5; 
      else if (status === 'W') weekOffsCount += 1;
      else if (status === 'PH') paidHolidaysCount += 1;
    });
    actualPayDaysValue = Math.min(actualPayDaysValue, totalDaysInMonthValue);
    const totalLeavesTakenThisMonth = usedCLInMonth + usedSLInMonth + usedPLInMonth;

    const monthlyComp = calculateMonthlySalaryComponents(employee.grossMonthlySalary);
    const payFactor = totalDaysInMonthValue > 0 ? actualPayDaysValue / totalDaysInMonthValue : 0;

    const earningsList = [
      { component: "Basic Salary", amount: monthlyComp.basic * payFactor },
      { component: "House Rent Allowance (HRA)", amount: monthlyComp.hra * payFactor },
      { component: "Conveyance Allowance (CA)", amount: monthlyComp.ca * payFactor },
      { component: "Medical Allowance", amount: monthlyComp.medical * payFactor },
      { component: "Other Allowance", amount: monthlyComp.otherAllowance * payFactor },
      { component: "Arrears", amount: salaryEdits.arrears ?? 0 },
    ];
    const calculatedTotalEarnings = earningsList.reduce((sum, item) => sum + item.amount, 0);
    
    const manualOtherDeductionVal = salaryEdits.manualOtherDeduction ?? 0;
    const totalOtherDeductionOnSlip = manualOtherDeductionVal + performanceDeductionAmount;

    const deductionsList = [
      { component: "Provident Fund (PF)", amount: 0 }, 
      { component: "Professional Tax (PT)", amount: 0 }, 
      { component: "ESIC", amount: 0 }, 
      { component: "Income Tax (TDS)", amount: salaryEdits.tds ?? 0 },
      { component: "Loan", amount: salaryEdits.loan ?? 0 },
      { component: "Salary Advance", amount: salaryEdits.salaryAdvance ?? 0 },
      { component: "Other Deduction", amount: totalOtherDeductionOnSlip },
    ];
    const calculatedTotalDeductions = deductionsList.reduce((sum, item) => sum + item.amount, 0);
    const calculatedNetSalary = calculatedTotalEarnings - calculatedTotalDeductions;

    const leaveDetailsEOM = calculateEmployeeLeaveDetailsForPeriod(employee, year, monthIndex, [], openingBalances);
    
    let nextMonthOpeningCL = 0, nextMonthOpeningSL = 0, nextMonthOpeningPL = 0;
    const nextMonthDateObject = addMonths(startOfMonth(new Date(year, monthIndex, 1)), 1);
    const nextMonthIdx = getMonth(nextMonthDateObject);
    const nextYr = getYear(nextMonthDateObject);
    const serviceMonthsAtNextMonthStart = calculateMonthsOfService(employee.doj, startOfMonth(nextMonthDateObject));
    const isEligibleForAccrualNextMonth = serviceMonthsAtNextMonthStart > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
    
    const openingBalanceForNextFY = openingBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === nextYr);

    if (nextMonthIdx === 3) { 
      nextMonthOpeningCL = (openingBalanceForNextFY?.openingCL || 0) + (isEligibleForAccrualNextMonth ? CL_ACCRUAL_RATE : 0);
      nextMonthOpeningSL = (openingBalanceForNextFY?.openingSL || 0) + (isEligibleForAccrualNextMonth ? SL_ACCRUAL_RATE : 0);
      
      let basePLForNextFY = leaveDetailsEOM.balancePLAtMonthEnd - usedPLInMonth; 
      if (openingBalanceForNextFY && openingBalanceForNextFY.openingPL !== undefined ) { 
         basePLForNextFY = openingBalanceForNextFY.openingPL;
      }
      nextMonthOpeningPL = basePLForNextFY + (isEligibleForAccrualNextMonth ? PL_ACCRUAL_RATE : 0);

    } else { 
      nextMonthOpeningCL = leaveDetailsEOM.balanceCLAtMonthEnd - usedCLInMonth + (isEligibleForAccrualNextMonth ? CL_ACCRUAL_RATE : 0);
      nextMonthOpeningSL = leaveDetailsEOM.balanceSLAtMonthEnd - usedSLInMonth + (isEligibleForAccrualNextMonth ? SL_ACCRUAL_RATE : 0);
      nextMonthOpeningPL = leaveDetailsEOM.balancePLAtMonthEnd - usedPLInMonth + (isEligibleForAccrualNextMonth ? PL_ACCRUAL_RATE : 0);
    }


    return {
      employeeId: employee.code,
      name: employee.name,
      designation: employee.designation,
      joinDate: employee.doj && isValid(parseISO(employee.doj)) ? format(parseISO(employee.doj), "dd MMM yyyy") : employee.doj || "N/A",
      division: employee.division || "N/A",
      totalDaysInMonth: totalDaysInMonthValue,
      actualPayDays: actualPayDaysValue,
      earnings: earningsList,
      deductions: deductionsList,
      totalEarnings: calculatedTotalEarnings,
      totalDeductions: calculatedTotalDeductions,
      netSalary: calculatedNetSalary,
      leaveUsedThisMonth: { cl: usedCLInMonth, sl: usedSLInMonth, pl: usedPLInMonth },
      leaveBalanceNextMonth: { cl: nextMonthOpeningCL, sl: nextMonthOpeningSL, pl: nextMonthOpeningPL },
      absentDays: absentDaysCount,
      weekOffs: weekOffsCount,
      paidHolidays: paidHolidaysCount,
      totalLeavesTakenThisMonth: totalLeavesTakenThisMonth,
    };
  };


  const handleGenerateSlip = async () => {
    if (!selectedMonth || !selectedYear || !selectedEmployeeId || !selectedDivision) {
      toast({ title: "Selection Missing", description: "Please select month, year, division, and employee.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSlip(false); 

    const employee = allEmployees.find(e => e.id === selectedEmployeeId);
    if (!employee) {
      toast({ title: "Employee Not Found", description: "Selected employee details could not be found.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    
    const generatedData = generateSlipDataForEmployee(employee, selectedMonth, selectedYear);
    if (generatedData) {
      setSlipData(generatedData);
      setShowSlip(true);
    } else {
      toast({ title: "Data Error", description: `Could not generate slip for ${employee.name}. Attendance data might be missing or corrupted.`, variant: "destructive" });
      setSlipData(null);
      setShowSlip(false);
    }
    setIsLoading(false);
  };

  const handleDownloadAllSummaries = () => {
    if (!selectedMonth || !selectedYear || !selectedDivision) {
      toast({ title: "Selection Missing", description: "Please select month, year, and division to download summaries.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const employeesForSummary = allEmployees
      .filter(emp => emp.division === selectedDivision)
      .sort((a, b) => a.code.localeCompare(b.code)); // Sort by employee code

    if (employeesForSummary.length === 0) {
      toast({ title: "No Employees", description: `No employees found for ${selectedDivision} division.`, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const csvRows: string[][] = [];
    const headers = ["Employee Code", "Name", "Designation", "Gross Salary", "Total Earnings", "Total Deductions", "Net Salary"];
    csvRows.push(headers);

    let processedCount = 0;
    employeesForSummary.forEach(emp => {
      const slipSummaryData = generateSlipDataForEmployee(emp, selectedMonth, selectedYear);
      if (slipSummaryData) {
         csvRows.push([
          emp.code,
          emp.name,
          emp.designation,
          emp.grossMonthlySalary.toFixed(2),
          slipSummaryData.totalEarnings.toFixed(2),
          slipSummaryData.totalDeductions.toFixed(2),
          slipSummaryData.netSalary.toFixed(2)
        ]);
        processedCount++;
      }
    });
    
    if (processedCount === 0) {
        toast({ title: "No Data for CSV", description: `No employees in ${selectedDivision} had attendance data for ${selectedMonth} ${selectedYear}. CSV not generated.`, variant: "destructive", duration: 7000 });
        setIsLoading(false);
        return;
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `salary_summaries_${selectedDivision}_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Summaries Downloaded", description: `CSV with ${processedCount} employee summaries for ${selectedDivision} division (${selectedMonth} ${selectedYear}) generated.` });
    setIsLoading(false);
  };
  
  const handlePrintAllSlips = () => {
    if (!selectedMonth || !selectedYear || !selectedDivision) {
      toast({ title: "Selection Missing", description: "Please select month, year, and division.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSlip(false);
    setSlipData(null);

    const employeesToPrint = allEmployees
        .filter(emp => emp.division === selectedDivision)
        .sort((a, b) => a.code.localeCompare(b.code)); // Sort by employee code

    if (employeesToPrint.length === 0) {
      toast({ title: "No Employees", description: `No employees found for ${selectedDivision} division to print slips.`, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const generatedSlips: SalarySlipDataType[] = [];
    let countWithAttendance = 0;
    employeesToPrint.forEach(emp => {
      const sData = generateSlipDataForEmployee(emp, selectedMonth, selectedYear);
      if (sData) {
        generatedSlips.push(sData);
        countWithAttendance++;
      }
    });

    if (countWithAttendance === 0) {
      toast({ title: "No Slips Generated", description: `No employees in ${selectedDivision} had attendance data for ${selectedMonth} ${selectedYear}. Cannot print slips.`, variant: "destructive", duration: 7000 });
      setIsLoading(false);
      return;
    }

    setBulkSlipsData(generatedSlips);
    setIsBulkPrintingView(true);
    // useEffect will handle calling window.print()
  };

  React.useEffect(() => {
    if (isBulkPrintingView && bulkSlipsData.length > 0) {
      const timer = setTimeout(() => {
        try {
          window.print();
          toast({
            title: "Print Initiated",
            description: "Use your browser's 'Save as PDF' option. Click 'Close Bulk View' to return.",
            duration: 9000,
          });
        } catch (e) {
          console.error("Error calling window.print():", e);
          toast({
            title: "Print Error",
            description: "Could not open print dialog. Please check browser console.",
            variant: "destructive",
          });
        }
      }, 500); // Delay to allow DOM to update
      return () => clearTimeout(timer);
    }
  }, [isBulkPrintingView, bulkSlipsData, toast]);


  const currentCompanyDetails = selectedDivision
    ? COMPANY_DETAILS_MAP[selectedDivision as keyof typeof COMPANY_DETAILS_MAP] || COMPANY_DETAILS_MAP.Default
    : COMPANY_DETAILS_MAP.Default;

  const nextMonthDate = selectedMonth && selectedYear > 0 ? addMonths(new Date(selectedYear, months.indexOf(selectedMonth), 1), 1) : new Date();
  const nextMonthName = format(nextMonthDate, "MMMM");
  const nextMonthYearNum = getYear(nextMonthDate);


  if (isLoadingEmployees) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (isBulkPrintingView) {
    return (
      <div id="salary-slip-printable-area">
        <Button
          onClick={() => {
            setIsBulkPrintingView(false);
            setBulkSlipsData([]);
            setIsLoading(false);
          }}
          variant="outline"
          className="fixed top-4 right-4 no-print z-[101]"
        >
          <XCircle className="mr-2 h-4 w-4" /> Close Bulk View
        </Button>
        {bulkSlipsData.map((sData, index) => {
          const empDivisionCompanyDetails = sData.division 
             ? COMPANY_DETAILS_MAP[sData.division as keyof typeof COMPANY_DETAILS_MAP] || COMPANY_DETAILS_MAP.Default
             : COMPANY_DETAILS_MAP.Default;

          const slipNextMonthDate = selectedMonth && selectedYear > 0 ? addMonths(new Date(selectedYear, months.indexOf(selectedMonth), 1), 1) : new Date();
          const slipNextMonthName = format(slipNextMonthDate, "MMMM");
          const slipNextMonthYearNum = getYear(slipNextMonthDate);

          return (
            <Card key={`bulk-slip-${sData.employeeId}-${index}`} className={`shadow-xl salary-slip-page ${index > 0 ? 'print-page-break-before' : ''} mb-4`}>
              <CardHeader className="bg-muted/30 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div>
                    <Image
                      src={`https://placehold.co/${empDivisionCompanyDetails.logoWidth}x${empDivisionCompanyDetails.logoHeight}.png?text=${encodeURIComponent(empDivisionCompanyDetails.logoText)}`}
                      alt={`${empDivisionCompanyDetails.name} Logo`}
                      width={empDivisionCompanyDetails.logoWidth}
                      height={empDivisionCompanyDetails.logoHeight}
                      className="mb-2"
                      data-ai-hint={empDivisionCompanyDetails.dataAiHint}
                    />
                    <p className="text-sm font-semibold">{empDivisionCompanyDetails.name}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{empDivisionCompanyDetails.address}</p>
                  </div>
                  <div className="text-right mt-4 sm:mt-0">
                    <CardTitle className="text-2xl">Salary Slip</CardTitle>
                    <CardDescription>For {selectedMonth} {selectedYear}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 text-sm">
                    {/* Column 1: Employee & Pay Details */}
                    <div>
                        <h3 className="font-semibold mb-2">Employee Details</h3>
                        <p><strong>Name:</strong> {sData.name}</p>
                        <p><strong>Employee ID:</strong> {sData.employeeId}</p>
                        <p><strong>Designation:</strong> {sData.designation}</p>
                        <p><strong>Date of Joining:</strong> {sData.joinDate}</p>
                        <p><strong>Division:</strong> {sData.division}</p>
                        <Separator className="my-4" />
                        <h3 className="font-semibold mb-2">Pay Details</h3>
                        <p><strong>Total Days:</strong> {sData.totalDaysInMonth.toFixed(1)}</p>
                        <p><strong>Pay Days:</strong> {sData.actualPayDays.toFixed(1)}</p>
                    </div>
                    {/* Column 2: Attendance & Leave Summary */}
                    <div>
                        <h3 className="font-semibold mb-2">Attendance Summary</h3>
                        <p><strong>Absent Days:</strong> {sData.absentDays.toFixed(1)}</p>
                        <p><strong>Week Offs:</strong> {sData.weekOffs}</p>
                        <p><strong>Paid Holidays:</strong> {sData.paidHolidays}</p>
                        <p><strong>Total Leaves Taken:</strong> {sData.totalLeavesTakenThisMonth.toFixed(1)}</p>
                        <p className="invisible">&nbsp;</p> {/* Placeholder for alignment */}
                        <Separator className="my-4" />
                        <h3 className="font-semibold mb-2">Leave Used ({selectedMonth} {selectedYear})</h3>
                        <p>CL: {sData.leaveUsedThisMonth.cl.toFixed(1)} | SL: {sData.leaveUsedThisMonth.sl.toFixed(1)} | PL: {sData.leaveUsedThisMonth.pl.toFixed(1)}</p>
                        
                        <Separator className="my-4" />
                        <h3 className="font-semibold mb-2">Leave Balance (Opening {slipNextMonthName} {slipNextMonthYearNum})</h3>
                        <p>CL: {sData.leaveBalanceNextMonth.cl.toFixed(1)} | SL: {sData.leaveBalanceNextMonth.sl.toFixed(1)} | PL: {sData.leaveBalanceNextMonth.pl.toFixed(1)}</p>
                    </div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Earnings</h3>
                    {sData.earnings.map(item => (
                      <div key={item.component} className="flex justify-between py-1 border-b border-dashed">
                        <span>{item.component}</span>
                        <span>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold mt-2 pt-1">
                      <span>Total Earnings</span>
                      <span>₹{sData.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Deductions</h3>
                    {sData.deductions.map(item => (
                      <div key={item.component} className="flex justify-between py-1 border-b border-dashed">
                        <span>{item.component}</span>
                        <span>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold mt-2 pt-1">
                      <span>Total Deductions</span>
                      <span>₹{sData.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="text-right">
                  <p className="text-lg font-bold">Net Salary: ₹{sData.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-sm text-muted-foreground">Amount in words: {convertToWords(sData.netSalary)} Rupees Only</p>
                </div>

                <p className="text-xs text-muted-foreground mt-8 text-center">This is a computer-generated salary slip and does not require a signature.</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Salary Slip Generator" description="Generate and download monthly salary slips for employees.">
          <Button
            onClick={handleDownloadAllSummaries}
            disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading}
            variant="outline"
          >
            {isLoading && bulkSlipsData.length === 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
             Download All Summaries (CSV)
          </Button>
          <Button
            onClick={handlePrintAllSlips}
            disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading}
            variant="outline"
          >
            {isLoading && bulkSlipsData.length > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Print All Slips (PDF)
          </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow print:hidden">
        <CardHeader>
          <CardTitle>Select Criteria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth} >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(val) => setSelectedYear(parseInt(val))}>
             <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
                {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
           <Select value={selectedDivision} onValueChange={setSelectedDivision}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FMCG">FMCG Division</SelectItem>
              <SelectItem value="Wellness">Wellness Division</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={!selectedDivision || filteredEmployeesForSlip.length === 0} >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select Employee" />
            </SelectTrigger>
            <SelectContent>
              {filteredEmployeesForSlip.length > 0 ? (
                filteredEmployeesForSlip.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code}) - {emp.status}</SelectItem>)
              ) : (
                <SelectItem value="no-employee" disabled>
                  {selectedDivision ? `No employees in ${selectedDivision}` : "Select division first"}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button
            onClick={handleGenerateSlip}
            disabled={!selectedMonth || !selectedEmployeeId || !selectedYear || !selectedDivision || isLoading}
          >
            {isLoading && !bulkSlipsData.length ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
             Generate Slip
          </Button>
        </CardContent>
      </Card>

      {showSlip && slipData && (
        <Card className="shadow-xl" id="salary-slip-preview">
          <CardHeader className="bg-muted/30 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <Image
                  src={`https://placehold.co/${currentCompanyDetails.logoWidth}x${currentCompanyDetails.logoHeight}.png?text=${encodeURIComponent(currentCompanyDetails.logoText)}`}
                  alt={`${currentCompanyDetails.name} Logo`}
                  width={currentCompanyDetails.logoWidth}
                  height={currentCompanyDetails.logoHeight}
                  className="mb-2"
                  data-ai-hint={currentCompanyDetails.dataAiHint}
                />
                <p className="text-sm font-semibold">{currentCompanyDetails.name}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{currentCompanyDetails.address}</p>
              </div>
              <div className="text-right mt-4 sm:mt-0">
                <CardTitle className="text-2xl">Salary Slip</CardTitle>
                <CardDescription>For {selectedMonth} {selectedYear}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 text-sm">
                {/* Column 1: Employee & Pay Details */}
                <div>
                    <h3 className="font-semibold mb-2">Employee Details</h3>
                    <p><strong>Name:</strong> {slipData.name}</p>
                    <p><strong>Employee ID:</strong> {slipData.employeeId}</p>
                    <p><strong>Designation:</strong> {slipData.designation}</p>
                    <p><strong>Date of Joining:</strong> {slipData.joinDate}</p>
                    <p><strong>Division:</strong> {slipData.division}</p>
                    <Separator className="my-4" />
                    <h3 className="font-semibold mb-2">Pay Details</h3>
                    <p><strong>Total Days:</strong> {slipData.totalDaysInMonth.toFixed(1)}</p>
                    <p><strong>Pay Days:</strong> {slipData.actualPayDays.toFixed(1)}</p>
                </div>
                {/* Column 2: Attendance & Leave Summary */}
                <div>
                    <h3 className="font-semibold mb-2">Attendance Summary</h3>
                    <p><strong>Absent Days:</strong> {slipData.absentDays.toFixed(1)}</p>
                    <p><strong>Week Offs:</strong> {slipData.weekOffs}</p>
                    <p><strong>Paid Holidays:</strong> {slipData.paidHolidays}</p>
                    <p><strong>Total Leaves Taken:</strong> {slipData.totalLeavesTakenThisMonth.toFixed(1)}</p>
                     <p className="invisible">&nbsp;</p> 
                    <Separator className="my-4" />
                    <h3 className="font-semibold mb-2">Leave Used ({selectedMonth} {selectedYear})</h3>
                    <p>CL: {slipData.leaveUsedThisMonth.cl.toFixed(1)} | SL: {slipData.leaveUsedThisMonth.sl.toFixed(1)} | PL: {slipData.leaveUsedThisMonth.pl.toFixed(1)}</p>
                    
                    <Separator className="my-4" />
                    <h3 className="font-semibold mb-2">Leave Balance (Opening {nextMonthName} {nextMonthYearNum})</h3>
                    <p>CL: {slipData.leaveBalanceNextMonth.cl.toFixed(1)} | SL: {slipData.leaveBalanceNextMonth.sl.toFixed(1)} | PL: {slipData.leaveBalanceNextMonth.pl.toFixed(1)}</p>
                </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-lg mb-2">Earnings</h3>
                {slipData.earnings.map(item => (
                  <div key={item.component} className="flex justify-between py-1 border-b border-dashed">
                    <span>{item.component}</span>
                    <span>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold mt-2 pt-1">
                  <span>Total Earnings</span>
                  <span>₹{slipData.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Deductions</h3>
                {slipData.deductions.map(item => (
                  <div key={item.component} className="flex justify-between py-1 border-b border-dashed">
                    <span>{item.component}</span>
                    <span>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold mt-2 pt-1">
                  <span>Total Deductions</span>
                  <span>₹{slipData.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="text-right">
              <p className="text-lg font-bold">Net Salary: ₹{slipData.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-sm text-muted-foreground">Amount in words: {convertToWords(slipData.netSalary)} Rupees Only</p>
            </div>

            <p className="text-xs text-muted-foreground mt-8 text-center">This is a computer-generated salary slip and does not require a signature.</p>
          </CardContent>
          <CardFooter className="p-6 border-t print:hidden">
            <p className="text-xs text-muted-foreground mr-auto">Use your browser's 'Save as PDF' option in the print dialog to download.</p>
            <Button 
              onClick={() => {
                console.log('Print button clicked. Attempting to call window.print().');
                try {
                  window.print();
                } catch (e) {
                  console.error('Error calling window.print():', e);
                  toast({
                    title: "Print Error",
                    description: "Could not open print dialog. Please check browser console.",
                    variant: "destructive",
                  });
                }
              }} 
              className="ml-auto print:hidden"
            >
              <Download className="mr-2 h-4 w-4" /> Print / Save as PDF
            </Button>
          </CardFooter>
        </Card>
      )}
       {!showSlip && !isLoading && !isLoadingEmployees && !isBulkPrintingView && (
        <Card className="shadow-md hover:shadow-lg transition-shadow items-center flex justify-center py-12">
          <CardContent className="text-center text-muted-foreground">
            <p>Please select month, year, division, and employee to generate the salary slip.</p>
          </CardContent>
        </Card>
      )}
      {(isLoading || isLoadingEmployees) && !isBulkPrintingView && (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}
    </>
  );
}

function convertToWords(num: number): string {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];

  const inWords = (numToConvert: number): string => {
    let numStr = numToConvert.toString();
    if (numStr.length > 9) return 'overflow'; 

    const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (parseInt(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]).trim() + ' Crore ' : '';
    str += (parseInt(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]).trim() + ' Lakh ' : '';
    str += (parseInt(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]).trim() + ' Thousand ' : '';
    str += (parseInt(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]).trim() + ' Hundred ' : '';
    str += (parseInt(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]).trim() : '';
    return str.replace(/\s+/g, ' ').trim();
  };

  if (num === 0) return "Zero";
  
  const roundedNum = parseFloat(num.toFixed(2)); 
  const [wholePartStr, decimalPartStr = "00"] = roundedNum.toString().split('.');
  const wholePart = parseInt(wholePartStr);
  const decimalPart = parseInt(decimalPartStr.padEnd(2, '0'));

  let words = inWords(wholePart);
  if (decimalPart > 0) {
    words += (words && words !== "Zero" && words !== "overflow" ? ' ' : '') + 'and ' + inWords(decimalPart) + ' Paise';
  } else if (!words || words === "Zero" || words === "overflow") {
    words = words || "Zero";
  }
  return words.trim() ? words.trim() : 'Zero';
}

    