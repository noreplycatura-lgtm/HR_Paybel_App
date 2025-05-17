
import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays, addMonths, differenceInCalendarMonths, isValid } from 'date-fns';
import type { EmployeeDetail } from './hr-data';
import type { LeaveApplication, OpeningLeaveBalance } from './hr-types';

export const CL_ACCRUAL_RATE = 0.6;
export const SL_ACCRUAL_RATE = 0.6;
export const PL_ACCRUAL_RATE = 1.2;
export const MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL = 5; // Accrual starts after 5 completed months (i.e., from the 6th month)

export const calculateMonthsOfService = (dojString: string, referenceDate: Date = new Date()): number => {
  if (!dojString) return 0;
  try {
    const doj = parseISO(dojString);
    if (!isValid(doj) || isBefore(referenceDate, doj)) return 0;
    
    const refDateForCalc = endOfMonth(referenceDate);
    const dojDateForCalc = startOfMonth(doj);
    
    const completedMonths = differenceInCalendarMonths(refDateForCalc, dojDateForCalc);
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
  isEligibleForAccrualThisMonth: boolean;
}

export const calculateEmployeeLeaveDetailsForPeriod = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0-11
  allLeaveApplications: LeaveApplication[], 
  allOpeningBalances: OpeningLeaveBalance[] = []
): EmployeeLeaveDetails => {
  if (!employee || !employee.doj || !isValid(parseISO(employee.doj))) {
    return {
      usedCLInMonth: 0, usedSLInMonth: 0, usedPLInMonth: 0,
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isEligibleForAccrualThisMonth: false,
    };
  }

  const doj = parseISO(employee.doj);
  const selectedMonthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const selectedMonthEndDate = endOfMonth(selectedMonthStartDate);

  if (isBefore(selectedMonthEndDate, doj)) {
     return {
      usedCLInMonth: 0, usedSLInMonth: 0, usedPLInMonth: 0,
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isEligibleForAccrualThisMonth: false,
    };
  }

  const employeeApplications = allLeaveApplications.filter(app => app.employeeId === employee.id);
  const employeeOpeningBalances = allOpeningBalances.filter(ob => ob.employeeCode === employee.code);
  
  let usedCLInSelectedMonthFromApps = 0;
  let usedSLInSelectedMonthFromApps = 0;
  let usedPLInSelectedMonthFromApps = 0;

  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (isValid(appStartDate) && getYear(appStartDate) === targetYear && getMonth(appStartDate) === targetMonthIndex) {
        if (app.leaveType === 'CL') usedCLInSelectedMonthFromApps += app.days;
        if (app.leaveType === 'SL') usedSLInSelectedMonthFromApps += app.days;
        if (app.leaveType === 'PL') usedPLInSelectedMonthFromApps += app.days;
        }
    } catch { /* ignore invalid app dates */ }
  });


  // Determine the financial year for the target month
  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1; // April is month 3
  const fyStartDate = startOfMonth(new Date(currentFYStartYear, 3, 1));

  const openingBalanceForCurrentFY = employeeOpeningBalances.find(ob => ob.financialYearStart === currentFYStartYear);
  
  let accruedCLInCurrentFY = openingBalanceForCurrentFY?.openingCL || 0;
  let accruedSLInCurrentFY = openingBalanceForCurrentFY?.openingSL || 0;
  
  let monthIteratorForFY = startOfMonth(fyStartDate);
  if (isBefore(monthIteratorForFY, doj)) {
      monthIteratorForFY = startOfMonth(doj);
  }
  // Iterate from the start of the FY (or DOJ if later) up to the END of the selected month
  while(isBefore(monthIteratorForFY, selectedMonthEndDate) || isEqual(monthIteratorForFY, selectedMonthEndDate)) {
      // Ensure iterator is within the current financial year for CL/SL
      if (getYear(monthIteratorForFY) < currentFYStartYear || (getYear(monthIteratorForFY) === currentFYStartYear && getMonth(monthIteratorForFY) < 3)) {
          monthIteratorForFY = startOfMonth(new Date(currentFYStartYear, 3, 1)); // Reset to start of current FY
          if (isBefore(monthIteratorForFY, doj)) monthIteratorForFY = startOfMonth(doj); // Ensure not before DOJ
          if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break; // Optimization: if reset jumps past target, break
          continue;
      }
      
      if(isBefore(doj, endOfMonth(monthIteratorForFY)) || isEqual(doj, endOfMonth(monthIteratorForFY))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForFY));
          if (serviceMonthsAtIterEnd > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) { // Greater than, because accrual starts from 6th month
               accruedCLInCurrentFY += CL_ACCRUAL_RATE;
               accruedSLInCurrentFY += SL_ACCRUAL_RATE;
          }
      }
      
      if (getMonth(monthIteratorForFY) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForFY) === getYear(selectedMonthEndDate)) {
        break; // Reached the target month
      }
      monthIteratorForFY = addMonths(monthIteratorForFY, 1);
      if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break; // Safety break
  }
  
  let usedCLInCurrentFYFromApps = 0;
  let usedSLInCurrentFYFromApps = 0;
  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (isValid(appStartDate) && !isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
            if (app.leaveType === 'CL') usedCLInCurrentFYFromApps += app.days;
            if (app.leaveType === 'SL') usedSLInCurrentFYFromApps += app.days;
        }
    } catch { /* ignore */ }
  });
  
  const balanceCLAtMonthEnd = accruedCLInCurrentFY - usedCLInCurrentFYFromApps;
  const balanceSLAtMonthEnd = accruedSLInCurrentFY - usedSLInCurrentFYFromApps;

  // PL Calculation (Carries Forward)
  let accruedPLOverall = 0;
  // Find the latest opening PL balance whose financial year is less than or equal to the current financial year.
  const relevantOpeningPLRecords = employeeOpeningBalances
    .filter(ob => ob.financialYearStart <= currentFYStartYear)
    .sort((a, b) => b.financialYearStart - a.financialYearStart);
  
  let latestOpeningPLRecord = relevantOpeningPLRecords.length > 0 ? relevantOpeningPLRecords[0] : null;

  let plCalculationStartDate = startOfMonth(doj);
  if (latestOpeningPLRecord) {
      accruedPLOverall = latestOpeningPLRecord.openingPL;
      // Start PL accrual calculation from the beginning of the financial year of this opening balance
      plCalculationStartDate = startOfMonth(new Date(latestOpeningPLRecord.financialYearStart, 3, 1));
      if (isBefore(plCalculationStartDate, doj)) { // Ensure it doesn't start before DOJ
          plCalculationStartDate = startOfMonth(doj);
      }
  }
  
  let monthIteratorForPL = plCalculationStartDate;
  // Iterate from PL calculation start date up to the END of the selected month
  while(isBefore(monthIteratorForPL, selectedMonthEndDate) || isEqual(monthIteratorForPL, selectedMonthEndDate)) {
      if(isBefore(doj, endOfMonth(monthIteratorForPL)) || isEqual(doj, endOfMonth(monthIteratorForPL))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForPL));
          if (serviceMonthsAtIterEnd > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
              accruedPLOverall += PL_ACCRUAL_RATE;
          }
      }
      if (getMonth(monthIteratorForPL) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForPL) === getYear(selectedMonthEndDate)) {
        break; // Reached the target month
      }
      monthIteratorForPL = addMonths(monthIteratorForPL, 1);
      if(isAfter(monthIteratorForPL, selectedMonthEndDate)) break; // Safety break
  }

  let usedPLOverallFromApps = 0;
  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (isValid(appStartDate) && app.leaveType === 'PL' && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
            // Only count PL used from DOJ onwards
            if (!isBefore(appStartDate, doj)) {
                usedPLOverallFromApps += app.days;
            }
        }
    } catch {/* ignore */}
  });
  const balancePLAtMonthEnd = accruedPLOverall - usedPLOverallFromApps;
  
  const serviceMonthsAtSelectedMonthEnd = calculateMonthsOfService(employee.doj, selectedMonthEndDate);
  const isEligibleForAccrualThisMonth = serviceMonthsAtSelectedMonthEnd > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
  
  return {
    usedCLInMonth: usedCLInSelectedMonthFromApps,
    usedSLInMonth: usedSLInSelectedMonthFromApps,
    usedPLInMonth: usedPLInSelectedMonthFromApps,
    balanceCLAtMonthEnd,
    balanceSLAtMonthEnd,
    balancePLAtMonthEnd,
    isEligibleForAccrualThisMonth,
  };
};


