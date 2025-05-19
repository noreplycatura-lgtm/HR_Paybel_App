
import type { EmployeeDetail } from './hr-data';
import { parseISO, isValid, isBefore, isEqual, startOfMonth, endOfMonth, addDays } from 'date-fns';

export interface MonthlySalaryComponents {
  basic: number;
  hra: number;
  ca: number;
  medical: number;
  otherAllowance: number;
  totalGross: number; // The gross salary amount used for this period's calculation
}

export function calculateMonthlySalaryComponents(
  employee: EmployeeDetail,
  periodYear: number,
  periodMonthIndex: number // 0-11
): MonthlySalaryComponents {
  
  // Ensure grossMonthlySalary is a number, default to 0 if not present or invalid
  let baseGrossSalary = (typeof employee.grossMonthlySalary === 'number' && !isNaN(employee.grossMonthlySalary))
    ? employee.grossMonthlySalary
    : 0;
  
  let applicableGrossSalary = baseGrossSalary;

  if (
    employee.revisedGrossMonthlySalary &&
    typeof employee.revisedGrossMonthlySalary === 'number' && // Check if it's a number
    !isNaN(employee.revisedGrossMonthlySalary) && // Ensure it's not NaN
    employee.revisedGrossMonthlySalary > 0 &&
    employee.salaryEffectiveDate
  ) {
    try {
      const effectiveDate = parseISO(employee.salaryEffectiveDate);
      const periodStartDate = startOfMonth(new Date(periodYear, periodMonthIndex, 1));
      
      if (isValid(effectiveDate) && !isBefore(endOfMonth(periodStartDate), effectiveDate)) {
         applicableGrossSalary = employee.revisedGrossMonthlySalary;
      }
    } catch (e) {
      console.error("Error parsing salaryEffectiveDate for employee " + employee.code + ":", employee.salaryEffectiveDate, e);
      // Stick with original gross if effective date is invalid or parsing fails
    }
  }

  // Final check to ensure applicableGrossSalary is a valid number
  if (typeof applicableGrossSalary !== 'number' || isNaN(applicableGrossSalary)) {
    applicableGrossSalary = 0;
  }


  if (applicableGrossSalary <= 0) {
    return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0, totalGross: 0 };
  }

  const fixedBasicAmount = 15010;
  let basic: number;
  let hra: number;
  let ca: number;
  let medical: number;
  let otherAllowance: number;

  if (applicableGrossSalary < fixedBasicAmount) {
    basic = applicableGrossSalary;
    hra = 0;
    ca = 0;
    medical = 0;
    otherAllowance = 0;
  } else {
    basic = fixedBasicAmount;
    const remainingAmount = applicableGrossSalary - basic;
    
    hra = remainingAmount * 0.50;
    ca = remainingAmount * 0.20;
    medical = remainingAmount * 0.15;
    // Ensure otherAllowance is not negative due to potential floating point inaccuracies summing up percentages
    otherAllowance = Math.max(0, remainingAmount - hra - ca - medical); 
  }

  // Ensure sum of components equals applicableGrossSalary due to potential floating point issues
  const calculatedSum = basic + hra + ca + medical + otherAllowance;
  if (Math.abs(calculatedSum - applicableGrossSalary) > 0.01) { // Allow for tiny floating point differences
      // Adjust 'otherAllowance' to make the sum exact, if it's the most flexible component
      otherAllowance = otherAllowance + (applicableGrossSalary - calculatedSum);
  }


  return {
    basic,
    hra,
    ca,
    medical,
    otherAllowance,
    totalGross: applicableGrossSalary,
  };
}

