
import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, differenceInCalendarDays, addDays } from 'date-fns';
import type { EmployeeDetail } from './hr-data';
import type { LeaveType, LeaveApplication, LeaveBalanceItem } from './hr-types';

export const CL_ACCRUAL_RATE = 0.6;
export const SL_ACCRUAL_RATE = 0.6;
export const PL_ACCRUAL_RATE = 1.2;
export const PL_ELIGIBILITY_MONTHS = 6; // Eligible from the 7th month, accrual starts from 1st eligible month.

export const calculateMonthsOfService = (dojString: string, referenceDate: Date = new Date()): number => {
  if (!dojString) return 0;
  try {
    const doj = parseISO(dojString);
    if (isBefore(referenceDate, doj)) return 0;
    // differenceInMonths gives full months passed. Add 1 if referenceDate is after or on DOJ to count the first month.
    // However, for accrual, typically it's for *completed* months.
    // If DOJ is 15th Jan, by 14th Feb, 0 completed months. By 15th Feb, 1 completed month.
    // differenceInMonths(endOfMonth(referenceDate), startOfMonth(doj)) might be more accurate for "service period"
    // Let's stick to simple completed months based on the anniversary day.
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
  isPLEligibleThisMonth: boolean;
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

  // Determine current financial year (FY) for CL/SL reset
  // FY is April to March. If target month is Jan-Mar (0-2), FY started last year. Else, FY started this year.
  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1;
  const fyStartDate = new Date(currentFYStartYear, 3, 1); // April 1st

  // --- CL Balance Calculation ---
  let accruedCLInCurrentFY = 0;
  let usedCLInCurrentFY = 0;
  // Calculate months of service from FY start (or DOJ if later) to selected month end
  const clslEffectiveStartDateForFY = isBefore(doj, fyStartDate) ? fyStartDate : doj;
  
  if (isBefore(selectedMonthEndDate, clslEffectiveStartDateForFY) || isEqual(selectedMonthEndDate, clslEffectiveStartDateForFY)) {
    accruedCLInCurrentFY = 0; // Joined after or in the month, so 0 completed months by start for accrual from FY start logic
  } else {
    // Calculate completed months from clslEffectiveStartDateForFY to selectedMonthEndDate
    // Consider only full months passed *within* the FY window for accrual.
    let currentIterMonth = startOfMonth(clslEffectiveStartDateForFY);
    while(isBefore(currentIterMonth, selectedMonthEndDate) || isEqual(currentIterMonth, selectedMonthEndDate)) {
        // Accrue if the employee was active for this month and it's on or after their DOJ
        if(isBefore(doj, endOfMonth(currentIterMonth)) || isEqual(doj, endOfMonth(currentIterMonth))) {
             // Calculate months between DOJ and currentIterMonth end. If >0, accrue.
             // Simplified: accrue for each month fully or partially served FROM clslEffectiveStartDateForFY within the FY
            if (getMonth(currentIterMonth) >= getMonth(clslEffectiveStartDateForFY) && getYear(currentIterMonth) >= getYear(clslEffectiveStartDateForFY)) {
                 accruedCLInCurrentFY += CL_ACCRUAL_RATE;
            }
        }
        currentIterMonth = addDays(endOfMonth(currentIterMonth), 1);
        currentIterMonth = startOfMonth(currentIterMonth); // Move to start of next month
         if(getYear(currentIterMonth) > getYear(selectedMonthEndDate) || (getYear(currentIterMonth) === getYear(selectedMonthEndDate) && getMonth(currentIterMonth) > getMonth(selectedMonthEndDate))) break;

    }
  }

  employeeApplications.forEach(app => {
    const appStartDate = parseISO(app.startDate);
    if (app.leaveType === 'CL' && !isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
      usedCLInCurrentFY += app.days;
    }
  });
  const balanceCLAtMonthEnd = Math.max(0, accruedCLInCurrentFY - usedCLInCurrentFY);

  // --- SL Balance Calculation (similar to CL) ---
  let accruedSLInCurrentFY = 0; // Recalculate for SL, same logic as CL accrual
  let usedSLInCurrentFY = 0;

  if (isBefore(selectedMonthEndDate, clslEffectiveStartDateForFY) || isEqual(selectedMonthEndDate, clslEffectiveStartDateForFY)) {
    accruedSLInCurrentFY = 0;
  } else {
    let currentIterMonth = startOfMonth(clslEffectiveStartDateForFY);
    while(isBefore(currentIterMonth, selectedMonthEndDate) || isEqual(currentIterMonth, selectedMonthEndDate)) {
         if(isBefore(doj, endOfMonth(currentIterMonth)) || isEqual(doj, endOfMonth(currentIterMonth))) {
            if (getMonth(currentIterMonth) >= getMonth(clslEffectiveStartDateForFY) && getYear(currentIterMonth) >= getYear(clslEffectiveStartDateForFY)) {
                accruedSLInCurrentFY += SL_ACCRUAL_RATE;
            }
        }
        currentIterMonth = addDays(endOfMonth(currentIterMonth), 1);
        currentIterMonth = startOfMonth(currentIterMonth);
        if(getYear(currentIterMonth) > getYear(selectedMonthEndDate) || (getYear(currentIterMonth) === getYear(selectedMonthEndDate) && getMonth(currentIterMonth) > getMonth(selectedMonthEndDate))) break;

    }
  }

  employeeApplications.forEach(app => {
    const appStartDate = parseISO(app.startDate);
    if (app.leaveType === 'SL' && !isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
      usedSLInCurrentFY += app.days;
    }
  });
  const balanceSLAtMonthEnd = Math.max(0, accruedSLInCurrentFY - usedSLInCurrentFY);

  // --- PL Balance Calculation (carries forward) ---
  let accruedPLOverall = 0;
  let usedPLOverall = 0;
  const totalMonthsOfServiceBySelectedMonthEnd = calculateMonthsOfService(employee.doj, selectedMonthEndDate);
  const isPLEligibleThisMonth = totalMonthsOfServiceBySelectedMonthEnd >= PL_ELIGIBILITY_MONTHS;

  if (isPLEligibleThisMonth) {
    // PL accrues for months *after* eligibility criteria is met.
    // Count months from DOJ where service >= PL_ELIGIBILITY_MONTHS
    let plAccrualMonthsCount = 0;
    if (totalMonthsOfServiceBySelectedMonthEnd >= PL_ELIGIBILITY_MONTHS) {
        // Iterate month by month from DOJ to selectedMonthEndDate
        let monthIterator = startOfMonth(doj);
        while(isBefore(monthIterator, selectedMonthEndDate) || isEqual(monthIterator, selectedMonthEndDate)){
            const serviceMonthsAtIteratorMonthEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIterator));
            if(serviceMonthsAtIteratorMonthEnd >= PL_ELIGIBILITY_MONTHS){
                plAccrualMonthsCount++;
            }
            monthIterator = addDays(endOfMonth(monthIterator),1);
            monthIterator = startOfMonth(monthIterator); // to next month
            if(getYear(monthIterator) > getYear(selectedMonthEndDate) || (getYear(monthIterator) === getYear(selectedMonthEndDate) && getMonth(monthIterator) > getMonth(selectedMonthEndDate))) break;
        }
    }
    accruedPLOverall = plAccrualMonthsCount * PL_ACCRUAL_RATE;
  }


  employeeApplications.forEach(app => {
    const appStartDate = parseISO(app.startDate);
    if (app.leaveType === 'PL' && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
      usedPLOverall += app.days;
    }
  });
  const balancePLAtMonthEnd = isPLEligibleThisMonth ? Math.max(0, accruedPLOverall - usedPLOverall) : 0;
  
  return {
    usedCLInMonth,
    usedSLInMonth,
    usedPLInMonth,
    balanceCLAtMonthEnd,
    balanceSLAtMonthEnd,
    balancePLAtMonthEnd,
    isPLEligibleThisMonth,
  };
};


