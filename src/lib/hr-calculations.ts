
import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays, addMonths, differenceInCalendarMonths, isValid, isAfter } from 'date-fns';
import type { EmployeeDetail } from './hr-data';
import type { LeaveApplication, OpeningLeaveBalance } from './hr-types';

// TEMPORARY FLAG: Set to true to simplify leave logic and reset prior accruals.
// Set to false to revert to standard calculation rules.
const TEMPORARY_RESET_LEAVE_LOGIC = true;

export const CL_ACCRUAL_RATE = 0.6;
export const SL_ACCRUAL_RATE = 0.6;
export const PL_ACCRUAL_RATE = 1.2;
export const MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL = 5; // Accrual starts after 5 completed months

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

  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1; // April is month 3
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
            if (serviceMonthsAtIterEnd > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) { 
                 accruedCLInCurrentFY += CL_ACCRUAL_RATE;
                 accruedSLInCurrentFY += SL_ACCRUAL_RATE;
            }
        }
        
        if (getMonth(monthIteratorForFY) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForFY) === getYear(selectedMonthEndDate)) {
          break; 
        }
        monthIteratorForFY = addMonths(monthIteratorForFY, 1);
        if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break; 
    }
  } else {
    // In temporary mode, if it's the target month itself, add its accrual if eligible, based on its opening balance
    // But we effectively want to zero out previous accruals and just use the opening for Feb 2025 as the base.
    // So, if opening balance for current FY is used, we don't add further accrual for Feb 2025 itself if it's the opening point.
    // For Feb 2025: targetMonthIndex = 1, targetYear = 2025. currentFYStartYear = 2024.
    // If an opening balance for 2024 exists, accruedCL/SL are set to those. No further addition for Feb if it's the "opening".
    // This makes the uploaded OB the "balance before Feb usage".
  }
  
  let usedCLInCurrentFYFromApps = 0;
  let usedSLInCurrentFYFromApps = 0;
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
    employeeApplications.forEach(app => {
      try {
          const appStartDate = parseISO(app.startDate);
          if (isValid(appStartDate) && !isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
              if (app.leaveType === 'CL') usedCLInCurrentFYFromApps += app.days;
              if (app.leaveType === 'SL') usedSLInCurrentFYFromApps += app.days;
          }
      } catch { /* ignore */ }
    });
  } else {
    // In temp mode, 'used' for the month only applies if it's the target month.
    // The overall used for FY is effectively reset to the target month's usage.
    usedCLInCurrentFYFromApps = usedCLInSelectedMonthFromApps;
    usedSLInCurrentFYFromApps = usedSLInSelectedMonthFromApps;
  }
  
  const balanceCLAtMonthEnd = accruedCLInCurrentFY - usedCLInCurrentFYFromApps;
  const balanceSLAtMonthEnd = accruedSLInCurrentFY - usedSLInCurrentFYFromApps;

  let accruedPLOverall = 0;
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
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
  } else {
    // In temporary mode, PL also starts from the opening balance for the current FY.
    accruedPLOverall = openingBalanceForCurrentFY?.openingPL || 0;
    // If it's the target month, add its accrual if eligible
    // But we want Feb 2025 opening to be absolute for Feb 2025.
  }

  let usedPLOverallFromApps = 0;
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
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
  } else {
    usedPLOverallFromApps = usedPLInSelectedMonthFromApps;
  }
  const balancePLAtMonthEnd = accruedPLOverall - usedPLOverallFromApps;
  
  const serviceMonthsAtSelectedMonthEnd = calculateMonthsOfService(employee.doj, selectedMonthEndDate);
  const isEligibleForAccrualThisMonth = serviceMonthsAtSelectedMonthEnd > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL && !TEMPORARY_RESET_LEAVE_LOGIC; // No accrual in temporary mode
  
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

  if (!isValid(dojDate)) { 
    return { cl: 0, sl: 0, pl: 0, isEligibleForAccrualThisMonth: false };
  }
  
  const currentFYStartYearForTargetMonth = targetMonthIndex >= 3 ? targetYear : targetYear - 1;
  const openingBalanceForCurrentFY = allOpeningBalances.find(
    ob => ob.employeeCode === employee.code && ob.financialYearStart === currentFYStartYearForTargetMonth
  );

  if (TEMPORARY_RESET_LEAVE_LOGIC) {
    // If it's the target month (e.g., Feb 2025), and an opening balance for FY2024 exists,
    // return those opening balances directly. No accrual for this month.
    if (openingBalanceForCurrentFY) {
        return {
            cl: openingBalanceForCurrentFY.openingCL,
            sl: openingBalanceForCurrentFY.openingSL,
            pl: openingBalanceForCurrentFY.openingPL,
            isEligibleForAccrualThisMonth: false, // No accrual in temp mode on top of OB
        };
    }
    // If no specific OB for this FY, return 0s.
    return { cl: 0, sl: 0, pl: 0, isEligibleForAccrualThisMonth: false };
  }

  let prevMonthDate = addMonths(monthStartDate, -1);
  if (isBefore(monthStartDate, dojDate) || isEqual(monthStartDate, startOfMonth(dojDate)) || isBefore(prevMonthDate, dojDate)) {
     const serviceMonthsAtTargetMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
     const isEligibleInTargetMonth = serviceMonthsAtTargetMonthStart > MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
     
     let initialCL = 0, initialSL = 0, initialPL = 0;
     
     if (targetMonthIndex === 3) { // April
        initialCL = openingBalanceForCurrentFY?.openingCL || 0;
        initialSL = openingBalanceForCurrentFY?.openingSL || 0;
     }
     
     const relevantOpeningPLRecords = allOpeningBalances
        .filter(ob => ob.employeeCode === employee.code && ob.financialYearStart <= currentFYStartYearForTargetMonth)
        .sort((a, b) => b.financialYearStart - a.financialYearStart);
    
     if (relevantOpeningPLRecords.length > 0 && relevantOpeningPLRecords[0].financialYearStart === currentFYStartYearForTargetMonth) {
        initialPL = relevantOpeningPLRecords[0].openingPL;
     } else if (relevantOpeningPLRecords.length > 0) {
       // This case should ideally not be hit if PL is always based on latest OB for FY.
       // Or, PL needs to be calculated from scratch if no OB for *this* FY.
       // For simplicity, if an older PL OB exists, it's not used directly if target is a new FY without its own PL OB.
     }


     if (isEligibleInTargetMonth) {
        initialCL += CL_ACCRUAL_RATE;
        initialSL += SL_ACCRUAL_RATE;
        initialPL += PL_ACCRUAL_RATE;
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

    