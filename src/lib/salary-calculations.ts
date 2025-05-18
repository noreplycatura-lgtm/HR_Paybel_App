
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
  
  let applicableGrossSalary = employee.grossMonthlySalary;

  if (employee.revisedGrossMonthlySalary && employee.revisedGrossMonthlySalary > 0 && employee.salaryEffectiveDate) {
    try {
      const effectiveDate = parseISO(employee.salaryEffectiveDate);
      const periodStartDate = startOfMonth(new Date(periodYear, periodMonthIndex, 1));
      
      // Use revised salary if effectiveDate is on or before the period's start date,
      // or if the effectiveDate falls within the current period.
      if (isValid(effectiveDate) && !isBefore(endOfMonth(periodStartDate), effectiveDate)) {
         applicableGrossSalary = employee.revisedGrossMonthlySalary;
      }
    } catch (e) {
      console.error("Error parsing salaryEffectiveDate:", employee.salaryEffectiveDate, e);
      // Stick with original gross if effective date is invalid
    }
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
    otherAllowance = remainingAmount - hra - ca - medical; // Ensures sum is exact
  }

  return {
    basic,
    hra,
    ca,
    medical,
    otherAllowance,
    totalGross: applicableGrossSalary, // Return the gross that was used for calculation
  };
}
