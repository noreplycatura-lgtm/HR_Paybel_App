

import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays, addMonths, differenceInCalendarMonths, isValid, isAfter } from 'date-fns';
import type { EmployeeDetail } from './hr-data';
import type { LeaveApplication, OpeningLeaveBalance } from './hr-types';

// This is a temporary flag to handle the special one-time seeding for Dec 2025.
// As requested, for this specific month, we will not add the default monthly accrual.
const TEMPORARY_SEED_MONTH_TARGET = { year: 2025, monthIndex: 11 }; // December 2025

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
  balanceCLAtMonthEnd: number; 
  balanceSLAtMonthEnd: number; 
  balancePLAtMonthEnd: number; 
  isEligibleForAccrualThisMonth: boolean;
}

/**
 * Calculates leave details for an employee up to the end of a target month.
 * This function considers opening balances and accruals based on service.
 * It also deducts leaves from 'allLeaveApplications' that fall within the calculated period.
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
  const plAccrualRate = isOfficeStaff ? 0 : PL_ACCRUAL_RATE; 

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
  
  const manualOverrideForMonth = employeeOpeningBalances.find(ob => ob.financialYearStart === targetYear && ob.monthIndex === targetMonthIndex);
  if (manualOverrideForMonth) {
     return {
      balanceCLAtMonthEnd: manualOverrideForMonth.openingCL || 0,
      balanceSLAtMonthEnd: manualOverrideForMonth.openingSL || 0,
      balancePLAtMonthEnd: manualOverrideForMonth.openingPL || 0,
      isEligibleForAccrualThisMonth: false, // Manual override ignores accrual for this month
    };
  }

  const openingBalanceForCurrentFY = employeeOpeningBalances.find(ob => ob.financialYearStart === currentFYStartYear && ob.monthIndex === undefined);
  
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
          if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break;
      }
      
      const iteratorMonthIndex = getMonth(monthIteratorForFY);
      const iteratorYear = getYear(monthIteratorForFY);
      const manualOverrideForIteratorMonth = employeeOpeningBalances.find(ob => ob.financialYearStart === iteratorYear && ob.monthIndex === iteratorMonthIndex);

      if (manualOverrideForIteratorMonth) {
        accruedCLInCurrentFY = manualOverrideForIteratorMonth.openingCL || 0;
        accruedSLInCurrentFY = manualOverrideForIteratorMonth.openingSL || 0;
      } else {
        if(isBefore(doj, endOfMonth(monthIteratorForFY)) || isEqual(doj, endOfMonth(monthIteratorForFY))) {
            const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForFY));
            if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
                // Special check for Dec 2025 seeding
                const isSeedingMonth = iteratorYear === TEMPORARY_SEED_MONTH_TARGET.year && iteratorMonthIndex === TEMPORARY_SEED_MONTH_TARGET.monthIndex;
                if (!isSeedingMonth) {
                    accruedCLInCurrentFY += clAccrualRate;
                    accruedSLInCurrentFY += slAccrualRate;
                }
            }
        }
      }
      
      if (getMonth(monthIteratorForFY) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForFY) === getYear(selectedMonthEndDate)) {
        break;
      }
      monthIteratorForFY = addMonths(monthIteratorForFY, 1);
      if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break;
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
      .filter(ob => ob.financialYearStart <= currentFYStartYear && ob.monthIndex === undefined)
      .sort((a, b) => b.financialYearStart - a.financialYearStart); 
  
  let latestOpeningPLRecord = relevantOpeningPLRecords.length > 0 ? relevantOpeningPLRecords[0] : null;

  if (latestOpeningPLRecord) {
      accruedPLOverall = latestOpeningPLRecord.openingPL;
      plCalculationStartDate = startOfMonth(new Date(latestOpeningPLRecord.financialYearStart, 3, 1)); 
      if (isBefore(plCalculationStartDate, doj)) {
          plCalculationStartDate = startOfMonth(doj); 
      }
  }
  
  let monthIteratorForPL = plCalculationStartDate;

  while(isBefore(monthIteratorForPL, selectedMonthEndDate) || isEqual(monthIteratorForPL, selectedMonthEndDate)) {
      const iteratorMonthIndex = getMonth(monthIteratorForPL);
      const iteratorYear = getYear(monthIteratorForPL);

      const manualOverrideForPLMonth = employeeOpeningBalances.find(ob => ob.financialYearStart === iteratorYear && ob.monthIndex === iteratorMonthIndex);
      if (manualOverrideForPLMonth) {
          accruedPLOverall = manualOverrideForPLMonth.openingPL || 0;
      } else {
        if(isOfficeStaff) {
          if(iteratorMonthIndex === 3) {
            accruedPLOverall += OFFICE_STAFF_ANNUAL_PL_GRANT;
          }
        } else {
          if(isBefore(doj, endOfMonth(monthIteratorForPL)) || isEqual(doj, endOfMonth(monthIteratorForPL))) {
              const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForPL));
              if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
                // Special check for Dec 2025 seeding
                const isSeedingMonth = iteratorYear === TEMPORARY_SEED_MONTH_TARGET.year && iteratorMonthIndex === TEMPORARY_SEED_MONTH_TARGET.monthIndex;
                if (!isSeedingMonth) {
                  accruedPLOverall += plAccrualRate;
                }
              }
          }
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
  const isEligibleForAccrualThisMonth = serviceMonthsAtSelectedMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
  
  return {
    balanceCLAtMonthEnd,
    balanceSLAtMonthEnd,
    balancePLAtMonthEnd,
    isEligibleForAccrualThisMonth,
  };
};