// Helper for old leave page - can be deprecated or integrated if needed elsewhere
export const calculateAllLeaveBalancesForEmployee = (
  employee: EmployeeDetail,
  allLeaveHistory: LeaveApplication[],
  referenceDate: Date = new Date()
): { CL: LeaveBalanceItem; SL: LeaveBalanceItem; PL: LeaveBalanceItem } => {
  const completedMonthsOverall = calculateMonthsOfService(employee.doj, referenceDate);

  const accruedCLOverall = completedMonthsOverall * CL_ACCRUAL_RATE;
  const accruedSLOverall = completedMonthsOverall * SL_ACCRUAL_RATE;
  
  let accruedPLOverall = 0;
  const isPLEligible = completedMonthsOverall >= PL_ELIGIBILITY_MONTHS;
   if (isPLEligible) {
    let plAccrualMonthsCount = 0;
    let monthIterator = startOfMonth(parseISO(employee.doj));
    while(isBefore(monthIterator, referenceDate) || isEqual(monthIterator, referenceDate)){
        const serviceMonthsAtIteratorMonthEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIterator));
        if(serviceMonthsAtIteratorMonthEnd >= PL_ELIGIBILITY_MONTHS){
            plAccrualMonthsCount++;
        }
        monthIterator = addDays(endOfMonth(monthIterator),1);
        monthIterator = startOfMonth(monthIterator);
         if(getYear(monthIterator) > getYear(referenceDate) || (getYear(monthIterator) === getYear(referenceDate) && getMonth(monthIterator) > getMonth(referenceDate))) break;
    }
    accruedPLOverall = plAccrualMonthsCount * PL_ACCRUAL_RATE;
  }

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

