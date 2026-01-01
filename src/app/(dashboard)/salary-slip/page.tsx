
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, Loader2, Printer, XCircle } from "lucide-react";
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
  PL_ACCRUAL_RATE,
  OFFICE_STAFF_CL_ACCRUAL_RATE,
  OFFICE_STAFF_SL_ACCRUAL_RATE,
  OFFICE_STAFF_ANNUAL_PL_GRANT,
} from "@/lib/hr-calculations";
import type { OpeningLeaveBalance, LeaveApplication } from "@/lib/hr-types";
import { getCompanyConfig, type CompanyConfig } from "@/lib/google-sheets";


const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Company Address with proper line breaks
const COMPANY_ADDRESS_LINES = [
  "37 B, Mangal Compound,",
  "Pipliya Kumar Dewas Naka,",
  "Indore - 452010, Madhya Pradesh"
];

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "novita_performance_deductions_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_SALARY_EDITS_PREFIX = "novita_salary_sheet_edits_v1_";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";

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
  professionalTax?: number;
  providentFund?: number;
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
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = [];

    activities.unshift({ timestamp: new Date().toISOString(), message });
    activities = activities.slice(0, 10); 
    localStorage.setItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error adding to activity log:", error);
  }
};

// Reusable Salary Slip Card Component with Light Theme
interface SalarySlipCardProps {
  sData: SalarySlipDataType;
  companyConfig: CompanyConfig;
  nextMonthName: string;
  nextMonthYear: number;
  showPageBreak?: boolean;
}

