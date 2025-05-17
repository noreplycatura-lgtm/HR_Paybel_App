
import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays, addMonths, differenceInCalendarMonths } from 'date-fns';
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
    if (isBefore(referenceDate, doj)) return 0;
    // Ensure reference date is at least start of month for accurate completed month counting up to that month's end
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
  usedCLInMonth: number; // Note: This is based on 'allLeaveApplications', not attendance for this function's direct output
  usedSLInMonth: number; // Note: This is based on 'allLeaveApplications', not attendance for this function's direct output
  usedPLInMonth: number; // Note: This is based on 'allLeaveApplications', not attendance for this function's direct output
  balanceCLAtMonthEnd: number;
  balanceSLAtMonthEnd: number;
  balancePLAtMonthEnd: number;
  isEligibleForAccrualThisMonth: boolean;
}

export const calculateEmployeeLeaveDetailsForPeriod = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0-11
  allLeaveApplications: LeaveApplication[], // Formal leave applications, not raw attendance statuses
  allOpeningBalances: OpeningLeaveBalance[] = []
): EmployeeLeaveDetails => {
  if (!employee || !employee.doj) {
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

  // Calculate "Used in Selected Month" from formal applications
  let usedCLInMonthFromApps = 0;
  let usedSLInMonthFromApps = 0;
  let usedPLInMonthFromApps = 0;

  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (getYear(appStartDate) === targetYear && getMonth(appStartDate) === targetMonthIndex) {
        if (app.leaveType === 'CL') usedCLInMonthFromApps += app.days;
        if (app.leaveType === 'SL') usedSLInMonthFromApps += app.days;
        if (app.leaveType === 'PL') usedPLInMonthFromApps += app.days;
        }
    } catch { /* ignore invalid app dates */ }
  });

  // CL & SL Calculation (Resets each Financial Year)
  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1; // April is month 3
  const fyStartDate = new Date(currentFYStartYear, 3, 1);

  const openingBalanceForCurrentFY = employeeOpeningBalances.find(ob => ob.financialYearStart === currentFYStartYear);
  
  let accruedCLInCurrentFY = openingBalanceForCurrentFY?.openingCL || 0;
  let accruedSLInCurrentFY = openingBalanceForCurrentFY?.openingSL || 0;
  
  let monthIteratorForFY = startOfMonth(fyStartDate);
  if (isBefore(monthIteratorForFY, doj)) {
      monthIteratorForFY = startOfMonth(doj);
  }

  while(isBefore(monthIteratorForFY, selectedMonthEndDate) || isEqual(monthIteratorForFY, selectedMonthEndDate)) {
      if (getYear(monthIteratorForFY) < currentFYStartYear || (getYear(monthIteratorForFY) === currentFYStartYear && getMonth(monthIteratorForFY) < 3)) {
          monthIteratorForFY = startOfMonth(new Date(currentFYStartYear, 3, 1));
          if (isBefore(monthIteratorForFY, doj)) monthIteratorForFY = startOfMonth(doj);
          continue;
      }
      // Check if employee had joined *before or on the last day* of the month being iterated for accrual
      if(isBefore(doj, endOfMonth(monthIteratorForFY)) || isEqual(doj, endOfMonth(monthIteratorForFY))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForFY));
          if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
               accruedCLInCurrentFY += CL_ACCRUAL_RATE;
               accruedSLInCurrentFY += SL_ACCRUAL_RATE;
          }
      }
      if (getMonth(monthIteratorForFY) === 2 && getYear(monthIteratorForFY) === currentFYStartYear + 1) { 
         break; 
      }
      monthIteratorForFY = addMonths(monthIteratorForFY, 1);
  }
  
  let usedCLInCurrentFYFromApps = 0;
  let usedSLInCurrentFYFromApps = 0;
  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        // Count usage from formal apps within the current FY up to the selected month end
        if (!isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
            if (app.leaveType === 'CL') usedCLInCurrentFYFromApps += app.days;
            if (app.leaveType === 'SL') usedSLInCurrentFYFromApps += app.days;
        }
    } catch { /* ignore */ }
  });
  
  const balanceCLAtMonthEnd = accruedCLInCurrentFY - usedCLInCurrentFYFromApps;
  const balanceSLAtMonthEnd = accruedSLInCurrentFY - usedSLInCurrentFYFromApps;

  // PL Calculation (Carries Forward)
  let accruedPLOverall = 0;
  let latestOpeningPLRecord = null;
  if(employeeOpeningBalances.length > 0) {
    latestOpeningPLRecord = employeeOpeningBalances
        .filter(ob => ob.financialYearStart <= currentFYStartYear) 
        .sort((a,b) => b.financialYearStart - a.financialYearStart)[0]; 
  }

  let plCalculationStartDate = startOfMonth(doj);
  if(latestOpeningPLRecord) {
      accruedPLOverall = latestOpeningPLRecord.openingPL;
      plCalculationStartDate = startOfMonth(new Date(latestOpeningPLRecord.financialYearStart, 3, 1)); 
      if (isBefore(plCalculationStartDate, doj)) { 
          plCalculationStartDate = startOfMonth(doj);
      }
  }
  
  let monthIteratorForPL = plCalculationStartDate;
  while(isBefore(monthIteratorForPL, selectedMonthEndDate) || isEqual(monthIteratorForPL, selectedMonthEndDate)) {
      if(isBefore(doj, endOfMonth(monthIteratorForPL)) || isEqual(doj, endOfMonth(monthIteratorForPL))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForPL));
          if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
              // Ensure accrual happens for months that are part of or after the FY of the opening balance (if used),
              // or for all eligible months if no opening balance was used for PL.
              let shouldAccruePLThisMonth = false;
              if (!latestOpeningPLRecord) {
                shouldAccruePLThisMonth = true; // No OB, accrue if eligible
              } else {
                // If OB exists, only accrue for months >= OB's financial year start
                const obFyStartForPL = new Date(latestOpeningPLRecord.financialYearStart, 3, 1);
                if (isEqual(monthIteratorForPL, obFyStartForPL) || isBefore(obFyStartForPL, monthIteratorForPL)) {
                    shouldAccruePLThisMonth = true;
                }
              }
              if (shouldAccruePLThisMonth) {
                accruedPLOverall += PL_ACCRUAL_RATE;
              }
          }
      }
      monthIteratorForPL = addMonths(monthIteratorForPL, 1);
  }

  let usedPLOverallFromApps = 0;
  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (app.leaveType === 'PL' && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
            usedPLOverallFromApps += app.days;
        }
    } catch {/* ignore */}
  });
  const balancePLAtMonthEnd = accruedPLOverall - usedPLOverallFromApps;
  
  const totalMonthsOfServiceBySelectedMonthEnd = calculateMonthsOfService(employee.doj, selectedMonthEndDate);
  const isEligibleForAccrualThisMonth = totalMonthsOfServiceBySelectedMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
  
  return {
    usedCLInMonth: usedCLInMonthFromApps,
    usedSLInMonth: usedSLInMonthFromApps,
    usedPLInMonth: usedPLInMonthFromApps,
    balanceCLAtMonthEnd,
    balanceSLAtMonthEnd,
    balancePLAtMonthEnd,
    isEligibleForAccrualThisMonth, // Eligibility for accrual in the selected month
  };
};


