
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
import { format, parseISO, isValid, getDaysInMonth, getMonth, getYear, startOfMonth, addMonths, isBefore, isEqual, endOfMonth, differenceInCalendarMonths } from "date-fns";

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
  const [fromMonthLedger, setFromMonthLedger] = React.useState<string>(months[new Date().getMonth()]);
  const [fromYearLedger, setFromYearLedger] = React.useState<number>(new Date().getFullYear());
  const [toMonthLedger, setToMonthLedger] = React.useState<string>(months[new Date().getMonth()]);
  const [toYearLedger, setToYearLedger] = React.useState<number>(new Date().getFullYear());


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
          else {
            console.warn("Reports Page: Employee master data in localStorage is not an array.");
            setEmployeeMasterList([]);
          }
        } else {
          setEmployeeMasterList([]);
        }
        const storedOB = localStorage.getItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
        if (storedOB) {
            const parsedOB = JSON.parse(storedOB);
            if(Array.isArray(parsedOB)) setOpeningBalances(parsedOB);
            else {
                console.warn("Reports Page: Opening balances in localStorage is not an array.");
                setOpeningBalances([]);
            }
        } else {
            setOpeningBalances([]);
        }
      } catch (error) {
        console.error("Error loading data for reports page:", error);
        toast({ title: "Error loading initial data", description: "Could not load employee master or opening balances.", variant: "destructive"});
        setEmployeeMasterList([]);
        setOpeningBalances([]);
      }
    }
    setIsLoadingEmployees(false);
  }, [toast]);

  const handleEmployeeSelectionForCompReport = (employeeId: string) => {
    setSelectedEmpComp(employeeId);
    const employee = employeeMasterList.find(emp => emp.id === employeeId);
    if (employee) {
      if (employee.doj && isValid(parseISO(employee.doj))) {
        setDateFromComp(format(parseISO(employee.doj), 'yyyy-MM-dd'));
      } else {
        setDateFromComp("");
      }

      if (employee.status === "Left" && employee.dor && isValid(parseISO(employee.dor))) {
        setDateToComp(format(parseISO(employee.dor), 'yyyy-MM-dd'));
      } else {
        setDateToComp(format(new Date(), 'yyyy-MM-dd')); // Default to current date if active or no DOR
      }
    } else {
      setDateFromComp("");
      setDateToComp("");
    }
  };


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
    if (!employee || !employee.doj || !isValid(parseISO(employee.doj))) {
      toast({ title: "Employee Data Error", description: "Selected employee details or a valid DOJ not found.", variant: "destructive" });
      setIsGeneratingReport(false);
      return;
    }

    const csvRows: string[][] = [];
    const headers = ["Month-Year", "Employee Code", "Employee Name", "CL Used", "SL Used", "PL Used", "CL Balance", "SL Balance", "PL Balance"];
    csvRows.push(headers);

    let currentDateIterator = startOfMonth(parseISO(employee.doj));
    const reportEndDate = endOfMonth(new Date()); // Up to end of current month

    try {
        while (isBefore(currentDateIterator, reportEndDate) || isEqual(currentDateIterator, reportEndDate)) {
            const currentReportMonthName = months[getMonth(currentDateIterator)];
            const currentReportYearValue = getYear(currentDateIterator);

            let usedCLInMonth = 0;
            let usedSLInMonth = 0;
            let usedPLInMonth = 0;

            const attendanceKey = getDynamicAttendanceStorageKey(currentReportMonthName, currentReportYearValue);
            if (attendanceKey && typeof window !== 'undefined') {
                const storedAttendance = localStorage.getItem(attendanceKey);
                if (storedAttendance) {
                    try {
                        const monthlyAttendanceForAll: MonthlyEmployeeAttendance[] = JSON.parse(storedAttendance);
                        const empAttendanceRecord = monthlyAttendanceForAll.find(att => att.code === employee.code);
                        if (empAttendanceRecord && empAttendanceRecord.attendance) {
                            empAttendanceRecord.attendance.forEach(status => {
                                if (status === 'CL') usedCLInMonth += 1;
                                else if (status === 'SL') usedSLInMonth += 1;
                                else if (status === 'PL') usedPLInMonth += 1;
                            });
                        }
                    } catch (e) {
                        console.warn(`Error parsing attendance for ${currentReportMonthName} ${currentReportYearValue}: ${e}`);
                    }
                }
            }
            
            const leaveDetails = calculateEmployeeLeaveDetailsForPeriod(
                employee,
                currentReportYearValue,
                getMonth(currentDateIterator),
                [], // Pass empty array for leave applications for this report type
                openingBalances
            );
            
            // Balances from calculation are EOM, so directly use them after adjusting for this month's usage.
            const finalCLBalance = leaveDetails.balanceCLAtMonthEnd - usedCLInMonth;
            const finalSLBalance = leaveDetails.balanceSLAtMonthEnd - usedSLInMonth;
            const finalPLBalance = leaveDetails.balancePLAtMonthEnd - usedPLInMonth;

            csvRows.push([
                `${currentReportMonthName}-${currentReportYearValue}`,
                employee.code,
                employee.name,
                usedCLInMonth.toFixed(1),
                usedSLInMonth.toFixed(1),
                usedPLInMonth.toFixed(1),
                finalCLBalance.toFixed(1),
                finalSLBalance.toFixed(1),
                finalPLBalance.toFixed(1),
            ]);

            if (getMonth(currentDateIterator) === getMonth(reportEndDate) && getYear(currentDateIterator) === getYear(reportEndDate)) {
                break; 
            }
            currentDateIterator = addMonths(currentDateIterator, 1);
        }

        if (csvRows.length <= 1) { // Only headers
            toast({ title: "No Data", description: `No leave usage data found for ${employee.name} from DOJ to current date.`, variant: "destructive" });
            setIsGeneratingReport(false);
            return;
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
    if (!fromMonthLedger || !fromYearLedger || !toMonthLedger || !toYearLedger) {
      toast({ title: "Selection Missing", description: "Please select a valid 'From' and 'To' date range for the salary ledger.", variant: "destructive" });
      return;
    }

    const fromDate = startOfMonth(new Date(fromYearLedger, months.indexOf(fromMonthLedger)));
    const toDate = endOfMonth(new Date(toYearLedger, months.indexOf(toMonthLedger)));

    if (isBefore(toDate, fromDate)) {
        toast({ title: "Invalid Date Range", description: "'From' date cannot be after 'To' date.", variant: "destructive"});
        return;
    }
    
    setIsGeneratingReport(true);

    let currentEmployeeMasterList: EmployeeDetail[] = [];
     if (typeof window !== 'undefined') {
        const empMasterStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (empMasterStr) {
            try { 
                const parsed = JSON.parse(empMasterStr);
                if (Array.isArray(parsed)) currentEmployeeMasterList = parsed;
            } catch(e) { 
                console.error("Error parsing employee master for salary ledger:", e);
                toast({ title: "Data Error", description: "Could not load employee master data.", variant: "destructive"});
                setIsGeneratingReport(false);
                return;
            }
        }
    }
    if (currentEmployeeMasterList.length === 0) {
        toast({ title: "No Employees", description: "No employees found in master data.", variant: "destructive"});
        setIsGeneratingReport(false);
        return;
    }

    const allSalarySheetDataForPeriod: any[] = [];
    let currentLoopDate = fromDate;
    let firstMonthAttendanceMissingNotified = false;

    while(isBefore(currentLoopDate, toDate) || isEqual(currentLoopDate, toDate)) {
        const currentMonthName = months[getMonth(currentLoopDate)];
        const currentYearValue = getYear(currentLoopDate);

        let attendanceForMonth: MonthlyEmployeeAttendance[] = [];
        let storedEditsForMonth: Record<string, EditableSalaryFields> = {};

        if (typeof window !== 'undefined') {
            const attendanceKey = getDynamicAttendanceStorageKey(currentMonthName, currentYearValue);
            if (attendanceKey) {
                const storedAttendance = localStorage.getItem(attendanceKey);
                if (storedAttendance) {
                    try { 
                        const parsedAtt = JSON.parse(storedAttendance);
                        if (Array.isArray(parsedAtt)) attendanceForMonth = parsedAtt;
                    } catch (e) { console.warn(`Error parsing attendance for ${currentMonthName} ${currentYearValue}: ${e}`); }
                }
            }
            const editsKey = getSalaryEditsStorageKey(currentMonthName, currentYearValue);
            if (editsKey) {
                const storedEditsStr = localStorage.getItem(editsKey);
                if (storedEditsStr) {
                    try { 
                        const parsedEdits = JSON.parse(storedEditsStr);
                        if (typeof parsedEdits === 'object' && parsedEdits !== null) storedEditsForMonth = parsedEdits;
                     } catch (e) { console.warn(`Error parsing salary edits for ${currentMonthName} ${currentYearValue}: ${e}`); }
                }
            }
        }

        if (attendanceForMonth.length === 0 && !firstMonthAttendanceMissingNotified && isEqual(currentLoopDate, fromDate)) {
            toast({ title: "No Attendance Data", description: `No attendance data found for the start of the period: ${currentMonthName} ${currentYearValue}. Report may be incomplete or empty.`, variant: "destructive", duration: 7000});
            firstMonthAttendanceMissingNotified = true;
        }
        
        currentEmployeeMasterList
          .forEach(emp => {
            const empAttendanceRecord = attendanceForMonth.find(att => att.code === emp.code);
            if (!empAttendanceRecord || !empAttendanceRecord.attendance) {
                return; 
            }

            const totalDaysInMonthValue = getDaysInMonth(new Date(currentYearValue, months.indexOf(currentMonthName)));
            const dailyStatuses = empAttendanceRecord.attendance.slice(0, totalDaysInMonthValue);
            
            let daysPaidCount = 0, weekOffsCount = 0, fullAbsentDaysCount = 0, halfDaysTakenCount = 0;
            dailyStatuses.forEach(status => {
              if (status === 'P' || status === 'CL' || status === 'SL' || status === 'PL' || status === 'PH') daysPaidCount++;
              else if (status === 'HD') { daysPaidCount += 0.5; halfDaysTakenCount++; }
              else if (status === 'W') { weekOffsCount++; daysPaidCount++; }
              else if (status === 'A') fullAbsentDaysCount++;
            });
            daysPaidCount = Math.min(daysPaidCount, totalDaysInMonthValue);
            const daysAbsentCalculated = fullAbsentDaysCount + (halfDaysTakenCount * 0.5);

            const monthlyComps = calculateMonthlySalaryComponents(emp.grossMonthlySalary);
            const payFactor = totalDaysInMonthValue > 0 ? daysPaidCount / totalDaysInMonthValue : 0;
            const actualBasicPay = monthlyComps.basic * payFactor;
            const actualHRAPay = monthlyComps.hra * payFactor;
            const actualCAPay = monthlyComps.ca * payFactor;
            const actualMedicalPay = monthlyComps.medical * payFactor;
            const actualOtherAllowancePay = monthlyComps.otherAllowance * payFactor;
            
            const empEdits = storedEditsForMonth[emp.id] || {};
            const arrearsValue = empEdits.arrears ?? 0;
            const tdsValue = empEdits.tds ?? 0;
            const loanValue = empEdits.loan ?? 0;
            const salaryAdvanceValue = empEdits.salaryAdvance ?? 0;
            const otherDeductionValue = empEdits.otherDeduction ?? 0;
            
            const totalAllowanceValue = actualBasicPay + actualHRAPay + actualCAPay + actualMedicalPay + actualOtherAllowancePay + arrearsValue;
            const esicValue = 0, professionalTaxValue = 0, providentFundValue = 0; // Placeholders
            const totalDeductionValue = esicValue + professionalTaxValue + providentFundValue + tdsValue + loanValue + salaryAdvanceValue + otherDeductionValue;
            const netPaidValue = totalAllowanceValue - totalDeductionValue;

            allSalarySheetDataForPeriod.push({
              period: `${currentMonthName}-${currentYearValue}`,
              ...emp, employeeStatus: emp.status, totalDaysInMonth: totalDaysInMonthValue, daysPaid: daysPaidCount, weekOffs: weekOffsCount, daysAbsent: daysAbsentCalculated,
              monthlyBasic: monthlyComps.basic, monthlyHRA: monthlyComps.hra, monthlyCA: monthlyComps.ca, monthlyOtherAllowance: monthlyComps.otherAllowance, monthlyMedical: monthlyComps.medical,
              actualBasic: actualBasicPay, actualHRA: actualHRAPay, actualCA: actualCAPay, actualOtherAllowance: actualOtherAllowancePay, actualMedical: actualMedicalPay,
              arrears: arrearsValue, tds: tdsValue, loan: loanValue, salaryAdvance: salaryAdvanceValue, otherDeduction: otherDeductionValue,
              totalAllowance: totalAllowanceValue, esic: esicValue, professionalTax: professionalTaxValue, providentFund: providentFundValue, totalDeduction: totalDeductionValue, netPaid: netPaidValue,
            });
          });
        
        if (getMonth(currentLoopDate) === getMonth(toDate) && getYear(currentLoopDate) === getYear(toDate)) {
            break;
        }
        currentLoopDate = addMonths(currentLoopDate, 1);
    }


    if (allSalarySheetDataForPeriod.length === 0) {
      toast({ title: "No Data", description: "No salary data found for any employee within the selected period. Ensure attendance data is uploaded.", variant: "destructive" });
      setIsGeneratingReport(false);
      return;
    }
    
    const headers = [
      "Period", "Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ",
      "Total Days", "Day Paid", "Week Off", "Day Absent",
      "Monthly Basic", "Monthly HRA", "Monthly CA", "Monthly Other Allowance", "Monthly Medical", "Monthly Gross",
      "Actual Basic", "Actual HRA", "Actual CA", "Actual Other Allowance", "Actual Medical",
      "Arrears", "Total Allowance",
      "ESIC", "Professional Tax", "PROVFUND", "TDS", "Loan", "Salary Advance", "Other Deduction",
      "Total Deduction", "Net Paid"
    ];
    const csvRows: string[][] = [headers];
    allSalarySheetDataForPeriod.forEach(empData => {
      if (!empData) return;
      const dojFormatted = empData.doj && isValid(parseISO(empData.doj)) ? format(parseISO(empData.doj), 'dd-MM-yyyy') : empData.doj || 'N/A';
      const row = [
        empData.period, empData.employeeStatus, empData.division || "N/A", empData.code, empData.name, empData.designation, empData.hq || "N/A", dojFormatted,
        empData.totalDaysInMonth.toString(), empData.daysPaid.toFixed(1), empData.weekOffs.toString(), empData.daysAbsent.toFixed(1),
        empData.monthlyBasic.toFixed(2), empData.monthlyHRA.toFixed(2), empData.monthlyCA.toFixed(2), empData.monthlyOtherAllowance.toFixed(2), empData.monthlyMedical.toFixed(2), empData.grossMonthlySalary.toFixed(2),
        empData.actualBasic.toFixed(2), empData.actualHRA.toFixed(2), empData.actualCA.toFixed(2), empData.actualOtherAllowance.toFixed(2), empData.actualMedical.toFixed(2),
        empData.arrears.toFixed(2), empData.totalAllowance.toFixed(2),
        empData.esic.toFixed(2), empData.professionalTax.toFixed(2), empData.providentFund.toFixed(2), empData.tds.toFixed(2), empData.loan.toFixed(2), empData.salaryAdvance.toFixed(2), empData.otherDeduction.toFixed(2),
        empData.totalDeduction.toFixed(2), empData.netPaid.toFixed(2),
      ].map(val => `"${String(val).replace(/"/g, '""')}"`); // Escape quotes within values
      csvRows.push(row);
    });
    
    const totals = {
        monthlyBasic: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.monthlyBasic || 0), 0),
        monthlyHRA: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.monthlyHRA || 0), 0),
        monthlyCA: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.monthlyCA || 0), 0),
        monthlyOtherAllowance: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.monthlyOtherAllowance || 0), 0),
        monthlyMedical: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.monthlyMedical || 0), 0),
        grossMonthlySalary: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.grossMonthlySalary || 0), 0),
        actualBasic: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.actualBasic || 0), 0),
        actualHRA: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.actualHRA || 0), 0),
        actualCA: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.actualCA || 0), 0),
        actualOtherAllowance: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.actualOtherAllowance || 0), 0),
        actualMedical: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.actualMedical || 0), 0),
        arrears: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.arrears || 0), 0),
        totalAllowance: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.totalAllowance || 0), 0),
        esic: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.esic || 0), 0),
        professionalTax: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.professionalTax || 0), 0),
        providentFund: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.providentFund || 0), 0),
        tds: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.tds || 0), 0),
        loan: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.loan || 0), 0),
        salaryAdvance: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.salaryAdvance || 0), 0),
        otherDeduction: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.otherDeduction || 0), 0),
        totalDeduction: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.totalDeduction || 0), 0),
        netPaid: allSalarySheetDataForPeriod.reduce((sum, empData) => sum + (empData?.netPaid || 0), 0),
    };

     const totalRow = [
        "GRAND TOTALS:", "", "", "", "", "", "", "", "", "", "", "",
        totals.monthlyBasic.toFixed(2), totals.monthlyHRA.toFixed(2), totals.monthlyCA.toFixed(2), totals.monthlyOtherAllowance.toFixed(2), totals.monthlyMedical.toFixed(2), totals.grossMonthlySalary.toFixed(2),
        totals.actualBasic.toFixed(2), totals.actualHRA.toFixed(2), totals.actualCA.toFixed(2), totals.actualOtherAllowance.toFixed(2), totals.actualMedical.toFixed(2),
        totals.arrears.toFixed(2), totals.totalAllowance.toFixed(2),
        totals.esic.toFixed(2), totals.professionalTax.toFixed(2), totals.providentFund.toFixed(2), totals.tds.toFixed(2), totals.loan.toFixed(2), totals.salaryAdvance.toFixed(2), totals.otherDeduction.toFixed(2),
        totals.totalDeduction.toFixed(2), totals.netPaid.toFixed(2),
    ].map(val => `"${String(val).replace(/"/g, '""')}"`);
    csvRows.push(totalRow);


    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const fromDateFormatted = format(fromDate, "MMMyyyy");
    const toDateFormatted = format(toDate, "MMMyyyy");
    link.setAttribute("download", `salary_ledger_${fromDateFormatted}_to_${toDateFormatted}_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Salary Ledger Generated", description: `CSV for ${fromDateFormatted} to ${toDateFormatted} download started.` });

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
              <Select value={selectedEmpComp} onValueChange={handleEmployeeSelectionForCompReport}>
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
            <CardDescription>Download a detailed salary ledger for all employees for a selected date range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="fromMonthLedger">From Month</Label>
                <Select value={fromMonthLedger} onValueChange={setFromMonthLedger}>
                  <SelectTrigger id="fromMonthLedger"><SelectValue placeholder="Select Month" /></SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={"from-"+month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fromYearLedger">From Year</Label>
                <Select value={fromYearLedger > 0 ? fromYearLedger.toString() : ""} onValueChange={(value) => setFromYearLedger(parseInt(value))}>
                  <SelectTrigger id="fromYearLedger"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => <SelectItem key={"from-"+year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="toMonthLedger">To Month</Label>
                <Select value={toMonthLedger} onValueChange={setToMonthLedger}>
                  <SelectTrigger id="toMonthLedger"><SelectValue placeholder="Select Month" /></SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={"to-"+month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="toYearLedger">To Year</Label>
                <Select value={toYearLedger > 0 ? toYearLedger.toString() : ""} onValueChange={(value) => setToYearLedger(parseInt(value))}>
                  <SelectTrigger id="toYearLedger"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => <SelectItem key={"to-"+year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleGenerateSalaryLedger} 
              disabled={isGeneratingReport || !fromMonthLedger || fromYearLedger === 0 || !toMonthLedger || toYearLedger === 0}
            >
              {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download Salary Ledger (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

    
