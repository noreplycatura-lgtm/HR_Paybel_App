
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserCheck, DollarSign, History, FileText, HardDrive, UploadCloud, DownloadCloud, Activity, Loader2, KeySquare } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { useToast } from "@/hooks/use-toast";
import { getMonth, getYear, subMonths, format, startOfMonth, endOfMonth } from "date-fns";
import type { LeaveApplication } from "@/lib/hr-types";
import { calculateMonthlySalaryComponents } from "@/lib/salary-calculations";

// LocalStorage Keys
const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX = "novita_attendance_filename_v4_";
const LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY = "novita_last_upload_context_v4";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX = "novita_salary_sheet_edits_v1_";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "novita_performance_deductions_v1";
const LOCAL_STORAGE_SIMULATED_USERS_KEY = "novita_simulated_users_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface StoredEmployeeAttendanceData {
  code: string;
  attendance: string[];
}

interface SalarySheetEdits {
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
}

interface MonthlySalaryTotal {
  monthYear: string;
  total: number;
}


export default function DashboardPage() {
  const { toast } = useToast();
  const [dashboardCards, setDashboardCards] = React.useState([
    { title: "Total Employees", value: "N/A", icon: UserCheck, description: "0 Active, 0 Left", dataAiHint: "team office" },
    { title: "Total Leave Records", value: "N/A", icon: History, description: "All recorded leave entries", dataAiHint: "documents list" },
    { title: "Payroll Status (Last Mth)", value: "N/A", icon: FileText, description: "For previous month", dataAiHint: "report checkmark" },
    { title: "Storage Used", value: "N/A", icon: HardDrive, description: "Approx. size of app data", dataAiHint: "data storage" },
  ]);

  const [lastFiveMonthsSalaryData, setLastFiveMonthsSalaryData] = React.useState<MonthlySalaryTotal[]>([]);
  const [grandTotalLastFiveMonths, setGrandTotalLastFiveMonths] = React.useState<number>(0);
  const [isLoadingSalaries, setIsLoadingSalaries] = React.useState(true);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [exportedDataJson, setExportedDataJson] = React.useState("");
  const [importDataJson, setImportDataJson] = React.useState("");
  const [recentActivities, setRecentActivities] = React.useState<ActivityLogEntry[]>([]);


  React.useEffect(() => {
    setIsLoading(true);
    setIsLoadingSalaries(true);

    let totalEmployeesCount = 0;
    let activeEmployeesCount = 0;
    let leftEmployeesCount = 0;
    let totalLeaveRecordsCount = 0;
    let payrollStatusValue = "N/A";
    let payrollStatusDescription = "For previous month";
    let employeeMasterList: EmployeeDetail[] = [];
    let allPerfDeductions: PerformanceDeductionEntry[] = [];
    let storageUsedValue = "N/A";
    
    if (typeof window !== 'undefined') {
      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployeesStr) {
          const parsedEmployees = JSON.parse(storedEmployeesStr);
          if (Array.isArray(parsedEmployees)) {
            employeeMasterList = parsedEmployees;
            totalEmployeesCount = parsedEmployees.length;
            activeEmployeesCount = parsedEmployees.filter(emp => emp.status === "Active").length;
            leftEmployeesCount = parsedEmployees.filter(emp => emp.status === "Left").length;
          } else {
             console.warn("Employee master data in localStorage is corrupted. Defaulting to empty.");
          }
        }

        const storedLeaveAppsStr = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedLeaveAppsStr) {
            try {
              const parsedApps: LeaveApplication[] = JSON.parse(storedLeaveAppsStr);
              totalLeaveRecordsCount = Array.isArray(parsedApps) ? parsedApps.length : 0;
            } catch (e) {
              console.error("Error parsing leave applications from localStorage:", e);
              totalLeaveRecordsCount = 0;
            }
        }

        const storedPerfDeductionsStr = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
        if (storedPerfDeductionsStr) {
            const parsedPerfDeductions = JSON.parse(storedPerfDeductionsStr);
            if(Array.isArray(parsedPerfDeductions)) allPerfDeductions = parsedPerfDeductions;
        }

        // Calculate Storage Used
        let totalAppSpecificBytes = 0;
        const appKeys = [
          LOCAL_STORAGE_EMPLOYEE_MASTER_KEY,
          LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY,
          LOCAL_STORAGE_OPENING_BALANCES_KEY,
          LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY,
          LOCAL_STORAGE_SIMULATED_USERS_KEY,
          LOCAL_STORAGE_RECENT_ACTIVITIES_KEY,
          LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY
        ];
        const appPrefixes = [
          LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX,
          LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX,
          LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX
        ];

        appKeys.forEach(key => {
          const item = localStorage.getItem(key);
          if (item) {
            totalAppSpecificBytes += item.length; // Assuming 1 char ~ 1 byte for approximation
          }
        });

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            let matchedPrefix = false;
            for (const prefix of appPrefixes) {
              if (key.startsWith(prefix)) {
                matchedPrefix = true;
                break;
              }
            }
            if (matchedPrefix) {
              const item = localStorage.getItem(key);
              if (item) {
                totalAppSpecificBytes += item.length;
              }
            }
          }
        }
        
        if (totalAppSpecificBytes > 0) {
          if (totalAppSpecificBytes < 1024) {
            storageUsedValue = `${totalAppSpecificBytes.toFixed(0)} Bytes`;
          } else if (totalAppSpecificBytes < 1024 * 1024) {
            storageUsedValue = `${(totalAppSpecificBytes / 1024).toFixed(2)} KB`;
          } else {
            storageUsedValue = `${(totalAppSpecificBytes / (1024 * 1024)).toFixed(2)} MB`;
          }
        } else {
            storageUsedValue = "0 Bytes";
        }


        const monthlyTotals: MonthlySalaryTotal[] = [];
        let fiveMonthGrandTotal = 0;

        for (let i = 1; i <= 5; i++) {
          const targetDate = subMonths(new Date(), i);
          const monthName = months[getMonth(targetDate)];
          const year = getYear(targetDate);
          let monthNetTotal = 0;

          const attendanceKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${monthName}_${year}`;
          const salaryEditsKey = `${LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX}${monthName}_${year}`;
          
          const storedAttendanceStr = localStorage.getItem(attendanceKey);
          const storedSalaryEditsStr = localStorage.getItem(salaryEditsKey);
          
          const attendanceForMonth: StoredEmployeeAttendanceData[] = storedAttendanceStr ? JSON.parse(storedAttendanceStr) : [];
          const salaryEditsForMonth: Record<string, SalarySheetEdits> = storedSalaryEditsStr ? JSON.parse(storedSalaryEditsStr) : {};
          const perfDeductionsForMonth = allPerfDeductions.filter(pd => pd.month === monthName && pd.year === year);

          if (attendanceForMonth.length > 0 && employeeMasterList.length > 0) {
            employeeMasterList.forEach(emp => {
              const empAttendanceRecord = attendanceForMonth.find(att => att.code === emp.code);
              if (empAttendanceRecord) {
                const totalDaysInMonth = new Date(year, getMonth(targetDate) + 1, 0).getDate();
                let daysPaid = 0;
                empAttendanceRecord.attendance.slice(0, totalDaysInMonth).forEach(status => {
                  if (['P', 'W', 'PH', 'CL', 'SL', 'PL'].includes(status.toUpperCase())) daysPaid++;
                  else if (status.toUpperCase() === 'HD') daysPaid += 0.5;
                });
                daysPaid = Math.min(daysPaid, totalDaysInMonth);

                const monthlyComps = calculateMonthlySalaryComponents(emp, year, getMonth(targetDate));
                const payFactor = totalDaysInMonth > 0 ? daysPaid / totalDaysInMonth : 0;
                
                const actualBasic = monthlyComps.basic * payFactor;
                const actualHRA = monthlyComps.hra * payFactor;
                const actualCA = monthlyComps.ca * payFactor;
                const actualMedical = monthlyComps.medical * payFactor;
                const actualOtherAllowance = monthlyComps.otherAllowance * payFactor;

                const empEdits = salaryEditsForMonth[emp.id] || {};
                const arrears = empEdits.arrears ?? 0;
                const tds = empEdits.tds ?? 0;
                const loan = empEdits.loan ?? 0;
                const salaryAdvance = empEdits.salaryAdvance ?? 0;
                const manualOtherDeduction = empEdits.manualOtherDeduction ?? 0;
                
                const perfDeductionEntry = perfDeductionsForMonth.find(pd => pd.employeeCode === emp.code);
                const performanceDeduction = perfDeductionEntry?.amount || 0;
                const totalOtherDeduction = manualOtherDeduction + performanceDeduction;

                const totalAllowance = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;
                const totalDeductionValue = 0 + 0 + 0 + tds + loan + salaryAdvance + totalOtherDeduction; // ESIC, PT, PF are 0
                monthNetTotal += (totalAllowance - totalDeductionValue);
              }
            });
          }
          monthlyTotals.push({ monthYear: `${monthName} ${year}`, total: monthNetTotal });
          fiveMonthGrandTotal += monthNetTotal;
        }
        setLastFiveMonthsSalaryData(monthlyTotals.reverse());
        setGrandTotalLastFiveMonths(fiveMonthGrandTotal);
        setIsLoadingSalaries(false);

        const lastMonthDate = subMonths(new Date(), 1);
        const prevMonthName = months[getMonth(lastMonthDate)];
        const prevMonthYear = getYear(lastMonthDate);
        const attendanceKeyPrevMonth = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${prevMonthName}_${prevMonthYear}`;
        const storedAttendancePrevMonthStr = localStorage.getItem(attendanceKeyPrevMonth);

        if (storedAttendancePrevMonthStr) {
            try {
              const parsedLastMonthAtt = JSON.parse(storedAttendancePrevMonthStr);
              if (Array.isArray(parsedLastMonthAtt) && parsedLastMonthAtt.length > 0) {
                  payrollStatusValue = "Processed";
                  payrollStatusDescription = `Attendance found for ${prevMonthName} ${prevMonthYear}`;
              } else {
                   payrollStatusValue = "Pending";
                   payrollStatusDescription = `Awaiting ${prevMonthName} ${prevMonthYear} attendance`;
              }
            } catch (e) {
              console.error("Error parsing last month's attendance for payroll status:", e);
              payrollStatusValue = "Error";
              payrollStatusDescription = `Error reading ${prevMonthName} ${prevMonthYear} attendance`;
            }
        } else {
           payrollStatusValue = "Pending";
           payrollStatusDescription = `Awaiting ${prevMonthName} ${prevMonthYear} attendance`;
        }

        const storedActivitiesStr = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
        if (storedActivitiesStr) {
          try {
            const parsedActivities: ActivityLogEntry[] = JSON.parse(storedActivitiesStr);
            setRecentActivities(Array.isArray(parsedActivities) ? parsedActivities.slice(0, 5) : []);
          } catch (e) {
            console.error("Error parsing recent activities from localStorage:", e);
            setRecentActivities([]);
          }
        } else {
           setRecentActivities([]);
        }

      } catch (error) {
          console.error("Dashboard: Error fetching data from localStorage:", error);
          toast({ title: "Dashboard Data Error", description: "Could not load some data. Figures may be inaccurate.", variant: "destructive" });
      }
    }
    setDashboardCards(prevCards => prevCards.map(card => {
      if (card.title === "Total Employees") return { ...card, value: totalEmployeesCount.toString(), description: `${activeEmployeesCount} Active, ${leftEmployeesCount} Left` };
      if (card.title === "Total Leave Records") return { ...card, value: totalLeaveRecordsCount.toString() };
      if (card.title === "Payroll Status (Last Mth)") return { ...card, value: payrollStatusValue, description: payrollStatusDescription };
      if (card.title === "Storage Used") return { ...card, value: storageUsedValue, description: "Approx. size of app data in local storage" };
      return card;
    }));
    setIsLoading(false);
  }, []);


  const handleExportData = () => {
    if (typeof window === 'undefined') return;
    const allData: Record<string, any> = {};
    
    const knownFixedKeys = [
      LOCAL_STORAGE_EMPLOYEE_MASTER_KEY,
      LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY,
      LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY,
      LOCAL_STORAGE_OPENING_BALANCES_KEY,
      LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY,
      LOCAL_STORAGE_SIMULATED_USERS_KEY,
      LOCAL_STORAGE_RECENT_ACTIVITIES_KEY 
    ];

    knownFixedKeys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          allData[key] = JSON.parse(item);
        } catch (e) {
          allData[key] = item; 
          console.warn(`Could not parse JSON for key ${key} during export, storing as raw string.`);
        }
      }
    });

    const knownDynamicPrefixes = [
      LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX,
      LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX,
      LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX
    ];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && knownDynamicPrefixes.some(prefix => key.startsWith(prefix))) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            allData[key] = JSON.parse(item);
          } catch (e) {
            allData[key] = item;
            console.warn(`Could not parse JSON for prefixed key ${key} during export, storing as raw string.`);
          }
        }
      }
    }
    setExportedDataJson(JSON.stringify(allData, null, 2));
    setIsExportDialogOpen(true);
  };

  const handleDownloadExportedFile = () => {
    if (!exportedDataJson) {
      toast({ title: "No Data", description: "No data available to download.", variant: "destructive" });
      return;
    }
    const blob = new Blob([exportedDataJson], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "hr_payroll_app_data_export.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Download Started", description: "hr_payroll_app_data_export.json is being downloaded." });
  };

  const handleImportData = () => {
    if (typeof window === 'undefined' || !importDataJson) {
      toast({ title: "No Data", description: "Please paste the JSON data to import.", variant: "destructive" });
      return;
    }
    try {
      const dataToImport = JSON.parse(importDataJson);
      if (typeof dataToImport !== 'object' || dataToImport === null) {
        toast({ title: "Invalid JSON", description: "The provided text is not a valid JSON object.", variant: "destructive" });
        return;
      }

      const knownKeysForClear = [
          LOCAL_STORAGE_EMPLOYEE_MASTER_KEY,
          LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY,
          LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY,
          LOCAL_STORAGE_OPENING_BALANCES_KEY,
          LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY,
          LOCAL_STORAGE_SIMULATED_USERS_KEY,
          LOCAL_STORAGE_RECENT_ACTIVITIES_KEY
      ];
      const knownDynamicPrefixesForClear = [
        LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX,
        LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX,
        LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX
      ];

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if(key && (knownDynamicPrefixesForClear.some(prefix => key.startsWith(prefix)) ||
             knownKeysForClear.includes(key))) {
            keysToRemove.push(key);
          }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      for (const key in dataToImport) {
        if (Object.prototype.hasOwnProperty.call(dataToImport, key)) {
          localStorage.setItem(key, JSON.stringify(dataToImport[key]));
        }
      }
      toast({ title: "Import Successful", description: "Data imported. Please refresh the application to see changes." });
      setIsImportDialogOpen(false);
      setImportDataJson("");
      window.location.reload(); 
    } catch (error) {
      console.error("Error importing data:", error);
      toast({ title: "Import Error", description: "Could not parse or import JSON data. Check format and ensure it's valid JSON from a previous export.", variant: "destructive", duration: 7000 });
    }
  };


  if (isLoading && isLoadingSalaries) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview of HR activities. (This software operates on offline data stored in your browser's local storage)." />
        <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
              <CardTitle>Prototype Data Management (Local Storage)</CardTitle>
              <CardDescription>
                Manually export or import all application data stored in your browser's local storage.
                This export includes all entered employees, monthly attendance, leave balances, salary edits, performance deductions, recent activities, and user accounts. 
                It does NOT export the application code itself. Importing data will overwrite existing local data.
              </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button variant="outline" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</Button>
            <Button variant="outline" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {dashboardCards.map((card, index) => (
                 <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        <card.icon className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 w-1/2 bg-muted rounded animate-pulse mb-1"></div>
                        <div className="h-3 w-3/4 bg-muted rounded animate-pulse"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
        <Card className="mt-6 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Last 5 Months' Salary Totals</CardTitle>
            <CardDescription>Grand total net pay for the last five months.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-6 w-1/4 bg-muted rounded animate-pulse mb-2"></div>
            <div className="h-6 w-1/3 bg-muted rounded animate-pulse mb-2"></div>
            <div className="h-6 w-1/4 bg-muted rounded animate-pulse mb-2"></div>
            <div className="h-6 w-1/3 bg-muted rounded animate-pulse mb-2"></div>
            <div className="h-6 w-1/4 bg-muted rounded animate-pulse mb-4"></div>
            <div className="h-8 w-1/2 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
         <div className="grid gap-6 mt-8 md:grid-cols-2">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest updates and notifications from your HR portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-2"></div>
              <div className="h-4 w-full bg-muted rounded animate-pulse mb-2"></div>
              <div className="h-4 w-2/3 bg-muted rounded animate-pulse mb-2"></div>
              <div className="h-4 w-5/6 bg-muted rounded animate-pulse"></div>
            </CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Access common tasks quickly.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col space-y-2">
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse mb-2"></div>
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse mb-2"></div>
                <div className="h-4 w-3/5 bg-muted rounded animate-pulse mb-2"></div>
                <div className="h-4 w-4/5 bg-muted rounded animate-pulse"></div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of HR activities. (This software operates on offline data stored in your browser's local storage)." />
      
      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Prototype Data Management (Local Storage)</CardTitle>
          <CardDescription>
            Manually export or import all application data stored in your browser's local storage.
            This export includes all entered employees, monthly attendance, leave balances, salary edits, performance deductions, recent activities, and user accounts. 
            It does NOT export the application code itself. Importing data will overwrite existing local data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button onClick={handleExportData} variant="outline">
            <DownloadCloud className="mr-2 h-4 w-4" /> Export All Local Data
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UploadCloud className="mr-2 h-4 w-4" /> Import All Local Data
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Import Local Storage Data</DialogTitle>
                <DialogDescription>
                  Paste the JSON string you previously exported here. This will overwrite all current local data for this application.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Label htmlFor="import-json-area">JSON Data to Import:</Label>
                <Textarea
                  id="import-json-area"
                  value={importDataJson}
                  onChange={(e) => setImportDataJson(e.target.value)}
                  rows={15}
                  placeholder="Paste your exported JSON data here..."
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={handleImportData}>Import Data & Reload</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {dashboardCards.map((card, index) => (
          <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground pt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5 text-primary"/>Last 5 Months' Salary Totals</CardTitle>
          <CardDescription>Grand total net pay for the last five months, based on available data.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSalaries ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Calculating salaries...</p>
            </div>
          ) : lastFiveMonthsSalaryData.length > 0 ? (
            <div className="space-y-2">
              {lastFiveMonthsSalaryData.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.monthYear}:</span>
                  <span className="font-medium">₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
              <hr className="my-2"/>
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Grand Total (Last 5 Months):</span>
                <span>₹{grandTotalLastFiveMonths.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No salary data available for the last five months to display totals. Ensure attendance and employee master data are present for previous months.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 mt-8 md:grid-cols-2">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center"><Activity className="mr-2 h-5 w-5 text-primary" />Recent Activities</CardTitle>
            <CardDescription>Latest updates from your HR portal.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <ul className="space-y-3">
                {recentActivities.map((activity, index) => (
                  <li key={index} className="text-sm">
                     {activity.message}
                     <span className="text-xs text-muted-foreground ml-2">({format(new Date(activity.timestamp), "dd MMM, p")})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activities logged yet.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Access common tasks quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/employee-master" className="block text-primary hover:underline">Employee Master</a>
            <a href="/attendance" className="block text-primary hover:underline">Attendance</a>
            <a href="/leave" className="block text-primary hover:underline">Manage Leaves</a>
            <a href="/salary-sheet" className="block text-primary hover:underline">Salary Sheet</a>
            <a href="/performance-deduction" className="block text-primary hover:underline">Performance Deduction</a>
            <a href="/salary-slip" className="block text-primary hover:underline">Generate Salary Slip</a>
            <a href="/reports" className="block text-primary hover:underline">View Reports</a>
            <a href="/user-management" className="block text-primary hover:underline">User Management</a>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Exported Local Storage Data</DialogTitle>
            <DialogDescription>
              Copy the JSON text below or download it as a file. You can save it and use the "Import" feature on another computer/browser.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="export-json-area">All Local Storage Data (JSON):</Label>
            <Textarea id="export-json-area" value={exportedDataJson} readOnly rows={15} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    navigator.clipboard.writeText(exportedDataJson);
                    toast({ title: "Copied!", description: "Data copied to clipboard." });
                }}
            >
                Copy to Clipboard
            </Button>
            <Button
                type="button"
                onClick={handleDownloadExportedFile}
            >
                <DownloadCloud className="mr-2 h-4 w-4" /> Download as JSON File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    