// Used in Attendance Page
export const getLeaveBalancesAtStartOfMonth = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0 for Jan, 11 for Dec
  allLeaveHistory: LeaveApplication[]
): { cl: number; sl: number; pl: number; plEligibleThisMonth: boolean } => {
  
  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const doj = parseISO(employee.doj);

  // --- CL/SL Calculation for start of month ---
  // Determine financial year (FY) for CL/SL reset
  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1;
  const fyStartDate = new Date(currentFYStartYear, 3, 1); // April 1st
  
  let accruedCLAtMonthStart = 0;
  let accruedSLAtMonthStart = 0;

  const clslEffectiveStartDateForFY = isBefore(doj, fyStartDate) ? fyStartDate : doj;

  if (isBefore(monthStartDate, clslEffectiveStartDateForFY) || isEqual(monthStartDate, clslEffectiveStartDateForFY)) {
    accruedCLAtMonthStart = 0;
    accruedSLAtMonthStart = 0;
  } else {
    let currentIterMonth = startOfMonth(clslEffectiveStartDateForFY);
    while(isBefore(currentIterMonth, monthStartDate)) { // up to, but not including, the target month
        if(isBefore(doj, endOfMonth(currentIterMonth)) || isEqual(doj, endOfMonth(currentIterMonth))) {
             if (getMonth(currentIterMonth) >= getMonth(clslEffectiveStartDateForFY) && getYear(currentIterMonth) >= getYear(clslEffectiveStartDateForFY)) {
                accruedCLAtMonthStart += CL_ACCRUAL_RATE;
                accruedSLAtMonthStart += SL_ACCRUAL_RATE;
            }
        }
        currentIterMonth = addDays(endOfMonth(currentIterMonth), 1);
        currentIterMonth = startOfMonth(currentIterMonth);
        if(getYear(currentIterMonth) > getYear(monthStartDate) || (getYear(currentIterMonth) === getYear(monthStartDate) && getMonth(currentIterMonth) >= getMonth(monthStartDate))) break;

    }
  }
  
  const historyBeforeMonthStart = allLeaveHistory.filter(h => {
    if (h.employeeId !== employee.id) return false;
    try {
      const leaveStartDate = parseISO(h.startDate);
      // Count leaves taken from the start of the FY up to *before* the target month starts
      return !isBefore(leaveStartDate, fyStartDate) && isBefore(leaveStartDate, monthStartDate);
    } catch {
      return false;
    }
  });

  const usedCLBeforeMonthStartInFY = historyBeforeMonthStart.filter(h => h.leaveType === 'CL').reduce((sum, h) => sum + h.days, 0);
  const usedSLBeforeMonthStartInFY = historyBeforeMonthStart.filter(h => h.leaveType === 'SL').reduce((sum, h) => sum + h.days, 0);

  const clBalanceAtMonthStart = Math.max(0, accruedCLAtMonthStart - usedCLBeforeMonthStartInFY);
  const slBalanceAtMonthStart = Math.max(0, accruedSLAtMonthStart - usedSLBeforeMonthStartInFY);

  // --- PL Calculation for start of month ---
  let accruedPLAtMonthStart = 0;
  const totalMonthsOfServiceByMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
  const plEligibleByMonthStart = totalMonthsOfServiceByMonthStart >= PL_ELIGIBILITY_MONTHS;

  if (plEligibleByMonthStart) {
    let plAccrualMonthsCount = 0;
    let monthIterator = startOfMonth(doj);
    while(isBefore(monthIterator, monthStartDate)){ // up to, but not including, the target month
        const serviceMonthsAtIteratorMonthEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIterator));
        if(serviceMonthsAtIteratorMonthEnd >= PL_ELIGIBILITY_MONTHS){
            plAccrualMonthsCount++;
        }
        monthIterator = addDays(endOfMonth(monthIterator),1);
        monthIterator = startOfMonth(monthIterator);
         if(getYear(monthIterator) > getYear(monthStartDate) || (getYear(monthIterator) === getYear(monthStartDate) && getMonth(monthIterator) >= getMonth(monthStartDate))) break;
    }
    accruedPLAtMonthStart = plAccrualMonthsCount * PL_ACCRUAL_RATE;
  }
  
  const plHistoryBeforeMonthStart = allLeaveHistory.filter(h => {
    if (h.employeeId !== employee.id) return false;
    try {
      const leaveStartDate = parseISO(h.startDate);
      // Count all PL taken up to *before* the target month starts
      return h.leaveType === 'PL' && isBefore(leaveStartDate, monthStartDate);
    } catch {
      return false;
    }
  });
  const usedPLBeforeMonthStart = plHistoryBeforeMonthStart.reduce((sum, h) => sum + h.days, 0);
  const plBalanceAtMonthStart = plEligibleByMonthStart ? Math.max(0, accruedPLAtMonthStart - usedPLBeforeMonthStart) : 0;

  return {
    cl: clBalanceAtMonthStart,
    sl: slBalanceAtMonthStart,
    pl: plBalanceAtMonthStart,
    plEligibleThisMonth: plEligibleByMonthStart 
  };
};
