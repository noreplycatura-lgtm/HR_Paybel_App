
import { differenceInMonths, parseISO, startOfMonth, isBefore, isEqual } from 'date-fns';
import type { EmployeeDetail, LeaveHistoryEntry } from './hr-data';
import type { LeaveType, LeaveBalanceItem } from './hr-types';

export const CL_ACCRUAL_RATE = 0.6;
export const SL_ACCRUAL_RATE = 0.6;
export const PL_ACCRUAL_RATE = 1.2;
export const PL_ELIGIBILITY_MONTHS = 6;

export const calculateMonthsOfService = (dojString: string, referenceDate: Date = new Date()): number => {
  if (!dojString) return 0;
  try {
    const doj = parseISO(dojString);
    // Ensure referenceDate is not before doj
    if (isBefore(referenceDate, doj)) return 0;
    const months = differenceInMonths(referenceDate, doj);
    return Math.max(0, months);
  } catch (error) {
    console.error("Error parsing DOJ for months of service calculation:", dojString, error);
    return 0;
  }
};

interface CalculatedLeaveBalances {
  CL: LeaveBalanceItem;
  SL: LeaveBalanceItem;
  PL: LeaveBalanceItem;
}

export const calculateAllLeaveBalancesForEmployee = (
  employee: EmployeeDetail,
  allLeaveHistory: LeaveHistoryEntry[],
  referenceDate: Date = new Date()
): CalculatedLeaveBalances => {
  const completedMonthsOverall = calculateMonthsOfService(employee.doj, referenceDate);

  // Accruals
  const accruedCLOverall = completedMonthsOverall * CL_ACCRUAL_RATE;
  const accruedSLOverall = completedMonthsOverall * SL_ACCRUAL_RATE;
  
  let accruedPLOverall = 0;
  const isPLEligible = completedMonthsOverall >= PL_ELIGIBILITY_MONTHS;
  if (isPLEligible) {
    // PL accrues for months *after* the eligibility period starts
    const plAccrualMonths = Math.max(0, completedMonthsOverall - (PL_ELIGIBILITY_MONTHS -1) ); // -5 if PL starts in 6th month
    accruedPLOverall = plAccrualMonths * PL_ACCRUAL_RATE;
  }

  // Used leaves
  const employeeLeaveHistory = allLeaveHistory.filter(
    h => h.employeeId === employee.id && 
         (isBefore(parseISO(h.startDate), referenceDate) || isEqual(parseISO(h.startDate), referenceDate))
  );

  const usedCL = employeeLeaveHistory
    .filter(h => h.leaveType === 'CL')
    .reduce((sum, h) => sum + h.days, 0);
  const usedSL = employeeLeaveHistory
    .filter(h => h.leaveType === 'SL')
    .reduce((sum, h) => sum + h.days, 0);
  const usedPL = employeeLeaveHistory
    .filter(h => h.leaveType === 'PL')
    .reduce((sum, h) => sum + h.days, 0);

  return {
    CL: { type: 'CL', accrued: accruedCLOverall, used: usedCL, balance: Math.max(0, accruedCLOverall - usedCL) },
    SL: { type: 'SL', accrued: accruedSLOverall, used: usedSL, balance: Math.max(0, accruedSLOverall - usedSL) },
    PL: { type: 'PL', accrued: accruedPLOverall, used: usedPL, balance: Math.max(0, accruedPLOverall - usedPL), eligible: isPLEligible },
  };
};


// Calculate balances specifically up to the START of a given month for an employee
export const getLeaveBalancesAtStartOfMonth = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0 for Jan, 11 for Dec
  allLeaveHistory: LeaveHistoryEntry[]
): { cl: number; sl: number; pl: number; plEligibleThisMonth: boolean } => {
  
  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  
  // Calculate months of service up to the start of the target month
  const completedMonthsByMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);

  const accruedCL = completedMonthsByMonthStart * CL_ACCRUAL_RATE;
  const accruedSL = completedMonthsByMonthStart * SL_ACCRUAL_RATE;
  
  let accruedPL = 0;
  const isPLEligibleByMonthStart = completedMonthsByMonthStart >= PL_ELIGIBILITY_MONTHS;
  if (isPLEligibleByMonthStart) {
     const plAccrualMonths = Math.max(0, completedMonthsByMonthStart - (PL_ELIGIBILITY_MONTHS - 1) );
     accruedPL = plAccrualMonths * PL_ACCRUAL_RATE;
  }
  
  // Consider leaves used *before* the start of the target month
  const historyBeforeMonth = allLeaveHistory.filter(h => {
    if (h.employeeId !== employee.id) return false;
    try {
      const leaveStartDate = parseISO(h.startDate);
      return isBefore(leaveStartDate, monthStartDate);
    } catch {
      return false;
    }
  });

  const usedCLBefore = historyBeforeMonth.filter(h => h.leaveType === 'CL').reduce((sum, h) => sum + h.days, 0);
  const usedSLBefore = historyBeforeMonth.filter(h => h.leaveType === 'SL').reduce((sum, h) => sum + h.days, 0);
  const usedPLBefore = historyBeforeMonth.filter(h => h.leaveType === 'PL').reduce((sum, h) => sum + h.days, 0);

  return {
    cl: Math.max(0, accruedCL - usedCLBefore),
    sl: Math.max(0, accruedSL - usedSLBefore),
    pl: Math.max(0, accruedPL - usedPLBefore),
    plEligibleThisMonth: isPLEligibleByMonthStart // Eligibility based on service by start of month
  };
};
