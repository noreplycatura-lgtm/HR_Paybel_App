"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, CalendarCheck, History, DollarSign, HardDrive } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data"; 
import { useToast } from "@/hooks/use-toast"; 
import { getMonth, getYear, subMonths, format } from "date-fns";

// These would be Firestore collection names
// const FIRESTORE_EMPLOYEE_MASTER_COLLECTION = "employees";
// const FIRESTORE_ATTENDANCE_COLLECTION_PREFIX = "attendance_"; 
// const FIRESTORE_LEAVE_APPLICATIONS_COLLECTION = "leaveApplications";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface StoredEmployeeAttendanceData {
  code: string;
  attendance: string[];
}

interface StoredUploadContext { // This conceptually comes from a settings/metadata store in Firestore
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

  React.useEffect(() => {
    setIsLoading(true);
    let activeEmployeesCount = 0;
    let overallAttendanceValue = "N/A";
    let attendanceDescription = "From last uploaded file";
    let totalLeaveRecords = 0; 
    let payrollStatusValue = "N/A";
    let payrollStatusDescription = "For previous month";

    // TODO: Implement fetching all necessary data from Firestore
    // This would involve multiple async calls.
    const fetchDashboardData = async () => {
        try {
            // Fetch Employee Master Count
            // const empSnap = await getDocs(collection(db, FIRESTORE_EMPLOYEE_MASTER_COLLECTION));
            // const employeesFromFirestore = empSnap.docs.map(doc => doc.data() as EmployeeDetail);
            // activeEmployeesCount = employeesFromFirestore.filter(emp => emp.status === "Active").length;
            activeEmployeesCount = 0; // Placeholder

            // Fetch Overall Attendance
            // const lastUploadContextSnap = await getDoc(doc(db, "settings", "lastUploadContext")); // Example path
            // if (lastUploadContextSnap.exists()) {
            //   const lastUploadContext = lastUploadContextSnap.data() as StoredUploadContext;
            //   const attendanceSnap = await getDoc(doc(db, FIRESTORE_ATTENDANCE_COLLECTION_PREFIX + `${lastUploadContext.month}_${lastUploadContext.year}`));
            //   if (attendanceSnap.exists()) {
            //     const rawData = attendanceSnap.data().attendanceRecords as StoredEmployeeAttendanceData[];
            //     // ... calculate attendance percentage ...
            //     overallAttendanceValue = "X%"; // Placeholder
            //     attendanceDescription = `Based on ${lastUploadContext.month} ${lastUploadContext.year} upload`;
            //   } else { attendanceDescription = `No attendance data for last upload context.`; }
            // } else { attendanceDescription = "No attendance data uploaded yet."; }
            overallAttendanceValue = "N/A"; // Placeholder
            attendanceDescription = "Fetch from Firestore"; // Placeholder

            // Fetch Total Leave Records
            // const leaveAppSnap = await getDocs(collection(db, FIRESTORE_LEAVE_APPLICATIONS_COLLECTION));
            // totalLeaveRecords = leaveAppSnap.size;
            totalLeaveRecords = 0; // Placeholder

            // Fetch Payroll Status (Last Month)
            const lastMonthDate = subMonths(new Date(), 1);
            const lastMonthName = months[getMonth(lastMonthDate)];
            const lastMonthYear = getYear(lastMonthDate);
            // const lastMonthAttendanceSnap = await getDoc(doc(db, FIRESTORE_ATTENDANCE_COLLECTION_PREFIX + `${lastMonthName}_${lastMonthYear}`));
            // if (lastMonthAttendanceSnap.exists() && (lastMonthAttendanceSnap.data().attendanceRecords as StoredEmployeeAttendanceData[]).length > 0) {
            //    payrollStatusValue = "Processed";
            //    payrollStatusDescription = `Based on ${lastMonthName} ${lastMonthYear} attendance`;
            // } else {
            //    payrollStatusValue = "Pending";
            //    payrollStatusDescription = `Awaiting ${lastMonthName} ${lastMonthYear} attendance`;
            // }
            payrollStatusValue = "N/A"; // Placeholder
            payrollStatusDescription = "Fetch from Firestore"; // Placeholder

        } catch (error) {
            console.error("Dashboard: Error fetching data from Firestore:", error);
            toast({title: "Data Fetch Error", description: "Could not fetch some dashboard data from Firestore.", variant: "destructive", duration: 7000});
        }

        setDashboardCards(prevCards => prevCards.map(card => {
          if (card.title === "Total Employees") return { ...card, value: activeEmployeesCount.toString() };
          if (card.title === "Overall Attendance (Last Upload)") return { ...card, value: overallAttendanceValue, description: attendanceDescription };
          if (card.title === "Total Leave Records") return { ...card, value: totalLeaveRecords.toString() };
          if (card.title === "Payroll Status (Last Mth)") return { ...card, value: payrollStatusValue, description: payrollStatusDescription };
          return card;
        }));
        setIsLoading(false);
    };

    fetchDashboardData();

  }, [toast]); 

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Overview of HR activities. (Data would be fetched from Firestore)" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {dashboardCards.map((card, index) => (
                 <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        <card.icon className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 w-1/2 bg-muted rounded animate-pulse mb-1"></div> {/* Placeholder for value */}
                        <div className="h-3 w-3/4 bg-muted rounded animate-pulse"></div> {/* Placeholder for description */}
                    </CardContent>
                </Card>
            ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of HR activities. (Data is illustrative as Firestore is not connected)" />
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
    </>
  );
}
