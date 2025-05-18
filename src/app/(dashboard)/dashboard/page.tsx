
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, CalendarCheck, History, DollarSign, HardDrive } from "lucide-react";
import { sampleEmployees, type EmployeeDetail } from "@/lib/hr-data"; 
import { useToast } from "@/hooks/use-toast"; 
import { getMonth, getYear, subMonths, format } from "date-fns";

const LOCAL_STORAGE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY = "novita_attendance_last_upload_context_v4";
const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1"; 

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
    { title: "Storage Used", value: "N/A (Prototype)", icon: HardDrive, description: "Uploaded data size (Prototype)", dataAiHint: "data storage" },
  ]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    let activeEmployeesCount = 0;
    let overallAttendanceValue = "N/A";
    let attendanceDescription = "From last uploaded file";
    let totalLeaveRecords = 0; 
    let payrollStatusValue = "N/A";
    let payrollStatusDescription = "For previous month";

    if (typeof window !== 'undefined') {
      // Employee Master Count
      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        let employeesToUseForCount: EmployeeDetail[] = []; 

        if (storedEmployeesStr) { 
          try {
            const parsedEmployees = JSON.parse(storedEmployeesStr) as EmployeeDetail[];
            if (Array.isArray(parsedEmployees)) {
              employeesToUseForCount = parsedEmployees;
            } else {
              console.error("Dashboard: Employee master data in localStorage is not an array. Using empty list for counts.");
              toast({title: "Data Format Error", description: "Stored employee master data is corrupted. Counts may be inaccurate.", variant: "destructive", duration: 7000});
            }
          } catch (parseError) {
            console.error("Dashboard: Error parsing employee master data from localStorage.", parseError);
            toast({title: "Data Load Error", description: "Could not parse employee master data from localStorage. Stored data might be corrupted. Counts may be inaccurate.", variant: "destructive", duration: 7000});
          }
        } else {
          // Key doesn't exist, use default sample employees and save them.
          employeesToUseForCount = [...sampleEmployees];
          try {
            localStorage.setItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY, JSON.stringify(sampleEmployees));
          } catch (storageError) {
             console.error("Dashboard: Error saving default employees to localStorage:", storageError);
          }
        }
        activeEmployeesCount = employeesToUseForCount.filter(emp => emp.status === "Active").length;
      } catch (error) {
        console.error("Dashboard: Error accessing employee master data for count:", error);
        activeEmployeesCount = sampleEmployees.filter(emp => emp.status === "Active").length; 
      }

      // Overall Attendance (Last Upload)
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
             attendanceDescription = `No attendance data found for last upload context (${lastUploadContext.month} ${lastUploadContext.year}).`;
          }
        } else {
            attendanceDescription = "No attendance data uploaded yet.";
        }
      } catch (error) {
        console.error("Dashboard: Error processing attendance data for overall status:", error);
        overallAttendanceValue = "Error";
        attendanceDescription = "Error loading attendance data";
        toast({title: "Attendance Data Error", description: "Could not process attendance data for dashboard. Stored data might be corrupted.", variant: "destructive", duration: 7000});
      }

      // Total Leave Records
      try {
        const storedLeaveApps = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedLeaveApps) {
          const parsedLeaveApps = JSON.parse(storedLeaveApps);
          if(Array.isArray(parsedLeaveApps)) {
            totalLeaveRecords = parsedLeaveApps.length;
          }
        } else {
            totalLeaveRecords = 0; 
        }
      } catch (error) {
        console.error("Dashboard: Error loading leave applications for count:", error);
        toast({title: "Leave Data Error", description: "Could not load leave application data for dashboard count. Stored data might be corrupted.", variant: "destructive", duration: 7000});
      }

      // Payroll Status (Last Month)
      try {
        const lastMonthDate = subMonths(new Date(), 1);
        const lastMonthName = months[getMonth(lastMonthDate)];
        const lastMonthYear = getYear(lastMonthDate);
        const lastMonthAttendanceKey = `${LOCAL_STORAGE_RAW_DATA_PREFIX}${lastMonthName}_${lastMonthYear}`;
        const lastMonthAttendanceData = localStorage.getItem(lastMonthAttendanceKey);

        if (lastMonthAttendanceData) {
          try {
            const parsedData = JSON.parse(lastMonthAttendanceData) as StoredEmployeeAttendanceData[];
            if (parsedData.length > 0) {
               payrollStatusValue = "Processed";
               payrollStatusDescription = `Based on ${lastMonthName} ${lastMonthYear} attendance`;
            } else {
               payrollStatusValue = "Pending";
               payrollStatusDescription = `No attendance entries for ${lastMonthName} ${lastMonthYear}`;
            }
          } catch (e) {
            payrollStatusValue = "Error";
            payrollStatusDescription = `Corrupted data for ${lastMonthName} ${lastMonthYear}`;
          }
        } else {
          payrollStatusValue = "Pending";
          payrollStatusDescription = `Awaiting ${lastMonthName} ${lastMonthYear} attendance`;
        }
      } catch (error) {
        console.error("Dashboard: Error checking payroll status:", error);
        payrollStatusValue = "Error";
        payrollStatusDescription = "Error checking last month's status";
      }

    } // end typeof window !== 'undefined'

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
      if (card.title === "Payroll Status (Last Mth)") {
        return { ...card, value: payrollStatusValue, description: payrollStatusDescription };
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

    
