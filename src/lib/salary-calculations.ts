// src/lib/salary-calculation.ts

import type { EmployeeDetail } from './hr-data';
import { parseISO, isValid, startOfMonth, endOfMonth, getDaysInMonth, getDate, isAfter } from 'date-fns';
import type { SalaryBreakupRule } from './hr-types';

// Storage Keys
const RULES_STORAGE_KEY = 'catura_salary_breakup_rules_v1';
const MAPPING_STORAGE_KEY = 'catura_employee_rule_mapping_v1';

export interface MonthlySalaryComponents {
  basic: number;
  hra: number;
  ca: number;
  medical: number;
  otherAllowance: number;
  totalGross: number;
}

// ============================================
// HELPER: Load Rules from LocalStorage
// ============================================
function loadBreakupRules(): SalaryBreakupRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(RULES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// ============================================
// HELPER: Load Employee Mappings from LocalStorage
// ============================================
function loadEmployeeMappings(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(MAPPING_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// ============================================
// HELPER: Find Rule for Employee
// ============================================
function findRuleForEmployee(
  employeeCode: string,
  grossSalary: number,
  rules: SalaryBreakupRule[],
  mappings: Record<string, string>
): SalaryBreakupRule | undefined {
  
  // 1. Check if employee has custom mapping
  const customRuleId = mappings[employeeCode];
  if (customRuleId && customRuleId !== 'auto') {
    const customRule = rules.find(r => r.id === customRuleId && r.isActive);
    if (customRule) return customRule;
  }
  
  // 2. Find rule by gross salary range (Auto mode)
  return rules.find(r => 
    r.isActive && 
    grossSalary >= r.grossFrom && 
    grossSalary <= r.grossTo
  );
}

// ============================================
// HELPER: Calculate Components for Gross (CORRECT LOGIC)
// ============================================
function getComponentsForGross(
  grossSalary: number, 
  rule: SalaryBreakupRule | undefined
): Omit<MonthlySalaryComponents, 'totalGross'> {
  
  if (grossSalary <= 0) {
    return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0 };
  }

  // ============================================
  // DEFAULT FALLBACK RULE (When no rule found)
  // ============================================
  if (!rule) {
    const fixedBasicAmount = 15010;
    let basic: number;
    let hra: number;
    let ca: number;
    let medical: number;
    let otherAllowance: number;
    
    if (grossSalary <= 15010) {
      // If gross <= 15010, entire amount is basic
      basic = grossSalary;
      hra = 0;
      ca = 0;
      medical = 0;
      otherAllowance = 0;
    } else if (grossSalary > 15010 && grossSalary <= 18000) {
      // Special case for 15010-18000 range
      basic = grossSalary * 0.80;
      hra = grossSalary - basic;
      ca = 0;
      medical = 0;
      otherAllowance = 0;
    } else {
      // Standard calculation for > 18000
      basic = fixedBasicAmount;
      const remaining = grossSalary - basic;
      
      // Apply percentages to REMAINING, not to Gross
      hra = remaining * 0.50;
      ca = remaining * 0.20;
      medical = remaining * 0.15;
      otherAllowance = Math.max(0, remaining - hra - ca - medical);
    }
    
    return { basic, hra, ca, medical, otherAllowance };
  }

  // ============================================
  // CALCULATE BASED ON RULE
  // ============================================
  const hraPercent = rule.hraPercentage || 0;
  const caPercent = rule.caPercentage || 0;
  const medicalPercent = rule.medicalPercentage || 0;

  let basic = 0;
  let hra = 0;
  let ca = 0;
  let medical = 0;
  let otherAllowance = 0;

  // ============================================
  // CASE 1: Basic is FIXED Amount
  // ============================================
  if (rule.basicType === 'fixed') {
    // Basic is fixed value (but not more than gross)
    basic = Math.min(rule.basicValue, grossSalary);
    
    // Remaining amount after basic
    const remaining = Math.max(0, grossSalary - basic);
    
    // Apply percentages on REMAINING (not on Gross!)
    hra = remaining * (hraPercent / 100);
    ca = remaining * (caPercent / 100);
    medical = remaining * (medicalPercent / 100);
    
    // Other is whatever is left
    otherAllowance = Math.max(0, remaining - hra - ca - medical);
  }
  // ============================================
  // CASE 2: Basic is PERCENTAGE of Gross
  // ============================================
  else {
    // All components are percentage of Gross
    basic = grossSalary * (rule.basicValue / 100);
    hra = grossSalary * (hraPercent / 100);
    ca = grossSalary * (caPercent / 100);
    medical = grossSalary * (medicalPercent / 100);
    
    // Other is whatever is left
    otherAllowance = Math.max(0, grossSalary - basic - hra - ca - medical);
  }

  // Round all values
  basic = Math.round(basic);
  hra = Math.round(hra);
  ca = Math.round(ca);
  medical = Math.round(medical);
  otherAllowance = Math.round(otherAllowance);

  // Final adjustment for rounding differences
  const sum = basic + hra + ca + medical + otherAllowance;
  if (sum !== grossSalary) {
    otherAllowance += (grossSalary - sum);
  }

  return { basic, hra, ca, medical, otherAllowance };
}

// ============================================
// MAIN FUNCTION: Calculate Monthly Salary
// ============================================
export function calculateMonthlySalaryComponents(
  employee: EmployeeDetail,
  periodYear: number,
  periodMonthIndex: number
): MonthlySalaryComponents {
  
  // Load rules and mappings from LocalStorage
  const breakupRules = loadBreakupRules();
  const employeeMappings = loadEmployeeMappings();

  const baseGrossSalary = (typeof employee.grossMonthlySalary === 'number' && !isNaN(employee.grossMonthlySalary))
    ? employee.grossMonthlySalary
    : 0;
  
  const revisedGrossSalary = (
    employee.revisedGrossMonthlySalary &&
    typeof employee.revisedGrossMonthlySalary === 'number' &&
    !isNaN(employee.revisedGrossMonthlySalary) &&
    employee.revisedGrossMonthlySalary > 0
  ) ? employee.revisedGrossMonthlySalary : 0;

  const effectiveDateStr = employee.salaryEffectiveDate;

  // ============================================
  // SCENARIO: No Revision - Use Base Salary Only
  // ============================================
  if (!revisedGrossSalary || !effectiveDateStr) {
    const rule = findRuleForEmployee(employee.code, baseGrossSalary, breakupRules, employeeMappings);
    const components = getComponentsForGross(baseGrossSalary, rule);
    return { ...components, totalGross: baseGrossSalary };
  }

  try {
    const effectiveDate = parseISO(effectiveDateStr);
    const periodStartDate = startOfMonth(new Date(periodYear, periodMonthIndex, 1));
    const periodEndDate = endOfMonth(periodStartDate);
    const daysInMonth = getDaysInMonth(periodStartDate);

    if (!isValid(effectiveDate)) {
      const rule = findRuleForEmployee(employee.code, baseGrossSalary, breakupRules, employeeMappings);
      const components = getComponentsForGross(baseGrossSalary, rule);
      return { ...components, totalGross: baseGrossSalary };
    }

    // ============================================
    // SCENARIO 1: Effective date is AFTER current month
    // Use OLD salary for entire month
    // ============================================
    if (isAfter(effectiveDate, periodEndDate)) {
      const rule = findRuleForEmployee(employee.code, baseGrossSalary, breakupRules, employeeMappings);
      const components = getComponentsForGross(baseGrossSalary, rule);
      return { ...components, totalGross: baseGrossSalary };
    }

    // ============================================
    // SCENARIO 2: Effective date is ON or BEFORE 1st of month
    // Use NEW salary for entire month
    // ============================================
    if (!isAfter(effectiveDate, periodStartDate)) {
      const rule = findRuleForEmployee(employee.code, revisedGrossSalary, breakupRules, employeeMappings);
      const components = getComponentsForGross(revisedGrossSalary, rule);
      return { ...components, totalGross: revisedGrossSalary };
    }

    // ============================================
    // SCENARIO 3: MID-MONTH SALARY CHANGE (PRORATION)
    // Example: 16-Dec se new salary
    // 01-15 Dec = Old Salary (15 days)
    // 16-31 Dec = New Salary (16 days)
    // ============================================
    const effectiveDayOfMonth = getDate(effectiveDate);
    const daysWithOldSalary = effectiveDayOfMonth - 1;
    const daysWithNewSalary = daysInMonth - daysWithOldSalary;

    if (daysWithOldSalary <= 0 || daysWithNewSalary <= 0) {
      const applicableGross = isAfter(effectiveDate, periodEndDate) ? baseGrossSalary : revisedGrossSalary;
      const rule = findRuleForEmployee(employee.code, applicableGross, breakupRules, employeeMappings);
      const components = getComponentsForGross(applicableGross, rule);
      return { ...components, totalGross: applicableGross };
    }

    // Find rules for both salaries
    const oldRule = findRuleForEmployee(employee.code, baseGrossSalary, breakupRules, employeeMappings);
    const newRule = findRuleForEmployee(employee.code, revisedGrossSalary, breakupRules, employeeMappings);

    // Get full month components for both
    const oldComponentsFull = getComponentsForGross(baseGrossSalary, oldRule);
    const newComponentsFull = getComponentsForGross(revisedGrossSalary, newRule);

    // PRORATE each component
    const proratedBasic = ((oldComponentsFull.basic / daysInMonth) * daysWithOldSalary) + 
                          ((newComponentsFull.basic / daysInMonth) * daysWithNewSalary);
    
    const proratedHra = ((oldComponentsFull.hra / daysInMonth) * daysWithOldSalary) + 
                        ((newComponentsFull.hra / daysInMonth) * daysWithNewSalary);
    
    const proratedCa = ((oldComponentsFull.ca / daysInMonth) * daysWithOldSalary) + 
                       ((newComponentsFull.ca / daysInMonth) * daysWithNewSalary);
    
    const proratedMedical = ((oldComponentsFull.medical / daysInMonth) * daysWithOldSalary) + 
                            ((newComponentsFull.medical / daysInMonth) * daysWithNewSalary);
    
    const proratedOtherAllowance = ((oldComponentsFull.otherAllowance / daysInMonth) * daysWithOldSalary) + 
                                    ((newComponentsFull.otherAllowance / daysInMonth) * daysWithNewSalary);
    
    // Effective Total Gross
    const effectiveTotalGross = ((baseGrossSalary / daysInMonth) * daysWithOldSalary) + 
                                 ((revisedGrossSalary / daysInMonth) * daysWithNewSalary);

    return {
      basic: proratedBasic,
      hra: proratedHra,
      ca: proratedCa,
      medical: proratedMedical,
      otherAllowance: proratedOtherAllowance,
      totalGross: effectiveTotalGross,
    };

  } catch (e) {
    console.error("Error during salary calculation for " + employee.code, e);
    const rule = findRuleForEmployee(employee.code, baseGrossSalary, breakupRules, employeeMappings);
    const components = getComponentsForGross(baseGrossSalary, rule);
    return { ...components, totalGross: baseGrossSalary };
  }
}