
import { differenceInMonths, parseISO, startOfMonth, endOfMonth, isBefore, isEqual, getMonth, getYear, addDays, addMonths, differenceInCalendarMonths, isValid, isAfter } from 'date-fns';
import type { EmployeeDetail } from './hr-data';
import type { LeaveApplication, OpeningLeaveBalance } from './hr-types';

// Ensure standard leave logic is active.
const TEMPORARY_RESET_LEAVE_LOGIC = false; 

export const CL_ACCRUAL_RATE = 0.6;
export const SL_ACCRUAL_RATE = 0.6;
export const PL_ACCRUAL_RATE = 1.2;
export const MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL = 5; // Accrual starts after 5 completed months

export const calculateMonthsOfService = (dojString: string, referenceDate: Date = new Date()): number => {
  if (!dojString) return 0;
  try {
    const doj = parseISO(dojString);
    if (!isValid(doj) || isBefore(referenceDate, doj)) return 0;
    
    const refDateForCalc = endOfMonth(referenceDate); // Consider service up to the end of the reference month
    const dojDateForCalc = startOfMonth(doj); // Service starts from the beginning of DOJ month for full month counting
    
    // Calculate the number of full calendar months between DOJ start and reference month end
    const completedMonths = differenceInCalendarMonths(refDateForCalc, dojDateForCalc);
    return Math.max(0, completedMonths);
  } catch (error) {
    console.error("Error parsing DOJ for months of service calculation:", dojString, error);
    return 0;
  }
};


