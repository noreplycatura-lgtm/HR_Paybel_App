import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, CalendarCheck, UserCheck, DollarSign } from "lucide-react";

export default function DashboardPage() {
  const summaryCards = [
    { title: "Total Employees", value: "125", icon: UserCheck, description: "Active employees", dataAiHint: "team office" },
    { title: "Attendance Today", value: "95% P", icon: CalendarCheck, description: "Overall presence", dataAiHint: "calendar schedule" },
    { title: "Pending Approvals", value: "8", icon: BarChart3, description: "Leaves & requests", dataAiHint: "documents list" },
    { title: "Payroll Status", value: "Processed", icon: DollarSign, description: "For current month", dataAiHint: "money payment" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of HR activities." />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card, index) => (
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
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest updates and notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="text-sm">New leave application from John Doe.</li>
              <li className="text-sm">Attendance for 25th July uploaded.</li>
              <li className="text-sm">Employee onboarding: Jane Smith.</li>
              <li className="text-sm">Monthly report generated.</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="shadow-md">
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
