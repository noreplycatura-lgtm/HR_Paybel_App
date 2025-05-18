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
import { format, parseISO, isValid, getDaysInMonth, startOfMonth } from "date-fns";

// These would be Firestore collection names
// const FIRESTORE_EMPLOYEE_MASTER_COLLECTION = "employees";
// const FIRESTORE_ATTENDANCE_COLLECTION_PREFIX = "attendance_";
// const FIRESTORE_SALARY_EDITS_COLLECTION_PREFIX = "salaryEdits_";
// const FIRESTORE_PERFORMANCE_DEDUCTIONS_COLLECTION = "performanceDeductions";


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
}

interface PerformanceDeductionEntry {
  id: string;
  employeeCode: string;
  month: string;
  year: number;
  amount: number;
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
  
  const [isLoading, setIsLoading] = React.useState(true); // For initial month/year setup
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true); // For master data
  const [isLoadingCalculations, setIsLoadingCalculations] = React.useState(false); // For sheet generation

  React.useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    setCurrentYearState(currentYear);
    setSelectedMonth(months[now.getMonth()]);
    setSelectedYear(currentYear);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    setIsLoadingEmployees(true);
    // TODO: Fetch allEmployees and allPerformanceDeductions from Firestore
    // Example:
    // const fetchData = async () => {
    //   // const empSnap = await getDocs(collection(db, FIRESTORE_EMPLOYEE_MASTER_COLLECTION));
    //   // setAllEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeDetail)));
    //   // const perfDedSnap = await getDocs(collection(db, FIRESTORE_PERFORMANCE_DEDUCTIONS_COLLECTION));
    //   // setAllPerformanceDeductions(perfDedSnap.docs.map(doc => doc.data() as PerformanceDeductionEntry));
    //   setAllEmployees([]);
    //   setAllPerformanceDeductions([]);
    //   setIsLoadingEmployees(false);
    // };
    // fetchData();
    setAllEmployees([]);
    setAllPerformanceDeductions([]);
    setIsLoadingEmployees(false);
    toast({
        title: "Data Source Changed",
        description: "Salary Sheet data would now be fetched from Firestore. Currently showing empty.",
        duration: 7000,
    });
  }, [toast]);

  React.useEffect(() => {
    if (isLoading || isLoadingEmployees || !selectedMonth || !selectedYear || selectedYear === 0) {
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

    const targetDateForMonth = startOfMonth(new Date(selectedYear, monthIndex, 1));
    const totalDaysInMonth = getDaysInMonth(targetDateForMonth);
    let attendanceForMonth: MonthlyEmployeeAttendance[] = [];
    let storedEdits: Record<string, EditableSalaryFields> = {};

    // TODO: Fetch attendance and salaryEdits from Firestore for selectedMonth/selectedYear
    // Example:
    // const fetchPeriodData = async () => {
    //   // ... fetch attendance records for month/year ...
    //   // setRawAttendanceForPeriod(fetchedAttendance);
    //   // ... fetch salary edits for month/year ...
    //   // setSalaryEditsForPeriod(fetchedEdits);
    //   setRawAttendanceForPeriod([]);
    //   setSalaryEditsForPeriod({});
    //   // Then proceed with calculations
    // };
    // fetchPeriodData().then(() => { ... calculations ... });
    setRawAttendanceForPeriod([]); // Simulate empty
    setSalaryEditsForPeriod({});   // Simulate empty

    const newSalarySheetData = allEmployees
      .map(emp => {
        const empAttendanceRecord = rawAttendanceForPeriod.find(att => att.code === emp.code);
        
        if (!empAttendanceRecord || !empAttendanceRecord.attendance) {
            return null; 
        }

        const dailyStatuses = empAttendanceRecord.attendance.slice(0, totalDaysInMonth);
        let daysPaid = 0;
        let weekOffs = 0;
        let fullAbsentDays = 0;
        let halfDaysTaken = 0;

        dailyStatuses.forEach(status => {
          if (status === 'P' || status === 'CL' || status === 'SL' || status === 'PL' || status === 'PH') {
            daysPaid++;
          } else if (status === 'HD') {
            daysPaid += 0.5; halfDaysTaken++;
          } else if (status === 'W') {
            weekOffs++; daysPaid++;
          } else if (status === 'A') {
            fullAbsentDays++;
          }
        });
        
        daysPaid = Math.min(daysPaid, totalDaysInMonth);
        const daysAbsentCalculated = fullAbsentDays + (halfDaysTaken * 0.5);
        const monthlyComponents = calculateMonthlySalaryComponents(emp, selectedYear, monthIndex);
        const payFactor = totalDaysInMonth > 0 ? daysPaid / totalDaysInMonth : 0;

        const actualBasic = monthlyComponents.basic * payFactor;
        const actualHRA = monthlyComponents.hra * payFactor;
        const actualCA = monthlyComponents.ca * payFactor;
        const actualMedical = monthlyComponents.medical * payFactor;
        const actualOtherAllowance = monthlyComponents.otherAllowance * payFactor;
        
        const empEdits = salaryEditsForPeriod[emp.id] || {};
        const arrears = empEdits.arrears ?? 0;
        const tds = empEdits.tds ?? 0;
        const loan = empEdits.loan ?? 0;
        const salaryAdvance = empEdits.salaryAdvance ?? 0;
        const manualOtherDeductionVal = empEdits.manualOtherDeduction ?? 0;

        const performanceDeductionEntry = allPerformanceDeductions.find(
          pd => pd.employeeCode === emp.code && pd.month === selectedMonth && pd.year === selectedYear
        );
        const performanceDeductionAmount = performanceDeductionEntry?.amount || 0;
        
        const totalAllowance = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;
        const esic = 0; const professionalTax = 0; const providentFund = 0;
        const totalDeduction = esic + professionalTax + providentFund + tds + loan + salaryAdvance + manualOtherDeductionVal + performanceDeductionAmount;
        const netPaid = totalAllowance - totalDeduction;

        return {
          ...emp, totalDaysInMonth, daysPaid, weekOffs, daysAbsent: daysAbsentCalculated,
          monthlyBasic: monthlyComponents.basic, monthlyHRA: monthlyComponents.hra, monthlyCA: monthlyComponents.ca,
          monthlyOtherAllowance: monthlyComponents.otherAllowance, monthlyMedical: monthlyComponents.medical,
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
  }, [allEmployees, selectedMonth, selectedYear, isLoading, isLoadingEmployees, allPerformanceDeductions, toast]);


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

  const handleEditableInputChange = async (employeeId: string, fieldName: keyof EditableSalaryFields, value: string) => {
    const numericValue = parseFloat(value) || 0;
    
    setSalarySheetData(prevData => {
      const newData = prevData.map(emp => {
        if (emp.id === employeeId) {
          const updatedEmp = { ...emp, [fieldName]: numericValue };
          const newTotalAllowance = updatedEmp.actualBasic + updatedEmp.actualHRA + updatedEmp.actualCA + updatedEmp.actualMedical + updatedEmp.actualOtherAllowance + updatedEmp.arrears;
          const newTotalDeduction = updatedEmp.esic + updatedEmp.professionalTax + updatedEmp.providentFund + updatedEmp.tds + updatedEmp.loan + updatedEmp.salaryAdvance + updatedEmp.manualOtherDeduction + updatedEmp.performanceDeduction;
          const newNetPaid = newTotalAllowance - newTotalDeduction;
          return { ...updatedEmp, totalAllowance: newTotalAllowance, totalDeduction: newTotalDeduction, netPaid: newNetPaid };
        }
        return emp;
      });
      return newData;
    });

    // Conceptually save to Firestore
    if (selectedMonth && selectedYear > 0) {
        const updatedEdits = { ...salaryEditsForPeriod };
        if (!updatedEdits[employeeId]) updatedEdits[employeeId] = {};
        updatedEdits[employeeId]![fieldName] = numericValue;
        setSalaryEditsForPeriod(updatedEdits);
        // TODO: Update Firestore document for salaryEdits for this month/year
        // await updateSalaryEditsInFirestore(selectedMonth, selectedYear, updatedEdits);
        console.log("Conceptual save of salary edits for", employeeId, fieldName, numericValue);
    }
  };

  const handleDownloadSheet = () => {
    if (salarySheetData.length === 0) {
      toast({ title: "No Data", description: "No salary data for selected period.", variant: "destructive" });
      return;
    }

    const headers = [
      "Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ",
      "Total Days", "Day Paid", "Week Off", "Day Absent",
      "Monthly Basic", "Monthly HRA", "Monthly CA", "Monthly Other Allowance", "Monthly Medical", "Monthly Gross",
      "Actual Basic", "Actual HRA", "Actual CA", "Actual Other Allowance", "Actual Medical",
      "Arrears", "Total Allowance",
      "ESIC", "Professional Tax", "PROVFUND", "TDS", "Loan", "Salary Advance", "Manual Other Ded.", "Performance Ded.", "Total Other Ded.",
      "Total Deduction", "Net Paid"
    ];
    const csvRows = [headers.join(',')];
    
    salarySheetData.forEach(emp => { // Use salarySheetData which includes all employees (active/left)
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
        monthlyBasic: salarySheetData.reduce((sum, emp) => sum + emp.monthlyBasic, 0),
        monthlyHRA: salarySheetData.reduce((sum, emp) => sum + emp.monthlyHRA, 0),
        monthlyCA: salarySheetData.reduce((sum, emp) => sum + emp.monthlyCA, 0),
        monthlyOtherAllowance: salarySheetData.reduce((sum, emp) => sum + emp.monthlyOtherAllowance, 0),
        monthlyMedical: salarySheetData.reduce((sum, emp) => sum + emp.monthlyMedical, 0),
        calculatedGross: salarySheetData.reduce((sum, emp) => sum + emp.calculatedGross, 0),
        actualBasic: salarySheetData.reduce((sum, emp) => sum + emp.actualBasic, 0),
        actualHRA: salarySheetData.reduce((sum, emp) => sum + emp.actualHRA, 0),
        actualCA: salarySheetData.reduce((sum, emp) => sum + emp.actualCA, 0),
        actualOtherAllowance: salarySheetData.reduce((sum, emp) => sum + emp.actualOtherAllowance, 0),
        actualMedical: salarySheetData.reduce((sum, emp) => sum + emp.actualMedical, 0),
        arrears: salarySheetData.reduce((sum, emp) => sum + emp.arrears, 0),
        totalAllowance: salarySheetData.reduce((sum, emp) => sum + emp.totalAllowance, 0),
        esic: salarySheetData.reduce((sum, emp) => sum + emp.esic, 0),
        professionalTax: salarySheetData.reduce((sum, emp) => sum + emp.professionalTax, 0),
        providentFund: salarySheetData.reduce((sum, emp) => sum + emp.providentFund, 0),
        tds: salarySheetData.reduce((sum, emp) => sum + emp.tds, 0),
        loan: salarySheetData.reduce((sum, emp) => sum + emp.loan, 0),
        salaryAdvance: salarySheetData.reduce((sum, emp) => sum + emp.salaryAdvance, 0),
        manualOtherDeduction: salarySheetData.reduce((sum, emp) => sum + emp.manualOtherDeduction, 0),
        performanceDeduction: salarySheetData.reduce((sum, emp) => sum + emp.performanceDeduction, 0),
        totalOtherDeduction: salarySheetData.reduce((sum, emp) => sum + (emp.manualOtherDeduction + emp.performanceDeduction), 0),
        totalDeduction: salarySheetData.reduce((sum, emp) => sum + emp.totalDeduction, 0),
        netPaid: salarySheetData.reduce((sum, emp) => sum + emp.netPaid, 0),
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
      <PageHeader title="Salary Sheet" description="Generate and download month-wise salary sheets. Some fields are editable. (Data is illustrative and not persisted to a backend).">
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
          <CardDescription>Displaying active employees with attendance. Download includes all employees. Manual Other Deduction and Performance Deduction are summed into Total Other Deduction. ESIC, PT, PF are placeholders (0).</CardDescription>
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
                  <TableHead className="text-center min-w-[80px]">Day Absent</TableHead>
                  <TableHead className="text-right min-w-[100px]">M_Basic (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">M_HRA (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">M_CA (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">M_Other (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">M_Medical (₹)</TableHead>
                  <TableHead className="text-right min-w-[110px]">M_Gross (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actual_Basic (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actual_HRA (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actual_CA (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actual_Other (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actual_Medical (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Arrears (₹)</TableHead>
                  <TableHead className="text-right min-w-[120px]">Total Earning (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">ESIC (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Prof. Tax (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">PF (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">TDS (₹)</TableHead>
                  <TableHead className="text-right min-w-[100px]">Loan (₹)</TableHead>
                  <TableHead className="text-right min-w-[120px]">Salary Adv (₹)</TableHead>
                  <TableHead className="text-right min-w-[120px]">Manual Other Ded (₹)</TableHead>
                  <TableHead className="text-right min-w-[140px]">Performance Ded (₹)</TableHead>
                  <TableHead className="text-right min-w-[120px]">Total Ded (₹)</TableHead>
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
                    <TableCell className="text-right">{emp.monthlyBasic.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.monthlyHRA.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.monthlyCA.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.monthlyOtherAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.monthlyMedical.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.calculatedGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.actualBasic.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.actualHRA.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.actualCA.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.actualOtherAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.actualMedical.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Input type="number" defaultValue={emp.arrears} onChange={(e) => handleEditableInputChange(emp.id, 'arrears', e.target.value)} className="h-8 w-24 text-right tabular-nums"/>
                    </TableCell>
                    <TableCell className="text-right">{emp.totalAllowance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.esic.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.professionalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{emp.providentFund.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Input type="number" defaultValue={emp.tds} onChange={(e) => handleEditableInputChange(emp.id, 'tds', e.target.value)} className="h-8 w-24 text-right tabular-nums"/>
                    </TableCell>
                    <TableCell>
                      <Input type="number" defaultValue={emp.loan} onChange={(e) => handleEditableInputChange(emp.id, 'loan', e.target.value)} className="h-8 w-24 text-right tabular-nums"/>
                    </TableCell>
                    <TableCell>
                      <Input type="number" defaultValue={emp.salaryAdvance} onChange={(e) => handleEditableInputChange(emp.id, 'salaryAdvance', e.target.value)} className="h-8 w-24 text-right tabular-nums"/>
                    </TableCell>
                    <TableCell>
                      <Input type="number" defaultValue={emp.manualOtherDeduction} onChange={(e) => handleEditableInputChange(emp.id, 'manualOtherDeduction', e.target.value)} className="h-8 w-24 text-right tabular-nums"/>
                    </TableCell>
                    <TableCell className="text-right">{emp.performanceDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{(emp.manualOtherDeduction + emp.performanceDeduction).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-semibold">{emp.netPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
               <TableFooter>
                <TableRow>
                    <TableCell colSpan={10} className="text-right font-semibold">
                        {searchTerm ? `Filtered Active Employees Totals:` : `Total Active Employees Displayed Totals:`}
                    </TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.monthlyBasic, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.monthlyHRA, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.monthlyCA, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.monthlyOtherAllowance, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.monthlyMedical, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.calculatedGross, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.actualBasic, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.actualHRA, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.actualCA, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.actualOtherAllowance, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.actualMedical, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.arrears, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.totalAllowance, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.esic, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.professionalTax, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.providentFund, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.tds, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.loan, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.salaryAdvance, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.manualOtherDeduction, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.performanceDeduction, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{(filteredSalarySheetData.reduce((acc, curr) => acc + (curr.totalDeduction) , 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">{filteredSalarySheetData.reduce((acc, curr) => acc + curr.netPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {isLoadingCalculations ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /> :
               allEmployees.length === 0 ? "No employee data. (Data would be fetched from Firestore)." :
               !selectedMonth || !selectedYear || selectedYear === 0 ? "Please select Month and Year to view salary sheet. (Data would be fetched from Firestore)." :
               rawAttendanceForPeriod.length === 0 ? "No attendance data for selected month. (Data would be fetched from Firestore)." :
               salarySheetData.length === 0 && rawAttendanceForPeriod.length > 0 ? "No employees from master have attendance data for selected month." :
               searchTerm && filteredSalarySheetData.length === 0 ? `No active employees with attendance found matching "${searchTerm}".` :
               "No active employees with attendance to display. (Data would be fetched from Firestore)."}
            </div>
          )}
        </CardContent>
      </Card>
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
