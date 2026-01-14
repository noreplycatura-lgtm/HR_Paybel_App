// src/lib/salary-calculation.ts

import type { EmployeeDetail } from './hr-data';
import { parseISO, isValid, startOfMonth, endOfMonth, getDaysInMonth, getDate, isAfter } from 'date-fns';
import type { SalaryBreakupRule } from './hr-types';

// Storage Keys
const RULES_STORAGE_KEY = 'novita_salary_breakup_rules_v1';
const MAPPING_STORAGE_KEY = 'novita_employee_rule_mapping_v1';

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
// HELPER: Calculate Components for Gross
// ============================================
function getComponentsForGross(
  grossSalary: number, 
  rule: SalaryBreakupRule | undefined
): Omit<MonthlySalaryComponents, 'totalGross'> {
  
  if (grossSalary <= 0) {
    return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0 };
  }

  // ============================================
  // DEFAULT FALLBACK RULE (Jab koi rule nahi mile)
  // ============================================
  if (!rule) {
    const fixedBasicAmount = 15010;
    let basic, hra, ca, medical, otherAllowance;
    
    if (grossSalary <= 15010) {
      basic = grossSalary;
      hra = ca = medical = otherAllowance = 0;
    } else if (grossSalary > 15010 && grossSalary <= 18000) {
      basic = grossSalary * 0.80;
      hra = grossSalary - basic;
      ca = medical = otherAllowance = 0;
    } else {
      basic = fixedBasicAmount;
      const remainingAmount = grossSalary - basic;
      hra = remainingAmount * 0.50;
      ca = remainingAmount * 0.20;
      medical = remainingAmount * 0.15;
      otherAllowance = Math.max(0, remainingAmount - hra - ca - medical);
    }
    
    const components = { basic, hra, ca, medical, otherAllowance };
    const calculatedSum = Object.values(components).reduce((sum, val) => sum + val, 0);
    components.otherAllowance += (grossSalary - calculatedSum);
    return components;
  }

  // ============================================
  // CALCULATE BASED ON RULE
  // ============================================
  let basic = 0;
  if (rule.basicType === 'fixed') {
    basic = Math.min(rule.basicValue, grossSalary);
  } else {
    basic = grossSalary * (rule.basicValue / 100);
  }

  const hra = grossSalary * (rule.hraPercentage / 100);
  const ca = grossSalary * (rule.caPercentage / 100);
  const medical = grossSalary * (rule.medicalPercentage / 100);
  
  const remainingForOther = grossSalary - basic - hra - ca - medical;
  const otherAllowance = Math.max(0, remainingForOther);

  const components = { basic, hra, ca, medical, otherAllowance };
  
  // Ensure total matches gross
  const calculatedSum = Object.values(components).reduce((sum, val) => sum + val, 0);
  if (Math.abs(calculatedSum - grossSalary) > 0.01) {
    components.otherAllowance += (grossSalary - calculatedSum);
  }

  return components;
}

// ============================================
// MAIN FUNCTION: Calculate Monthly Salary
// ============================================
export function calculateMonthlySalaryComponents(
  employee: EmployeeDetail,
  periodYear: number,
  periodMonthIndex: number // 0-11
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