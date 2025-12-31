"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, Loader2, Printer, XCircle } from "lucide-react";
import Image from "next/image";
import { getDaysInMonth, parseISO, isValid, format, getMonth, getYear, addMonths, startOfMonth, endOfMonth, isBefore, isEqual, isAfter } from "date-fns";
import { useToast } from "@/hooks/use-toast";

import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateMonthlySalaryComponents } from "@/lib/salary-calculations";
import {
  calculateEmployeeLeaveDetailsForPeriod,
  calculateMonthsOfService,
  MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL,
  CL_ACCRUAL_RATE,
  SL_ACCRUAL_RATE,
  PL_ACCRUAL_RATE
} from "@/lib/hr-calculations";
import type { OpeningLeaveBalance, LeaveApplication } from "@/lib/hr-types";
import { getCompanyConfig, type CompanyConfig } from "@/lib/google-sheets";


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
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "novita_performance_deductions_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_SALARY_EDITS_PREFIX = "novita_salary_sheet_edits_v1_";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";
const LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY = "novita_current_logged_in_user_display_name_v1";

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
  workingDays: number;
  totalLeavesTakenThisMonth: number;
  period: string;
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

interface ActivityLogEntry {
  timestamp: string;
  message: string;
  user: string;
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = [];

    const loggedInUser = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY) || "System";

    activities.unshift({ timestamp: new Date().toISOString(), message, user: loggedInUser });
    activities = activities.slice(0, 10); 
    localStorage.setItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error adding to activity log:", error);
  }
};

// Reusable Salary Slip Card Component
interface SalarySlipCardProps {
  sData: SalarySlipDataType;
  companyConfig: CompanyConfig;
  companyDetails: CompanyDetail;
  nextMonthName: string;
  nextMonthYear: number;
  showPageBreak?: boolean;
}

