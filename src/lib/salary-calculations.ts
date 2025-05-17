
// src/lib/salary-calculations.ts
export interface MonthlySalaryComponents {
  basic: number;
  hra: number;
  ca: number;
  medical: number;
  otherAllowance: number;
  totalGross: number;
}

/**
 * Calculates monthly salary components based on gross salary.
 * New Rules:
 * 1. Basic is fixed at 15010.
 * 2. If Gross < 15010, Basic = Gross, others = 0.
 * 3. If Gross >= 15010, Basic = 15010. Remaining (Gross - Basic) is distributed:
 *    HRA: 50% of remaining
 *    CA: 20% of remaining
 *    Medical: 15% of remaining
 *    Other Allowance: 15% of remaining (or adjusted to ensure sum equals Gross)
 */
export function calculateMonthlySalaryComponents(grossMonthlySalary: number): MonthlySalaryComponents {
  if (grossMonthlySalary <= 0) {
    return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0, totalGross: 0 };
  }

  const fixedBasicAmount = 15010;
  let basic: number;
  let hra: number;
  let ca: number;
  let medical: number;
  let otherAllowance: number;

  if (grossMonthlySalary < fixedBasicAmount) {
    basic = grossMonthlySalary;
    hra = 0;
    ca = 0;
    medical = 0;
    otherAllowance = 0;
  } else {
    basic = fixedBasicAmount;
    const remainingAmount = grossMonthlySalary - basic;
    
    hra = remainingAmount * 0.50;
    ca = remainingAmount * 0.20;
    medical = remainingAmount * 0.15;
    // Calculate Other Allowance as the remainder to ensure the sum is exact
    otherAllowance = remainingAmount - hra - ca - medical;
  }

  return {
    basic,
    hra,
    ca,
    medical,
    otherAllowance,
    totalGross: grossMonthlySalary,
  };
}
