
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
  allLeaveApplications: LeaveApplication[],
  allOpeningBalances: OpeningLeaveBalance[] = [] // Added opening balances
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

  if (isBefore(selectedMonthEndDate, doj)) {
     return {
      usedCLInMonth: 0, usedSLInMonth: 0, usedPLInMonth: 0,
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isPLEligibleThisMonth: false,
    };
  }

  const employeeApplications = allLeaveApplications.filter(app => app.employeeId === employee.id);
  const employeeOpeningBalances = allOpeningBalances.filter(ob => ob.employeeCode === employee.code);

  // Calculate "Used in Selected Month"
  let usedCLInMonth = 0;
  let usedSLInMonth = 0;
  let usedPLInMonth = 0;

  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (getYear(appStartDate) === targetYear && getMonth(appStartDate) === targetMonthIndex) {
        if (app.leaveType === 'CL') usedCLInMonth += app.days;
        if (app.leaveType === 'SL') usedSLInMonth += app.days;
        if (app.leaveType === 'PL') usedPLInMonth += app.days;
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
          // If iterator somehow goes before current FY start, advance it (should not happen with correct init)
          monthIteratorForFY = startOfMonth(new Date(currentFYStartYear, 3, 1));
          if (isBefore(monthIteratorForFY, doj)) monthIteratorForFY = startOfMonth(doj);
          continue;
      }
      if(isBefore(doj, endOfMonth(monthIteratorForFY)) || isEqual(doj, endOfMonth(monthIteratorForFY))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForFY));
          if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
               accruedCLInCurrentFY += CL_ACCRUAL_RATE;
               accruedSLInCurrentFY += SL_ACCRUAL_RATE;
          }
      }
      if (getMonth(monthIteratorForFY) === 2 && getYear(monthIteratorForFY) === currentFYStartYear + 1) { // End of March for current FY
         break; // Stop CL/SL accrual for current FY
      }
      monthIteratorForFY = addMonths(monthIteratorForFY, 1);
  }
  
  let usedCLInCurrentFY = 0;
  let usedSLInCurrentFY = 0;
  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (!isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
            if (app.leaveType === 'CL') usedCLInCurrentFY += app.days;
            if (app.leaveType === 'SL') usedSLInCurrentFY += app.days;
        }
    } catch { /* ignore */ }
  });
  
  const balanceCLAtMonthEnd = accruedCLInCurrentFY - usedCLInCurrentFY;
  const balanceSLAtMonthEnd = accruedSLInCurrentFY - usedSLInCurrentFY;

  // PL Calculation (Carries Forward)
  let accruedPLOverall = 0;
  let latestOpeningPLRecord = null;
  if(employeeOpeningBalances.length > 0) {
    latestOpeningPLRecord = employeeOpeningBalances
        .filter(ob => ob.financialYearStart <= currentFYStartYear) // Consider OBs up to current FY
        .sort((a,b) => b.financialYearStart - a.financialYearStart)[0]; // Get most recent one
  }

  let plCalculationStartDate = startOfMonth(doj);
  if(latestOpeningPLRecord) {
      accruedPLOverall = latestOpeningPLRecord.openingPL;
      // Start accruing PL from the FY of the opening balance
      plCalculationStartDate = startOfMonth(new Date(latestOpeningPLRecord.financialYearStart, 3, 1)); // April of OB FY
      if (isBefore(plCalculationStartDate, doj)) { // If OB FY is before DOJ, start PL from DOJ month
          plCalculationStartDate = startOfMonth(doj);
      }
  }
  
  let monthIteratorForPL = plCalculationStartDate;
  while(isBefore(monthIteratorForPL, selectedMonthEndDate) || isEqual(monthIteratorForPL, selectedMonthEndDate)) {
      if(isBefore(doj, endOfMonth(monthIteratorForPL)) || isEqual(doj, endOfMonth(monthIteratorForPL))) {
          const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForPL));
          if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
              // Only add accrual if the month is after or same as the opening balance's FY start, if OB was used
              if (!latestOpeningPLRecord || 
                  getYear(monthIteratorForPL) > latestOpeningPLRecord.financialYearStart ||
                  (getYear(monthIteratorForPL) === latestOpeningPLRecord.financialYearStart && getMonth(monthIteratorForPL) >=3)
                 ) {
                     accruedPLOverall += PL_ACCRUAL_RATE;
              } else if (!latestOpeningPLRecord) { // No OB, accrue normally
                 accruedPLOverall += PL_ACCRUAL_RATE;
              }
          }
      }
      monthIteratorForPL = addMonths(monthIteratorForPL, 1);
  }

  let usedPLOverall = 0;
  employeeApplications.forEach(app => {
    try {
        const appStartDate = parseISO(app.startDate);
        if (app.leaveType === 'PL' && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
            usedPLOverall += app.days;
        }
    } catch {/* ignore */}
  });
  const balancePLAtMonthEnd = accruedPLOverall - usedPLOverall;
  
  const totalMonthsOfServiceBySelectedMonthEnd = calculateMonthsOfService(employee.doj, selectedMonthEndDate);
  const isEligibleForAccrualThisMonth = totalMonthsOfServiceBySelectedMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;
  
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
  allLeaveHistory: LeaveApplication[],
  allOpeningBalances: OpeningLeaveBalance[] = []
): { cl: number; sl: number; pl: number; plEligibleThisMonth: boolean } => { 
  
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

  const totalMonthsOfServiceByMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
  const isEligibleForAccrualAtMonthStart = totalMonthsOfServiceByMonthStart >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

  return {
    cl: balancesAtPrevMonthEnd.balanceCLAtMonthEnd,
    sl: balancesAtPrevMonthEnd.balanceSLAtMonthEnd,
    pl: balancesAtPrevMonthEnd.balancePLAtMonthEnd,
    plEligibleThisMonth: isEligibleForAccrualAtMonthStart 
  };
};
