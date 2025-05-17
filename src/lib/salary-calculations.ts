
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
 * This is a simplified fixed structure for the prototype.
 * In a real application, these rules would likely come from a more complex salary setup.
 */
export function calculateMonthlySalaryComponents(grossMonthlySalary: number): MonthlySalaryComponents {
  if (grossMonthlySalary <= 0) {
    return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0, totalGross: 0 };
  }

  // Example breakdown:
  // Basic: 40%
  // HRA: 20%
  // Conveyance Allowance (CA): 10%
  // Medical Allowance: 10%
  // Other Allowance: 20% (to sum up to 100%)

  const basic = grossMonthlySalary * 0.40;
  const hra = grossMonthlySalary * 0.20;
  const ca = grossMonthlySalary * 0.10;
  const medical = grossMonthlySalary * 0.10;
  const otherAllowance = grossMonthlySalary - basic - hra - ca - medical; // Ensure total matches gross

  return {
    basic,
    hra,
    ca,
    medical,
    otherAllowance,
    totalGross: grossMonthlySalary,
  };
}