function SalarySlipCard({ sData, companyConfig, nextMonthName, nextMonthYear, showPageBreak }: SalarySlipCardProps) {
  return (
    <Card 
      className={`shadow-xl salary-slip-page ${showPageBreak ? 'print-page-break-before' : ''} mb-4`}
      style={{ 
        backgroundColor: '#ffffff', 
        color: '#000000',
        border: '1px solid #e0e0e0'
      }}
    >
      <CardHeader 
        className="p-6"
        style={{ 
          backgroundColor: '#f8f9fa', 
          borderBottom: '2px solid #e0e0e0' 
        }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            {companyConfig.company_logo ? (
              <img
                src={companyConfig.company_logo}
                alt={`${companyConfig.company_name} Logo`}
                style={{ 
                  height: '80px', // Reduced height
                  width: 'auto', 
                  maxWidth: '200px', // Reduced max-width
                  marginBottom: '12px', 
                  objectFit: 'contain' 
                }}
              />
            ) : (
              <div 
                style={{ 
                  height: '80px', 
                  width: '200px', 
                  marginBottom: '12px', 
                  backgroundColor: '#e8f4f8', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderRadius: '8px',
                  border: '1px solid #ccc'
                }}
              >
                <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#0066cc' }}>
                  {companyConfig.company_name ? companyConfig.company_name.charAt(0) : 'N'}
                </span>
              </div>
            )}
            <p style={{ fontSize: '16px', fontWeight: '600', color: '#000', marginBottom: '4px' }}>
              {companyConfig.company_name || 'Novita Healthcare Pvt. Ltd.'}
            </p>
            <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.6' }}>
              {COMPANY_ADDRESS_LINES.map((line, index) => (
                <p key={index} style={{ margin: 0 }}>{line}</p>
              ))}
            </div>
          </div>
          <div className="text-right mt-4 sm:mt-0">
             <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626', marginBottom: '4px' }}>
              Salary Slip
            </h2>
            <p style={{ fontSize: '18px', color: '#dc2626', fontWeight: 'bold' }}>For {sData.period}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6" style={{ backgroundColor: '#ffffff' }}>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 text-sm">
          <div className="space-y-1">
            <h3 style={{ fontWeight: '600', marginBottom: '8px', color: '#000', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
              Employee Details
            </h3>
            <p style={{ color: '#333' }}><strong>Name:</strong> {sData.name}</p>
            <p style={{ color: '#333' }}><strong>Employee ID:</strong> {sData.employeeId}</p>
            <p style={{ color: '#333' }}><strong>Designation:</strong> {sData.designation}</p>
            <p style={{ color: '#333' }}><strong>Date of Joining:</strong> {sData.joinDate}</p>
            {sData.division !== 'Office-Staff' && (
                <p style={{ color: '#333' }}><strong>Division:</strong> {sData.division}</p>
            )}
            
            <div style={{ margin: '16px 0', borderTop: '1px solid #eee' }} />
            
            <h3 style={{ fontWeight: '600', marginBottom: '8px', color: '#000', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
              Pay Details
            </h3>
            <p style={{ color: '#333' }}><strong>Total Days:</strong> {sData.totalDaysInMonth.toFixed(1)}</p>
            <p style={{ color: '#333' }}><strong>Pay Days:</strong> {sData.actualPayDays.toFixed(1)}</p>
          </div>
          
          <div className="space-y-1">
            <h3 style={{ fontWeight: '600', marginBottom: '8px', color: '#000', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
              Attendance Summary
            </h3>
            <p style={{ color: '#333' }}><strong>Absent Days:</strong> {sData.absentDays.toFixed(1)}</p>
            <p style={{ color: '#333' }}><strong>Week Offs:</strong> {sData.weekOffs.toFixed(1)}</p>
            <p style={{ color: '#333' }}><strong>Paid Holidays:</strong> {sData.paidHolidays.toFixed(1)}</p>
            <p style={{ color: '#333' }}><strong>Working Days:</strong> {sData.workingDays.toFixed(1)}</p>
            <p style={{ color: '#333' }}><strong>Total Leaves Taken:</strong> {sData.totalLeavesTakenThisMonth.toFixed(1)}</p>
            
            <div style={{ margin: '16px 0', borderTop: '1px solid #eee' }} />
            
            <h3 style={{ fontWeight: '600', marginBottom: '8px', color: '#000', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
              Leave Used ({sData.period})
            </h3>
            <p style={{ color: '#333' }}>CL: {sData.leaveUsedThisMonth.cl.toFixed(1)} | SL: {sData.leaveUsedThisMonth.sl.toFixed(1)} | PL: {sData.leaveUsedThisMonth.pl.toFixed(1)}</p>
            
            <div style={{ margin: '16px 0', borderTop: '1px solid #eee' }} />
            
            <h3 style={{ fontWeight: '600', marginBottom: '8px', color: '#000', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
              Leave Balance (Opening {nextMonthName} {nextMonthYear > 0 ? nextMonthYear : ''})
            </h3>
            <p style={{ color: '#333' }}>CL: {sData.leaveBalanceNextMonth.cl.toFixed(1)} | SL: {sData.leaveBalanceNextMonth.sl.toFixed(1)} | PL: {sData.leaveBalanceNextMonth.pl.toFixed(1)}</p>
          </div>
        </div>

        <div style={{ margin: '20px 0', borderTop: '2px solid #ddd' }} />

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <h3 style={{ fontWeight: '600', fontSize: '16px', marginBottom: '12px', color: '#000', backgroundColor: '#e8f5e9', padding: '8px', borderRadius: '4px' }}>
              Earnings
            </h3>
            {sData.earnings.map(item => (
              <div 
                key={`earning-${item.component}-${sData.employeeId}-${sData.period}`} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '6px 0', 
                  borderBottom: '1px dashed #ddd',
                  color: '#333'
                }}
              >
                <span>{item.component}</span>
                <span>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 'bold', 
                marginTop: '8px', 
                paddingTop: '8px',
                borderTop: '2px solid #4caf50',
                color: '#2e7d32'
              }}
            >
              <span>Total Earnings</span>
              <span>₹{sData.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          
          <div>
            <h3 style={{ fontWeight: '600', fontSize: '16px', marginBottom: '12px', color: '#000', backgroundColor: '#ffebee', padding: '8px', borderRadius: '4px' }}>
              Deductions
            </h3>
            {sData.deductions.map(item => (
              <div 
                key={`deduction-${item.component}-${sData.employeeId}-${sData.period}`} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '6px 0', 
                  borderBottom: '1px dashed #ddd',
                  color: '#333'
                }}
              >
                <span>{item.component}</span>
                <span>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 'bold', 
                marginTop: '8px', 
                paddingTop: '8px',
                borderTop: '2px solid #f44336',
                color: '#c62828'
              }}
            >
              <span>Total Deductions</span>
              <span>₹{sData.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div style={{ margin: '24px 0', borderTop: '2px solid #ddd' }} />

        <div style={{ textAlign: 'right' }}>
          <p style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: '#1565c0',
            backgroundColor: '#e3f2fd',
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'inline-block'
          }}>
            Net Salary: ₹{sData.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
            Amount in words: {convertToWords(sData.netSalary)}
          </p>
        </div>

        <p style={{ 
          fontSize: '11px', 
          color: '#888', 
          marginTop: '32px', 
          textAlign: 'center',
          borderTop: '1px solid #eee',
          paddingTop: '16px'
        }}>
          This is a computer-generated salary slip and does not require a signature.
        </p>
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

  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: 'Novita Healthcare Pvt. Ltd.'
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

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        if (config) {
          setCompanyConfig({
            company_logo: config.company_logo || '',
            company_name: config.company_name || 'Novita Healthcare Pvt. Ltd.'
          });
        }
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
        console.error("Error loading initial data:", error);
        toast({ title: "Data Load Error", variant: "destructive" });
        setAllEmployees([]);
        setOpeningBalances([]);
        setAllPerformanceDeductions([]);
        setAllLeaveApplications([]);
      }
    }
    setIsLoadingEmployees(false);
  }, [toast]);

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
  }, [selectedDivision, allEmployees, selectedEmployeeId]);

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
  }, [selectedDivisionForMultiMonth, allEmployees, selectedEmployeeForMultiMonth]);

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
        return null;
      }
    } else {
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
          console.warn(`Error parsing attendance:`, e);
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
          console.warn(`Error parsing salary edits:`, e);
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
    let workingDaysCount = 0;

    dailyStatuses.forEach(status => {
      const s = status.toUpperCase();
      if (s === 'P') { actualPayDaysValue++; workingDaysCount++; }
      else if (s === 'W') { actualPayDaysValue++; weekOffsCount++; }
      else if (s === 'PH') { actualPayDaysValue++; paidHolidaysCount++; }
      else if (s === 'CL') { actualPayDaysValue++; usedCLInMonth++; }
      else if (s === 'SL') { actualPayDaysValue++; usedSLInMonth++; }
      else if (s === 'PL') { actualPayDaysValue++; usedPLInMonth++; }
      else if (s === 'HCL') { actualPayDaysValue++; usedCLInMonth += 0.5; workingDaysCount += 0.5; }
      else if (s === 'HSL') { actualPayDaysValue++; usedSLInMonth += 0.5; workingDaysCount += 0.5; }
      else if (s === 'HPL') { actualPayDaysValue++; usedPLInMonth += 0.5; workingDaysCount += 0.5; }
      else if (s === 'HD') { actualPayDaysValue += 0.5; absentDaysCount += 0.5; workingDaysCount += 0.5; }
      else if (s === 'A') absentDaysCount += 1;
    });
    actualPayDaysValue = Math.min(actualPayDaysValue, totalDaysInMonthValue);
    const totalLeavesTakenThisMonth = usedCLInMonth + usedSLInMonth + usedPLInMonth;

    const monthlyComp = calculateMonthlySalaryComponents(employee, year, monthIndex);
    const payFactor = totalDaysInMonthValue > 0 ? actualPayDaysValue / totalDaysInMonthValue : 0;
    
    const actualBasic = (monthlyComp.basic || 0) * payFactor;
    const actualHRA = (monthlyComp.hra || 0) * payFactor;
    const actualCA = (monthlyComp.ca || 0) * payFactor;
    const actualMedical = (monthlyComp.medical || 0) * payFactor;
    const actualOtherAllowance = (monthlyComp.otherAllowance || 0) * payFactor;
    
    const arrears = salaryEdits.arrears ?? 0;
    const totalEarningsValue = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;

    const earningsList = [
      { component: "Basic Salary", amount: actualBasic },
      { component: "House Rent Allowance (HRA)", amount: actualHRA },
      { component: "Conveyance Allowance (CA)", amount: actualCA },
      { component: "Medical Allowance", amount: actualMedical },
      { component: "Other Allowance", amount: actualOtherAllowance },
      { component: "Arrears", amount: arrears },
    ];
    const calculatedTotalEarnings = earningsList.reduce((sum, item) => sum + item.amount, 0);

    const manualOtherDeductionVal = salaryEdits.manualOtherDeduction ?? 0;
    const totalOtherDeductionOnSlip = manualOtherDeductionVal + performanceDeductionAmount;
    
    const esicDeduction = monthlyComp.totalGross <= 21010 ? totalEarningsValue * 0.0075 : 0;
    const pfDeduction = salaryEdits.providentFund ?? 0;
    const ptDeduction = salaryEdits.professionalTax ?? 0;
    const tdsDeduction = salaryEdits.tds ?? 0;
    const loanDeduction = salaryEdits.loan ?? 0;
    const salaryAdvanceDeduction = salaryEdits.salaryAdvance ?? 0;

    const deductionsList = [
      { component: "Provident Fund (PF)", amount: pfDeduction },
      { component: "Professional Tax (PT)", amount: ptDeduction },
      { component: "ESIC", amount: esicDeduction },
      { component: "Income Tax (TDS)", amount: tdsDeduction },
      { component: "Loan", amount: loanDeduction },
      { component: "Salary Advance", amount: salaryAdvanceDeduction },
      { component: "Other Deduction", amount: totalOtherDeductionOnSlip },
    ];
    const calculatedTotalDeductions = deductionsList.reduce((sum, item) => sum + item.amount, 0);
    const calculatedNetSalary = calculatedTotalEarnings - calculatedTotalDeductions;
    
    const nextMonthDateObject = addMonths(selectedPeriodStartDate, 1);
    const nextMonthDetails = calculateEmployeeLeaveDetailsForPeriod(
        employee, getYear(nextMonthDateObject), getMonth(nextMonthDateObject), localAllLeaveApplications, localOpeningBalances
    );
    
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
      leaveBalanceNextMonth: { 
          cl: nextMonthDetails.balanceCLAtMonthEnd, 
          sl: nextMonthDetails.balanceSLAtMonthEnd, 
          pl: nextMonthDetails.balancePLAtMonthEnd 
      },
      absentDays: absentDaysCount, weekOffs: weekOffsCount, paidHolidays: paidHolidaysCount,
      workingDays: workingDaysCount,
      totalLeavesTakenThisMonth: totalLeavesTakenThisMonth,
      period: `${format(selectedPeriodStartDate, "MMMM")} ${year}`,
    };
  };

  const handleGenerateSlip = () => {
    if (!selectedMonth || !selectedYear || !selectedEmployeeId || !selectedDivision) {
      toast({ title: "Selection Missing", description: "Please select all fields.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSlip(false);

    const employee = allEmployees.find(e => e.id === selectedEmployeeId);
    if (!employee) {
      toast({ title: "Employee Not Found", variant: "destructive" });
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
      toast({ title: "Cannot Generate Slip", description: `Attendance data missing for ${selectedMonth} ${selectedYear}.`, variant: "destructive" });
      setSlipData(null);
      setShowSlip(false);
    }
    setIsLoading(false);
  };

  const handleDownloadAllSummaries = () => {
    if (!selectedMonth || !selectedYear || !selectedDivision) {
      toast({ title: "Selection Missing", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const employeesForSummary = allEmployees
      .filter(emp => emp.division === selectedDivision)
      .sort((a, b) => a.code.localeCompare(b.code));

    if (employeesForSummary.length === 0) {
      toast({ title: "No Employees", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const csvRows: string[][] = [];
    csvRows.push(["Employee (Code-Name-Designation)", "Gross Salary", "Total Earnings", "Total Deductions", "Net Salary"]);

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
      toast({ title: "No Data for CSV", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `salary_summaries_${selectedDivision}_${selectedMonth}_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addActivityLog(`Salary summaries CSV downloaded for ${selectedDivision}.`);
    toast({ title: "Summaries Downloaded" });
    setIsLoading(false);
  };

  const handlePrintAllSlips = () => {
    if (!selectedMonth || !selectedYear || !selectedDivision) {
      toast({ title: "Selection Missing", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSlip(false);
    setSlipData(null);

    const employeesToPrint = allEmployees
      .filter(emp => emp.division === selectedDivision)
      .sort((a, b) => a.code.localeCompare(b.code));

    if (employeesToPrint.length === 0) {
      toast({ title: "No Employees", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const generatedSlips: SalarySlipDataType[] = [];
    let countSkipped = 0;

    for (const emp of employeesToPrint) {
      const sData = generateSlipDataForEmployee(
        emp, selectedMonth, selectedYear,
        openingBalances, allPerformanceDeductions, allLeaveApplications
      );
      if (sData) {
        generatedSlips.push(sData);
      } else {
        countSkipped++;
      }
    }

    if (generatedSlips.length === 0) {
      toast({ title: "No Slips Generated", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setBulkSlipsData(generatedSlips);
    setIsBulkPrintingView(true);
    addActivityLog(`Bulk slips generated for ${selectedDivision}.`);
    if (countSkipped > 0) {
      toast({ title: "Note", description: `${countSkipped} employee(s) skipped.` });
    }
  };

  const handleGenerateMultiMonthSlips = () => {
    if (!selectedDivisionForMultiMonth || !selectedEmployeeForMultiMonth || !fromMonthMulti || fromYearMulti === 0 || !toMonthMulti || toYearMulti === 0) {
      toast({ title: "Selection Missing", variant: "destructive" });
      return;
    }

    const fromDate = startOfMonth(new Date(fromYearMulti, months.indexOf(fromMonthMulti)));
    const toDate = endOfMonth(new Date(toYearMulti, months.indexOf(toMonthMulti)));

    if (isBefore(toDate, fromDate)) {
      toast({ title: "Invalid Date Range", variant: "destructive" });
      return;
    }

    setIsLoadingMultiMonth(true);
    setShowSlip(false);
    setSlipData(null);

    const employee = allEmployees.find(e => e.id === selectedEmployeeForMultiMonth);
    if (!employee) {
      toast({ title: "Employee Not Found", variant: "destructive" });
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
      toast({ title: "No Slips Generated", variant: "destructive" });
      setIsLoadingMultiMonth(false);
      return;
    }

    setBulkSlipsData(generatedSlips);
    setIsBulkPrintingView(true);
    addActivityLog(`Multi-month slips generated for ${employee.name}.`);
    if (countSkipped > 0) {
      toast({ title: "Note", description: `${countSkipped} month(s) skipped.` });
    }
    setIsLoadingMultiMonth(false);
  };

  React.useEffect(() => {
    if (isBulkPrintingView && bulkSlipsData.length > 0) {
      let printTitle = `SalarySlips-${selectedMonth}-${selectedYear}`;
      if (bulkSlipsData.length > 0 && bulkSlipsData[0].period !== bulkSlipsData[bulkSlipsData.length - 1]?.period) {
        const empName = bulkSlipsData[0].name.replace(/\s+/g, '_');
        printTitle = `Slips_${empName}_MultiMonth`;
      } else if (bulkSlipsData.length > 0) {
        printTitle = `AllSlips-${selectedDivision || 'All'}-${bulkSlipsData[0].period.replace(/\s+/g, '-')}`;
      }

      const originalTitle = document.title;
      document.title = printTitle;

      const timer = setTimeout(() => {
        try {
          window.print();
          toast({ title: "Print Initiated", description: "Use 'Save as PDF' option." });
        } catch (e) {
          console.error("Print error:", e);
          toast({ title: "Print Error", variant: "destructive" });
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

  const getNextMonthInfo = (period: string) => {
    const parts = period.split(' ');
    const monthStr = parts[0];
    const yearStr = parts[1];
    const parsedYear = parseInt(yearStr, 10);
    const parsedMonthIndex = months.indexOf(monthStr);

    if (!isNaN(parsedYear) && parsedMonthIndex !== -1) {
      const nextMonthDate = addMonths(new Date(parsedYear, parsedMonthIndex, 1), 1);
      return { name: format(nextMonthDate, "MMMM"), year: getYear(nextMonthDate) };
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

  if (isBulkPrintingView) {
    return (
      <div id="salary-slip-printable-area" style={{ backgroundColor: '#fff' }}>
        <Button
          onClick={() => { setIsBulkPrintingView(false); setBulkSlipsData([]); }}
          variant="outline"
          className="fixed top-4 right-4 no-print z-[101]"
        >
          <XCircle className="mr-2 h-4 w-4" /> Close Bulk View
        </Button>
        {bulkSlipsData.map((sData, index) => {
          const nextMonthInfo = getNextMonthInfo(sData.period);
          return (
            <SalarySlipCard
              key={`bulk-slip-${sData.employeeId}-${index}`}
              sData={sData}
              companyConfig={companyConfig}
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
      <PageHeader title="Salary Slip Generator" description="Generate and download monthly salary slips.">
        <Button onClick={handleDownloadAllSummaries} disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading} variant="outline">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download Summaries (CSV)
        </Button>
        <Button onClick={handlePrintAllSlips} disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading} variant="outline">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          Print All Slips (PDF)
        </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md print:hidden">
        <CardHeader><CardTitle>Select Criteria</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={v => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedDivision} onValueChange={v => { setSelectedDivision(v); setSelectedEmployeeId(undefined); setShowSlip(false); }}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Division" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FMCG">FMCG</SelectItem>
              <SelectItem value="Wellness">Wellness</SelectItem>
              <SelectItem value="Office-Staff">Office-Staff</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={!selectedDivision || filteredEmployeesForSlip.length === 0}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              {filteredEmployeesForSlip.length > 0 ?
                filteredEmployeesForSlip.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code})</SelectItem>) :
                <SelectItem value="none" disabled>No employees</SelectItem>
              }
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateSlip} disabled={!selectedMonth || !selectedEmployeeId || selectedYear === 0 || !selectedDivision || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Generate Slip
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-md print:hidden">
        <CardHeader>
          <CardTitle>Multi-Month Slips</CardTitle>
          <CardDescription>Generate slips for one employee over a date range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Select value={selectedDivisionForMultiMonth} onValueChange={v => { setSelectedDivisionForMultiMonth(v); setSelectedEmployeeForMultiMonth(undefined); }}>
              <SelectTrigger><SelectValue placeholder="Division" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FMCG">FMCG</SelectItem>
                <SelectItem value="Wellness">Wellness</SelectItem>
                <SelectItem value="Office-Staff">Office-Staff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedEmployeeForMultiMonth} onValueChange={setSelectedEmployeeForMultiMonth} disabled={!selectedDivisionForMultiMonth || filteredEmployeesForMultiMonth.length === 0}>
              <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
              <SelectContent>
                {filteredEmployeesForMultiMonth.length > 0 ?
                  filteredEmployeesForMultiMonth.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code})</SelectItem>) :
                  <SelectItem value="none" disabled>No employees</SelectItem>
                }
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Select value={fromMonthMulti} onValueChange={setFromMonthMulti}>
              <SelectTrigger><SelectValue placeholder="From Month" /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={fromYearMulti > 0 ? fromYearMulti.toString() : ""} onValueChange={v => setFromYearMulti(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="From Year" /></SelectTrigger>
              <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Select value={toMonthMulti} onValueChange={setToMonthMulti}>
              <SelectTrigger><SelectValue placeholder="To Month" /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={toYearMulti > 0 ? toYearMulti.toString() : ""} onValueChange={v => setToYearMulti(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="To Year" /></SelectTrigger>
              <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={handleGenerateMultiMonthSlips} disabled={!selectedDivisionForMultiMonth || !selectedEmployeeForMultiMonth || !fromMonthMulti || fromYearMulti === 0 || !toMonthMulti || toYearMulti === 0 || isLoadingMultiMonth}>
              {isLoadingMultiMonth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Generate Multi-Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {showSlip && slipData && !isBulkPrintingView && (
        <>
          <SalarySlipCard
            sData={slipData}
            companyConfig={companyConfig}
            nextMonthName={nextMonthNameForDisplay}
            nextMonthYear={nextMonthYearNumForDisplay}
          />
          <Card className="shadow-md print:hidden">
            <CardFooter className="p-6 border-t">
              <p className="text-xs text-muted-foreground mr-auto">Use browser's 'Save as PDF' option.</p>
              <Button
                onClick={() => {
                  if (slipData) {
                    const originalTitle = document.title;
                    document.title = `${slipData.employeeId}-${slipData.name}-Slip-${selectedMonth}-${selectedYear}`;
                    try { window.print(); } catch (e) { console.error(e); }
                    finally { document.title = originalTitle; }
                  }
                }}
                className="ml-auto print:hidden"
              >
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
              </Button>
            </CardFooter>
          </Card>
        </>
      )}

      {!showSlip && !isLoading && !isLoadingEmployees && !isBulkPrintingView && (
        <Card className="shadow-md flex justify-center py-12">
          <CardContent className="text-center text-muted-foreground">
            <p>Select criteria to generate a salary slip.</p>
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
    const thousands = Math.floor(wholePart / 1000);
    const remainder = wholePart % 1000;
    words = convertTwoDigits(thousands) + ' Thousand';
    if (remainder > 0) words += ' ' + convertThreeDigits(remainder);
  } else if (wholePart < 10000000) {
    const lakhs = Math.floor(wholePart / 100000);
    const remainder = wholePart % 100000;
    words = convertTwoDigits(lakhs) + ' Lakh';
    if (remainder > 0) {
      const thousands = Math.floor(remainder / 1000);
      const rest = remainder % 1000;
      if (thousands > 0) words += ' ' + convertTwoDigits(thousands) + ' Thousand';
      if (rest > 0) words += ' ' + convertThreeDigits(rest);
    }
  } else {
    const crores = Math.floor(wholePart / 10000000);
    const remainder = wholePart % 10000000;
    words = convertTwoDigits(crores) + ' Crore';
    if (remainder > 0) {
      const lakhs = Math.floor(remainder / 100000);
      const restAfterLakh = remainder % 100000;
      if (lakhs > 0) words += ' ' + convertTwoDigits(lakhs) + ' Lakh';
      const thousands = Math.floor(restAfterLakh / 1000);
      const rest = restAfterLakh % 1000;
      if (thousands > 0) words += ' ' + convertTwoDigits(thousands) + ' Thousand';
      if (rest > 0) words += ' ' + convertThreeDigits(rest);
    }
  }

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
