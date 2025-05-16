
import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays } from 'date-fns';
import type { EmployeeDetail } from './hr-data';
import type { LeaveApplication } from './hr-types';

export const CL_ACCRUAL_RATE = 0.6;
export const SL_ACCRUAL_RATE = 0.6;
export const PL_ACCRUAL_RATE = 1.2;
export const MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL = 5; // Accrual starts after 5 completed months (i.e., from the 6th month)

export const calculateMonthsOfService = (dojString: string, referenceDate: Date = new Date()): number => {
  if (!dojString) return 0;
  try {
    const doj = parseISO(dojString);
    if (isBefore(referenceDate, doj)) return 0;
    const completedMonths = differenceInMonths(referenceDate, doj);
    return Math.max(0, completedMonths);
  } catch (error) {
    console.error("Error parsing DOJ for months of service calculation:", dojString, error);
    return 0;
  }
};


interface EmployeeLeaveDetails {
  usedCLInMonth: number;
  usedSLInMonth: number;
  usedPLInMonth: number;
  balanceCLAtMonthEnd: number;
  balanceSLAtMonthEnd: number;
  balancePLAtMonthEnd: number;
  isPLEligibleThisMonth: boolean; // This now means "is eligible for ANY leave accrual this month"
}

export const calculateEmployeeLeaveDetailsForPeriod = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0-11
  allLeaveApplications: LeaveApplication[]
): EmployeeLeaveDetails => {
  if (!employee || !employee.doj) {
    return {
      usedCLInMonth: 0, usedSLInMonth: 0, usedPLInMonth: 0,
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isPLEligibleThisMonth: false,
    };
  }

  const doj = parseISO(employee.doj);
  const selectedMonthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const selectedMonthEndDate = endOfMonth(selectedMonthStartDate);

  // If employee joined after the selected month ended, all values are 0
  if (isBefore(selectedMonthEndDate, doj)) {
     return {
      usedCLInMonth: 0, usedSLInMonth: 0, usedPLInMonth: 0,
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isPLEligibleThisMonth: false,
    };
  }

  const employeeApplications = allLeaveApplications.filter(app => app.employeeId === employee.id);

  // Calculate "Used in Selected Month"
  let usedCLInMonth = 0;
  let usedSLInMonth = 0;
  let usedPLInMonth = 0;

  employeeApplications.forEach(app => {
    const appStartDate = parseISO(app.startDate);
    if (getYear(appStartDate) === targetYear && getMonth(appStartDate) === targetMonthIndex) {
      if (app.leaveType === 'CL') usedCLInMonth += app.days;
      if (app.leaveType === 'SL') usedSLInMonth += app.days;
      if (app.leaveType === 'PL') usedPLInMonth += app.days;
    }
  });

  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetMonthIndex - 1;
  const fyStartDate = new Date(currentFYStartYear, 3, 1); // April 1st
  const clslEffectiveStartDateForFY = isBefore(doj, fyStartDate) ? fyStartDate : doj;

  let accruedCLInCurrentFY = 0;
  let usedCLInCurrentFY = 0;
  let accruedSLInCurrentFY = 0;
  let usedSLInCurrentFY = 0;

  let currentIterMonth = startOfMonth(clslEffectiveStartDateForFY);
  while(isBefore(currentIterMonth, selectedMonthEndDate) || isEqual(currentIterMonth, selectedMonthEndDate)) {
      if(isBefore(doj, endOfMonth(currentIterMonth)) || isEqual(doj, endOfMonth(currentIterMonth))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(currentIterMonth));
          if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
            if (getMonth(currentIterMonth) >= getMonth(clslEffectiveStartDateForFY) && getYear(currentIterMonth) >= getYear(clslEffectiveStartDateForFY)) {
                 accruedCLInCurrentFY += CL_ACCRUAL_RATE;
                 accruedSLInCurrentFY += SL_ACCRUAL_RATE;
            }
          }
      }
      currentIterMonth = addDays(endOfMonth(currentIterMonth), 1);
      currentIterMonth = startOfMonth(currentIterMonth);
      if(getYear(currentIterMonth) > getYear(selectedMonthEndDate) || (getYear(currentIterMonth) === getYear(selectedMonthEndDate) && getMonth(currentIterMonth) > getMonth(selectedMonthEndDate))) break;
  }

  employeeApplications.forEach(app => {
    const appStartDate = parseISO(app.startDate);
    if (!isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
      if (app.leaveType === 'CL') usedCLInCurrentFY += app.days;
      if (app.leaveType === 'SL') usedSLInCurrentFY += app.days;
    }
  });
  const balanceCLAtMonthEnd = Math.max(0, accruedCLInCurrentFY - usedCLInCurrentFY);
  const balanceSLAtMonthEnd = Math.max(0, accruedSLInCurrentFY - usedSLInCurrentFY);

  let accruedPLOverall = 0;
  let usedPLOverall = 0;
  const totalMonthsOfServiceBySelectedMonthEnd = calculateMonthsOfService(employee.doj, selectedMonthEndDate);
  const isEligibleForAccrualThisMonth = totalMonthsOfServiceBySelectedMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

  if (isEligibleForAccrualThisMonth) {
    let plAccrualMonthsCount = 0;
    let monthIterator = startOfMonth(doj);
    while(isBefore(monthIterator, selectedMonthEndDate) || isEqual(monthIterator, selectedMonthEndDate)){
        const serviceMonthsAtIteratorMonthEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIterator));
        if(serviceMonthsAtIteratorMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL){
            plAccrualMonthsCount++;
        }
        monthIterator = addDays(endOfMonth(monthIterator),1);
        monthIterator = startOfMonth(monthIterator);
        if(getYear(monthIterator) > getYear(selectedMonthEndDate) || (getYear(monthIterator) === getYear(selectedMonthEndDate) && getMonth(monthIterator) > getMonth(selectedMonthEndDate))) break;
    }
    accruedPLOverall = plAccrualMonthsCount * PL_ACCRUAL_RATE;
  }

  employeeApplications.forEach(app => {
    const appStartDate = parseISO(app.startDate);
    if (app.leaveType === 'PL' && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
      usedPLOverall += app.days;
    }
  });
  const balancePLAtMonthEnd = isEligibleForAccrualThisMonth ? Math.max(0, accruedPLOverall - usedPLOverall) : 0;
  
  return {
    usedCLInMonth,
    usedSLInMonth,
    usedPLInMonth,
    balanceCLAtMonthEnd,
    balanceSLAtMonthEnd,
    balancePLAtMonthEnd,
    isPLEligibleThisMonth: isEligibleForAccrualThisMonth,
  };
};


