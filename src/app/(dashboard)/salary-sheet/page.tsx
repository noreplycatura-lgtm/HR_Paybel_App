"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Search, Upload, IndianRupee, Users, Calculator, FileSpreadsheet, Wallet, TrendingDown } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateMonthlySalaryComponents } from "@/lib/salary-calculations";
import { format, parseISO, isValid, getDaysInMonth } from "date-fns";
import { FileUploadButton } from "@/components/shared/file-upload-button";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "catura_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "catura_attendance_raw_data_v4_";
const LOCAL_STORAGE_SALARY_EDITS_PREFIX = "catura_salary_sheet_edits_v1_";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "catura_performance_deductions_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";

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

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface SalarySheetEntry extends EmployeeDetail {
  totalDaysInMonth: number;
  daysPaid: number;
  weekOffs: number;
  daysAbsent: number;
  monthlyBasic: number;
  monthlyHRA: number;
  monthlyCA: number;
  monthlyOtherAllowance: number;
  monthlyMedical: number;
  calculatedGross: number;
  actualBasic: number;
  actualHRA: number;
  actualCA: number;
  actualOtherAllowance: number;
  actualMedical: number;
  arrears: number;
  tds: number;
  loan: number;
  salaryAdvance: number;
  manualOtherDeduction: number;
  performanceDeduction: number;
  esic: number;
  professionalTax: number;
  providentFund: number;
  totalAllowance: number;
  totalDeduction: number;
  netPaid: number;
  employeeStatus: "Active" | "Left";
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

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-600 bg-blue-100', text: 'text-blue-700' },
    green: { bg: 'bg-green-50 border-green-200', icon: 'text-green-600 bg-green-100', text: 'text-green-700' },
    red: { bg: 'bg-red-50 border-red-200', icon: 'text-red-600 bg-red-100', text: 'text-red-700' },
    purple: { bg: 'bg-purple-50 border-purple-200', icon: 'text-purple-600 bg-purple-100', text: 'text-purple-700' },
    orange: { bg: 'bg-orange-50 border-orange-200', icon: 'text-orange-600 bg-orange-100', text: 'text-orange-700' },
    teal: { bg: 'bg-teal-50 border-teal-200', icon: 'text-teal-600 bg-teal-100', text: 'text-teal-700' },
  };
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`rounded-xl border-2 ${colors.bg} p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${colors.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function SalarySheetPage() {
  const { toast } = useToast();
  const [allEmployees, setAllEmployees] = React.useState<EmployeeDetail[]>([]);
  const [salarySheetData, setSalarySheetData] = React.useState<SalarySheetEntry[]>([]);
  const [filteredSalarySheetData, setFilteredSalarySheetData] = React.useState<SalarySheetEntry[]>([]);
  const [rawAttendanceForPeriod, setRawAttendanceForPeriod] = React.useState<MonthlyEmployeeAttendance[]>([]);
  const [allPerformanceDeductions, setAllPerformanceDeductions] = React.useState<PerformanceDeductionEntry[]>([]);
  const [salaryEditsForPeriod, setSalaryEditsForPeriod] = React.useState<Record<string, EditableSalaryFields>>({});

  const [currentYearState, setCurrentYearState] = React.useState(0);
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isLoadingCalculations, setIsLoadingCalculations] = React.useState(false);

  // Initialize default values
  React.useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    setCurrentYearState(currentYear);
    setSelectedMonth(months[now.getMonth()]);
    setSelectedYear(currentYear);
  }, []);

  // Load master data
  React.useEffect(() => {
    setIsLoadingData(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployees) {
          const parsedEmployees = JSON.parse(storedEmployees);
          setAllEmployees(Array.isArray(parsedEmployees) ? parsedEmployees : []);
        } else {
          setAllEmployees([]);
        }

        const storedPerfDeductions = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
        if (storedPerfDeductions) {
          const parsedPerfDeductions = JSON.parse(storedPerfDeductions);
          setAllPerformanceDeductions(Array.isArray(parsedPerfDeductions) ? parsedPerfDeductions : []);
        } else {
          setAllPerformanceDeductions([]);
        }
      } catch (error) {
        console.error("Error loading initial master data for salary sheet:", error);
        toast({ title: "Data Load Error", description: "Could not load employee master or performance deductions.", variant: "destructive" });
        setAllEmployees([]);
        setAllPerformanceDeductions([]);
      }
    }
    setIsLoadingData(false);
  }, []);

  // Calculate salary data when dependencies change
  React.useEffect(() => {
    if (isLoadingData || !selectedMonth || !selectedYear || selectedYear === 0) {
      setSalarySheetData([]);
      setRawAttendanceForPeriod([]);
      setSalaryEditsForPeriod({});
      return;
    }

    setIsLoadingCalculations(true);
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) {
      setSalarySheetData([]);
      setRawAttendanceForPeriod([]);
      setSalaryEditsForPeriod({});
      setIsLoadingCalculations(false);
      return;
    }

    let attendanceDataForSelectedMonth: MonthlyEmployeeAttendance[] = [];
    let salaryEditsForSelectedMonth: Record<string, EditableSalaryFields> = {};

    if (typeof window !== 'undefined') {
      const attendanceKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${selectedMonth}_${selectedYear}`;
      const storedAttendance = localStorage.getItem(attendanceKey);
      if (storedAttendance) {
        try {
          const parsedAtt = JSON.parse(storedAttendance);
          if (Array.isArray(parsedAtt)) attendanceDataForSelectedMonth = parsedAtt;
          else {
            console.warn(`Attendance data for ${selectedMonth} ${selectedYear} in localStorage is not an array.`);
            toast({ title: "Attendance Data Format Error", description: `Stored attendance for ${selectedMonth} ${selectedYear} is corrupted.`, variant: "destructive", duration: 7000 });
          }
        } catch (e) {
          console.warn(`Error parsing attendance for ${selectedMonth} ${selectedYear} from localStorage:`, e);
          toast({ title: "Attendance Data Corrupted", description: `Could not parse stored attendance for ${selectedMonth} ${selectedYear}.`, variant: "destructive", duration: 7000 });
        }
      }
      setRawAttendanceForPeriod(attendanceDataForSelectedMonth);

      const editsKey = `${LOCAL_STORAGE_SALARY_EDITS_PREFIX}${selectedMonth}_${selectedYear}`;
      const storedEdits = localStorage.getItem(editsKey);
      if (storedEdits) {
        try {
          const parsedEdits = JSON.parse(storedEdits);
          if (typeof parsedEdits === 'object' && parsedEdits !== null) salaryEditsForSelectedMonth = parsedEdits;
          else {
            console.warn(`Salary edits for ${selectedMonth} ${selectedYear} in localStorage is not an object.`);
            toast({ title: "Salary Edits Format Error", description: `Stored salary edits for ${selectedMonth} ${selectedYear} are corrupted.`, variant: "destructive", duration: 7000 });
          }
        } catch (e) {
          console.warn(`Error parsing salary edits for ${selectedMonth} ${selectedYear} from localStorage:`, e);
          toast({ title: "Salary Edits Data Corrupted", description: `Could not parse stored salary edits for ${selectedMonth} ${selectedYear}.`, variant: "destructive", duration: 7000 });
        }
      }
      setSalaryEditsForPeriod(salaryEditsForSelectedMonth);
    }

    const performanceDeductionsForSelectedMonth = allPerformanceDeductions.filter(
      pd => pd.month === selectedMonth && pd.year === selectedYear
    );

    const newSalarySheetData = allEmployees
      .filter(emp => {
        return attendanceDataForSelectedMonth.some(att => att.code === emp.code);
      })
      .map(emp => {
        const empAttendanceRecord = attendanceDataForSelectedMonth.find(att => att.code === emp.code);

        if (!empAttendanceRecord || !empAttendanceRecord.attendance) {
          return null;
        }

        const totalDaysInMonth = getDaysInMonth(new Date(selectedYear, monthIndex, 1));
        const dailyStatuses = empAttendanceRecord.attendance.slice(0, totalDaysInMonth);

        let daysPaid = 0;
        let weekOffs = 0;
        let absentDays = 0;

        dailyStatuses.forEach(status => {
          const s = status.toUpperCase();
          if (s === 'A') {
            absentDays += 1;
          } else if (s === 'HD') {
            daysPaid += 0.5;
            absentDays += 0.5;
          } else if (s !== '-') {
            daysPaid += 1;
          }

          if (s === 'W') {
            weekOffs++;
          }
        });

        daysPaid = Math.min(daysPaid, totalDaysInMonth);

        const monthlyComponents = calculateMonthlySalaryComponents(emp, selectedYear, monthIndex);
        const payFactor = totalDaysInMonth > 0 ? daysPaid / totalDaysInMonth : 0;

        const actualBasic = monthlyComponents.basic * payFactor;
        const actualHRA = monthlyComponents.hra * payFactor;
        const actualCA = monthlyComponents.ca * payFactor;
        const actualMedical = monthlyComponents.medical * payFactor;
        const actualOtherAllowance = monthlyComponents.otherAllowance * payFactor;

        const empEdits = salaryEditsForSelectedMonth[emp.id] || {};
        const arrears = empEdits.arrears ?? 0;
        const tds = empEdits.tds ?? 0;
        const loan = empEdits.loan ?? 0;
        const salaryAdvance = empEdits.salaryAdvance ?? 0;
        const manualOtherDeductionVal = empEdits.manualOtherDeduction ?? 0;
        const professionalTax = empEdits.professionalTax ?? 0;
        const providentFund = empEdits.providentFund ?? 0;

        const performanceDeductionEntry = performanceDeductionsForSelectedMonth.find(
          pd => pd.employeeCode === emp.code
        );
        const performanceDeductionAmount = performanceDeductionEntry?.amount || 0;

        const totalAllowance = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;

        const esic = monthlyComponents.totalGross <= 21010 ? totalAllowance * 0.0075 : 0;

        const totalDeduction = esic + professionalTax + providentFund +
          tds + loan + salaryAdvance + manualOtherDeductionVal + performanceDeductionAmount;
        const netPaid = totalAllowance - totalDeduction;

        return {
          ...emp,
          totalDaysInMonth,
          daysPaid,
          weekOffs,
          daysAbsent: absentDays,
          monthlyBasic: monthlyComponents.basic,
          monthlyHRA: monthlyComponents.hra,
          monthlyCA: monthlyComponents.ca,
          monthlyOtherAllowance: monthlyComponents.otherAllowance,
          monthlyMedical: monthlyComponents.medical,
          calculatedGross: monthlyComponents.totalGross,
          actualBasic, actualHRA, actualCA, actualOtherAllowance, actualMedical,
          arrears, tds, loan, salaryAdvance, manualOtherDeduction: manualOtherDeductionVal, performanceDeduction: performanceDeductionAmount,
          totalAllowance, esic, professionalTax, providentFund, totalDeduction, netPaid,
          employeeStatus: emp.status as "Active" | "Left",
        };
      })
      .filter(emp => emp !== null) as SalarySheetEntry[];

    setSalarySheetData(newSalarySheetData);
    setIsLoadingCalculations(false);
  }, [allEmployees, selectedMonth, selectedYear, isLoadingData, allPerformanceDeductions, toast]);

  // Filter data based on search
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

  // Calculate stats
  const salaryStats = React.useMemo(() => {
    const totalGross = filteredSalarySheetData.reduce((sum, emp) => sum + emp.totalAllowance, 0);
    const totalDeductions = filteredSalarySheetData.reduce((sum, emp) => sum + emp.totalDeduction, 0);
    const totalNetPaid = filteredSalarySheetData.reduce((sum, emp) => sum + emp.netPaid, 0);
    return {
      totalEmployees: filteredSalarySheetData.length,
      totalGross,
      totalDeductions,
      totalNetPaid,
    };
  }, [filteredSalarySheetData]);

  const handleEditableInputChange = (employeeId: string, fieldName: keyof EditableSalaryFields, value: string) => {
    const numericValue = parseFloat(value) || 0;

    setSalarySheetData(prevData => {
      const newData = prevData.map(emp => {
        if (emp.id === employeeId) {
          const updatedEmp = { ...emp };

          if (fieldName === 'manualOtherDeduction') updatedEmp.manualOtherDeduction = numericValue;
          else if (fieldName === 'arrears') updatedEmp.arrears = numericValue;
          else if (fieldName === 'tds') updatedEmp.tds = numericValue;
          else if (fieldName === 'loan') updatedEmp.loan = numericValue;
          else if (fieldName === 'salaryAdvance') updatedEmp.salaryAdvance = numericValue;
          else if (fieldName === 'professionalTax') updatedEmp.professionalTax = numericValue;
          else if (fieldName === 'providentFund') updatedEmp.providentFund = numericValue;

          const newTotalAllowance = updatedEmp.actualBasic + updatedEmp.actualHRA + updatedEmp.actualCA + updatedEmp.actualMedical + updatedEmp.actualOtherAllowance + updatedEmp.arrears;

          const newEsic = updatedEmp.calculatedGross <= 21010 ? newTotalAllowance * 0.0075 : 0;
          updatedEmp.esic = newEsic;

          const newTotalDeduction = newEsic + updatedEmp.professionalTax + updatedEmp.providentFund +
            updatedEmp.tds + updatedEmp.loan + updatedEmp.salaryAdvance +
            updatedEmp.manualOtherDeduction + updatedEmp.performanceDeduction;
          const newNetPaid = newTotalAllowance - newTotalDeduction;

          return { ...updatedEmp, totalAllowance: newTotalAllowance, totalDeduction: newTotalDeduction, netPaid: newNetPaid };
        }
        return emp;
      });
      return newData;
    });

    if (selectedMonth && selectedYear > 0) {
      const updatedEditsForStorage = { ...salaryEditsForPeriod };
      if (!updatedEditsForStorage[employeeId]) {
        updatedEditsForStorage[employeeId] = {};
      }
      updatedEditsForStorage[employeeId]![fieldName] = numericValue;

      setSalaryEditsForPeriod(updatedEditsForStorage);

      if (typeof window !== 'undefined') {
        try {
          const editsKey = `${LOCAL_STORAGE_SALARY_EDITS_PREFIX}${selectedMonth}_${selectedYear}`;
          localStorage.setItem(editsKey, JSON.stringify(updatedEditsForStorage));
          addActivityLog(`Salary sheet edit for ${employeeId} (${selectedMonth} ${selectedYear}) updated: ${fieldName}=${numericValue}`);
        } catch (error) {
          console.error("Error saving salary edits to localStorage:", error);
          toast({ title: "Storage Error", description: "Could not save salary edits.", variant: "destructive" });
        }
      }
    }
  };

  const handleDownloadSheet = () => {
    if (isLoadingCalculations || isLoadingData) {
      toast({ title: "Please Wait", description: "Calculations or data loading is in progress.", variant: "destructive" });
      return;
    }

    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1 || !selectedYear || selectedYear === 0) {
      toast({ title: "Selection Missing", description: "Please select month and year for the report.", variant: "destructive" });
      return;
    }

    let attendanceDataForCsv: MonthlyEmployeeAttendance[] = [];
    let salaryEditsForCsv: Record<string, EditableSalaryFields> = {};
    let performanceDeductionsForCsv: PerformanceDeductionEntry[] = [];

    if (typeof window !== 'undefined') {
      const attendanceKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${selectedMonth}_${selectedYear}`;
      const storedAttendance = localStorage.getItem(attendanceKey);
      if (storedAttendance) {
        try {
          const parsedAtt = JSON.parse(storedAttendance);
          if (Array.isArray(parsedAtt)) attendanceDataForCsv = parsedAtt;
        } catch (e) { console.warn("Error parsing attendance for CSV export from localStorage"); }
      }

      const editsKey = `${LOCAL_STORAGE_SALARY_EDITS_PREFIX}${selectedMonth}_${selectedYear}`;
      const storedEdits = localStorage.getItem(editsKey);
      if (storedEdits) {
        try {
          const parsedEdits = JSON.parse(storedEdits);
          if (typeof parsedEdits === 'object' && parsedEdits !== null) salaryEditsForCsv = parsedEdits;
        } catch (e) { console.warn("Error parsing salary edits for CSV export from localStorage"); }
      }

      const storedPerfDeductions = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
      if (storedPerfDeductions) {
        try {
          const parsed = JSON.parse(storedPerfDeductions);
          if (Array.isArray(parsed)) {
            performanceDeductionsForCsv = parsed.filter(
              (pd: PerformanceDeductionEntry) => pd.month === selectedMonth && pd.year === selectedYear
            );
          }
        } catch (e) { console.warn("Error parsing performance deductions for CSV export from localStorage"); }
      }
    }

    if (allEmployees.length === 0) {
      toast({ title: "No Data", description: "No employee master data found.", variant: "destructive" });
      return;
    }

    const dataToExport = allEmployees
      .map(emp => {
        const empAttendanceRecord = attendanceDataForCsv.find(att => att.code === emp.code);

        const totalDaysInMonth = getDaysInMonth(new Date(selectedYear, monthIndex, 1));

        let daysPaid = 0;
        let weekOffs = 0;
        let absentDays = 0;

        if (empAttendanceRecord && empAttendanceRecord.attendance) {
          const dailyStatuses = empAttendanceRecord.attendance.slice(0, totalDaysInMonth);
          dailyStatuses.forEach(status => {
            const s = status.toUpperCase();
            if (s === 'A') {
              absentDays += 1;
            } else if (s === 'HD') {
              daysPaid += 0.5;
              absentDays += 0.5;
            } else if (s !== '-') {
              daysPaid += 1;
            }

            if (s === 'W') {
              weekOffs++;
            }
          });
          daysPaid = Math.min(daysPaid, totalDaysInMonth);
        } else {
          if (emp.status === "Active") {
            absentDays = totalDaysInMonth;
          } else {
            daysPaid = 0;
            absentDays = 0;
          }
        }

        const monthlyComponents = calculateMonthlySalaryComponents(emp, selectedYear, monthIndex);
        const payFactor = totalDaysInMonth > 0 ? daysPaid / totalDaysInMonth : 0;
        const actualBasic = monthlyComponents.basic * payFactor;
        const actualHRA = monthlyComponents.hra * payFactor;
        const actualCA = monthlyComponents.ca * payFactor;
        const actualMedical = monthlyComponents.medical * payFactor;
        const actualOtherAllowance = monthlyComponents.otherAllowance * payFactor;

        const empEdits = salaryEditsForCsv[emp.id] || {};
        const arrears = empEdits.arrears ?? 0;
        const tds = empEdits.tds ?? 0;
        const loan = empEdits.loan ?? 0;
        const salaryAdvance = empEdits.salaryAdvance ?? 0;
        const manualOtherDeductionVal = empEdits.manualOtherDeduction ?? 0;
        const professionalTax = empEdits.professionalTax ?? 0;
        const providentFund = empEdits.providentFund ?? 0;

        const performanceDeductionEntry = performanceDeductionsForCsv.find(
          pd => pd.employeeCode === emp.code
        );
        const performanceDeductionAmount = performanceDeductionEntry?.amount || 0;

        const totalAllowance = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;
        const esic = monthlyComponents.totalGross <= 21010 ? totalAllowance * 0.0075 : 0;

        const totalDeduction = esic + professionalTax + providentFund + tds + loan + salaryAdvance + manualOtherDeductionVal + performanceDeductionAmount;
        const netPaid = totalAllowance - totalDeduction;

        if (empAttendanceRecord || emp.status === "Left") {
          return {
            ...emp, totalDaysInMonth, daysPaid, weekOffs, daysAbsent: absentDays,
            monthlyBasic: monthlyComponents.basic, monthlyHRA: monthlyComponents.hra, monthlyCA: monthlyComponents.ca,
            monthlyOtherAllowance: monthlyComponents.otherAllowance, monthlyMedical: monthlyComponents.medical,
            calculatedGross: monthlyComponents.totalGross,
            actualBasic, actualHRA, actualCA, actualOtherAllowance, actualMedical,
            arrears, tds, loan, salaryAdvance, manualOtherDeduction: manualOtherDeductionVal, performanceDeduction: performanceDeductionAmount,
            esic, professionalTax, providentFund,
            totalAllowance, totalDeduction, netPaid,
            employeeStatus: emp.status as "Active" | "Left",
          };
        }
        return null;
      })
      .filter(emp => emp !== null) as SalarySheetEntry[];

    if (dataToExport.length === 0) {
      toast({ title: "No Data", description: "No employees processed for the selected period to export.", variant: "destructive" });
      return;
    }

    const headers = [
      "Employee Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ",
      "Total Days", "Day Paid", "Week Off", "Day Absent",
      "Monthly Basic", "Monthly HRA", "Monthly CA", "Monthly Other Allowance", "Monthly Medical", "Monthly Gross",
      "Basic", "HRA", "CA", "Other Allowance", "Medical",
      "Arrears", "Total Allowance",
      "ESIC", "Professional Tax", "PROVFUND", "TDS", "Loan", "Salary Advance", "Manual Other Ded.", "Performance Ded.", "Total Other Ded.",
      "Total Deduction", "Net Paid"
    ];
    const csvRows = [headers.join(',')];

    dataToExport.forEach(emp => {
      const dojFormatted = emp.doj && isValid(parseISO(emp.doj)) ? format(parseISO(emp.doj), 'dd-MM-yyyy') : emp.doj || 'N/A';
      const totalOtherDeductionForEmp = emp.manualOtherDeduction + emp.performanceDeduction;
      const row = [
        emp.employeeStatus, emp.division || "N/A", emp.code, emp.name, emp.designation, emp.hq || "N/A", dojFormatted,
        emp.totalDaysInMonth.toString(), emp.daysPaid.toFixed(1), emp.weekOffs.toString(), emp.daysAbsent.toFixed(1),
        emp.monthlyBasic.toFixed(2), emp.monthlyHRA.toFixed(2), emp.monthlyCA.toFixed(2), emp.monthlyOtherAllowance.toFixed(2), emp.monthlyMedical.toFixed(2),
        emp.calculatedGross.toFixed(2),
        emp.actualBasic.toFixed(2), emp.actualHRA.toFixed(2), emp.actualCA.toFixed(2), emp.actualOtherAllowance.toFixed(2), emp.actualMedical.toFixed(2),
        emp.arrears.toFixed(2), emp.totalAllowance.toFixed(2),
        emp.esic.toFixed(2), emp.professionalTax.toFixed(2), emp.providentFund.toFixed(2), emp.tds.toFixed(2), emp.loan.toFixed(2), emp.salaryAdvance.toFixed(2), emp.manualOtherDeduction.toFixed(2), emp.performanceDeduction.toFixed(2), totalOtherDeductionForEmp.toFixed(2),
        emp.totalDeduction.toFixed(2), emp.netPaid.toFixed(2),
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
      csvRows.push(row.join(','));
    });

    const totals = {
      monthlyBasic: dataToExport.reduce((sum, emp) => sum + emp.monthlyBasic, 0),
      monthlyHRA: dataToExport.reduce((sum, emp) => sum + emp.monthlyHRA, 0),
      monthlyCA: dataToExport.reduce((sum, emp) => sum + emp.monthlyCA, 0),
      monthlyOtherAllowance: dataToExport.reduce((sum, emp) => sum + emp.monthlyOtherAllowance, 0),
      monthlyMedical: dataToExport.reduce((sum, emp) => sum + emp.monthlyMedical, 0),
      calculatedGross: dataToExport.reduce((sum, emp) => sum + emp.calculatedGross, 0),
      actualBasic: dataToExport.reduce((sum, emp) => sum + emp.actualBasic, 0),
      actualHRA: dataToExport.reduce((sum, emp) => sum + emp.actualHRA, 0),
      actualCA: dataToExport.reduce((sum, emp) => sum + emp.actualCA, 0),
      actualOtherAllowance: dataToExport.reduce((sum, emp) => sum + emp.actualOtherAllowance, 0),
      actualMedical: dataToExport.reduce((sum, emp) => sum + emp.actualMedical, 0),
      arrears: dataToExport.reduce((sum, emp) => sum + emp.arrears, 0),
      totalAllowance: dataToExport.reduce((sum, emp) => sum + emp.totalAllowance, 0),
      esic: dataToExport.reduce((sum, emp) => sum + emp.esic, 0),
      professionalTax: dataToExport.reduce((sum, emp) => sum + emp.professionalTax, 0),
      providentFund: dataToExport.reduce((sum, emp) => sum + emp.providentFund, 0),
      tds: dataToExport.reduce((sum, emp) => sum + emp.tds, 0),
      loan: dataToExport.reduce((sum, emp) => sum + emp.loan, 0),
      salaryAdvance: dataToExport.reduce((sum, emp) => sum + emp.salaryAdvance, 0),
      manualOtherDeduction: dataToExport.reduce((sum, emp) => sum + emp.manualOtherDeduction, 0),
      performanceDeduction: dataToExport.reduce((sum, emp) => sum + emp.performanceDeduction, 0),
      totalOtherDeduction: dataToExport.reduce((sum, emp) => sum + (emp.manualOtherDeduction + emp.performanceDeduction), 0),
      totalDeduction: dataToExport.reduce((sum, emp) => sum + emp.totalDeduction, 0),
      netPaid: dataToExport.reduce((sum, emp) => sum + emp.netPaid, 0),
    };

    const totalRow = [
      "", "", "", "", "", "", "TOTALS:", "", "", "", "",
      totals.monthlyBasic.toFixed(2), totals.monthlyHRA.toFixed(2), totals.monthlyCA.toFixed(2), totals.monthlyOtherAllowance.toFixed(2), totals.monthlyMedical.toFixed(2), totals.calculatedGross.toFixed(2),
      totals.actualBasic.toFixed(2), totals.actualHRA.toFixed(2), totals.actualCA.toFixed(2), totals.actualOtherAllowance.toFixed(2), totals.actualMedical.toFixed(2),
      totals.arrears.toFixed(2), totals.totalAllowance.toFixed(2),
      totals.esic.toFixed(2), totals.professionalTax.toFixed(2), totals.providentFund.toFixed(2), totals.tds.toFixed(2), totals.loan.toFixed(2), totals.salaryAdvance.toFixed(2), totals.manualOtherDeduction.toFixed(2), totals.performanceDeduction.toFixed(2), totals.totalOtherDeduction.toFixed(2),
      totals.totalDeduction.toFixed(2), totals.netPaid.toFixed(2),
    ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    csvRows.push(totalRow.join(','));

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
    addActivityLog(`Salary sheet for ${selectedMonth} ${selectedYear} downloaded.`);
    toast({ title: "Download Started", description: "Salary sheet CSV is being downloaded." });
  };

  const handleDownloadDeductionTemplate = () => {
    if (!selectedMonth || !selectedYear || selectedYear === 0) {
      toast({ title: "Select Period First", description: "Please select a month and year to download the template.", variant: "destructive" });
      return;
    }

    const headers = ["Code", "Name", "Arrears", "ProfessionalTax", "ProvidentFund", "TDS", "Loan", "SalaryAdvance", "ManualOtherDeduction"];
    const activeEmployees = allEmployees.filter(emp => emp.status === "Active");

    if (activeEmployees.length === 0) {
      toast({ title: "No Active Employees", description: "No active employees found to generate a template for.", variant: "destructive" });
      return;
    }
    const csvContent = [
      headers.join(','),
      ...activeEmployees.map(emp => {
        return [`"${emp.code}"`, `"${emp.name}"`, "", "", "", "", "", "", ""].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Deduction_Template_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: "Deduction template for the selected period has been downloaded." });
  };

  const handleUploadDeductions = (file: File) => {
    if (!selectedMonth || !selectedYear || selectedYear === 0) {
      toast({ title: "Select Period First", description: "Please select month and year before uploading deductions.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error Reading File", variant: "destructive" });
        return;
      }

      try {
        const lines = text.split(/\r\n|\n/).map(line => line.trim()).filter(line => line);
        if (lines.length < 2) {
          toast({ title: "Invalid File", description: "File is empty or has no data rows.", variant: "destructive" });
          return;
        }

        const headerLine = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const expectedHeaders: string[] = ["code", "arrears", "professionaltax", "providentfund", "tds", "loan", "salaryadvance", "manualotherdeduction"];

        const missingHeaders = expectedHeaders.filter(eh => eh !== 'name' && !headerLine.includes(eh));
        if (missingHeaders.length > 0) {
          toast({ title: "File Header Error", description: `Missing/misnamed headers: ${missingHeaders.join(', ')}.`, variant: "destructive", duration: 7000 });
          return;
        }

        const getIndex = (name: string) => headerLine.indexOf(name);
        const idxCode = getIndex('code');

        const newSalaryEdits = { ...salaryEditsForPeriod };
        let updatedCount = 0;
        let skippedCount = 0;
        const dataRows = lines.slice(1);

        dataRows.forEach(row => {
          const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
          const code = values[idxCode];

          const employee = allEmployees.find(emp => emp.code === code);
          if (!employee) {
            skippedCount++;
            console.warn(`Skipping deduction upload for code '${code}': not found in employee master.`);
            return;
          }

          if (!newSalaryEdits[employee.id]) {
            newSalaryEdits[employee.id] = {};
          }

          let employeeUpdated = false;

          const fieldsToUpdate: (keyof EditableSalaryFields)[] = ['arrears', 'professionalTax', 'providentFund', 'tds', 'loan', 'salaryAdvance', 'manualOtherDeduction'];
          fieldsToUpdate.forEach(field => {
            const fieldNameInCsv = field.toLowerCase();
            const idx = getIndex(fieldNameInCsv);
            if (idx > -1 && values[idx] && values[idx].trim() !== "") {
              const val = parseFloat(values[idx]);
              if (!isNaN(val)) {
                newSalaryEdits[employee.id]![field] = val;
                employeeUpdated = true;
              }
            }
          });
          if (employeeUpdated) updatedCount++;
        });

        if (updatedCount > 0) {
          setSalaryEditsForPeriod(newSalaryEdits);
          setSalarySheetData(prevData => [...prevData]);

          if (typeof window !== 'undefined') {
            const editsKey = `${LOCAL_STORAGE_SALARY_EDITS_PREFIX}${selectedMonth}_${selectedYear}`;
            localStorage.setItem(editsKey, JSON.stringify(newSalaryEdits));
          }

          toast({ title: "Deductions Uploaded", description: `${updatedCount} employee records updated from file. ${skippedCount > 0 ? `${skippedCount} rows skipped.` : ''}` });
          addActivityLog(`${updatedCount} salary deductions uploaded for ${selectedMonth} ${selectedYear}.`);
        } else {
          toast({ title: "No Matching Data", description: `No matching employee records found to update. ${skippedCount > 0 ? `${skippedCount} rows skipped.` : ''}`, variant: "destructive" });
        }

      } catch (error) {
        console.error("Error parsing deductions CSV:", error);
        toast({ title: "Parsing Error", description: "Could not parse CSV file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const availableYears = currentYearState > 0 ? Array.from({ length: 5 }, (_, i) => currentYearState - i) : [];

  // Loading State
  if (isLoadingData && allEmployees.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading Salary Data...</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN JSX RETURN ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <FileSpreadsheet className="h-7 w-7" />
                Salary Sheet
              </h1>
              <p className="text-orange-100 text-sm">Generate and download month-wise salary sheets</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleDownloadSheet}
                disabled={isLoadingCalculations || isLoadingData || (!selectedMonth || !selectedYear || selectedYear === 0)}
                className="bg-white text-orange-700 hover:bg-orange-50"
              >
                {isLoadingCalculations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download Sheet
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Employees"
          value={salaryStats.totalEmployees}
          icon={Users}
          color="blue"
          subtitle={`${selectedMonth} ${selectedYear}`}
        />
        <StatCard
          title="Total Gross"
          value={`₹${salaryStats.totalGross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={Wallet}
          color="green"
          subtitle="Total Allowances"
        />
        <StatCard
          title="Total Deductions"
          value={`₹${salaryStats.totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={TrendingDown}
          color="red"
          subtitle="All deductions"
        />
        <StatCard
          title="Net Payable"
          value={`₹${salaryStats.totalNetPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={IndianRupee}
          color="orange"
          subtitle="After deductions"
        />
      </div>

      {/* Filters & Upload Card */}
      <Card className="shadow-md border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5 text-orange-600" /> Filters & Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left Side - Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => setSelectedYear(parseInt(value) || 0)}>
                <SelectTrigger className="w-full sm:w-[120px] border-gray-300">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="relative w-full sm:w-auto sm:flex-grow max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Name/Code..."
                  className="pl-8 border-gray-300"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Right Side - Upload Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadDeductionTemplate} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" /> Deduction Template
              </Button>
              <FileUploadButton
                onFileUpload={handleUploadDeductions}
                buttonText="Upload Deductions"
                acceptedFileTypes=".csv"
                icon={<Upload className="mr-2 h-4 w-4" />}
                variant="outline"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salary Table */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-orange-600" />
            Salary Details - {selectedMonth} {selectedYear > 0 ? selectedYear : ''}
          </CardTitle>
          <CardDescription>
            Active employees with attendance data. ESIC: 0.75% of Total Allowance if Gross ≤ ₹21,010. Editable fields saved locally.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isLoadingCalculations ? (
              <div className="text-center py-12">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-600" />
                <p className="mt-2 text-gray-500">Calculating salaries...</p>
              </div>
            ) : filteredSalarySheetData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold">Division</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Designation</TableHead>
                    <TableHead className="font-semibold">HQ</TableHead>
                    <TableHead className="font-semibold">DOJ</TableHead>
                    <TableHead className="text-center font-semibold">Days</TableHead>
                    <TableHead className="text-center font-semibold">Paid</TableHead>
                    <TableHead className="text-center font-semibold">W/O</TableHead>
                    <TableHead className="text-center font-semibold">Absent</TableHead>
                    <TableHead className="text-right font-semibold bg-green-50">Gross</TableHead>
                    <TableHead className="text-right font-semibold bg-blue-50">Allowance</TableHead>
                    <TableHead className="text-right font-semibold">Arrears</TableHead>
                    <TableHead className="text-right font-semibold bg-green-100">Tot. Allow</TableHead>
                    <TableHead className="text-right font-semibold">ESIC</TableHead>
                    <TableHead className="text-right font-semibold">PT</TableHead>
                    <TableHead className="text-right font-semibold">PF</TableHead>
                    <TableHead className="text-right font-semibold">TDS</TableHead>
                    <TableHead className="text-right font-semibold">Loan</TableHead>
                    <TableHead className="text-right font-semibold">Sal Adv</TableHead>
                    <TableHead className="text-right font-semibold">Other Ded</TableHead>
                    <TableHead className="text-right font-semibold bg-red-100">Tot. Ded</TableHead>
                    <TableHead className="text-right font-semibold bg-orange-100">Net Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSalarySheetData.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-orange-50/50">
                      <TableCell>{emp.division || "N/A"}</TableCell>
                      <TableCell className="font-medium text-orange-600">{emp.code}</TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.designation}</TableCell>
                      <TableCell>{emp.hq || "N/A"}</TableCell>
                      <TableCell>{emp.doj && isValid(parseISO(emp.doj)) ? format(parseISO(emp.doj), 'dd MMM yy') : "N/A"}</TableCell>
                      <TableCell className="text-center">{emp.totalDaysInMonth}</TableCell>
                      <TableCell className="text-center font-medium text-green-600">{emp.daysPaid.toFixed(1)}</TableCell>
                      <TableCell className="text-center">{emp.weekOffs}</TableCell>
                      <TableCell className="text-center font-medium text-red-600">{emp.daysAbsent.toFixed(1)}</TableCell>
                      <TableCell className="text-right bg-green-50">{emp.calculatedGross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right bg-blue-50">{(emp.actualBasic + emp.actualHRA + emp.actualCA + emp.actualOtherAllowance + emp.actualMedical).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell>
                        <Input type="number" defaultValue={emp.arrears} onBlur={(e) => handleEditableInputChange(emp.id, 'arrears', e.target.value)} className="h-8 w-20 text-right text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-semibold bg-green-100 text-green-700">{emp.totalAllowance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right">{emp.esic.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell>
                        <Input type="number" defaultValue={emp.professionalTax} onBlur={(e) => handleEditableInputChange(emp.id, 'professionalTax', e.target.value)} className="h-8 w-16 text-right text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" defaultValue={emp.providentFund} onBlur={(e) => handleEditableInputChange(emp.id, 'providentFund', e.target.value)} className="h-8 w-16 text-right text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" defaultValue={emp.tds} onBlur={(e) => handleEditableInputChange(emp.id, 'tds', e.target.value)} className="h-8 w-16 text-right text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" defaultValue={emp.loan} onBlur={(e) => handleEditableInputChange(emp.id, 'loan', e.target.value)} className="h-8 w-16 text-right text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" defaultValue={emp.salaryAdvance} onBlur={(e) => handleEditableInputChange(emp.id, 'salaryAdvance', e.target.value)} className="h-8 w-16 text-right text-sm" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" defaultValue={emp.manualOtherDeduction} onBlur={(e) => handleEditableInputChange(emp.id, 'manualOtherDeduction', e.target.value)} className="h-8 w-16 text-right text-sm" />
                      </TableCell>
                      <TableCell className="text-right font-semibold bg-red-100 text-red-700">{emp.totalDeduction.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right font-bold bg-orange-100 text-orange-700">{emp.netPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-gray-100 font-semibold">
                    <TableCell colSpan={10} className="text-right">Totals:</TableCell>
                    <TableCell className="text-right bg-green-50">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.calculatedGross, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right bg-blue-50">{filteredSalarySheetData.reduce((acc, curr) => acc + (curr.actualBasic + curr.actualHRA + curr.actualCA + curr.actualOtherAllowance + curr.actualMedical), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.arrears, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right bg-green-100 font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.totalAllowance, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.esic, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.professionalTax, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.providentFund, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.tds, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.loan, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.salaryAdvance, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.manualOtherDeduction, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right bg-red-100 font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.totalDeduction, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right bg-orange-100 font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.netPaid, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            ) : (
              <div className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500 font-medium">
                    {isLoadingData ? "Loading employee data..." :
                      allEmployees.length === 0 ? "No employees found in Employee Master" :
                        !selectedMonth || !selectedYear || selectedYear === 0 ? "Please select Month and Year" :
                          rawAttendanceForPeriod.length === 0 ? "No attendance data found for the selected month" :
                            searchTerm ? `No employees matching "${searchTerm}"` :
                              "No data to display"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}