// This function is mainly for reference if needed, as LeavePage calculates next month's opening differently now
export const getLeaveBalancesAtStartOfMonth = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0 for Jan, 11 for Dec
  allLeaveHistory: LeaveApplication[], // Formal leave applications
  allOpeningBalances: OpeningLeaveBalance[] = []
): { cl: number; sl: number; pl: number; isEligibleForAccrualThisMonth: boolean } => {
  
  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const prevMonthEndDate = addDays(monthStartDate, -1); // End of previous month

  // Get balances as of end of previous month
  const balancesAtPrevMonthEnd = calculateEmployeeLeaveDetailsForPeriod(
    employee,
    getYear(prevMonthEndDate),
    getMonth(prevMonthEndDate),
    allLeaveHistory,
    allOpeningBalances
  );

  // Determine eligibility for accrual for the *targetMonth*
  const serviceMonthsAtTargetMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
  const isEligibleForAccrualInTargetMonth = serviceMonthsAtTargetMonthStart >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
  
  let openingCLForTargetMonth = balancesAtPrevMonthEnd.balanceCLAtMonthEnd;
  let openingSLForTargetMonth = balancesAtPrevMonthEnd.balanceSLAtMonthEnd;
  let openingPLForTargetMonth = balancesAtPrevMonthEnd.balancePLAtMonthEnd;

  // Add accrual for the target month to the *opening* balance if eligible
  if (isEligibleForAccrualInTargetMonth) {
    if (targetMonthIndex === 3) { // April - CL/SL reset
      openingCLForTargetMonth = CL_ACCRUAL_RATE;
      openingSLForTargetMonth = SL_ACCRUAL_RATE;
    } else {
      openingCLForTargetMonth += CL_ACCRUAL_RATE;
      openingSLForTargetMonth += SL_ACCRUAL_RATE;
    }
    openingPLForTargetMonth += PL_ACCRUAL_RATE;
  } else {
    // If not eligible for accrual in target month, and it's April, opening CL/SL should be 0
    if (targetMonthIndex === 3) {
        openingCLForTargetMonth = 0;
        openingSLForTargetMonth = 0;
    }
    // PL just carries forward from previous month's end if no accrual
  }


  return {
    cl: openingCLForTargetMonth,
    sl: openingSLForTargetMonth,
    pl: openingPLForTargetMonth,
    isEligibleForAccrualThisMonth: isEligibleForAccrualInTargetMonth,
  };
};