function SalarySlipCard({ sData, companyConfig, companyDetails, nextMonthName, nextMonthYear, showPageBreak }: SalarySlipCardProps) {
  return (
    <Card className={`shadow-xl salary-slip-page ${showPageBreak ? 'print-page-break-before' : ''} mb-4`}>
      <CardHeader className="bg-muted/30 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            {/* Dynamic Logo from Google Sheet Config */}
            {companyConfig.company_logo ? (
              <Image
                src={companyConfig.company_logo}
                alt={`${companyConfig.company_name} Logo`}
                width={160}
                height={60}
                className="h-16 w-auto mb-2 object-contain"
                unoptimized
              />
            ) : (
              <div className="h-16 w-40 mb-2 bg-primary/10 flex items-center justify-center rounded">
                <span className="text-xl font-bold text-primary">
                  {companyConfig.company_name || companyDetails.logoText}
                </span>
              </div>
            )}
            <p className="text-sm font-semibold">{companyConfig.company_name || companyDetails.name}</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line">{companyDetails.address}</p>
          </div>
          <div className="text-right mt-4 sm:mt-0">
            <CardTitle className="text-2xl">Salary Slip</CardTitle>
            <CardDescription>For {sData.period}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 text-sm">
          <div className="space-y-1">
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
          <div className="space-y-1">
            <h3 className="font-semibold mb-2">Attendance Summary</h3>
            <p><strong>Absent Days:</strong> {sData.absentDays.toFixed(1)}</p>
            <p><strong>Week Offs:</strong> {sData.weekOffs.toFixed(1)}</p>
            <p><strong>Paid Holidays:</strong> {sData.paidHolidays.toFixed(1)}</p>
            <p><strong>Working Days:</strong> {sData.workingDays.toFixed(1)}</p>
            <p><strong>Total Leaves Taken:</strong> {sData.totalLeavesTakenThisMonth.toFixed(1)}</p>
            <p className="invisible">&nbsp;</p>
            <Separator className="my-4" />
            <h3 className="font-semibold mb-2">Leave Used ({sData.period})</h3>
            <p>CL: {sData.leaveUsedThisMonth.cl.toFixed(1)} | SL: {sData.leaveUsedThisMonth.sl.toFixed(1)} | PL: {sData.leaveUsedThisMonth.pl.toFixed(1)}</p>
            <Separator className="my-4" />
            <h3 className="font-semibold mb-2">Leave Balance (Opening {nextMonthName} {nextMonthYear > 0 ? nextMonthYear : ''})</h3>
            <p>CL: {sData.leaveBalanceNextMonth.cl.toFixed(1)} | SL: {sData.leaveBalanceNextMonth.sl.toFixed(1)} | PL: {sData.leaveBalanceNextMonth.pl.toFixed(1)}</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-lg mb-2">Earnings</h3>
            {sData.earnings.map(item => (
              <div key={`earning-${item.component}-${sData.employeeId}-${sData.period}`} className="flex justify-between py-1 border-b border-dashed">
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
              <div key={`deduction-${item.component}-${sData.employeeId}-${sData.period}`} className="flex justify-between py-1 border-b border-dashed">
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
  );
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
  const [allLeaveApplications, setAllLeaveApplications] = React.useState<LeaveApplication[]>([]);

  // Company Config from Google Sheet
  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: ''
  });
  const [isConfigLoading, setIsConfigLoading] = React.useState(true);

  const [slipData, setSlipData] = React.useState<SalarySlipDataType | null>(null);
  const [bulkSlipsData, setBulkSlipsData] = React.useState<SalarySlipDataType[]>([]);
  const [isBulkPrintingView, setIsBulkPrintingView] = React.useState(false);
  const [showSlip, setShowSlip] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);

  const [selectedDivisionForMultiMonth, setSelectedDivisionForMultiMonth] = React.useState<string | undefined>();
  const [filteredEmployeesForMultiMonth, setFilteredEmployeesForMultiMonth] = React.useState<EmployeeDetail[]>([]);
  const [selectedEmployeeForMultiMonth, setSelectedEmployeeForMultiMonth] = React.useState<string | undefined>();
  const [fromMonthMulti, setFromMonthMulti] = React.useState<string>('');
  const [fromYearMulti, setFromYearMulti] = React.useState<number>(0);
  const [toMonthMulti, setToMonthMulti] = React.useState<string>('');
  const [toYearMulti, setToYearMulti] = React.useState<number>(0);
  const [isLoadingMultiMonth, setIsLoadingMultiMonth] = React.useState(false);

  // Fetch Company Config from Google Sheet
  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        setCompanyConfig(config);
      } catch (error) {
        console.error('Error fetching company config:', error);
      } finally {
        setIsConfigLoading(false);
      }
    }
    fetchConfig();
  }, []);

  React.useEffect(() => {
    const year = new Date().getFullYear();
    const month = months[new Date().getMonth()];
    setCurrentYear(year);
    setAvailableYears(Array.from({ length: 5 }, (_, i) => year - i));
    setSelectedMonth(month);
    setSelectedYear(year);
    setFromMonthMulti(month);
    setFromYearMulti(year);
    setToMonthMulti(month);
    setToYearMulti(year);
  }, []);

  React.useEffect(() => {
    setIsLoadingEmployees(true);
    if (typeof window !== 'undefined') {
        try {
            const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
            setAllEmployees(storedEmployees ? JSON.parse(storedEmployees) : []);

            const storedOB = localStorage.getItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
            setOpeningBalances(storedOB ? JSON.parse(storedOB) : []);

            const storedPerfDeductions = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
            setAllPerformanceDeductions(storedPerfDeductions ? JSON.parse(storedPerfDeductions) : []);

            const storedLeaveApps = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
            setAllLeaveApplications(storedLeaveApps ? JSON.parse(storedLeaveApps) : []);

        } catch (error) {
            console.error("Error loading initial data for Salary Slip page:", error);
            toast({ title: "Data Load Error", description: "Could not load some initial data from localStorage. Salary slip generation might be affected.", variant: "destructive" });
            setAllEmployees([]);
            setOpeningBalances([]);
            setAllPerformanceDeductions([]);
            setAllLeaveApplications([]);
        }
    }
    setIsLoadingEmployees(false);
  }, []);

  React.useEffect(() => {
    if (selectedDivision && allEmployees.length > 0) {
      const filtered = allEmployees
        .filter(emp => emp.division === selectedDivision)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFilteredEmployeesForSlip(filtered);
      if (selectedEmployeeId && !filtered.some(emp => emp.id === selectedEmployeeId)) {
        setSelectedEmployeeId(undefined);
      }
    } else {
      setFilteredEmployeesForSlip([]);
      setSelectedEmployeeId(undefined);
    }
  }, [selectedDivision, allEmployees]);


  React.useEffect(() => {
    if (selectedDivisionForMultiMonth && allEmployees.length > 0) {
      const filtered = allEmployees
        .filter(emp => emp.division === selectedDivisionForMultiMonth)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFilteredEmployeesForMultiMonth(filtered);
      if (selectedEmployeeForMultiMonth && !filtered.some(emp => emp.id === selectedEmployeeForMultiMonth)) {
        setSelectedEmployeeForMultiMonth(undefined); 
      }
    } else { 
      setFilteredEmployeesForMultiMonth([]);
      setSelectedEmployeeForMultiMonth(undefined); 
    }
  }, [selectedDivisionForMultiMonth, allEmployees]);


  const generateSlipDataForEmployee = (
    employee: EmployeeDetail,
    month: string,
    year: number,
    localOpeningBalances: OpeningLeaveBalance[],
    localAllPerformanceDeductions: PerformanceDeductionEntry[],
    localAllLeaveApplications: LeaveApplication[]
  ): SalarySlipDataType | null => {
    const monthIndex = months.indexOf(month);
    if (monthIndex === -1) return null;

    let parsedEmployeeDOJ: Date | null = null;
    if (employee && typeof employee.doj === 'string' && employee.doj.trim() !== '') {
        const tempDOJ = parseISO(employee.doj);
        if (isValid(tempDOJ)) {
            parsedEmployeeDOJ = tempDOJ;
        } else {
            console.warn(`Employee ${employee.code} has an invalid DOJ string: "${employee.doj}" in master data. Cannot parse for slip generation.`);
            return null;
        }
    } else {
      console.warn(`Missing DOJ for employee ${employee.code}. Cannot generate slip.`);
      return null;
    }

    const selectedPeriodStartDate = startOfMonth(new Date(year, monthIndex, 1));
    const selectedPeriodEndDate = endOfMonth(selectedPeriodStartDate);

    if (isAfter(parsedEmployeeDOJ, selectedPeriodEndDate)) {
      return null; 
    }
    if (employee.dor) {
      const employeeDOR = parseISO(employee.dor);
      if (isValid(employeeDOR) && isBefore(employeeDOR, selectedPeriodStartDate)) {
        return null; 
      }
    }

    let attendanceForMonthEmployee: MonthlyEmployeeAttendance | undefined;
    let salaryEditsForEmployee: EditableSalaryFields | undefined;

    if (typeof window !== 'undefined') {
        const attendanceStorageKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${month}_${year}`;
        const storedAttendanceForMonth = localStorage.getItem(attendanceStorageKey);
        if (storedAttendanceForMonth) {
            try {
                const allMonthAttendance: MonthlyEmployeeAttendance[] = JSON.parse(storedAttendanceForMonth);
                attendanceForMonthEmployee = allMonthAttendance.find(att => att.code === employee.code);
            } catch (e) {
                console.warn(`Error parsing attendance for ${month} ${year} for employee ${employee.code}:`, e);
            }
        }

        if (!attendanceForMonthEmployee || !attendanceForMonthEmployee.attendance || attendanceForMonthEmployee.attendance.length === 0) {
            return null; 
        }

        const salaryEditsStorageKey = `${LOCAL_STORAGE_SALARY_EDITS_PREFIX}${month}_${year}`;
        const storedSalaryEditsForMonth = localStorage.getItem(salaryEditsStorageKey);
        if (storedSalaryEditsForMonth) {
            try {
                const allMonthEdits: Record<string, EditableSalaryFields> = JSON.parse(storedSalaryEditsForMonth);
                salaryEditsForEmployee = allMonthEdits[employee.id];
            } catch (e) {
                 console.warn(`Error parsing salary edits for ${month} ${year} for employee ${employee.code}:`, e);
            }
        }
    } else {
        return null; 
    }
    

    const attendanceStatuses: string[] = attendanceForMonthEmployee.attendance;
    const salaryEdits = salaryEditsForEmployee || {};
    const performanceDeductionEntry = localAllPerformanceDeductions.find(
      pd => pd.employeeCode === employee.code && pd.month === month && pd.year === year
    );
    const performanceDeductionAmount = performanceDeductionEntry?.amount || 0;

    const totalDaysInMonthValue = getDaysInMonth(selectedPeriodStartDate);
    const dailyStatuses = attendanceStatuses.slice(0, totalDaysInMonthValue);

    let actualPayDaysValue = 0;
    let usedCLInMonth = 0, usedSLInMonth = 0, usedPLInMonth = 0;
    let absentDaysCount = 0;
    let weekOffsCount = 0;
    let paidHolidaysCount = 0;
    let halfDaysTaken = 0;
    let workingDaysCount = 0;


    dailyStatuses.forEach(status => {
      if (status === 'P') {actualPayDaysValue++; workingDaysCount++; }
      else if (status === 'W') { actualPayDaysValue++; weekOffsCount++; }
      else if (status === 'PH') { actualPayDaysValue++; paidHolidaysCount++; }
      else if (status === 'CL') { actualPayDaysValue++; usedCLInMonth++; }
      else if (status === 'SL') { actualPayDaysValue++; usedSLInMonth++; }
      else if (status === 'PL') { actualPayDaysValue++; usedPLInMonth++; }
      else if (status === 'HD') { actualPayDaysValue += 0.5; halfDaysTaken++; workingDaysCount +=0.5; }
      else if (status === 'A') absentDaysCount += 1;
    });
    actualPayDaysValue = Math.min(actualPayDaysValue, totalDaysInMonthValue);
    const finalAbsentDays = absentDaysCount + (halfDaysTaken * 0.5);
    const totalLeavesTakenThisMonth = usedCLInMonth + usedSLInMonth + usedPLInMonth;

    const monthlyComp = calculateMonthlySalaryComponents(employee, year, monthIndex);
    const payFactor = totalDaysInMonthValue > 0 ? actualPayDaysValue / totalDaysInMonthValue : 0;

    const earningsList = [
      { component: "Basic Salary", amount: (monthlyComp.basic || 0) * payFactor },
      { component: "House Rent Allowance (HRA)", amount: (monthlyComp.hra || 0) * payFactor },
      { component: "Conveyance Allowance (CA)", amount: (monthlyComp.ca || 0) * payFactor },
      { component: "Medical Allowance", amount: (monthlyComp.medical || 0) * payFactor },
      { component: "Other Allowance", amount: (monthlyComp.otherAllowance || 0) * payFactor },
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

    const leaveDetailsEOM = calculateEmployeeLeaveDetailsForPeriod(
        employee, year, monthIndex,
        localAllLeaveApplications.filter(app => app.employeeId === employee.id),
        localOpeningBalances
    );

    let nextMonthOpeningCL = 0, nextMonthOpeningSL = 0, nextMonthOpeningPL = 0;
    const nextMonthDateObject = addMonths(selectedPeriodStartDate, 1);
    const nextMonthIdx = getMonth(nextMonthDateObject);
    const nextYr = getYear(nextMonthDateObject);

    const closingBalanceCLForSelectedMonth = leaveDetailsEOM.balanceCLAtMonthEnd - usedCLInMonth;
    const closingBalanceSLForSelectedMonth = leaveDetailsEOM.balanceSLAtMonthEnd - usedSLInMonth;
    const closingBalancePLForSelectedMonth = leaveDetailsEOM.balancePLAtMonthEnd - usedPLInMonth;

    const obForNextFY = localOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === nextYr);

    if (nextMonthIdx === 3) { 
        nextMonthOpeningCL = obForNextFY?.openingCL || 0;
        nextMonthOpeningSL = obForNextFY?.openingSL || 0;
        if (obForNextFY && obForNextFY.openingPL !== undefined) {
          nextMonthOpeningPL = obForNextFY.openingPL;
        } else { 
          nextMonthOpeningPL = closingBalancePLForSelectedMonth;
        }
    } else {
        nextMonthOpeningCL = closingBalanceCLForSelectedMonth;
        nextMonthOpeningSL = closingBalanceSLForSelectedMonth;
        nextMonthOpeningPL = closingBalancePLForSelectedMonth;
    }

    const serviceMonthsAtNextMonthStart = calculateMonthsOfService(employee.doj, startOfMonth(nextMonthDateObject));
    const isEligibleForAccrualNextMonth = serviceMonthsAtNextMonthStart >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

    if (isEligibleForAccrualNextMonth) {
        nextMonthOpeningCL += CL_ACCRUAL_RATE;
        nextMonthOpeningSL += SL_ACCRUAL_RATE;
        nextMonthOpeningPL += PL_ACCRUAL_RATE;
    }

    let formattedDOJ = "N/A";
    if (parsedEmployeeDOJ && isValid(parsedEmployeeDOJ)) {
        formattedDOJ = format(parsedEmployeeDOJ, "dd MMM yyyy");
    }


    return {
      employeeId: employee.code, name: employee.name, designation: employee.designation,
      joinDate: formattedDOJ,
      division: employee.division || "N/A", totalDaysInMonth: totalDaysInMonthValue, actualPayDays: actualPayDaysValue,
      earnings: earningsList, deductions: deductionsList,
      totalEarnings: calculatedTotalEarnings, totalDeductions: calculatedTotalDeductions, netSalary: calculatedNetSalary,
      leaveUsedThisMonth: { cl: usedCLInMonth, sl: usedSLInMonth, pl: usedPLInMonth },
      leaveBalanceNextMonth: { cl: nextMonthOpeningCL, sl: nextMonthOpeningSL, pl: nextMonthOpeningPL },
      absentDays: finalAbsentDays, weekOffs: weekOffsCount, paidHolidays: paidHolidaysCount,
      workingDays: workingDaysCount, 
      totalLeavesTakenThisMonth: totalLeavesTakenThisMonth,
      period: `${format(selectedPeriodStartDate, "MMMM")} ${year}`,
    };
  };


  const handleGenerateSlip = () => {
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

    const generatedData = generateSlipDataForEmployee(
        employee, selectedMonth, selectedYear,
        openingBalances, allPerformanceDeductions, allLeaveApplications
    );

    if (generatedData) {
      setSlipData(generatedData);
      setShowSlip(true);
      addActivityLog(`Salary slip generated for ${employee.name} (${selectedMonth} ${selectedYear}).`);
    } else {
      toast({ title: "Cannot Generate Slip", description: `Could not generate slip for ${employee.name}. Required data (e.g. attendance) might be missing for ${selectedMonth} ${selectedYear}, or employee was not active/employed during this period.`, variant: "destructive", duration: 7000 });
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
      .sort((a,b) => a.code.localeCompare(b.code));

    if (employeesForSummary.length === 0) {
      toast({ title: "No Employees", description: `No employees found for ${selectedDivision} division.`, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const csvRows: string[][] = [];
    const headers = ["Employee (Code-Name-Designation)", "Gross Salary", "Total Earnings", "Total Deductions", "Net Salary"];
    csvRows.push(headers);

    let processedCount = 0;
    for (const emp of employeesForSummary) {
      const salaryComponents = calculateMonthlySalaryComponents(emp, selectedYear, months.indexOf(selectedMonth));
      const slipSummaryData = generateSlipDataForEmployee(
          emp, selectedMonth, selectedYear,
          openingBalances, allPerformanceDeductions, allLeaveApplications
      );
      if (slipSummaryData) {
         csvRows.push([
          `"${emp.code}-${emp.name}-${emp.designation}"`,
          salaryComponents.totalGross.toFixed(2),
          slipSummaryData.totalEarnings.toFixed(2),
          slipSummaryData.totalDeductions.toFixed(2),
          slipSummaryData.netSalary.toFixed(2)
        ]);
        processedCount++;
      }
    }

    if (processedCount === 0) {
        toast({ title: "No Data for CSV", description: `No employees in ${selectedDivision} had necessary data (e.g., attendance) for ${selectedMonth} ${selectedYear} to generate summaries, or were ineligible. CSV not generated.`, variant: "destructive", duration: 7000 });
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

    addActivityLog(`Salary summaries CSV for ${selectedDivision} (${selectedMonth} ${selectedYear}) downloaded.`);
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
        .sort((a, b) => a.code.localeCompare(b.code));

    if (employeesToPrint.length === 0) {
      toast({ title: "No Employees", description: `No employees found for ${selectedDivision} division to print slips.`, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const generatedSlips: SalarySlipDataType[] = [];
    let countWithData = 0;
    let countSkipped = 0;

    for (const emp of employeesToPrint) {
        const sData = generateSlipDataForEmployee(
            emp, selectedMonth, selectedYear,
            openingBalances, allPerformanceDeductions, allLeaveApplications
        );
        if (sData) {
            generatedSlips.push(sData);
            countWithData++;
        } else {
            countSkipped++;
        }
    }

    if (countWithData === 0) {
      toast({ title: "No Slips Generated", description: `No employees in ${selectedDivision} had necessary data (e.g. attendance) or were eligible for ${selectedMonth} ${selectedYear}. Cannot print slips.`, variant: "destructive", duration: 7000 });
      setIsLoading(false);
      return;
    }

    setBulkSlipsData(generatedSlips);
    setIsBulkPrintingView(true);
    addActivityLog(`Bulk salary slips generated for ${selectedDivision} (${selectedMonth} ${selectedYear}) - ${countWithData} slips.`);
     if (countSkipped > 0) {
        toast({ title: "Note", description: `${countSkipped} employee(s) were skipped due to missing attendance data or ineligibility for the selected period.`, duration: 7000});
    }
  };

  const handleGenerateMultiMonthSlips = () => {
    if (!selectedDivisionForMultiMonth || !selectedEmployeeForMultiMonth || !fromMonthMulti || fromYearMulti === 0 || !toMonthMulti || toYearMulti === 0) {
      toast({ title: "Selection Missing", description: "Please select division, employee, and a valid date range for multi-month slips.", variant: "destructive" });
      return;
    }

    const fromDate = startOfMonth(new Date(fromYearMulti, months.indexOf(fromMonthMulti)));
    const toDate = endOfMonth(new Date(toYearMulti, months.indexOf(toMonthMulti)));

    if (isBefore(toDate, fromDate)) {
      toast({ title: "Invalid Date Range", description: "'From' date cannot be after 'To' date.", variant: "destructive" });
      return;
    }

    setIsLoadingMultiMonth(true);
    setShowSlip(false);
    setSlipData(null);

    const employee = allEmployees.find(e => e.id === selectedEmployeeForMultiMonth);
    if (!employee) {
      toast({ title: "Employee Not Found", description: "Selected employee details could not be found.", variant: "destructive" });
      setIsLoadingMultiMonth(false);
      return;
    }

    const generatedSlips: SalarySlipDataType[] = [];
    let currentLoopDate = fromDate;
    let countSkipped = 0;

    while (isBefore(currentLoopDate, toDate) || isEqual(currentLoopDate, toDate)) {
      const currentMonthName = months[getMonth(currentLoopDate)];
      const currentYearValue = getYear(currentLoopDate);

      const sData = generateSlipDataForEmployee(
        employee, currentMonthName, currentYearValue,
        openingBalances, allPerformanceDeductions, allLeaveApplications
      );
      if (sData) {
        generatedSlips.push(sData);
      } else {
        countSkipped++;
      }
      if (getMonth(currentLoopDate) === getMonth(toDate) && getYear(currentLoopDate) === getYear(toDate)) {
        break;
      }
      currentLoopDate = addMonths(currentLoopDate, 1);
    }

    if (generatedSlips.length === 0) {
      toast({ title: "No Slips Generated", description: `No data found or employee ineligible for ${employee.name} within the selected date range to generate slips. (${countSkipped} months skipped).`, variant: "destructive", duration: 7000 });
      setIsLoadingMultiMonth(false);
      return;
    }

    setBulkSlipsData(generatedSlips);
    setIsBulkPrintingView(true);
    addActivityLog(`Multi-month salary slips generated for ${employee.name} (${format(fromDate, 'MMM yyyy')} to ${format(toDate, 'MMM yyyy')}).`);
    if (countSkipped > 0) {
        toast({ title: "Note", description: `Slips for ${countSkipped} month(s) were skipped due to missing attendance data or ineligibility.`, duration: 7000});
    }
    setIsLoadingMultiMonth(false);
  };


  React.useEffect(() => {
    if (isBulkPrintingView && bulkSlipsData.length > 0) {
      let printTitle = `SalarySlips-${selectedMonth}-${selectedYear}`;
      if(bulkSlipsData.length > 0 && bulkSlipsData[0].period !== bulkSlipsData[bulkSlipsData.length -1]?.period){
          const empName = bulkSlipsData[0].name.replace(/\s+/g, '_');
          const fromPeriod = bulkSlipsData[0].period.replace(/\s+/g, '-');
          const toPeriod = bulkSlipsData[bulkSlipsData.length - 1].period.replace(/\s+/g, '-');
          printTitle = `Slips_${empName}_${fromPeriod}_to_${toPeriod}`;
      } else if (bulkSlipsData.length > 0) {
          printTitle = `AllSlips-${selectedDivision || 'AllDivisions'}-${bulkSlipsData[0].period.replace(/\s+/g, '-')}`;
      }

      const originalTitle = document.title;
      document.title = printTitle;

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
        } finally {
            setIsLoading(false);
            setIsLoadingMultiMonth(false);
            document.title = originalTitle;
        }
      }, 500);
      return () => {
        clearTimeout(timer);
        document.title = originalTitle;
      };
    }
  }, [isBulkPrintingView, bulkSlipsData, selectedDivision, selectedMonth, selectedYear, toast]);


  const currentCompanyDetails = selectedDivision
    ? COMPANY_DETAILS_MAP[selectedDivision as keyof typeof COMPANY_DETAILS_MAP] || COMPANY_DETAILS_MAP.Default
    : COMPANY_DETAILS_MAP.Default;

  // Helper function to get next month info
  const getNextMonthInfo = (period: string) => {
    const parts = period.split(' ');
    const monthStr = parts[0];
    const yearStr = parts[1];
    const parsedYear = parseInt(yearStr, 10);
    const parsedMonthIndex = months.indexOf(monthStr);
    
    if (!isNaN(parsedYear) && parsedMonthIndex !== -1) {
      const nextMonthDate = addMonths(new Date(parsedYear, parsedMonthIndex, 1), 1);
      return {
        name: format(nextMonthDate, "MMMM"),
        year: getYear(nextMonthDate)
      };
    }
    return { name: "N/A", year: 0 };
  };

  let nextMonthNameForDisplay = "";
  let nextMonthYearNumForDisplay = 0;

  if (showSlip && slipData && selectedMonth && selectedYear > 0) {
    const currentSlipMonthIndex = months.indexOf(selectedMonth);
    if (currentSlipMonthIndex !== -1) {
        const nextMonthDateForSlipDisplay = addMonths(new Date(selectedYear, currentSlipMonthIndex, 1), 1);
        nextMonthNameForDisplay = format(nextMonthDateForSlipDisplay, "MMMM");
        nextMonthYearNumForDisplay = getYear(nextMonthDateForSlipDisplay);
    }
  }


  if ((isLoadingEmployees || isConfigLoading) && !selectedMonth && !selectedYear) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  // Bulk Printing View
  if (isBulkPrintingView) {
    return (
      <div id="salary-slip-printable-area">
        <Button
          onClick={() => {
            setIsBulkPrintingView(false);
            setBulkSlipsData([]);
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

          const nextMonthInfo = getNextMonthInfo(sData.period);

          return (
            <SalarySlipCard
              key={`bulk-slip-${sData.employeeId}-${index}`}
              sData={sData}
              companyConfig={companyConfig}
              companyDetails={empDivisionCompanyDetails}
              nextMonthName={nextMonthInfo.name}
              nextMonthYear={nextMonthInfo.year}
              showPageBreak={index > 0}
            />
          );
        })}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Salary Slip Generator" description="Generate and download monthly salary slips for employees. Data is loaded from localStorage for this prototype.">
          <Button
            onClick={handleDownloadAllSummaries}
            disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading}
            variant="outline"
          >
            {isLoading && !bulkSlipsData.length ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
             Download All Summaries (CSV)
          </Button>
          <Button
            onClick={handlePrintAllSlips}
            disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading}
            variant="outline"
          >
            {isLoading && bulkSlipsData.length > 0 && !showSlip ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Print All Slips (PDF)
          </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow print:hidden">
        <CardHeader>
          <CardTitle>Select Criteria (Single Slip / Division Bulk Print)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth} >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => <SelectItem key={`single-month-${month}`} value={month}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(val) => setSelectedYear(parseInt(val))}>
             <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
                {availableYears.map(year => <SelectItem key={`single-year-${year}`} value={year.toString()}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
           <Select value={selectedDivision} onValueChange={(value) => {
             setSelectedDivision(value);
             setSelectedEmployeeId(undefined); 
             setShowSlip(false);
             setSlipData(null);
           }}>
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
              <SelectValue placeholder="Select Employee for Single Slip" />
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
            disabled={!selectedMonth || !selectedEmployeeId || selectedYear === 0 || !selectedDivision || isLoading}
          >
            {isLoading && !bulkSlipsData.length && showSlip ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
             Generate Single Slip
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow print:hidden">
        <CardHeader>
          <CardTitle>Multi-Month Salary Slips (Single Employee)</CardTitle>
          <CardDescription>Generate and print all salary slips for a single employee over a selected date range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
            
                 <Select 
                    value={selectedDivisionForMultiMonth} 
                    onValueChange={(value) => {
                        setSelectedDivisionForMultiMonth(value);
                        setSelectedEmployeeForMultiMonth(undefined); 
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select Division" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="FMCG">FMCG Division</SelectItem>
                        <SelectItem value="Wellness">Wellness Division</SelectItem>
                    </SelectContent>
                </Select>
            
             <Select 
                value={selectedEmployeeForMultiMonth} 
                onValueChange={setSelectedEmployeeForMultiMonth}
                disabled={!selectedDivisionForMultiMonth || filteredEmployeesForMultiMonth.length === 0}
            >
                <SelectTrigger>
                <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                {filteredEmployeesForMultiMonth.length > 0 ? (
                    filteredEmployeesForMultiMonth.map(emp => (
                    <SelectItem key={`multi-emp-${emp.id}`} value={emp.id}>
                        {emp.name} ({emp.code}) - {emp.status}
                    </SelectItem>
                    ))
                ) : (
                    <SelectItem value="no-emp-multi-filtered" disabled>
                        {selectedDivisionForMultiMonth ? `No employees in ${selectedDivisionForMultiMonth}` : "Select division first"}
                    </SelectItem>
                )}
                </SelectContent>
            </Select>
            <div/> {/* Spacer for grid alignment */}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
            <Select value={fromMonthMulti} onValueChange={setFromMonthMulti}>
              <SelectTrigger> <SelectValue placeholder="From Month" /> </SelectTrigger>
              <SelectContent> {months.map(m => <SelectItem key={`from-multi-${m}`} value={m}>{m}</SelectItem>)} </SelectContent>
            </Select>
            <Select value={fromYearMulti > 0 ? fromYearMulti.toString() : ""} onValueChange={val => setFromYearMulti(parseInt(val))}>
              <SelectTrigger> <SelectValue placeholder="From Year" /> </SelectTrigger>
              <SelectContent> {availableYears.map(y => <SelectItem key={`from-multi-${y}`} value={y.toString()}>{y}</SelectItem>)} </SelectContent>
            </Select>
            <div/> {/* Spacer for grid alignment */}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
             <Select value={toMonthMulti} onValueChange={setToMonthMulti}>
              <SelectTrigger> <SelectValue placeholder="To Month" /> </SelectTrigger>
              <SelectContent> {months.map(m => <SelectItem key={`to-multi-${m}`} value={m}>{m}</SelectItem>)} </SelectContent>
            </Select>
            <Select value={toYearMulti > 0 ? toYearMulti.toString() : ""} onValueChange={val => setToYearMulti(parseInt(val))}>
              <SelectTrigger> <SelectValue placeholder="To Year" /> </SelectTrigger>
              <SelectContent> {availableYears.map(y => <SelectItem key={`to-multi-${y}`} value={y.toString()}>{y}</SelectItem>)} </SelectContent>
            </Select>
             <Button
              onClick={handleGenerateMultiMonthSlips}
              disabled={!selectedDivisionForMultiMonth || !selectedEmployeeForMultiMonth || !fromMonthMulti || fromYearMulti === 0 || !toMonthMulti || toYearMulti === 0 || isLoadingMultiMonth}
              className="md:mt-auto" 
            >
              {isLoadingMultiMonth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Generate & Print Multi-Month Slips
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Single Slip Preview */}
      {showSlip && slipData && !isBulkPrintingView && (
        <>
          <SalarySlipCard
            sData={slipData}
            companyConfig={companyConfig}
            companyDetails={currentCompanyDetails}
            nextMonthName={nextMonthNameForDisplay}
            nextMonthYear={nextMonthYearNumForDisplay}
          />
          <Card className="shadow-md print:hidden">
            <CardFooter className="p-6 border-t">
              <p className="text-xs text-muted-foreground mr-auto">Use your browser's 'Save as PDF' option in the print dialog to download.</p>
              <Button
                onClick={() => {
                  if (slipData) {
                    const originalTitle = document.title;
                    document.title = `${slipData.employeeId}-${slipData.name}-SalarySlip-${selectedMonth}-${selectedYear}`;
                    try {
                      window.print();
                    } catch (e) {
                      console.error('Error calling window.print():', e);
                      toast({
                        title: "Print Error",
                        description: "Could not open print dialog. Please check browser console.",
                        variant: "destructive",
                      });
                    } finally {
                      document.title = originalTitle;
                    }
                  }
                }}
                className="ml-auto print:hidden"
              >
                <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
              </Button>
            </CardFooter>
          </Card>
        </>
      )}
       {!showSlip && !isLoading && !isLoadingEmployees && !isBulkPrintingView && (
        <Card className="shadow-md hover:shadow-lg transition-shadow items-center flex justify-center py-12">
          <CardContent className="text-center text-muted-foreground">
            <p>Please select criteria to generate a salary slip. Data is loaded from localStorage for this prototype.</p>
          </CardContent>
        </Card>
      )}
      {(isLoading || isLoadingEmployees || isLoadingMultiMonth) && !isBulkPrintingView && !showSlip && (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}
    </>
  );
}

function convertToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return "Zero Rupees Only";
  if (num < 0) return "Minus " + convertToWords(Math.abs(num));

  const convertTwoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
  };

  const convertThreeDigits = (n: number): string => {
    if (n === 0) return '';
    if (n < 100) return convertTwoDigits(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertTwoDigits(n % 100) : '');
  };

  const roundedNum = parseFloat(num.toFixed(2));
  const wholePart = Math.floor(roundedNum);
  const decimalPart = Math.round((roundedNum - wholePart) * 100);

  let words = '';

  if (wholePart === 0) {
    words = '';
  } else if (wholePart < 1000) {
    words = convertThreeDigits(wholePart);
  } else if (wholePart < 100000) {
    // Thousands (Indian system)
    const thousands = Math.floor(wholePart / 1000);
    const remainder = wholePart % 1000;
    words = convertTwoDigits(thousands) + ' Thousand';
    if (remainder > 0) {
      words += ' ' + convertThreeDigits(remainder);
    }
  } else if (wholePart < 10000000) {
    // Lakhs (Indian system)
    const lakhs = Math.floor(wholePart / 100000);
    const remainder = wholePart % 100000;
    words = convertTwoDigits(lakhs) + ' Lakh';
    if (remainder > 0) {
      const thousands = Math.floor(remainder / 1000);
      const rest = remainder % 1000;
      if (thousands > 0) {
        words += ' ' + convertTwoDigits(thousands) + ' Thousand';
      }
      if (rest > 0) {
        words += ' ' + convertThreeDigits(rest);
      }
    }
  } else {
    // Crores (Indian system)
    const crores = Math.floor(wholePart / 10000000);
    const remainder = wholePart % 10000000;
    words = convertTwoDigits(crores) + ' Crore';
    if (remainder > 0) {
      const lakhs = Math.floor(remainder / 100000);
      const restAfterLakh = remainder % 100000;
      if (lakhs > 0) {
        words += ' ' + convertTwoDigits(lakhs) + ' Lakh';
      }
      const thousands = Math.floor(restAfterLakh / 1000);
      const rest = restAfterLakh % 1000;
      if (thousands > 0) {
        words += ' ' + convertTwoDigits(thousands) + ' Thousand';
      }
      if (rest > 0) {
        words += ' ' + convertThreeDigits(rest);
      }
    }
  }

  // Add Rupees and Paise
  if (wholePart > 0 && decimalPart > 0) {
    words += ' Rupees and ' + convertTwoDigits(decimalPart) + ' Paise Only';
  } else if (wholePart > 0) {
    words += ' Rupees Only';
  } else if (decimalPart > 0) {
    words = convertTwoDigits(decimalPart) + ' Paise Only';
  } else {
    words = 'Zero Rupees Only';
  }

  return words.trim();
}