
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserCheck, CalendarCheck, History, DollarSign, HardDrive, UploadCloud, DownloadCloud } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { useToast } from "@/hooks/use-toast";
import { getMonth, getYear, subMonths, format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX = "novita_attendance_filename_v4_";
const LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY = "novita_last_upload_context_v4";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX = "novita_salary_sheet_edits_v1_";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "novita_performance_deductions_v1";
const LOCAL_STORAGE_SIMULATED_USERS_KEY = "novita_simulated_users_v1";


const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface StoredEmployeeAttendanceData {
  code: string;
  attendance: string[];
}

interface StoredUploadContext {
  month: string;
  year: number;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [dashboardCards, setDashboardCards] = React.useState([
    { title: "Total Employees", value: "N/A", icon: UserCheck, description: "Active employees", dataAiHint: "team office" },
    { title: "Overall Attendance (Last Upload)", value: "N/A", icon: CalendarCheck, description: "From last uploaded file", dataAiHint: "calendar schedule" },
    { title: "Total Leave Records", value: "N/A", icon: History, description: "All recorded leave entries", dataAiHint: "documents list" },
    { title: "Payroll Status (Last Mth)", value: "N/A", icon: DollarSign, description: "For previous month", dataAiHint: "money payment" },
    { title: "Storage Used", value: "N/A (Conceptual)", icon: HardDrive, description: "Uploaded data size (Conceptual)", dataAiHint: "data storage" },
  ]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [exportedDataJson, setExportedDataJson] = React.useState("");
  const [importDataJson, setImportDataJson] = React.useState("");


  React.useEffect(() => {
    setIsLoading(true);
    let activeEmployeesCount = 0;
    let overallAttendanceValue = "N/A";
    let attendanceDescription = "From last uploaded file";
    let totalLeaveRecords = 0;
    let payrollStatusValue = "N/A";
    let payrollStatusDescription = "For previous month";

    if (typeof window !== 'undefined') {
      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployeesStr) {
          const employeesFromStorage: EmployeeDetail[] = JSON.parse(storedEmployeesStr);
           if (Array.isArray(employeesFromStorage)) {
            activeEmployeesCount = employeesFromStorage.filter(emp => emp.status === "Active").length;
           } else {
            activeEmployeesCount = 0;
            console.warn("Employee master data in localStorage is corrupted or not an array. Showing 0.");
            toast({ title: "Data Warning", description: "Could not properly read employee master data from local storage. Data is saved locally in your browser.", variant: "destructive", duration: 7000 });
           }
        } else {
          activeEmployeesCount = 0;
        }

        const lastUploadContextStr = localStorage.getItem(LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY);
        if (lastUploadContextStr) {
          try {
            const lastUploadContext: StoredUploadContext = JSON.parse(lastUploadContextStr);
            const attendanceKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${lastUploadContext.month}_${lastUploadContext.year}`;
            const storedAttendance = localStorage.getItem(attendanceKey);
            if (storedAttendance) {
              const rawData: StoredEmployeeAttendanceData[] = JSON.parse(storedAttendance);
              if (Array.isArray(rawData)) {
                let totalPresent = 0;
                let totalRelevantDays = 0;
                rawData.forEach(emp => {
                  emp.attendance.forEach(status => {
                    if (['P', 'A', 'HD'].includes(status.toUpperCase())) {
                      totalRelevantDays++;
                      if (status.toUpperCase() === 'P') totalPresent++;
                      else if (status.toUpperCase() === 'HD') totalPresent += 0.5;
                    }
                  });
                });
                overallAttendanceValue = totalRelevantDays > 0 ? `${((totalPresent / totalRelevantDays) * 100).toFixed(1)}%` : "N/A";
                attendanceDescription = `Based on ${lastUploadContext.month} ${lastUploadContext.year} upload`;
              } else {
                overallAttendanceValue = "N/A";
                attendanceDescription = `Attendance data for ${lastUploadContext.month} ${lastUploadContext.year} is corrupted.`;
                console.warn("Last uploaded attendance data is corrupted.");
                 toast({ title: "Data Warning", description: `Attendance data for ${lastUploadContext.month} ${lastUploadContext.year} in localStorage is corrupted. Dashboard may not show latest attendance.`, variant: "destructive", duration: 7000 });
              }
            } else {
              overallAttendanceValue = "N/A";
              attendanceDescription = `No attendance data for ${lastUploadContext.month} ${lastUploadContext.year}.`;
            }
          } catch (e) {
            console.error("Error parsing last upload context or its attendance data:", e);
            overallAttendanceValue = "N/A";
            attendanceDescription = "Error reading attendance context.";
            toast({ title: "Data Warning", description: "Could not properly read last upload context. Dashboard may not show latest attendance.", variant: "destructive", duration: 7000 });
          }
        } else { attendanceDescription = "No attendance data uploaded yet."; }

        const storedLeaveApps = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedLeaveApps) {
            try {
              const parsedApps = JSON.parse(storedLeaveApps);
              totalLeaveRecords = Array.isArray(parsedApps) ? parsedApps.length : 0;
            } catch (e) {
              console.error("Error parsing leave applications:", e);
              totalLeaveRecords = 0;
              toast({ title: "Data Warning", description: "Could not read leave application data from local storage.", variant: "destructive", duration: 7000 });
            }
        }

        const lastMonthDate = subMonths(new Date(), 1);
        const lastMonthName = months[getMonth(lastMonthDate)];
        const lastMonthYear = getYear(lastMonthDate);
        const lastMonthAttendanceKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${lastMonthName}_${lastMonthYear}`;
        const storedLastMonthAttendance = localStorage.getItem(lastMonthAttendanceKey);
        if (storedLastMonthAttendance) {
            try {
              const parsedLastMonthAtt = JSON.parse(storedLastMonthAttendance);
              if (Array.isArray(parsedLastMonthAtt) && parsedLastMonthAtt.length > 0) {
                  payrollStatusValue = "Processed";
                  payrollStatusDescription = `Based on ${lastMonthName} ${lastMonthYear} attendance`;
              } else {
                   payrollStatusValue = "Pending";
                   payrollStatusDescription = `Awaiting ${lastMonthName} ${lastMonthYear} attendance`;
              }
            } catch (e) {
              console.error("Error parsing last month's attendance for payroll status:", e);
              payrollStatusValue = "Error";
              payrollStatusDescription = `Error reading ${lastMonthName} ${lastMonthYear} attendance`;
              toast({ title: "Data Warning", description: `Could not read last month's attendance (${lastMonthName} ${lastMonthYear}) for payroll status.`, variant: "destructive", duration: 7000 });
            }
        } else {
           payrollStatusValue = "Pending";
           payrollStatusDescription = `Awaiting ${lastMonthName} ${lastMonthYear} attendance`;
        }

      } catch (error) {
          console.error("Dashboard: Error fetching data from localStorage:", error);
          toast({title: "Data Fetch Error", description: "Could not fetch some dashboard data from localStorage. Data is saved locally in your browser.", variant: "destructive", duration: 7000});
          activeEmployeesCount = 0;
          overallAttendanceValue = "N/A";
          attendanceDescription = "Error fetching data.";
          totalLeaveRecords = 0;
          payrollStatusValue = "Error";
          payrollStatusDescription = "Error fetching data.";
      }
    }

    setDashboardCards(prevCards => prevCards.map(card => {
      if (card.title === "Total Employees") return { ...card, value: activeEmployeesCount.toString() };
      if (card.title === "Overall Attendance (Last Upload)") return { ...card, value: overallAttendanceValue, description: attendanceDescription };
      if (card.title === "Total Leave Records") return { ...card, value: totalLeaveRecords.toString() };
      if (card.title === "Payroll Status (Last Mth)") return { ...card, value: payrollStatusValue, description: payrollStatusDescription };
      return card;
    }));
    setIsLoading(false);
  }, []); // Runs once on mount


  const handleExportData = () => {
    if (typeof window === 'undefined') return;
    const allData: Record<string, any> = {};
    const keysToExport = [
      LOCAL_STORAGE_EMPLOYEE_MASTER_KEY,
      LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY,
      LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY,
      LOCAL_STORAGE_OPENING_BALANCES_KEY,
      LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY,
      LOCAL_STORAGE_SIMULATED_USERS_KEY
    ];

    keysToExport.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          allData[key] = JSON.parse(item);
        } catch (e) {
          allData[key] = item;
        }
      }
    });

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX) ||
                  key.startsWith(LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX) ||
                  key.startsWith(LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX))) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            allData[key] = JSON.parse(item);
          } catch (e) {
            allData[key] = item;
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

      const knownPrefixes = [
          LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX,
          LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX,
          LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX
      ];
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if(key && (knownPrefixes.some(prefix => key.startsWith(prefix)) ||
             [
                LOCAL_STORAGE_EMPLOYEE_MASTER_KEY,
                LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY,
                LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY,
                LOCAL_STORAGE_OPENING_BALANCES_KEY,
                LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY,
                LOCAL_STORAGE_SIMULATED_USERS_KEY
             ].includes(key))) {
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
            <CardDescription>Latest updates and notifications (Illustrative).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="text-sm">New leave application from John Doe.</li>
              <li className="text-sm">Attendance for July 2024 uploaded.</li>
              <li className="text-sm">Employee onboarding: Jane Smith.</li>
              <li className="text-sm">Monthly report generated.</li>
            </ul>
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
                  Use with caution: Importing data will overwrite existing local data.
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
