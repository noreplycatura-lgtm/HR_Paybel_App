import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, CalendarCheck, Briefcase, Users, Sheet, FileText, BarChart3, UserCog, TrendingDownIcon } from 'lucide-react';

export const APP_NAME = 'Novita_Payroll';
export const COMPANY_NAME = 'Novita Healthcare Pvt. Ltd.';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard', 
    icon: LayoutDashboard,
  },
  {
    title: 'Employee Master',
    href: '/employee-master',
    icon: Users,
  },
  {
    title: 'Attendance',
    href: '/attendance',
    icon: CalendarCheck,
  },
  {
    title: 'Leave Management',
    href: '/leave',
    icon: Briefcase,
  },
  {
    title: 'Salary Sheet',
    href: '/salary-sheet',
    icon: Sheet,
  },
  {
    title: 'Performance Deduction',
    href: '/performance-deduction',
    icon: TrendingDownIcon,
  },
  {
    title: 'Salary Slip',
    href: '/salary-slip',
    icon: FileText,
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
  },
  {
    title: 'User Management',
    href: '/user-management',
    icon: UserCog,
  },
];

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  P: 'bg-green-100 text-green-700', // Present
  A: 'bg-red-100 text-red-700',     // Absent
  HD: 'bg-yellow-100 text-yellow-700', // Half Day
  W: 'bg-gray-100 text-gray-700',    // Week Off
  PH: 'bg-blue-100 text-blue-700',   // Public Holiday
  CL: 'bg-purple-100 text-purple-700', // Casual Leave
  SL: 'bg-orange-100 text-orange-700', // Sick Leave
  PL: 'bg-amber-100 text-amber-700',  // Paid Leave
  HCL: 'bg-purple-100 text-purple-700', // Half Casual Leave
  HSL: 'bg-orange-100 text-orange-700', // Half Sick Leave
  HPL: 'bg-amber-100 text-amber-700',  // Half Paid Leave
  '-': 'bg-slate-100 text-slate-600', // Not Joined / Not Applicable
};
