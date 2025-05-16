
export type LeaveType = 'CL' | 'SL' | 'PL';

export interface LeaveBalanceItem {
  type: LeaveType;
  accrued: number;
  used: number;
  balance: number;
  eligible?: boolean; // For PL
}
