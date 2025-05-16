
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, CalendarCheck, History, DollarSign, HardDrive } from "lucide-react";
import { sampleEmployees, type EmployeeDetail } from "@/lib/hr-data"; 
import { useToast } from "@/hooks/use-toast"; // Added import

// localStorage keys
const LOCAL_STORAGE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY = "novita_attendance_last_upload_context_v4";
const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1"; // Though not actively managed by a UI yet

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
    { title: "Payroll Status", value: "N/A (Prototype)", icon: DollarSign, description: "For current month", dataAiHint: "money payment" },
    { title: "Storage Used", value: "N/A (Prototype)", icon: HardDrive, description: "Uploaded data size (Prototype)", dataAiHint: "data storage" },
  ]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    let activeEmployeesCount = 0;
    let overallAttendanceValue = "N/A";
    let attendanceDescription = "From last uploaded file";
    let totalLeaveRecords = 0; 

    if (typeof window !== 'undefined') {
      // Calculate Total Active Employees
      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        let employeesToUseForCount: EmployeeDetail[] = [];

        if (storedEmployeesStr !== null) { // Check if the key exists
          try {
            const parsedEmployees = JSON.parse(storedEmployeesStr) as EmployeeDetail[];
            if (Array.isArray(parsedEmployees)) {
              employeesToUseForCount = parsedEmployees;
            } else {
              console.error("Employee master data in localStorage is not an array. Using defaults for count.");
              toast({title: "Data Format Error", description: "Stored employee master data is corrupted. Using defaults for counts.", variant: "destructive", duration: 7000});
              employeesToUseForCount = sampleEmployees; 
            }
          } catch (parseError) {
            console.error("Error parsing employee master data from localStorage for dashboard.", parseError);
            toast({title: "Data Load Error", description: "Could not parse employee master data from localStorage. Stored data might be corrupted. Using defaults.", variant: "destructive", duration: 7000});
            employeesToUseForCount = sampleEmployees; 
          }
        } else {
            // Key doesn't exist, likely first run or cleared. Use sample data.
            // console.log("No employee master found in localStorage, using sample data for dashboard count.");
            employeesToUseForCount = sampleEmployees;
        }
        activeEmployeesCount = employeesToUseForCount.filter(emp => emp.status === "Active").length;
      } catch (error) {
        console.error("Error accessing or processing employee master data for dashboard count:", error);
        toast({title: "Storage Access Error", description: "Could not access employee master data for dashboard. Using defaults.", variant: "destructive", duration: 7000});
        activeEmployeesCount = sampleEmployees.filter(emp => emp.status === "Active").length; 
      }

      // Calculate Overall Attendance from last upload context
      try {
        const storedLastUploadContextStr = localStorage.getItem(LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY);
        if (storedLastUploadContextStr) {
          const lastUploadContext = JSON.parse(storedLastUploadContextStr) as StoredUploadContext;
          const rawDataKey = `${LOCAL_STORAGE_RAW_DATA_PREFIX}${lastUploadContext.month}_${lastUploadContext.year}`;
          const storedRawDataForContext = localStorage.getItem(rawDataKey);

          if (storedRawDataForContext) {
            const rawData = JSON.parse(storedRawDataForContext) as StoredEmployeeAttendanceData[];
            if (rawData.length > 0) {
              let presentCount = 0;
              let relevantEntriesCount = 0;

              rawData.forEach(emp => {
                const hasMeaningfulAttendance = emp.attendance.some(status => status !== '-');
                if (hasMeaningfulAttendance) {
                  emp.attendance.forEach(status => {
                    if (status === "P") {
                      presentCount++;
                    }
                    if (status === "P" || status === "A" || status === "HD") {
                      relevantEntriesCount++;
                    }
                  });
                }
              });

              if (relevantEntriesCount > 0) {
                const percentage = (presentCount / relevantEntriesCount) * 100;
                overallAttendanceValue = `${percentage.toFixed(1)}% P`;
              } else {
                overallAttendanceValue = "No P/A/HD data";
              }
              attendanceDescription = `Based on ${lastUploadContext.month} ${lastUploadContext.year} upload`;
            } else {
                 attendanceDescription = `No attendance entries in ${lastUploadContext.month} ${lastUploadContext.year} file.`;
            }
          } else {
             attendanceDescription = `No attendance data found for last upload context (${lastUploadContext.month} ${lastUploadContext.year}). Ensure data for this period was uploaded.`;
          }
        } else {
            attendanceDescription = "No attendance data uploaded yet.";
        }
      } catch (error) {
        console.error("Error processing attendance data for dashboard:", error);
        overallAttendanceValue = "Error";
        attendanceDescription = "Error loading attendance data";
        toast({title: "Attendance Data Error", description: "Could not process attendance data for dashboard. Stored data might be corrupted.", variant: "destructive", duration: 7000});
      }

      // Get Total Leave Records (count from localStorage if conceptualized, else 0)
      try {
        const storedLeaveApps = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedLeaveApps) {
          const parsedLeaveApps = JSON.parse(storedLeaveApps);
          if(Array.isArray(parsedLeaveApps)) {
            totalLeaveRecords = parsedLeaveApps.length;
          }
        } else {
            totalLeaveRecords = 0; // Or could use sampleLeaveHistory.length if you want to show sample count
        }
      } catch (error) {
        console.error("Error loading leave applications for dashboard count:", error);
        toast({title: "Leave Data Error", description: "Could not load leave application data for dashboard count. Stored data might be corrupted.", variant: "destructive", duration: 7000});
      }

    }

    setDashboardCards(prevCards => prevCards.map(card => {
      if (card.title === "Total Employees") {
        return { ...card, value: activeEmployeesCount.toString() };
      }
      if (card.title === "Overall Attendance (Last Upload)") {
        return { ...card, value: overallAttendanceValue, description: attendanceDescription };
      }
      if (card.title === "Total Leave Records") {
        return { ...card, value: totalLeaveRecords.toString() };
      }
      return card;
    }));
    setIsLoading(false);
  }, [toast]); 

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview of HR activities." />
        <div className="text-center py-10">Loading dashboard data...</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of HR activities." />
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
            <CardDescription>Latest updates and notifications.</CardDescription>
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
    </>
  );
}

