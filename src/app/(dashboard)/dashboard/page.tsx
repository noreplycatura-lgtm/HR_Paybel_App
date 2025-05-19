
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserCheck, CalendarCheck, History, DollarSign, HardDrive, UploadCloud, DownloadCloud, FileText } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { useToast } from "@/hooks/use-toast";
import { getMonth, getYear, subMonths, format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1"; // For future use

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface StoredEmployeeAttendanceData {
  code: string;
  attendance: string[];
}

interface StoredUploadContext {
  month: string;
  year: number;
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


export default function DashboardPage() {
  const { toast } = useToast();
  const [dashboardCards, setDashboardCards] = React.useState([
    { title: "Total Employees", value: "N/A", icon: UserCheck, description: "Active employees", dataAiHint: "team office" },
    { title: "Last Month's Salary Total", value: "N/A", icon: DollarSign, description: "Grand total net pay for last month", dataAiHint: "money payment calculator" },
    { title: "Total Leave Records", value: "N/A", icon: History, description: "All recorded leave entries", dataAiHint: "documents list" },
    { title: "Payroll Status (Last Mth)", value: "N/A", icon: FileText, description: "For previous month", dataAiHint: "report checkmark" },
    { title: "Storage Used", value: "N/A (Conceptual)", icon: HardDrive, description: "Uploaded data size (Conceptual)", dataAiHint: "data storage" },
  ]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [exportedDataJson, setExportedDataJson] = React.useState("");
  const [importDataJson, setImportDataJson] = React.useState("");
  const [recentActivities, setRecentActivities] = React.useState<ActivityLogEntry[]>([]);


  React.useEffect(() => {
    setIsLoading(true);
    let activeEmployeesCount = 0;
    let lastMonthSalaryTotalValue = "N/A";
    let lastMonthSalaryDescription = "Grand total net pay for last month";
    let totalLeaveRecordsCount = 0;
    let payrollStatusValue = "N/A";
    let payrollStatusDescription = "For previous month";
    let illustrativeActivities: ActivityLogEntry[] = [
      { timestamp: new Date().toISOString(), message: "Attendance for May 2024 uploaded." },
      { timestamp: subMonths(new Date(), 1).toISOString(), message: "Employee John Doe added to master." },
      { timestamp: subMonths(new Date(), 2).toISOString(), message: "Salary slip generated for Jane Smith." },
    ];

    if (typeof window !== 'undefined') {
      try {
        // Calculate Total Active Employees
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        let employeeMasterList: EmployeeDetail[] = [];
        if (storedEmployeesStr) {
          const parsedEmployees = JSON.parse(storedEmployeesStr);
          if (Array.isArray(parsedEmployees)) {
            employeeMasterList = parsedEmployees;
            activeEmployeesCount = parsedEmployees.filter(emp => emp.status === "Active").length;
          } else {
            console.warn("Employee master data in localStorage is corrupted or not an array. Defaulting to 0 active employees.");
            activeEmployeesCount = 0;
          }
        } else {
          activeEmployeesCount = 0;
        }

        // Calculate Last Month's Salary Total
        const lastMonthDate = subMonths(new Date(), 1);
        const prevMonthName = months[getMonth(lastMonthDate)];
        const prevMonthYear = getYear(lastMonthDate);
        lastMonthSalaryDescription = `Grand total net pay for ${prevMonthName} ${prevMonthYear}`;
        
        const attendanceKeyPrevMonth = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${prevMonthName}_${prevMonthYear}`;
        const salaryEditsKeyPrevMonth = `${LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX}${prevMonthName}_${prevMonthYear}`;
        
        const storedAttendancePrevMonthStr = localStorage.getItem(attendanceKeyPrevMonth);
        const storedSalaryEditsPrevMonthStr = localStorage.getItem(salaryEditsKeyPrevMonth);
        const storedPerformanceDeductionsStr = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);

        let grandTotalNetPaid = 0;
        let processedEmployeesForSalary = 0;

        if (storedAttendancePrevMonthStr && employeeMasterList.length > 0) {
          const attendancePrevMonth: StoredEmployeeAttendanceData[] = JSON.parse(storedAttendancePrevMonthStr);
          const salaryEditsPrevMonth: Record<string, SalarySheetEdits> = storedSalaryEditsPrevMonthStr ? JSON.parse(storedSalaryEditsPrevMonthStr) : {};
          const performanceDeductionsAll: PerformanceDeductionEntry[] = storedPerformanceDeductionsStr ? JSON.parse(storedPerformanceDeductionsStr) : [];
          
          const performanceDeductionsPrevMonth = performanceDeductionsAll.filter(pd => pd.month === prevMonthName && pd.year === prevMonthYear);

          employeeMasterList.forEach(emp => {
            const empAttendanceRecord = attendancePrevMonth.find(att => att.code === emp.code);
            if (empAttendanceRecord) {
              processedEmployeesForSalary++;
              const totalDaysInPrevMonth = new Date(prevMonthYear, getMonth(lastMonthDate) + 1, 0).getDate();
              let daysPaid = 0;
              empAttendanceRecord.attendance.slice(0, totalDaysInPrevMonth).forEach(status => {
                if (['P', 'W', 'PH', 'CL', 'SL', 'PL'].includes(status.toUpperCase())) daysPaid++;
                else if (status.toUpperCase() === 'HD') daysPaid += 0.5;
              });
              daysPaid = Math.min(daysPaid, totalDaysInPrevMonth);

              const monthlyComps = calculateMonthlySalaryComponents(emp, prevMonthYear, getMonth(lastMonthDate));
              const payFactor = totalDaysInPrevMonth > 0 ? daysPaid / totalDaysInPrevMonth : 0;
              
              const actualBasic = monthlyComps.basic * payFactor;
              const actualHRA = monthlyComps.hra * payFactor;
              const actualCA = monthlyComps.ca * payFactor;
              const actualMedical = monthlyComps.medical * payFactor;
              const actualOtherAllowance = monthlyComps.otherAllowance * payFactor;

              const empEdits = salaryEditsPrevMonth[emp.id] || {};
              const arrears = empEdits.arrears ?? 0;
              const tds = empEdits.tds ?? 0;
              const loan = empEdits.loan ?? 0;
              const salaryAdvance = empEdits.salaryAdvance ?? 0;
              const manualOtherDeduction = empEdits.manualOtherDeduction ?? 0;
              
              const perfDeductionEntry = performanceDeductionsPrevMonth.find(pd => pd.employeeCode === emp.code);
              const performanceDeduction = perfDeductionEntry?.amount || 0;
              const totalOtherDeduction = manualOtherDeduction + performanceDeduction;

              const totalAllowance = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;
              const esic = 0, profTax = 0, pf = 0; // Assuming these are 0 for prototype
              const totalDeduction = esic + profTax + pf + tds + loan + salaryAdvance + totalOtherDeduction;
              grandTotalNetPaid += (totalAllowance - totalDeduction);
            }
          });
          lastMonthSalaryTotalValue = processedEmployeesForSalary > 0 ? `₹${grandTotalNetPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A (No Data)";
        } else {
           lastMonthSalaryTotalValue = "N/A (Missing Attendance)";
        }


        // Calculate Total Leave Records
        const storedLeaveAppsStr = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedLeaveAppsStr) {
            try {
              const parsedApps: LeaveApplication[] = JSON.parse(storedLeaveAppsStr);
              totalLeaveRecordsCount = Array.isArray(parsedApps) ? parsedApps.length : 0;
            } catch (e) {
              console.error("Error parsing leave applications from localStorage:", e);
              totalLeaveRecordsCount = 0;
            }
        } else {
          totalLeaveRecordsCount = 0;
        }

        // Determine Payroll Status for Last Month (based on attendance upload)
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

        // Load Recent Activities (Illustrative for now)
        // const storedActivitiesStr = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
        // if (storedActivitiesStr) {
        //   const parsedActivities: ActivityLogEntry[] = JSON.parse(storedActivitiesStr);
        //   setRecentActivities(Array.isArray(parsedActivities) ? parsedActivities.slice(0, 5) : illustrativeActivities);
        // } else {
           setRecentActivities(illustrativeActivities);
        // }


      } catch (error) {
          console.error("Dashboard: Error fetching data from localStorage:", error);
          activeEmployeesCount = 0;
          lastMonthSalaryTotalValue = "N/A (Error)";
          totalLeaveRecordsCount = 0;
          payrollStatusValue = "Error";
          setRecentActivities(illustrativeActivities);
      }
    }

    setDashboardCards(prevCards => prevCards.map(card => {
      if (card.title === "Total Employees") return { ...card, value: activeEmployeesCount.toString() };
      if (card.title === "Last Month's Salary Total") return { ...card, value: lastMonthSalaryTotalValue, description: lastMonthSalaryDescription };
      if (card.title === "Total Leave Records") return { ...card, value: totalLeaveRecordsCount.toString() };
      if (card.title === "Payroll Status (Last Mth)") return { ...card, value: payrollStatusValue, description: payrollStatusDescription };
      // Storage Used remains conceptual
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
      LOCAL_STORAGE_RECENT_ACTIVITIES_KEY // Include if we start logging
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

      const knownPrefixesForClear = [
          LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX,
          LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX,
          LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX
      ];
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if(key && (knownPrefixesForClear.some(prefix => key.startsWith(prefix)) ||
             knownFixedKeys.includes(key))) {
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
      // Trigger a hard reload to ensure all components re-fetch from localStorage
      window.location.reload(); 
    } catch (error) {
      console.error("Error importing data:", error);
      toast({ title: "Import Error", description: "Could not parse or import JSON data. Check format.", variant: "destructive" });
    }
  };


  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview of HR activities. (Data saved in browser's local storage)" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
         <div className="grid gap-6 mt-8 md:grid-cols-2">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest updates and notifications (Illustrative).</CardDescription>
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
      <PageHeader title="Dashboard" description="Overview of HR activities. (Data saved in browser's local storage)" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
      <div className="grid gap-6 mt-8 md:grid-cols-2">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest updates from your HR activities. (Illustrative for now)</CardDescription>
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
          <CardContent className="flex flex-col space-y-2">
             <a href="/attendance" className="text-primary hover:underline">Upload Attendance</a>
             <a href="/leave" className="text-primary hover:underline">Manage Leaves</a>
             <a href="/salary-slip" className="text-primary hover:underline">Generate Salary Slip</a>
             <a href="/reports" className="text-primary hover:underline">View Reports</a>
          </CardContent>
        </Card>
      </div>

      <Accordion type="single" collapsible className="w-full mt-8">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-base font-semibold">Prototype Data Management (Local Storage)</AccordionTrigger>
          <AccordionContent>
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Local Storage Data Tools</CardTitle>
                <CardDescription>
                  Manually export or import all application data stored in your browser's local storage.
                  This is a prototype feature to help transfer data between browsers/computers for testing.
                  Use with caution: Importing data will overwrite existing local data for this application.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-4">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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