// This function is mainly for reference if needed, for calculating what *would be* the opening balance
// for a given month if we didn't have specific attendance data for that month yet.
// The LeavePage component calculates next month's opening differently based on current month's closing.
export const getLeaveBalancesAtStartOfMonth = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0 for Jan, 11 for Dec
  allLeaveHistory: LeaveApplication[],
  allOpeningBalances: OpeningLeaveBalance[] = []
): { cl: number; sl: number; pl: number; isEligibleForAccrualThisMonth: boolean } => {
  
  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  
  // Calculate balances as of the end of the *previous* month.
  let prevMonthDate = addMonths(monthStartDate, -1);
  if (isBefore(prevMonthDate, parseISO(employee.doj))) {
    // If previous month is before DOJ, effectively opening balances are 0 before first accrual.
     const serviceMonthsAtTargetMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
     const isEligibleInTargetMonth = serviceMonthsAtTargetMonthStart > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
     let initialCL = 0, initialSL = 0, initialPL = 0;
     if (isEligibleInTargetMonth) {
        initialCL = targetMonthIndex === 3 ? CL_ACCRUAL_RATE : 0; // April reset special case
        initialSL = targetMonthIndex === 3 ? SL_ACCRUAL_RATE : 0; // April reset special case
        initialPL = PL_ACCRUAL_RATE;
     }
      return {
        cl: initialCL,
        sl: initialSL,
        pl: initialPL,
        isEligibleForAccrualThisMonth: isEligibleInTargetMonth,
      };
  }

  const balancesAtPrevMonthEnd = calculateEmployeeLeaveDetailsForPeriod(
    employee,
    getYear(prevMonthDate),
    getMonth(prevMonthDate),
    allLeaveHistory,
    allOpeningBalances
  );

  const serviceMonthsAtTargetMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
  const isEligibleForAccrualInTargetMonth = serviceMonthsAtTargetMonthStart > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
  
  let openingCLForTargetMonth = balancesAtPrevMonthEnd.balanceCLAtMonthEnd;
  let openingSLForTargetMonth = balancesAtPrevMonthEnd.balanceSLAtMonthEnd;
  let openingPLForTargetMonth = balancesAtPrevMonthEnd.balancePLAtMonthEnd;

  if (targetMonthIndex === 3) { // April - Financial Year Reset for CL/SL
    const obForNewFY = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === targetYear);
    openingCLForTargetMonth = obForNewFY?.openingCL || 0;
    openingSLForTargetMonth = obForNewFY?.openingSL || 0;
    // For PL, if OB exists for new FY, that's the new base. Otherwise, it's carried forward.
    // This part needs care: balancePLAtMonthEnd is already carried forward. If an OB exists, it *replaces* it.
    if (obForNewFY && obForNewFY.openingPL !== undefined) {
        openingPLForTargetMonth = obForNewFY.openingPL;
    }
  }

  if (isEligibleForAccrualInTargetMonth) {
    openingCLForTargetMonth += CL_ACCRUAL_RATE;
    openingSLForTargetMonth += SL_ACCRUAL_RATE;
    openingPLForTargetMonth += PL_ACCRUAL_RATE;
  }

  return {
    cl: openingCLForTargetMonth,
    sl: openingSLForTargetMonth,
    pl: openingPLForTargetMonth,
    isEligibleForAccrualThisMonth: isEligibleForAccrualInTargetMonth,
  };
};

    