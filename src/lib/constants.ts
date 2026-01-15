// src/lib/constants.ts

import type { LucideIcon } from 'lucide-react';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  Briefcase, 
  Users, 
  Sheet, 
  FileText, 
  BarChart3, 
  UserCog, 
  TrendingDownIcon, 
  Settings, 
  LifeBuoy,
  PieChart  // ← NEW IMPORT
} from 'lucide-react';

export const APP_NAME = 'Catura_Payroll';
export const COMPANY_NAME = 'Catura Healthcare Pvt. Ltd.';

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
  // ✅ NEW TAB ADDED
  {
    title: 'Salary Breakup',
    href: '/salary-breakup',
    icon: PieChart,
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
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    title: 'User Management',
    href: '/user-management',
    icon: UserCog,
  },
  {
    title: 'Help',
    href: '/help',
    icon: LifeBuoy,
  },
];

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  P: 'bg-green-100 text-green-700',
  A: 'bg-red-100 text-red-700',
  HD: 'bg-yellow-100 text-yellow-700',
  W: 'bg-gray-100 text-gray-700',
  PH: 'bg-blue-100 text-blue-700',
  CL: 'bg-purple-100 text-purple-700',
  SL: 'bg-orange-100 text-orange-700',
  PL: 'bg-amber-100 text-amber-700',
  HCL: 'bg-purple-100 text-purple-700',
  HSL: 'bg-orange-100 text-orange-700',
  HPL: 'bg-amber-100 text-amber-700',
  '-': 'bg-slate-100 text-slate-600',
};