
export type LeaveType = 'CL' | 'SL' | 'PL';

export interface LeaveBalanceItem {
  type: LeaveType;
  accrued: number;
  used: number;
  balance: number;
  eligible?: boolean; // For PL
}

export interface LeaveApplication {
  id: string;
  employeeId: string; // Should match EmployeeDetail.id / EmployeeDetail.code
  leaveType: LeaveType; 
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: number;
}

export interface OpeningLeaveBalance {
  employeeCode: string; // Should match EmployeeDetail.code
  openingCL: number;
  openingSL: number;
  openingPL: number;
  financialYearStart: number; // e.g., 2024 for FY Apr 2024 - Mar 2025
}
