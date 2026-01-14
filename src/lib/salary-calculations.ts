import type { EmployeeDetail } from './hr-data';
import { parseISO, isValid, isBefore, startOfMonth, endOfMonth, getDaysInMonth, getDate } from 'date-fns';
import { getSalaryBreakupConfig, type SalaryBreakupConfig } from './google-sheets';

export interface MonthlySalaryComponents {
  basic: number;
  hra: number;
  ca: number;
  medical: number;
  otherAllowance: number;
  totalGross: number; // The gross salary amount used for this period's calculation
}

let breakupConfig: SalaryBreakupConfig | null = null;
let configPromise: Promise<void> | null = null;

async function fetchAndCacheConfig() {
  if (breakupConfig) return;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    breakupConfig = await getSalaryBreakupConfig();
  })();
  await configPromise;
  configPromise = null;
}

function getComponentsForGross(gross: number, config: SalaryBreakupConfig | null): Omit<MonthlySalaryComponents, 'totalGross'> {
  if (gross <= 0) {
    return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0 };
  }

  // Use custom percentages if available
  if (config) {
    const basic = gross * (config.basic_percentage / 100);
    const hra = gross * (config.hra_percentage / 100);
    const ca = gross * (config.ca_percentage / 100);
    const medical = gross * (config.medical_percentage / 100);
    const totalPercentage = config.basic_percentage + config.hra_percentage + config.ca_percentage + config.medical_percentage;
    const otherPercentage = Math.max(0, 100 - totalPercentage);
    const otherAllowance = gross * (otherPercentage / 100);
    
    // Adjust other allowance to ensure sum is exact
    const calculatedSum = basic + hra + ca + medical + otherAllowance;
    const finalOtherAllowance = otherAllowance + (gross - calculatedSum);

    return { basic, hra, ca, medical, otherAllowance: finalOtherAllowance };
  }

  // Fallback to fixed logic
  const fixedBasicAmount = 15010;
  let basic: number;
  let hra: number;
  let ca: number;
  let medical: number;
  let otherAllowance: number;

  if (gross < fixedBasicAmount) {
    basic = gross;
    hra = 0;
    ca = 0;
    medical = 0;
    otherAllowance = 0;
  } else {
    basic = fixedBasicAmount;
    const remainingAmount = gross - basic;
    
    hra = remainingAmount * 0.50;
    ca = remainingAmount * 0.20;
    medical = remainingAmount * 0.15;
    otherAllowance = Math.max(0, remainingAmount - hra - ca - medical);
  }

  const calculatedSum = basic + hra + ca + medical + otherAllowance;
  if (Math.abs(calculatedSum - gross) > 0.01) {
      otherAllowance = otherAllowance + (gross - calculatedSum);
  }

  return { basic, hra, ca, medical, otherAllowance };
}


export async function calculateMonthlySalaryComponents(
  employee: EmployeeDetail,
  periodYear: number,
  periodMonthIndex: number // 0-11
): Promise<MonthlySalaryComponents> {
  
  await fetchAndCacheConfig();

  const baseGrossSalary = (typeof employee.grossMonthlySalary === 'number' && !isNaN(employee.grossMonthlySalary))
    ? employee.grossMonthlySalary
    : 0;

  const periodStartDate = startOfMonth(new Date(periodYear, periodMonthIndex, 1));
  const periodEndDate = endOfMonth(periodStartDate);
  const daysInMonth = getDaysInMonth(periodStartDate);

  let effectiveDate: Date | null = null;
  if (employee.salaryEffectiveDate) {
    try {
      const parsedDate = parseISO(employee.salaryEffectiveDate);
      if (isValid(parsedDate)) {
        effectiveDate = parsedDate;
      }
    } catch (e) {
      console.error("Error parsing salaryEffectiveDate for employee " + employee.code, e);
    }
  }

  const revisedGrossSalary = (
      employee.revisedGrossMonthlySalary &&
      typeof employee.revisedGrossMonthlySalary === 'number' &&
      !isNaN(employee.revisedGrossMonthlySalary) &&
      employee.revisedGrossMonthlySalary > 0
  ) ? employee.revisedGrossMonthlySalary : null;

  // Scenario 1: Revision date is in the future, or no revision exists. Use old salary.
  if (!effectiveDate || !revisedGrossSalary || isBefore(periodEndDate, effectiveDate)) {
    const components = getComponentsForGross(baseGrossSalary, breakupConfig);
    return { ...components, totalGross: baseGrossSalary };
  }

  // Scenario 2: Revision date is in the past (before this month). Use new salary.
  if (isBefore(effectiveDate, periodStartDate)) {
    const components = getComponentsForGross(revisedGrossSalary, breakupConfig);
    return { ...components, totalGross: revisedGrossSalary };
  }

  // Scenario 3: Revision happens this month. Pro-rata calculation needed.
  const revisionDayOfMonth = getDate(effectiveDate);

  if (revisionDayOfMonth === 1) {
    // Revision is on the first day, so the new salary applies for the whole month.
    const components = getComponentsForGross(revisedGrossSalary, breakupConfig);
    return { ...components, totalGross: revisedGrossSalary };
  }

  // Pro-rata calculation
  const daysWithOldSalary = revisionDayOfMonth - 1;
  const daysWithNewSalary = daysInMonth - daysWithOldSalary;

  // Calculate salary components for both gross amounts
  const oldComponents = getComponentsForGross(baseGrossSalary, breakupConfig);
  const newComponents = getComponentsForGross(revisedGrossSalary, breakupConfig);

  // Calculate pro-rata components
  const proRataBasic = (oldComponents.basic / daysInMonth * daysWithOldSalary) + (newComponents.basic / daysInMonth * daysWithNewSalary);
  const proRataHra = (oldComponents.hra / daysInMonth * daysWithOldSalary) + (newComponents.hra / daysInMonth * daysWithNewSalary);
  const proRataCa = (oldComponents.ca / daysInMonth * daysWithOldSalary) + (newComponents.ca / daysInMonth * daysWithNewSalary);
  const proRataMedical = (oldComponents.medical / daysInMonth * daysWithOldSalary) + (newComponents.medical / daysInMonth * daysWithNewSalary);
  const proRataOtherAllowance = (oldComponents.otherAllowance / daysInMonth * daysWithOldSalary) + (newComponents.otherAllowance / daysInMonth * daysWithNewSalary);

  // The "total gross" for the month is the effective gross salary after pro-rata calculation
  const effectiveTotalGross = proRataBasic + proRataHra + proRataCa + proRataMedical + proRataOtherAllowance;

  return {
    basic: proRataBasic,
    hra: proRataHra,
    ca: proRataCa,
    medical: proRataMedical,
    otherAllowance: proRataOtherAllowance,
    totalGross: effectiveTotalGross,
  };
}
