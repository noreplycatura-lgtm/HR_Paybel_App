

import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays, addMonths, differenceInCalendarMonths, isValid, isAfter } from 'date-fns';
import type { EmployeeDetail } from './hr-data';
import type { LeaveApplication, OpeningLeaveBalance } from './hr-types';

// Ensure standard leave logic is active.
const TEMPORARY_RESET_LEAVE_LOGIC = false; 

export const CL_ACCRUAL_RATE = 0.6;
export const SL_ACCRUAL_RATE = 0.6;
export const PL_ACCRUAL_RATE = 1.2;

// Special rates for Office-Staff
export const OFFICE_STAFF_CL_ACCRUAL_RATE = 0.5;
export const OFFICE_STAFF_SL_ACCRUAL_RATE = 0.5;
export const OFFICE_STAFF_ANNUAL_PL_GRANT = 21;


export const MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL = 5; // Accrual starts after 5 completed months

export const calculateMonthsOfService = (dojString: string, referenceDate: Date = new Date()): number => {
  if (!dojString) return 0;
  try {
    const doj = parseISO(dojString);
    if (!isValid(doj) || isBefore(referenceDate, doj)) return 0;
    
    const refDateForCalc = endOfMonth(referenceDate); // Consider service up to the end of the reference month
    const dojDateForCalc = startOfMonth(doj); // Service starts from the beginning of DOJ month for full month counting
    
    const completedMonths = differenceInCalendarMonths(refDateForCalc, dojDateForCalc);
    return Math.max(0, completedMonths);
  } catch (error) {
    console.error("Error parsing DOJ for months of service calculation:", dojString, error);
    return 0;
  }
};


interface EmployeeLeaveDetails {
  // These represent accruals up to the END of the target month, including any OB and that month's accrual
  balanceCLAtMonthEnd: number; // This is accrued total before deducting current month's usage from attendance
  balanceSLAtMonthEnd: number; // This is accrued total before deducting current month's usage from attendance
  balancePLAtMonthEnd: number; // This is accrued total before deducting current month's usage from attendance
  isEligibleForAccrualThisMonth: boolean;
}

/**
 * Calculates leave details for an employee up to the end of a target month.
 * This function considers opening balances and accruals based on service.
 * It also deducts leaves from 'allLeaveApplications' that fall within the calculated period.
 * The "used" leaves it returns are specific to the target month from 'allLeaveApplications'.
 */