interface EmployeeLeaveDetails {
  // These represent accruals - formal applications for the current month from allLeaveApplications
  usedCLInMonth: number; 
  usedSLInMonth: number; 
  usedPLInMonth: number; 
  // These represent balances at EOM considering OB, accruals, and formal applications
  balanceCLAtMonthEnd: number;
  balanceSLAtMonthEnd: number;
  balancePLAtMonthEnd: number;
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
      usedCLInMonth: 0, usedSLInMonth: 0, usedPLInMonth: 0,
      balanceCLAtMonthEnd: 0, balanceSLAtMonthEnd: 0, balancePLAtMonthEnd: 0,
      isEligibleForAccrualThisMonth: false,
    };
  }

  const doj = parseISO(employee.doj);
  const selectedMonthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const selectedMonthEndDate = endOfMonth(selectedMonthStartDate);

  // If employee joined after the selected month, all balances/used are 0 for this period
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

  // CL & SL Calculation (reset annually in April)
  const currentFYStartYear = targetMonthIndex >= 3 ? targetYear : targetYear - 1; // April is month 3
  const fyStartDate = startOfMonth(new Date(currentFYStartYear, 3, 1)); // April 1st of current FY
  
  const openingBalanceForCurrentFY = employeeOpeningBalances.find(ob => ob.financialYearStart === currentFYStartYear);
  
  let accruedCLInCurrentFY = openingBalanceForCurrentFY?.openingCL || 0;
  let accruedSLInCurrentFY = openingBalanceForCurrentFY?.openingSL || 0;
  
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
    let monthIteratorForFY = startOfMonth(fyStartDate); // Start from April 1st of current FY
    // If employee joined after FY start, begin accrual from DOJ month
    if (isBefore(monthIteratorForFY, doj)) {
        monthIteratorForFY = startOfMonth(doj);
    }

    // Iterate from FY start (or DOJ if later) up to and including the selected month
    while(isBefore(monthIteratorForFY, selectedMonthEndDate) || isEqual(monthIteratorForFY, selectedMonthEndDate)) {
        // Ensure iterator doesn't go beyond selected month or before relevant FY period
        if (getYear(monthIteratorForFY) < currentFYStartYear || (getYear(monthIteratorForFY) === currentFYStartYear && getMonth(monthIteratorForFY) < 3)) {
            // This case should ideally not be hit if monthIteratorForFY starts correctly.
            // Jump to the start of the current financial year or DOJ if it's later.
            monthIteratorForFY = startOfMonth(new Date(currentFYStartYear, 3, 1)); 
            if (isBefore(monthIteratorForFY, doj)) monthIteratorForFY = startOfMonth(doj); 
            if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break; // Safety break if jump goes too far
        }
        
        // Check if employee has completed DOJ month before accruing
        if(isBefore(doj, endOfMonth(monthIteratorForFY)) || isEqual(doj, endOfMonth(monthIteratorForFY))) {
            const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForFY));
            if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) { // Changed to >=
                 accruedCLInCurrentFY += CL_ACCRUAL_RATE;
                 accruedSLInCurrentFY += SL_ACCRUAL_RATE;
            }
        }
        
        if (getMonth(monthIteratorForFY) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForFY) === getYear(selectedMonthEndDate)) {
          break; // Stop after processing the target month
        }
        monthIteratorForFY = addMonths(monthIteratorForFY, 1);
        if(isAfter(monthIteratorForFY, selectedMonthEndDate)) break; // Safety break
    }
  }
  
  let usedCLInCurrentFYFromApps = 0;
  let usedSLInCurrentFYFromApps = 0;
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
    employeeApplications.forEach(app => {
      try {
          const appStartDate = parseISO(app.startDate);
          // Count leaves from start of FY up to and including selected month
          if (isValid(appStartDate) && !isBefore(appStartDate, fyStartDate) && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
              if (app.leaveType === 'CL') usedCLInCurrentFYFromApps += app.days;
              if (app.leaveType === 'SL') usedSLInCurrentFYFromApps += app.days;
          }
      } catch { /* ignore */ }
    });
  } else {
    // In temporary reset mode, used leaves from apps are only those in the current month
    usedCLInCurrentFYFromApps = usedCLInSelectedMonthFromApps;
    usedSLInCurrentFYFromApps = usedSLInSelectedMonthFromApps;
  }
  
  const balanceCLAtMonthEnd = accruedCLInCurrentFY - usedCLInCurrentFYFromApps;
  const balanceSLAtMonthEnd = accruedSLInCurrentFY - usedSLInCurrentFYFromApps;

  // PL Calculation (carries forward, uses latest relevant OB)
  let accruedPLOverall = 0;
  let plCalculationStartDate = startOfMonth(doj); // Start PL accrual from DOJ month

  // Find the most recent opening PL balance that is on or before the current FY start
  const relevantOpeningPLRecords = employeeOpeningBalances
      .filter(ob => ob.financialYearStart <= currentFYStartYear)
      .sort((a, b) => b.financialYearStart - a.financialYearStart); // Sort descending by year
  
  let latestOpeningPLRecord = relevantOpeningPLRecords.length > 0 ? relevantOpeningPLRecords[0] : null;

  if (latestOpeningPLRecord) {
      accruedPLOverall = latestOpeningPLRecord.openingPL;
      // Start PL accrual period from the FY of this opening balance, or DOJ if later
      plCalculationStartDate = startOfMonth(new Date(latestOpeningPLRecord.financialYearStart, 3, 1)); 
      if (isBefore(plCalculationStartDate, doj)) {
          plCalculationStartDate = startOfMonth(doj); 
      }
  }
  
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
    let monthIteratorForPL = plCalculationStartDate;
    // Iterate from PL calc start date up to and including selected month
    while(isBefore(monthIteratorForPL, selectedMonthEndDate) || isEqual(monthIteratorForPL, selectedMonthEndDate)) {
        if(isBefore(doj, endOfMonth(monthIteratorForPL)) || isEqual(doj, endOfMonth(monthIteratorForPL))) {
            let boolSkipAccrualThisMonth = false;
            // If we used an opening balance for an FY, and this monthIteratorForPL is the very first month (April)
            // of that opening balance's FY, AND this opening balance wasn't from the start of employment (DOJ),
            // then this month's accrual is already accounted for by the OB.
            if (latestOpeningPLRecord && 
                getYear(monthIteratorForPL) === latestOpeningPLRecord.financialYearStart && 
                getMonth(monthIteratorForPL) === 3 && // It's April
                !isEqual(monthIteratorForPL, startOfMonth(doj)) // And April is not the DOJ month
            ) {
                  // This logic intends to avoid double-counting April's accrual if an OB for that April was provided.
                  // However, if OB is for a past FY, normal accrual should happen.
                  // The current logic adds accrual *after* setting OB, so this might be fine.
            }

            const serviceMonthsAtIterEnd = calculateMonthsOfService(employee.doj, endOfMonth(monthIteratorForPL));
            if (serviceMonthsAtIterEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL) {
                if (!boolSkipAccrualThisMonth) {
                   accruedPLOverall += PL_ACCRUAL_RATE;
                }
            }
        }
        if (getMonth(monthIteratorForPL) === getMonth(selectedMonthEndDate) && getYear(monthIteratorForPL) === getYear(selectedMonthEndDate)) {
          break; // Stop after processing the target month
        }
        monthIteratorForPL = addMonths(monthIteratorForPL, 1);
        if(isAfter(monthIteratorForPL, selectedMonthEndDate)) break; // Safety break
    }
  } else {
    // In temporary reset mode, use opening PL if available for current FY, otherwise 0
    accruedPLOverall = openingBalanceForCurrentFY?.openingPL || 0; 
  }

  let usedPLOverallFromApps = 0;
  if (!TEMPORARY_RESET_LEAVE_LOGIC) {
    employeeApplications.forEach(app => {
      try {
          const appStartDate = parseISO(app.startDate);
          // Count all PL leaves from DOJ up to and including selected month
          if (isValid(appStartDate) && app.leaveType === 'PL' && (isBefore(appStartDate, selectedMonthEndDate) || isEqual(appStartDate, selectedMonthEndDate))) {
              if (!isBefore(appStartDate, doj)) { // Ensure leave is after DOJ
                  usedPLOverallFromApps += app.days;
              }
          }
      } catch {/* ignore */}
    });
  } else {
    // In temporary reset mode, used PL from apps is only those in the current month
    usedPLOverallFromApps = usedPLInSelectedMonthFromApps;
  }
  const balancePLAtMonthEnd = accruedPLOverall - usedPLOverallFromApps;
  
  const serviceMonthsAtSelectedMonthEnd = calculateMonthsOfService(employee.doj, selectedMonthEndDate);
  // Eligibility for accrual *in* the current selected month
  const isEligibleForAccrualThisMonth = serviceMonthsAtSelectedMonthEnd >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL && !TEMPORARY_RESET_LEAVE_LOGIC; 
  
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

