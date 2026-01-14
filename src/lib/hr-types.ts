// src/lib/hr-types.ts

// ============================================
// LEAVE MANAGEMENT TYPES (EXISTING - NO CHANGE)
// ============================================

export type LeaveType = 'CL' | 'SL' | 'PL';

export interface LeaveBalanceItem {
  type: LeaveType;
  accrued: number;
  used: number;
  balance: number;
  eligible?: boolean;
}

export interface LeaveApplication {
  id: string;
  employeeId: string;
  leaveType: LeaveType; 
  startDate: string;
  endDate: string;
  days: number;
}

export interface OpeningLeaveBalance {
  employeeCode: string;
  openingCL: number;
  openingSL: number;
  openingPL: number;
  financialYearStart: number;
  monthIndex?: number;
}

// ============================================
// SALARY BREAKUP TYPES (NEW ADDED)
// ============================================

export interface SalaryBreakupRule {
  id: string;
  ruleName: string;
  grossFrom: number;
  grossTo: number;
  basicType: 'fixed' | 'percentage';
  basicValue: number;
  hraPercentage: number;
  caPercentage: number;
  medicalPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRuleMapping {
  employeeCode: string;
  ruleId: string;
}