export const calculateEmployeeLeaveDetailsForPeriod = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0-11
  allLeaveApplications: LeaveApplication[], 
  allOpeningBalances: OpeningLeaveBalance[] = []
): EmployeeLeaveDetails => {
  if (!employee || !employee.doj || !isValid(parseISO(employee.doj))) {
    return {
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isEligibleForAccrualThisMonth: false,
    };
  }

  const isOfficeStaff = employee.division === 'Office-Staff';
  const clAccrualRate = isOfficeStaff ? OFFICE_STAFF_CL_ACCRUAL_RATE : CL_ACCRUAL_RATE;
  const slAccrualRate = isOfficeStaff ? OFFICE_STAFF_SL_ACCRUAL_RATE : SL_ACCRUAL_RATE;
  const plAccrualRate = isOfficeStaff ? 0 : PL_ACCRUAL_RATE; // PL accrues annually for office staff

  const doj = parseISO(employee.doj);
  const selectedMonthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const selectedMonthEndDate = endOfMonth(selectedMonthStartDate);

  if (isBefore(selectedMonthEndDate, doj)) {
     return {
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isEligibleForAccrualThisMonth: false,
    };
  }

  const employeeApplications = allLeaveApplications.filter(app => app.employeeId === employee.id);
  const employeeOpeningBalances = allOpeningBalances.filter(ob => ob.employeeCode === employee.code);
  
  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1;
  const fyStartDate = startOfMonth(new Date(currentFYStartYear, 3, 1)); 
  
  const openingBalanceForCurrentFY = employeeOpeningBalances.find(ob => ob.financialYearStart === currentFYStartYear);
  
  let accruedCLInCurrentFY = openingBalanceForCurrentFY?.openingCL || 0;
  let accruedSLInCurrentFY = openingBalanceForCurrentFY?.openingSL || 0;
  
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
    let monthIteratorForFY = startOfMonth(fyStartDate); 
    if (isBefore(monthIteratorForFY, doj)) {
        monthIteratorForFY = startOfMonth(doj);
    }

    while(isBefore(monthIteratorForFY, selectedMonthEndDate) || isEqual(monthIteratorForFY, selectedMonthEndDate)) {
        if (getYear(monthIteratorForFY) < currentFYStartYear || (getYear(monthIteratorForFY) === currentFYStartYear && getMonth(monthIteratorForFY) < 3)) {
            monthIteratorForFY = startOfMonth(new Date(currentFYStartYear, 3, 1)); 
            if (isBefore(monthIteratorForFY, doj)) monthIteratorForFY = startOfMonth(doj); 
            if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break;
        }
        
        if(isBefore(doj, endOfMonth(monthIteratorForFY)) || isEqual(doj, endOfMonth(monthIteratorForFY))) {
            const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForFY));
            if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
                 accruedCLInCurrentFY += clAccrualRate;
                 accruedSLInCurrentFY += slAccrualRate;
            }
        }
        
        if (getMonth(monthIteratorForFY) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForFY) === getYear(selectedMonthEndDate)) {
          break;
        }
        monthIteratorForFY = addMonths(monthIteratorForFY, 1);
        if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break;
    }
  } else {
      accruedCLInCurrentFY = openingBalanceForCurrentFY?.openingCL || 0;
      accruedSLInCurrentFY = openingBalanceForCurrentFY?.openingSL || 0;
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

  // PL Calculation
  let accruedPLOverall = 0;
  let plCalculationStartDate = startOfMonth(doj); 

  const relevantOpeningPLRecords = employeeOpeningBalances
      .filter(ob => ob.financialYearStart <= currentFYStartYear)
      .sort((a, b) => b.financialYearStart - a.financialYearStart); 
  
  let latestOpeningPLRecord = relevantOpeningPLRecords.length > 0 ? relevantOpeningPLRecords[0] : null;

  if (latestOpeningPLRecord) {
      accruedPLOverall = latestOpeningPLRecord.openingPL;
      plCalculationStartDate = startOfMonth(new Date(latestOpeningPLRecord.financialYearStart, 3, 1)); 
      if (isBefore(plCalculationStartDate, doj)) {
          plCalculationStartDate = startOfMonth(doj); 
      }
  }
  
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
    let monthIteratorForPL = plCalculationStartDate;

    if(isOfficeStaff) {
      // For Office-Staff, find the start of the current financial year.
      const currentFYStartForPL = startOfMonth(new Date(currentFYStartYear, 3, 1)); 
      if (isBefore(plCalculationStartDate, currentFYStartForPL)) {
        // If we have an OB from a previous year, add annual grant for all intermediate years.
        let grantYear = getYear(plCalculationStartDate);
        while (grantYear < currentFYStartYear) {
          accruedPLOverall += OFFICE_STAFF_ANNUAL_PL_GRANT;
          grantYear++;
        }
      }
      // Add the grant for the current financial year if the target month is April or later.
      accruedPLOverall += OFFICE_STAFF_ANNUAL_PL_GRANT;
    } else {
      // Standard monthly accrual for other divisions
      while(isBefore(monthIteratorForPL, selectedMonthEndDate) || isEqual(monthIteratorForPL, selectedMonthEndDate)) {
          if(isBefore(doj, endOfMonth(monthIteratorForPL)) || isEqual(doj, endOfMonth(monthIteratorForPL))) {
              let boolSkipAccrual = false;
              if (latestOpeningPLRecord && 
                  getYear(monthIteratorForPL) === latestOpeningPLRecord.financialYearStart && 
                  getMonth(monthIteratorForPL) === 3 
              ) {
                   boolSkipAccrual = !isEqual(monthIteratorForPL, startOfMonth(doj)); 
              }

              const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForPL));
              if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
                  if (!boolSkipAccrual) {
                     accruedPLOverall += plAccrualRate;
                  }
              }
          }
          if (getMonth(monthIteratorForPL) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForPL) === getYear(selectedMonthEndDate)) {
            break; 
          }
          monthIteratorForPL = addMonths(monthIteratorForPL, 1);
          if(isAfter(monthIteratorForPL, selectedMonthEndDate)) break; 
      }
    }

  } else {
    accruedPLOverall = openingBalanceForCurrentFY?.openingPL || 0; 
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
  const isEligibleForAccrualThisMonth = serviceMonthsAtSelectedMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL && !TEMPORARY_RESET_LEAVE_LOGIC; 
  
  return {
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
  
  const isOfficeStaff = employee.division === 'Office-Staff';
  const clAccrualRate = isOfficeStaff ? OFFICE_STAFF_CL_ACCRUAL_RATE : CL_ACCRUAL_RATE;
  const slAccrualRate = isOfficeStaff ? OFFICE_STAFF_SL_ACCRUAL_RATE : SL_ACCRUAL_RATE;
  const plAccrualRate = isOfficeStaff ? 0 : PL_ACCRUAL_RATE;


  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const dojDate = parseISO(employee.doj);

  if (!isValid(dojDate) || !employee.doj ) { 
    return { cl: 0, sl: 0, pl: 0, isEligibleForAccrualThisMonth: false };
  }
  
  const currentFYStartYearForTargetMonth = targetMonthIndex >= 3 ? targetYear : targetMonthIndex < 3 && targetYear > getYear(dojDate) ? targetYear -1 : getYear(dojDate);
  
  if (TEMPORARY_RESET_LEAVE_LOGIC) {
    const openingBalanceForCurrentFY = allOpeningBalances.find(
      ob => ob.employeeCode === employee.code && ob.financialYearStart === currentFYStartYearForTargetMonth
    );
    if (openingBalanceForCurrentFY) {
        return {
            cl: openingBalanceForCurrentFY.openingCL,
            sl: openingBalanceForCurrentFY.openingSL,
            pl: openingBalanceForCurrentFY.openingPL,
            isEligibleForAccrualThisMonth: false,
        };
    }
    return { cl: 0, sl: 0, pl: 0, isEligibleForAccrualThisMonth: false };
  }

  const serviceMonthsAtTargetMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
  const isEligibleForAccrualInTargetMonth = serviceMonthsAtTargetMonthStart >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

  if (isBefore(monthStartDate, dojDate) || isEqual(monthStartDate, startOfMonth(dojDate))) {
     let initialCL = 0, initialSL = 0, initialPL = 0;
     
     if (targetMonthIndex === 3) { 
        const obForThisNewFY = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === targetYear);
        initialCL = obForThisNewFY?.openingCL || 0;
        initialSL = obForThisNewFY?.openingSL || 0;
        initialPL = obForThisNewFY?.openingPL || 0;
        if(isOfficeStaff) initialPL += OFFICE_STAFF_ANNUAL_PL_GRANT;
     } else {
        const obForCurrentFYofDOJ = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === currentFYStartYearForTargetMonth);
        initialCL = obForCurrentFYofDOJ?.openingCL || 0;
        initialSL = obForCurrentFYofDOJ?.openingSL || 0;
        initialPL = obForCurrentFYofDOJ?.openingPL || 0;
     }
    
     if (isEligibleForAccrualInTargetMonth) {
        initialCL += clAccrualRate;
        initialSL += slAccrualRate;
        initialPL += plAccrualRate; // Will be 0 for office staff
     }
     
      return {
        cl: initialCL,
        sl: initialSL,
        pl: initialPL,
        isEligibleForAccrualThisMonth: isEligibleForAccrualInTargetMonth,
      };
  }

  let prevMonthDate = addMonths(monthStartDate, -1);
  const balancesAtPrevMonthEnd = calculateEmployeeLeaveDetailsForPeriod(
    employee,
    getYear(prevMonthDate),
    getMonth(prevMonthDate),
    allLeaveHistory, 
    allOpeningBalances
  );
  
  let openingCLForTargetMonth = balancesAtPrevMonthEnd.balanceCLAtMonthEnd;
  let openingSLForTargetMonth = balancesAtPrevMonthEnd.balanceSLAtMonthEnd;
  let openingPLForTargetMonth = balancesAtPrevMonthEnd.balancePLAtMonthEnd;
  
  if (targetMonthIndex === 3) { 
    const obForNewFY = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === targetYear);
    openingCLForTargetMonth = obForNewFY?.openingCL || 0;
    openingSLForTargetMonth = obForNewFY?.openingSL || 0;
    if (obForNewFY && obForNewFY.openingPL !== undefined) { 
        openingPLForTargetMonth = obForNewFY.openingPL;
    }
    if (isOfficeStaff) {
      openingPLForTargetMonth += OFFICE_STAFF_ANNUAL_PL_GRANT;
    }
  }

  if (isEligibleForAccrualInTargetMonth) {
    openingCLForTargetMonth += clAccrualRate;
    openingSLForTargetMonth += slAccrualRate;
    openingPLForTargetMonth += plAccrualRate; // Will be 0 for office staff
  }

  return {
    cl: openingCLForTargetMonth,
    sl: openingSLForTargetMonth,
    pl: openingPLForTargetMonth,
    isEligibleForAccrualThisMonth: isEligibleForAccrualInTargetMonth,
  };
};

