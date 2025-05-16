
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, CalendarCheck, UserCheck, DollarSign, HardDrive, History } from "lucide-react";
import { sampleEmployees, sampleLeaveHistory } from "@/lib/hr-data";
import type { EmployeeDetail } from "@/lib/hr-data";

// Mirrored from attendance page for consistency
const LOCAL_STORAGE_ATTENDANCE_RAW_KEY = "novita_attendance_raw_data_v2";
const LOCAL_STORAGE_ATTENDANCE_CONTEXT_KEY = "novita_attendance_context_v2";

interface StoredEmployeeAttendanceData {
  // Only need the attendance array and relevant fields for calculation
  code: string;
  attendance: string[];
}

interface StoredUploadContext {
  month: string;
  year: number;
}

export default function DashboardPage() {
  const [dashboardCards, setDashboardCards] = React.useState([
    { title: "Total Employees", value: "N/A", icon: UserCheck, description: "Active employees", dataAiHint: "team office" },
    { title: "Overall Attendance (Last Upload)", value: "N/A", icon: CalendarCheck, description: "From last uploaded file", dataAiHint: "calendar schedule" },
    { title: "Total Leave Records", value: "N/A", icon: History, description: "All recorded leave entries", dataAiHint: "documents list" },
    { title: "Payroll Status", value: "N/A (Prototype)", icon: DollarSign, description: "For current month", dataAiHint: "money payment" },
    { title: "Storage Used", value: "N/A (Prototype)", icon: HardDrive, description: "Uploaded data size (Prototype)", dataAiHint: "data storage" },
  ]);

  React.useEffect(() => {
    // Calculate Total Active Employees
    const activeEmployees = sampleEmployees.filter(emp => emp.status === "Active").length;
    
    // Calculate Total Leave Records
    const totalLeaveRecords = sampleLeaveHistory.length;

    // Calculate Overall Attendance from localStorage
    let overallAttendanceValue = "N/A";
    let attendanceDescription = "From last uploaded file";

    try {
      const storedRawContext = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_CONTEXT_KEY);
      const storedRawData = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_RAW_KEY);

      if (storedRawContext && storedRawData) {
        const context = JSON.parse(storedRawContext) as StoredUploadContext;
        const rawData = JSON.parse(storedRawData) as StoredEmployeeAttendanceData[];

        if (rawData.length > 0 && context) {
          let presentCount = 0;
          let relevantEntriesCount = 0;

          rawData.forEach(emp => {
            emp.attendance.forEach(status => {
              if (status === "P") {
                presentCount++;
                relevantEntriesCount++;
              } else if (status === "A" || status === "HD") {
                relevantEntriesCount++;
              }
            });
          });

          if (relevantEntriesCount > 0) {
            const percentage = (presentCount / relevantEntriesCount) * 100;
            overallAttendanceValue = `${percentage.toFixed(1)}% P`;
          } else {
            overallAttendanceValue = "No P/A/HD data";
          }
          attendanceDescription = `Based on ${context.month} ${context.year} upload`;
        }
      }
    } catch (error) {
      console.error("Error processing attendance data for dashboard:", error);
      overallAttendanceValue = "Error";
      attendanceDescription = "Error loading data";
    }

    setDashboardCards(prevCards => prevCards.map(card => {
      if (card.title === "Total Employees") {
        return { ...card, value: activeEmployees.toString() };
      }
      if (card.title === "Overall Attendance (Last Upload)") {
        return { ...card, value: overallAttendanceValue, description: attendanceDescription };
      }
      if (card.title === "Total Leave Records") {
        return { ...card, value: totalLeaveRecords.toString() };
      }
      return card;
    }));

  }, []);

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

