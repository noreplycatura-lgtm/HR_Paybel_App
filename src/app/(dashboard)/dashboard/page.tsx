"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck, DollarSign, History, HardDrive, Activity, Loader2, Users, Calendar, FileText, TrendingUp, ArrowRight, Briefcase, Clock, CheckCircle2 } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { useToast } from "@/hooks/use-toast";
import { getMonth, getYear, subMonths, format, startOfMonth, endOfMonth, parseISO, isValid, isAfter, isBefore, getDaysInMonth } from "date-fns";
import type { LeaveApplication } from "@/lib/hr-types";
import { calculateMonthlySalaryComponents } from "@/lib/salary-calculations";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";

// LocalStorage Keys
const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "catura_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "catura_attendance_raw_data_v4_";
const LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX = "catura_attendance_filename_v4_";
const LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY = "catura_last_upload_context_v4";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "catura_leave_applications_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "catura_opening_leave_balances_v1";
const LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX = "catura_salary_sheet_edits_v1_";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "catura_performance_deductions_v1";
const LOCAL_STORAGE_SIMULATED_USERS_KEY = "catura_simulated_users_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";

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
  employeeCount: number;
  statusCounts: { Active: number; Left: number };
  designationCounts: Record<string, number>;
}

// Quick Link Card Component
function QuickLinkCard({ href, icon: Icon, title, description, gradient }: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <Link href={href}>
      <div className={`group relative overflow-hidden rounded-xl p-5 ${gradient} text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer`}>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 transition-transform group-hover:scale-150" />
        <div className="relative">
          <div className="mb-3 inline-flex rounded-lg bg-white/20 p-2.5">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{title}</h3>
          <p className="text-sm text-white/80">{description}</p>
          <div className="mt-3 flex items-center text-sm font-medium text-white/90 group-hover:text-white">
            Open <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// Stat Card Component
function StatCard({ title, value, description, icon: Icon, trend, trendUp, color }: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; icon: string; border: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600 bg-blue-100', border: 'border-blue-100' },
    green: { bg: 'bg-green-50', icon: 'text-green-600 bg-green-100', border: 'border-green-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600 bg-purple-100', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600 bg-orange-100', border: 'border-orange-100' },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <Card className={`relative overflow-hidden border-2 ${colors.border} shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full ${colors.bg} opacity-50`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${colors.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
        {trend && (
          <div className={`mt-2 inline-flex items-center text-xs font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`h-3 w-3 mr-1 ${!trendUp && 'rotate-180'}`} />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = React.useState({
    totalEmployees: 0,
    activeEmployees: 0,
    leftEmployees: 0,
    totalLeaveRecords: 0,
    payrollStatus: "N/A",
    payrollDescription: "For previous month",
    storageUsed: "0 Bytes",
  });

  const [lastFiveMonthsSalaryData, setLastFiveMonthsSalaryData] = React.useState<MonthlySalaryTotal[]>([]);
  const [grandTotalLastFiveMonths, setGrandTotalLastFiveMonths] = React.useState<number>(0);
  const [isLoadingSalaries, setIsLoadingSalaries] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const [recentActivities, setRecentActivities] = React.useState<ActivityLogEntry[]>([]);

  React.useEffect(() => {
    setIsLoading(true);
    setIsLoadingSalaries(true);

    let employeeMasterList: EmployeeDetail[] = [];
    let allPerfDeductions: PerformanceDeductionEntry[] = [];

    if (typeof window !== 'undefined') {
      try {
        // Load Employee Data
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployeesStr) {
          const parsed = JSON.parse(storedEmployeesStr);
          if (Array.isArray(parsed)) {
            employeeMasterList = parsed;
          }
        }

        const totalEmployees = employeeMasterList.length;
        const activeEmployees = employeeMasterList.filter(emp => emp.status === "Active").length;
        const leftEmployees = employeeMasterList.filter(emp => emp.status === "Left").length;

        // Load Leave Records
        let totalLeaveRecords = 0;
        const storedLeaveAppsStr = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedLeaveAppsStr) {
          try {
            const parsedApps: LeaveApplication[] = JSON.parse(storedLeaveAppsStr);
            totalLeaveRecords = Array.isArray(parsedApps) ? parsedApps.length : 0;
          } catch (e) {
            console.error("Error parsing leave applications:", e);
          }
        }

        // Load Performance Deductions
        const storedPerfDeductionsStr = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
        if (storedPerfDeductionsStr) {
          const parsedPerfDeductions = JSON.parse(storedPerfDeductionsStr);
          if (Array.isArray(parsedPerfDeductions)) allPerfDeductions = parsedPerfDeductions;
        }

        // Calculate Storage
        let totalAppSpecificBytes = 0;
        const knownFixedKeys = [
          LOCAL_STORAGE_EMPLOYEE_MASTER_KEY,
          LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY,
          LOCAL_STORAGE_OPENING_BALANCES_KEY,
          LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY,
          LOCAL_STORAGE_SIMULATED_USERS_KEY,
          LOCAL_STORAGE_RECENT_ACTIVITIES_KEY,
          LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY,
        ];

        knownFixedKeys.forEach(key => {
          const item = localStorage.getItem(key);
          if (item) {
            totalAppSpecificBytes += new TextEncoder().encode(item).length;
          }
        });

        const knownPrefixes = [
          LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX,
          LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX,
          LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX
        ];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && knownPrefixes.some(prefix => key.startsWith(prefix))) {
            const item = localStorage.getItem(key);
            if (item) {
              totalAppSpecificBytes += new TextEncoder().encode(item).length;
            }
          }
        }

        let storageUsed = "0 Bytes";
        if (totalAppSpecificBytes > 0) {
          if (totalAppSpecificBytes < 1024) {
            storageUsed = `${totalAppSpecificBytes.toFixed(0)} Bytes`;
          } else if (totalAppSpecificBytes < 1024 * 1024) {
            storageUsed = `${(totalAppSpecificBytes / 1024).toFixed(2)} KB`;
          } else {
            storageUsed = `${(totalAppSpecificBytes / (1024 * 1024)).toFixed(2)} MB`;
          }
        }

        // Calculate Last 5 Months Salary
        const monthlyTotals: MonthlySalaryTotal[] = [];
        let fiveMonthGrandTotal = 0;

        for (let i = 1; i <= 5; i++) {
          const targetDate = subMonths(new Date(), i);
          const monthName = months[getMonth(targetDate)];
          const year = getYear(targetDate);
          let monthTotal = 0;
          let monthEmployeeCount = 0;
          const monthStatusCounts = { Active: 0, Left: 0 };
          const monthDesignationCounts: Record<string, number> = {};

          const employeeMasterForPeriod = employeeMasterList.filter(emp => {
            const employeeDOJ = emp.doj && isValid(parseISO(emp.doj)) ? parseISO(emp.doj) : null;
            const employeeDOR = emp.dor && isValid(parseISO(emp.dor)) ? parseISO(emp.dor) : null;
            const currentMonthStart = startOfMonth(targetDate);
            const currentMonthEnd = endOfMonth(targetDate);
            if (employeeDOJ && isAfter(employeeDOJ, currentMonthEnd)) return false;
            if (employeeDOR && isBefore(employeeDOR, currentMonthStart)) return false;
            return true;
          });

          if (employeeMasterForPeriod.length > 0) {
            const attendanceKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${monthName}_${year}`;
            const salaryEditsKey = `${LOCAL_STORAGE_SALARY_SHEET_EDITS_PREFIX}${monthName}_${year}`;

            const storedAttendanceStr = localStorage.getItem(attendanceKey);
            const storedSalaryEditsStr = localStorage.getItem(salaryEditsKey);

            const attendanceForMonth: StoredEmployeeAttendanceData[] = storedAttendanceStr ? JSON.parse(storedAttendanceStr) : [];
            const salaryEditsForMonth: Record<string, SalarySheetEdits> = storedSalaryEditsStr ? JSON.parse(storedSalaryEditsStr) : {};
            const perfDeductionsForMonth = allPerfDeductions.filter(pd => pd.month === monthName && pd.year === year);

            if (attendanceForMonth.length > 0) {
              employeeMasterForPeriod.forEach(emp => {
                const empAttendanceRecord = attendanceForMonth.find(att => att.code === emp.code);
                if (empAttendanceRecord) {
                  const totalDaysInMonth = getDaysInMonth(targetDate);
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
                  const totalDeductionValue = tds + loan + salaryAdvance + totalOtherDeduction;
                  const netPayForMonth = totalAllowance - totalDeductionValue;
                  monthTotal += netPayForMonth;

                  monthEmployeeCount++;
                  monthStatusCounts[emp.status] = (monthStatusCounts[emp.status] || 0) + 1;
                  const desig = emp.designation || "N/A";
                  monthDesignationCounts[desig] = (monthDesignationCounts[desig] || 0) + 1;
                }
              });
            }
          }
          monthlyTotals.push({ monthYear: `${monthName} ${year}`, total: monthTotal, employeeCount: monthEmployeeCount, statusCounts: monthStatusCounts, designationCounts: monthDesignationCounts });
          fiveMonthGrandTotal += monthTotal;
        }
        setLastFiveMonthsSalaryData(monthlyTotals.reverse());
        setGrandTotalLastFiveMonths(fiveMonthGrandTotal);
        setIsLoadingSalaries(false);

        // Payroll Status
        const lastMonthDate = subMonths(new Date(), 1);
        const prevMonthName = months[getMonth(lastMonthDate)];
        const prevMonthYear = getYear(lastMonthDate);
        const attendanceKeyForLastMonth = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${prevMonthName}_${prevMonthYear}`;

        let payrollStatus = "Pending";
        let payrollDescription = `Awaiting ${prevMonthName} ${prevMonthYear} attendance`;
        if (localStorage.getItem(attendanceKeyForLastMonth)) {
          payrollStatus = "Processed";
          payrollDescription = `${prevMonthName} ${prevMonthYear} completed`;
        }

        // Recent Activities
        const storedActivitiesStr = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
        if (storedActivitiesStr) {
          try {
            const parsedActivities: ActivityLogEntry[] = JSON.parse(storedActivitiesStr);
            setRecentActivities(Array.isArray(parsedActivities) ? parsedActivities.slice(0, 5) : []);
          } catch (e) {
            setRecentActivities([]);
          }
        }

        // Set Stats
        setStats({
          totalEmployees,
          activeEmployees,
          leftEmployees,
          totalLeaveRecords,
          payrollStatus,
          payrollDescription,
          storageUsed,
        });

      } catch (error) {
        console.error("Dashboard: Error fetching data:", error);
        toast({ title: "Dashboard Error", description: "Could not load some data.", variant: "destructive" });
      }
    }
    setIsLoading(false);
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <h1 className="text-2xl font-bold mb-1">Welcome to Dashboard</h1>
          <p className="text-blue-100 text-sm">Manage your HR operations efficiently</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <Users className="h-4 w-4" />
              <span className="text-sm">{stats.totalEmployees} Employees</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{stats.activeEmployees} Active</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{format(new Date(), "dd MMM yyyy")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees.toString()}
          description={`${stats.activeEmployees} Active, ${stats.leftEmployees} Left`}
          icon={UserCheck}
          color="blue"
        />
        <StatCard
          title="Leave Records"
          value={stats.totalLeaveRecords.toString()}
          description="All recorded entries"
          icon={History}
          color="green"
        />
        <StatCard
          title="Payroll Status"
          value={stats.payrollStatus}
          description={stats.payrollDescription}
          icon={DollarSign}
          color="purple"
        />
        <StatCard
          title="Storage Used"
          value={stats.storageUsed}
          description="Local app data"
          icon={HardDrive}
          color="orange"
        />
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLinkCard
            href="/employee-master"
            icon={Users}
            title="Employee Master"
            description="Manage employee records"
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          />
          <QuickLinkCard
            href="/attendance"
            icon={Calendar}
            title="Attendance"
            description="Upload & manage attendance"
            gradient="bg-gradient-to-br from-green-500 to-green-700"
          />
          <QuickLinkCard
            href="/salary-sheet"
            icon={FileText}
            title="Salary Sheet"
            description="View & edit salary data"
            gradient="bg-gradient-to-br from-purple-500 to-purple-700"
          />
          <QuickLinkCard
            href="/salary-slip"
            icon={Briefcase}
            title="Salary Slips"
            description="Generate salary slips"
            gradient="bg-gradient-to-br from-orange-500 to-orange-700"
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Salary Totals */}
        <Card className="shadow-md border-0 bg-white">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base">Last 5 Months' Salary</CardTitle>
                <CardDescription>Net pay breakdown</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoadingSalaries ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : lastFiveMonthsSalaryData.length > 0 ? (
              <div className="space-y-3">
                {lastFiveMonthsSalaryData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">{item.monthYear}</p>
                      <p className="text-xs text-gray-500">{item.employeeCount} employees</p>
                    </div>
                    <p className="font-semibold text-green-600">
                      ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200 mt-4">
                  <p className="font-semibold text-gray-800">Grand Total</p>
                  <p className="text-xl font-bold text-green-700">
                    ₹{grandTotalLastFiveMonths.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No salary data available</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="shadow-md border-0 bg-white">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Recent Activities</CardTitle>
                <CardDescription>Latest updates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="mt-0.5 p-1.5 bg-blue-100 rounded-full">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{activity.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(activity.timestamp), "dd MMM, hh:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No recent activities</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* More Quick Links */}
      <Card className="shadow-md border-0 bg-white">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
          <CardTitle className="text-base">More Options</CardTitle>
          <CardDescription>Access all features</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { href: "/leave", label: "Leave Management", icon: Calendar, color: "text-green-600 bg-green-50" },
              { href: "/performance-deduction", label: "Deductions", icon: TrendingUp, color: "text-red-600 bg-red-50" },
              { href: "/reports", label: "Reports", icon: FileText, color: "text-blue-600 bg-blue-50" },
              { href: "/user-management", label: "Users", icon: Users, color: "text-purple-600 bg-purple-50" },
              { href: "/settings", label: "Settings", icon: HardDrive, color: "text-gray-600 bg-gray-100" },
              { href: "/help", label: "Help", icon: History, color: "text-orange-600 bg-orange-50" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer">
                  <div className={`p-2.5 rounded-lg ${item.color} mb-2`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}