// This function is used by the Salary Slip page and needs to be accurate
export const getLeaveBalancesAtStartOfMonth = (
  employee: EmployeeDetail,
  targetYear: number,
  targetMonthIndex: number, // 0 for Jan, 11 for Dec
  allLeaveHistory: LeaveApplication[], // Formal leave applications
  allOpeningBalances: OpeningLeaveBalance[] = []
): { cl: number; sl: number; pl: number; isEligibleForAccrualThisMonth: boolean } => {
  
  const monthStartDate = startOfMonth(new Date(targetYear, targetMonthIndex, 1));
  const dojDate = parseISO(employee.doj);

  if (!isValid(dojDate) || !employee.doj ) { 
    return { cl: 0, sl: 0, pl: 0, isEligibleForAccrualThisMonth: false };
  }
  
  const currentFYStartYearForTargetMonth = targetMonthIndex >= 3 ? targetYear : targetMonthIndex < 3 && targetYear > getYear(dojDate) ? targetYear -1 : getYear(dojDate);

  const openingBalanceForCurrentFY = allOpeningBalances.find(
    ob => ob.employeeCode === employee.code && ob.financialYearStart === currentFYStartYearForTargetMonth
  );

  if (TEMPORARY_RESET_LEAVE_LOGIC) {
    // In temp mode, the opening for the month is just the OB for that FY, without adding current month's accrual yet.
    if (openingBalanceForCurrentFY) {
        return {
            cl: openingBalanceForCurrentFY.openingCL,
            sl: openingBalanceForCurrentFY.openingSL,
            pl: openingBalanceForCurrentFY.openingPL,
            isEligibleForAccrualThisMonth: false, // No accrual in temp mode for the target month itself
        };
    }
    return { cl: 0, sl: 0, pl: 0, isEligibleForAccrualThisMonth: false };
  }

  // Calculate service months at the START of the target month
  const serviceMonthsAtTargetMonthStart = calculateMonthsOfService(employee.doj, monthStartDate);
  const isEligibleForAccrualInTargetMonth = serviceMonthsAtTargetMonthStart >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

  // If target month is before or same as DOJ month, opening is 0 (or from OB if specified for that exact month's FY start)
  if (isBefore(monthStartDate, dojDate) || isEqual(monthStartDate, startOfMonth(dojDate))) {
     let initialCL = 0, initialSL = 0, initialPL = 0;
     
     // If target month is April, use opening balance for this new FY if available
     if (targetMonthIndex === 3) { 
        const obForThisNewFY = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === targetYear);
        initialCL = obForThisNewFY?.openingCL || 0;
        initialSL = obForThisNewFY?.openingSL || 0;
        initialPL = obForThisNewFY?.openingPL || 0; // PL also from OB if specified for this FY
     } else {
        // For non-April months that are the first month of service, usually balances are 0.
        // But if an OB was specified for the FY containing this month, it should be the base.
        const obForCurrentFYofDOJ = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === currentFYStartYearForTargetMonth);
        initialCL = obForCurrentFYofDOJ?.openingCL || 0;
        initialSL = obForCurrentFYofDOJ?.openingSL || 0;
        initialPL = obForCurrentFYofDOJ?.openingPL || 0;
     }
    
     // Add accrual for the target month itself if eligible (this is opening *before* current month's usage)
     if (isEligibleForAccrualInTargetMonth) {
        initialCL += CL_ACCRUAL_RATE;
        initialSL += SL_ACCRUAL_RATE;
        initialPL += PL_ACCRUAL_RATE;
     }
     
      return {
        cl: initialCL,
        sl: initialSL,
        pl: initialPL,
        isEligibleForAccrualThisMonth: isEligibleForAccrualInTargetMonth, // Eligibility for accrual *in* target month
      };
  }

  // For months after DOJ month:
  // Get balances at the END of the PREVIOUS month
  let prevMonthDate = addMonths(monthStartDate, -1);
  const balancesAtPrevMonthEnd = calculateEmployeeLeaveDetailsForPeriod(
    employee,
    getYear(prevMonthDate),
    getMonth(prevMonthDate),
    allLeaveHistory, // Pass full history to get accurate prior deductions
    allOpeningBalances
  );
  
  let openingCLForTargetMonth = balancesAtPrevMonthEnd.balanceCLAtMonthEnd;
  let openingSLForTargetMonth = balancesAtPrevMonthEnd.balanceSLAtMonthEnd;
  let openingPLForTargetMonth = balancesAtPrevMonthEnd.balancePLAtMonthEnd;
  
  // If target month is April, reset CL/SL based on new FY's OB or to 0
  if (targetMonthIndex === 3) { 
    const obForNewFY = allOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === targetYear);
    openingCLForTargetMonth = obForNewFY?.openingCL || 0;
    openingSLForTargetMonth = obForNewFY?.openingSL || 0;
    // For PL, it carries forward, but if an OB for the new FY exists, it overrides.
    if (obForNewFY && obForNewFY.openingPL !== undefined) { 
        openingPLForTargetMonth = obForNewFY.openingPL;
    }
  }

  // Add accrual for the target month itself if eligible
  if (isEligibleForAccrualInTargetMonth) {
    openingCLForTargetMonth += CL_ACCRUAL_RATE;
    openingSLForTargetMonth += SL_ACCRUAL_RATE;
    openingPLForTargetMonth += PL_ACCRUAL_RATE;
  }

  return {
    cl: openingCLForTargetMonth,
    sl: openingSLForTargetMonth,
    pl: openingPLForTargetMonth,
    isEligibleForAccrualThisMonth: isEligibleForAccrualInTargetMonth, // Eligibility for accrual *in* target month
  };
};
