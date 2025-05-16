
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
  employeeId: string;
  leaveType: LeaveType; 
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: number;
  // status: 'Pending' | 'Approved' | 'Rejected'; // Removed as per previous request
}