export const getLeaveBalancesAtStartOfMonth = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0 for Jan, 11 for Dec
  allLeaveHistory: LeaveApplication[]
): { cl: number; sl: number; pl: number; plEligibleThisMonth: boolean } => { // plEligibleThisMonth now general eligibility
  
  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const doj = parseISO(employee.doj);

  const totalMonthsOfServiceByMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
  const isEligibleForAccrualAtMonthStart = totalMonthsOfServiceByMonthStart >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

  if (!isEligibleForAccrualAtMonthStart) {
    return { cl: 0, sl: 0, pl: 0, plEligibleThisMonth: false };
  }

  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetMonthIndex - 1;
  const fyStartDate = new Date(currentFYStartYear, 3, 1); 
  const clslEffectiveStartDateForFY = isBefore(doj, fyStartDate) ? fyStartDate : doj;
  
  let accruedCLAtMonthStart = 0;
  let accruedSLAtMonthStart = 0;

  if (!(isBefore(monthStartDate, clslEffectiveStartDateForFY) || isEqual(monthStartDate, clslEffectiveStartDateForFY))) {
    let currentIterMonth = startOfMonth(clslEffectiveStartDateForFY);
    while(isBefore(currentIterMonth, monthStartDate)) { 
        if(isBefore(doj, endOfMonth(currentIterMonth)) || isEqual(doj, endOfMonth(currentIterMonth))) {
             const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(currentIterMonth));
             if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
                if (getMonth(currentIterMonth) >= getMonth(clslEffectiveStartDateForFY) && getYear(currentIterMonth) >= getYear(clslEffectiveStartDateForFY)) {
                    accruedCLAtMonthStart += CL_ACCRUAL_RATE;
                    accruedSLAtMonthStart += SL_ACCRUAL_RATE;
                }
             }
        }
        currentIterMonth = addDays(endOfMonth(currentIterMonth), 1);
        currentIterMonth = startOfMonth(currentIterMonth);
        if(getYear(currentIterMonth) > getYear(monthStartDate) || (getYear(currentIterMonth) === getYear(monthStartDate) && getMonth(currentIterMonth) >= getMonth(monthStartDate))) break;
    }
  }
  
  const historyBeforeMonthStartInFY = allLeaveHistory.filter(h => {
    if (h.employeeId !== employee.id) return false;
    try {
      const leaveStartDate = parseISO(h.startDate);
      return !isBefore(leaveStartDate, fyStartDate) && isBefore(leaveStartDate, monthStartDate);
    } catch { return false; }
  });

  const usedCLBeforeMonthStartInFY = historyBeforeMonthStartInFY.filter(h => h.leaveType === 'CL').reduce((sum, h) => sum + h.days, 0);
  const usedSLBeforeMonthStartInFY = historyBeforeMonthStartInFY.filter(h => h.leaveType === 'SL').reduce((sum, h) => sum + h.days, 0);

  const clBalanceAtMonthStart = Math.max(0, accruedCLAtMonthStart - usedCLBeforeMonthStartInFY);
  const slBalanceAtMonthStart = Math.max(0, accruedSLAtMonthStart - usedSLBeforeMonthStartInFY);

  let accruedPLAtMonthStart = 0;
  let plAccrualMonthsCount = 0;
  let monthIterator = startOfMonth(doj);
  while(isBefore(monthIterator, monthStartDate)){
      const serviceMonthsAtIteratorMonthEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIterator));
      if(serviceMonthsAtIteratorMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL){
          plAccrualMonthsCount++;
      }
      monthIterator = addDays(endOfMonth(monthIterator),1);
      monthIterator = startOfMonth(monthIterator);
      if(getYear(monthIterator) > getYear(monthStartDate) || (getYear(monthIterator) === getYear(monthStartDate) && getMonth(monthIterator) >= getMonth(monthStartDate))) break;
  }
  accruedPLAtMonthStart = plAccrualMonthsCount * PL_ACCRUAL_RATE;
  
  const plHistoryBeforeMonthStart = allLeaveHistory.filter(h => {
    if (h.employeeId !== employee.id) return false;
    try {
      const leaveStartDate = parseISO(h.startDate);
      return h.leaveType === 'PL' && isBefore(leaveStartDate, monthStartDate);
    } catch { return false; }
  });
  const usedPLBeforeMonthStart = plHistoryBeforeMonthStart.reduce((sum, h) => sum + h.days, 0);
  const plBalanceAtMonthStart = Math.max(0, accruedPLAtMonthStart - usedPLBeforeMonthStart);

  return {
    cl: clBalanceAtMonthStart,
    sl: slBalanceAtMonthStart,
    pl: plBalanceAtMonthStart,
    plEligibleThisMonth: isEligibleForAccrualAtMonthStart 
  };
};

