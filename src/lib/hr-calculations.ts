
import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays, addMonths, differenceInCalendarMonths, isValid, isAfter } from 'date-fns';
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
          // continue; // Removed continue to ensure this month is processed if it's the target after reset
      }
      
      if(isBefore(doj, endOfMonth(monthIteratorForFY)) || isEqual(doj, endOfMonth(monthIteratorForFY))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForFY));
          if (serviceMonthsAtIterEnd > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) { 
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
  const relevantOpeningPLRecords = employeeOpeningBalances
    .filter(ob => ob.financialYearStart <= currentFYStartYear)
    .sort((a, b) => b.financialYearStart - a.financialYearStart);
  
  let latestOpeningPLRecord = relevantOpeningPLRecords.length > 0 ? relevantOpeningPLRecords[0] : null;

  let plCalculationStartDate = startOfMonth(doj);
  if (latestOpeningPLRecord) {
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
          if (serviceMonthsAtIterEnd > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
              accruedPLOverall += PL_ACCRUAL_RATE;
          }
      }
      if (getMonth(monthIteratorForPL) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForPL) === getYear(selectedMonthEndDate)) {
        break; 
      }
      monthIteratorForPL = addMonths(monthIteratorForPL, 1);
      if(isAfter(monthIteratorForPL, selectedMonthEndDate)) break; 
  }

  let usedPLOverallFromApps = 0;
  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (isValid(appStartDate) && app.leaveType === 'PL' && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
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

export const getLeaveBalancesAtStartOfMonth = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0 for Jan, 11 for Dec
  allLeaveHistory: LeaveApplication[],
  allOpeningBalances: OpeningLeaveBalance[] = []
): { cl: number; sl: number; pl: number; isEligibleForAccrualThisMonth: boolean } => {
  
  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const dojDate = parseISO(employee.doj);

  if (!isValid(dojDate)) { // Handle invalid DOJ
    return { cl: 0, sl: 0, pl: 0, isEligibleForAccrualThisMonth: false };
  }
  
  let prevMonthDate = addMonths(monthStartDate, -1);

  // If target month is DOJ month or before, or prev month is before DOJ, implies no prior balance or accrual.
  if (isBefore(monthStartDate, dojDate) || isEqual(monthStartDate, startOfMonth(dojDate)) || isBefore(prevMonthDate, dojDate)) {
     const serviceMonthsAtTargetMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
     const isEligibleInTargetMonth = serviceMonthsAtTargetMonthStart > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
     
     let initialCL = 0, initialSL = 0, initialPL = 0;
     
     const currentFYStartYearForTargetMonth = targetMonthIndex >= 3 ? targetYear : targetYear - 1;
     const openingBalanceForCurrentFY = allOpeningBalances.find(
        ob => ob.employeeCode === employee.code && ob.financialYearStart === currentFYStartYearForTargetMonth
     );

     if (targetMonthIndex === 3) { // April
        initialCL = openingBalanceForCurrentFY?.openingCL || 0;
        initialSL = openingBalanceForCurrentFY?.openingSL || 0;
     }
     // PL opening balance is handled below, if it exists for current or past FYs.

     if (isEligibleInTargetMonth) {
        initialCL += CL_ACCRUAL_RATE;
        initialSL += SL_ACCRUAL_RATE;
        initialPL += PL_ACCRUAL_RATE;
     }
     
     // For PL, even if starting, check if there's an overall opening PL
     const relevantOpeningPLRecords = allOpeningBalances
        .filter(ob => ob.employeeCode === employee.code && ob.financialYearStart <= currentFYStartYearForTargetMonth)
        .sort((a, b) => b.financialYearStart - a.financialYearStart);
    
     if (relevantOpeningPLRecords.length > 0) {
        initialPL = relevantOpeningPLRecords[0].openingPL + (isEligibleInTargetMonth ? PL_ACCRUAL_RATE : 0);
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

  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1;
  
  if (targetMonthIndex === 3) { // April - Financial Year Reset for CL/SL
    const obForNewFY = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === targetYear);
    openingCLForTargetMonth = obForNewFY?.openingCL || 0;
    openingSLForTargetMonth = obForNewFY?.openingSL || 0;
    if (obForNewFY && obForNewFY.openingPL !== undefined) { // If specific PL OB for new FY, use it
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