// Deprecated function - keeping for reference or if structure is needed elsewhere, but not actively used by Leave or Attendance pages.
export const calculateAllLeaveBalancesForEmployee = (
  employee: EmployeeDetail,
  allLeaveHistory: LeaveApplication[],
  referenceDate: Date = new Date()
): { CL: any; SL: any; PL: any } => { // Using 'any' as this function is deprecated
  const completedMonthsOverall = calculateMonthsOfService(employee.doj, referenceDate);
  const isEligibleForAccrual = completedMonthsOverall >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

  if (!isEligibleForAccrual) {
    return {
      CL: { type: 'CL', accrued: 0, used: 0, balance: 0, eligible: false },
      SL: { type: 'SL', accrued: 0, used: 0, balance: 0, eligible: false },
      PL: { type: 'PL', accrued: 0, used: 0, balance: 0, eligible: false },
    };
  }
  
  // This simplified accrual doesn't consider FY resets for CL/SL and is not what the main pages use.
  const accruedCLOverall = (completedMonthsOverall - MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL +1) * CL_ACCRUAL_RATE; // Simplistic
  const accruedSLOverall = (completedMonthsOverall - MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL +1) * SL_ACCRUAL_RATE; // Simplistic
  const accruedPLOverall = (completedMonthsOverall - MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL +1) * PL_ACCRUAL_RATE; // Simplistic


  const employeeLeaveHistory = allLeaveHistory.filter(
    h => h.employeeId === employee.id && 
         (isBefore(parseISO(h.startDate), referenceDate) || isEqual(parseISO(h.startDate), referenceDate))
  );

  const usedCL = employeeLeaveHistory.filter(h => h.leaveType === 'CL').reduce((sum, h) => sum + h.days, 0);
  const usedSL = employeeLeaveHistory.filter(h => h.leaveType === 'SL').reduce((sum, h) => sum + h.days, 0);
  const usedPL = employeeLeaveHistory.filter(h => h.leaveType === 'PL').reduce((sum, h) => sum + h.days, 0);

  return {
    CL: { type: 'CL', accrued: accruedCLOverall, used: usedCL, balance: Math.max(0, accruedCLOverall - usedCL), eligible: true },
    SL: { type: 'SL', accrued: accruedSLOverall, used: usedSL, balance: Math.max(0, accruedSLOverall - usedSL), eligible: true },
    PL: { type: 'PL', accrued: accruedPLOverall, used: usedPL, balance: Math.max(0, accruedPLOverall - usedPL), eligible: true },
  };
};
