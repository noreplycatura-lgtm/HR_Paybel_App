"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useSyncContext } from '@/lib/sync-provider';
import { parseISO, isValid, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Calculator, 
  Users, 
  Settings2, 
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  Percent,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Shield,
  Target,
  PieChart,
  Search,
  UserCheck,
  UserX,
  ArrowUpCircle,
  Calendar
} from 'lucide-react';
import type { SalaryBreakupRule } from '@/lib/hr-types';

// ============================================
// LOCALSTORAGE KEYS
// ============================================
const RULES_STORAGE_KEY = 'novita_salary_breakup_rules_v1';
const MAPPING_STORAGE_KEY = 'novita_employee_rule_mapping_v1';
const EMPLOYEE_STORAGE_KEY = 'novita_employee_master_data_v1';

// ============================================
// EMPLOYEE INTERFACE (WITH REVISION FIELDS)
// ============================================
interface Employee {
  id?: string;
  code: string;
  name: string;
  grossMonthlySalary?: number;
  grossSalary?: number;
  monthlySalary?: number;
  salary?: number;
  revisedGrossMonthlySalary?: number;
  revisedGrossSalary?: number;
  salaryEffectiveDate?: string;
  effectiveDate?: string;
  department?: string;
  designation?: string;
  status?: string;
}

// ============================================
// SALARY INFO INTERFACE
// ============================================
interface SalaryInfo {
  currentGross: number;
  oldGross: number;
  newGross: number;
  hasRevision: boolean;
  isRevisionEffective: boolean;
  effectiveDate: string | null;
}

// ============================================
// DEFAULT RULE TEMPLATE
// ============================================
const DEFAULT_RULE: Omit<SalaryBreakupRule, 'id' | 'createdAt' | 'updatedAt'> = {
  ruleName: '',
  grossFrom: 0,
  grossTo: 0,
  basicType: 'fixed',
  basicValue: 15010,
  hraPercentage: 50,
  caPercentage: 20,
  medicalPercentage: 15,
  isActive: true,
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function SalaryBreakupPage() {
  const { toast } = useToast();
  const { triggerSync } = useSyncContext();
  
  // ============================================
  // STATES
  // ============================================
  const [rules, setRules] = useState<SalaryBreakupRule[]>([]);
  const [employeeMappings, setEmployeeMappings] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SalaryBreakupRule | null>(null);
  const [formData, setFormData] = useState(DEFAULT_RULE);
  
  // Calculator State
  const [testGross, setTestGross] = useState<number>(25000);
  
  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ============================================
  // LOAD DATA ON MOUNT
  // ============================================
  useEffect(() => {
    loadAllData();
  }, []);

  // ============================================
  // LOAD ALL DATA FUNCTION
  // ============================================
  const loadAllData = () => {
    setIsLoading(true);
    try {
      // Load Rules
      const savedRules = localStorage.getItem(RULES_STORAGE_KEY);
      if (savedRules) {
        setRules(JSON.parse(savedRules));
      }

      // Load Mappings
      const savedMappings = localStorage.getItem(MAPPING_STORAGE_KEY);
      if (savedMappings) {
        setEmployeeMappings(JSON.parse(savedMappings));
      }

      // Load Employees with Multiple Fallbacks
      let employeeList: Employee[] = [];
      const savedEmployees = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
      
      if (savedEmployees) {
        try {
          const empData = JSON.parse(savedEmployees);
          
          // Check different possible structures
          if (Array.isArray(empData)) {
            employeeList = empData;
          } else if (empData && Array.isArray(empData.employees)) {
            employeeList = empData.employees;
          } else if (empData && Array.isArray(empData.data)) {
            employeeList = empData.data;
          } else if (empData && typeof empData === 'object') {
            const possibleArrays = Object.values(empData).filter(val => Array.isArray(val));
            if (possibleArrays.length > 0) {
              employeeList = possibleArrays[0] as Employee[];
            }
          }
          
          // Normalize employee data
          employeeList = employeeList
            .filter(emp => emp && (emp.code || emp.id))
            .map(emp => ({
              ...emp,
              code: emp.code || emp.id || '',
              name: emp.name || 'Unknown',
              grossMonthlySalary: emp.grossMonthlySalary || emp.grossSalary || emp.monthlySalary || emp.salary || 0,
              revisedGrossMonthlySalary: emp.revisedGrossMonthlySalary || emp.revisedGrossSalary || 0,
              salaryEffectiveDate: emp.salaryEffectiveDate || emp.effectiveDate || ''
            }))
            .filter(emp => emp.status !== 'Inactive' && emp.status !== 'Resigned');
            
        } catch (parseError) {
          console.error('Error parsing employee data:', parseError);
        }
      }
      
      setEmployees(employeeList);
      console.log('Loaded employees:', employeeList.length);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Data load karne mein error aaya",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // GET EMPLOYEE SALARY INFO (HANDLES REVISION)
  // ============================================
  const getEmployeeSalaryInfo = (emp: Employee): SalaryInfo => {
    const baseGross = emp.grossMonthlySalary || emp.grossSalary || emp.monthlySalary || emp.salary || 0;
    const revisedGross = emp.revisedGrossMonthlySalary || emp.revisedGrossSalary || 0;
    const effectiveDateStr = emp.salaryEffectiveDate || emp.effectiveDate || '';
    
    // No revision case
    if (!revisedGross || revisedGross <= 0 || !effectiveDateStr) {
      return {
        currentGross: baseGross,
        oldGross: baseGross,
        newGross: 0,
        hasRevision: false,
        isRevisionEffective: false,
        effectiveDate: null
      };
    }

    try {
      const effectiveDate = parseISO(effectiveDateStr);
      const today = new Date();
      
      if (!isValid(effectiveDate)) {
        return {
          currentGross: baseGross,
          oldGross: baseGross,
          newGross: revisedGross,
          hasRevision: true,
          isRevisionEffective: false,
          effectiveDate: effectiveDateStr
        };
      }

      // Check if revision is effective (effective date has passed or is today)
      const isEffective = !isAfter(effectiveDate, today);
      
      return {
        currentGross: isEffective ? revisedGross : baseGross,
        oldGross: baseGross,
        newGross: revisedGross,
        hasRevision: true,
        isRevisionEffective: isEffective,
        effectiveDate: effectiveDateStr
      };
      
    } catch (e) {
      return {
        currentGross: baseGross,
        oldGross: baseGross,
        newGross: revisedGross,
        hasRevision: true,
        isRevisionEffective: false,
        effectiveDate: effectiveDateStr
      };
    }
  };

  // ============================================
  // GET CURRENT EFFECTIVE GROSS (FOR RULE MATCHING)
  // ============================================
  const getCurrentEffectiveGross = (emp: Employee): number => {
    const salaryInfo = getEmployeeSalaryInfo(emp);
    return salaryInfo.currentGross;
  };

  // ============================================
  // SAVE RULES
  // ============================================
  const saveRules = (newRules: SalaryBreakupRule[]) => {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(newRules));
    setRules(newRules);
    triggerSync();
  };

  // ============================================
  // SAVE MAPPINGS
  // ============================================
  const saveMappings = (newMappings: Record<string, string>) => {
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(newMappings));
    setEmployeeMappings(newMappings);
    triggerSync();
  };

  // ============================================
  // GENERATE UNIQUE ID
  // ============================================
  const generateId = () => `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // ============================================
  // HANDLE ADD NEW RULE
  // ============================================
  const handleAddNew = () => {
    setEditingRule(null);
    setFormData(DEFAULT_RULE);
    setIsDialogOpen(true);
  };

  // ============================================
  // HANDLE EDIT RULE
  // ============================================
  const handleEdit = (rule: SalaryBreakupRule) => {
    setEditingRule(rule);
    setFormData({
      ruleName: rule.ruleName,
      grossFrom: rule.grossFrom,
      grossTo: rule.grossTo,
      basicType: rule.basicType,
      basicValue: rule.basicValue,
      hraPercentage: rule.hraPercentage,
      caPercentage: rule.caPercentage,
      medicalPercentage: rule.medicalPercentage,
      isActive: rule.isActive,
    });
    setIsDialogOpen(true);
  };

  // ============================================
  // VALIDATE FORM
  // ============================================
  const validateForm = (): string | null => {
    if (!formData.ruleName.trim()) return "Rule name required hai";
    if (formData.grossFrom < 0 || formData.grossTo < 0) return "Gross range negative nahi ho sakti";
    if (formData.grossFrom >= formData.grossTo) return "Gross From, Gross To se kam hona chahiye";
    if (formData.basicValue <= 0) return "Basic value 0 se zyada honi chahiye";
    if (formData.basicType === 'percentage' && formData.basicValue > 100) return "Basic percentage 100% se zyada nahi ho sakti";
    
    const overlapping = rules.find(r => {
      if (editingRule && r.id === editingRule.id) return false;
      return (formData.grossFrom <= r.grossTo && formData.grossTo >= r.grossFrom);
    });
    
    if (overlapping) return `Range overlap: "${overlapping.ruleName}"`;
    return null;
  };

  // ============================================
  // HANDLE SAVE RULE
  // ============================================
  const handleSaveRule = () => {
    const error = validateForm();
    if (error) {
      toast({ title: "Validation Error", description: error, variant: "destructive" });
      return;
    }

    const now = new Date().toISOString();
    
    if (editingRule) {
      const updatedRules = rules.map(r => 
        r.id === editingRule.id ? { ...r, ...formData, updatedAt: now } : r
      );
      saveRules(updatedRules);
      toast({ title: "Success ✅", description: "Rule update ho gaya" });
    } else {
      const newRule: SalaryBreakupRule = {
        id: generateId(),
        ...formData,
        createdAt: now,
        updatedAt: now,
      };
      saveRules([...rules, newRule]);
      toast({ title: "Success ✅", description: "Naya rule add ho gaya" });
    }
    
    setIsDialogOpen(false);
  };

  // ============================================
  // HANDLE DELETE RULE
  // ============================================
  const handleDelete = (ruleId: string) => {
    const mappedEmployees = Object.entries(employeeMappings)
      .filter(([_, rid]) => rid === ruleId)
      .map(([empCode]) => empCode);
    
    if (mappedEmployees.length > 0) {
      toast({
        title: "Cannot Delete",
        description: `${mappedEmployees.length} employees mapped hain. Pehle unki mapping hatao.`,
        variant: "destructive"
      });
      return;
    }
    
    saveRules(rules.filter(r => r.id !== ruleId));
    setDeleteConfirm(null);
    toast({ title: "Deleted", description: "Rule delete ho gaya" });
  };

  // ============================================
  // HANDLE MAPPING CHANGE
  // ============================================
  const handleMappingChange = (employeeCode: string, ruleId: string) => {
    const newMappings = { ...employeeMappings };
    
    if (ruleId === 'auto') {
      delete newMappings[employeeCode];
      toast({ 
        title: "Auto Mode ✅", 
        description: `${employeeCode} ab range ke hisab se rule lagega` 
      });
    } else {
      newMappings[employeeCode] = ruleId;
      const ruleName = rules.find(r => r.id === ruleId)?.ruleName || 'Unknown';
      toast({ 
        title: "Force Applied ✅", 
        description: `${employeeCode} par "${ruleName}" force apply kiya` 
      });
    }
    
    saveMappings(newMappings);
  };

  // ============================================
  // HANDLE CLEAR MAPPING
  // ============================================
  const handleClearMapping = (employeeCode: string) => {
    const newMappings = { ...employeeMappings };
    delete newMappings[employeeCode];
    saveMappings(newMappings);
    toast({ 
      title: "Mapping Cleared ✅", 
      description: `${employeeCode} ab auto mode mein hai` 
    });
  };

  // ============================================
  // FIND APPLICABLE RULE (RANGE BASED)
  // ============================================
  const findApplicableRule = (grossSalary: number): SalaryBreakupRule | null => {
    return rules.find(r => r.isActive && grossSalary >= r.grossFrom && grossSalary <= r.grossTo) || null;
  };

  // ============================================
  // GET APPLIED RULE FOR EMPLOYEE
  // ============================================
  const getAppliedRule = (emp: Employee): { rule: SalaryBreakupRule | null; isForced: boolean } => {
    const mappedRuleId = employeeMappings[emp.code];
    
    if (mappedRuleId && mappedRuleId !== 'auto') {
      const forcedRule = rules.find(r => r.id === mappedRuleId);
      if (forcedRule) {
        return { rule: forcedRule, isForced: true };
      }
    }
    
    // Use CURRENT EFFECTIVE gross for auto rule matching
    const currentGross = getCurrentEffectiveGross(emp);
    const autoRule = findApplicableRule(currentGross);
    return { rule: autoRule, isForced: false };
  };

  // ============================================
  // CALCULATE BREAKUP
  // ============================================
  const calculateBreakup = (grossSalary: number, rule: SalaryBreakupRule | null) => {
    if (!rule || grossSalary <= 0) {
      return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0, total: 0 };
    }

    let basic = rule.basicType === 'fixed' 
      ? Math.min(rule.basicValue, grossSalary) 
      : grossSalary * (rule.basicValue / 100);

    const hra = grossSalary * (rule.hraPercentage / 100);
    const ca = grossSalary * (rule.caPercentage / 100);
    const medical = grossSalary * (rule.medicalPercentage / 100);
    const otherAllowance = Math.max(0, grossSalary - basic - hra - ca - medical);

    return {
      basic: Math.round(basic),
      hra: Math.round(hra),
      ca: Math.round(ca),
      medical: Math.round(medical),
      otherAllowance: Math.round(otherAllowance),
      total: grossSalary
    };
  };

  // ============================================
  // FORMAT DATE
  // ============================================
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return dateStr;
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // ============================================
  // FILTERED EMPLOYEES
  // ============================================
  const filteredEmployees = employees.filter(emp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.code?.toLowerCase().includes(searchLower) ||
      emp.name?.toLowerCase().includes(searchLower) ||
      emp.department?.toLowerCase().includes(searchLower)
    );
  });

  // ============================================
  // STATS
  // ============================================
  const activeRulesCount = rules.filter(r => r.isActive).length;
  const mappedEmployeesCount = Object.keys(employeeMappings).length;
  const promotedEmployeesCount = employees.filter(emp => getEmployeeSalaryInfo(emp).hasRevision).length;
  const testRule = findApplicableRule(testGross);
  const testBreakup = calculateBreakup(testGross, testRule);

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-purple-500 mx-auto mb-3" />
          <p className="text-base text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto py-6 px-4 space-y-6">
        
        {/* ============================================ */}
        {/* HEADER SECTION */}
        {/* ============================================ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 shadow-xl">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <PieChart className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                  Salary Breakup Rules
                  <Sparkles className="h-6 w-6 text-yellow-300 animate-pulse" />
                </h1>
                <p className="text-purple-100 text-base mt-1">
                  Gross salary range ke hisab se breakup rules manage karo
                </p>
              </div>
            </div>
            
            <Button 
              onClick={handleAddNew} 
              size="lg"
              className="bg-white text-purple-600 hover:bg-purple-50 shadow-lg hover:shadow-xl transition-all duration-300 font-semibold px-6"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Rule
            </Button>
          </div>
        </div>

        {/* ============================================ */}
        {/* STATS CARDS */}
        {/* ============================================ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Rules Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Rules</p>
                  <p className="text-4xl font-bold mt-1">{rules.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Settings2 className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Rules Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Active Rules</p>
                  <p className="text-4xl font-bold mt-1">{activeRulesCount}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Employees Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cyan-500 to-teal-600 text-white hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-cyan-100 text-sm font-medium">Employees</p>
                  <p className="text-4xl font-bold mt-1">{employees.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Users className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Promoted Employees Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-pink-500 to-rose-600 text-white hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-pink-100 text-sm font-medium">Promoted</p>
                  <p className="text-4xl font-bold mt-1">{promotedEmployeesCount}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <ArrowUpCircle className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Force Mapped Card */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Force Mapped</p>
                  <p className="text-4xl font-bold mt-1">{mappedEmployeesCount}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Target className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============================================ */}
        {/* MAIN TABS SECTION */}
        {/* ============================================ */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm dark:bg-gray-800/90">
          <Tabs defaultValue="rules" className="w-full">
            
            {/* Tab List Header */}
            <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-t-xl py-4 px-6">
              <TabsList className="grid w-full max-w-xl mx-auto grid-cols-3 bg-white dark:bg-gray-700 p-1.5 rounded-xl shadow-inner h-12">
                <TabsTrigger 
                  value="rules" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg text-base font-medium h-9"
                >
                  <Settings2 className="h-5 w-5 mr-2" />
                  Rules
                </TabsTrigger>
                <TabsTrigger 
                  value="mapping"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg text-base font-medium h-9"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Mapping
                </TabsTrigger>
                <TabsTrigger 
                  value="calculator"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white rounded-lg text-base font-medium h-9"
                >
                  <Calculator className="h-5 w-5 mr-2" />
                  Calculator
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            {/* ============================================ */}
            {/* RULES TAB CONTENT */}
            {/* ============================================ */}
            <TabsContent value="rules" className="p-6">
              {rules.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-2xl opacity-30 animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 rounded-full">
                      <Settings2 className="h-12 w-12 text-purple-500" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mt-6 text-gray-800 dark:text-white">Koi Rule Nahi Hai</h3>
                  <p className="text-gray-500 text-base mt-2 mb-6">
                    Apna pehla salary breakup rule add karo
                  </p>
                  <Button 
                    onClick={handleAddNew} 
                    size="lg"
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add First Rule
                  </Button>
                </div>
              ) : (
                /* Rules Table */
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700">
                        <TableHead className="text-sm font-bold py-4 px-4">Rule Name</TableHead>
                        <TableHead className="text-sm font-bold py-4 text-right">Gross Range</TableHead>
                        <TableHead className="text-sm font-bold py-4 text-center">Basic</TableHead>
                        <TableHead className="text-sm font-bold py-4 text-center">HRA</TableHead>
                        <TableHead className="text-sm font-bold py-4 text-center">CA</TableHead>
                        <TableHead className="text-sm font-bold py-4 text-center">Medical</TableHead>
                        <TableHead className="text-sm font-bold py-4 text-center">Status</TableHead>
                        <TableHead className="text-sm font-bold py-4 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules
                        .sort((a, b) => a.grossFrom - b.grossFrom)
                        .map((rule, index) => (
                          <TableRow 
                            key={rule.id}
                            className={`
                              transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-900/20
                              ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}
                            `}
                          >
                            <TableCell className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`
                                  p-2 rounded-lg
                                  ${index % 3 === 0 ? 'bg-blue-100 text-blue-600' : ''}
                                  ${index % 3 === 1 ? 'bg-purple-100 text-purple-600' : ''}
                                  ${index % 3 === 2 ? 'bg-emerald-100 text-emerald-600' : ''}
                                `}>
                                  <Shield className="h-5 w-5" />
                                </div>
                                <span className="text-base font-semibold text-gray-800 dark:text-white">
                                  {rule.ruleName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-4">
                              <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
                                ₹{rule.grossFrom.toLocaleString()} - ₹{rule.grossTo.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <Badge className={`
                                text-sm px-3 py-1
                                ${rule.basicType === 'fixed' 
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                  : 'bg-gradient-to-r from-purple-500 to-purple-600'
                                } text-white border-0 shadow-sm
                              `}>
                                {rule.basicType === 'fixed' 
                                  ? `₹${rule.basicValue.toLocaleString()}` 
                                  : `${rule.basicValue}%`
                                }
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                                {rule.hraPercentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                                {rule.caPercentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                                {rule.medicalPercentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <Badge className={`
                                text-sm px-3 py-1
                                ${rule.isActive 
                                  ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                  : 'bg-gray-400'
                                } text-white border-0 shadow-sm
                              `}>
                                {rule.isActive ? '✓ Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(rule)}
                                  className="h-9 w-9 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                >
                                  <Edit2 className="h-5 w-5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteConfirm(rule.id)}
                                  className="h-9 w-9 hover:bg-red-100 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ============================================ */}
            {/* MAPPING TAB CONTENT (FIXED) */}
            {/* ============================================ */}
            <TabsContent value="mapping" className="p-6 space-y-5">
              {/* Info Alert */}
              <Alert className="py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <AlertDescription className="text-base text-amber-800 dark:text-amber-200 ml-2">
                  <strong>Auto</strong> = Current Gross se automatic rule lagega | 
                  <strong> Force</strong> = Range ignore karke specific rule lagega |
                  <span className="text-pink-600 font-semibold ml-2">🎉 = Promoted (Revised Salary)</span>
                </AlertDescription>
              </Alert>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by code, name, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 text-base border-2 focus:border-orange-400 rounded-xl"
                />
              </div>
              
              {employees.length === 0 ? (
                /* No Employees State */
                <div className="text-center py-16">
                  <div className="p-6 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-full inline-block">
                    <Users className="h-12 w-12 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-bold mt-6 text-gray-800 dark:text-white">
                    Koi Employee Nahi Mila
                  </h3>
                  <p className="text-gray-500 text-base mt-2">
                    Employee Master mein employees add karo
                  </p>
                  <Button 
                    onClick={loadAllData} 
                    variant="outline" 
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </Button>
                </div>
              ) : (
                <>
                  {/* Employee Count */}
                  <div className="flex items-center justify-between text-base text-gray-600">
                    <span>Showing <strong>{filteredEmployees.length}</strong> of <strong>{employees.length}</strong> employees</span>
                    <div className="flex items-center gap-4">
                      <span className="text-pink-600 font-semibold">
                        🎉 {promotedEmployeesCount} promoted
                      </span>
                      <span className="text-orange-600 font-semibold">
                        {mappedEmployeesCount} force mapped
                      </span>
                    </div>
                  </div>

                  {/* Mapping Table */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-gradient-to-r from-orange-100 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/20">
                          <TableHead className="text-sm font-bold py-4 px-4">Code</TableHead>
                          <TableHead className="text-sm font-bold py-4">Employee Name</TableHead>
                          <TableHead className="text-sm font-bold py-4 text-right">Current Gross</TableHead>
                          <TableHead className="text-sm font-bold py-4 text-center">Salary Info</TableHead>
                          <TableHead className="text-sm font-bold py-4 text-center">Auto Rule</TableHead>
                          <TableHead className="text-sm font-bold py-4">Select Rule</TableHead>
                          <TableHead className="text-sm font-bold py-4 text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((emp, index) => {
                          const salaryInfo = getEmployeeSalaryInfo(emp);
                          const autoRule = findApplicableRule(salaryInfo.currentGross);
                          const mappedRuleId = employeeMappings[emp.code];
                          const { rule: appliedRule, isForced } = getAppliedRule(emp);
                          
                          return (
                            <TableRow 
                              key={emp.code}
                              className={`
                                transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-900/10
                                ${salaryInfo.hasRevision ? 'bg-pink-50/50 dark:bg-pink-900/10' : ''}
                                ${isForced && !salaryInfo.hasRevision ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}
                                ${index % 2 === 0 && !isForced && !salaryInfo.hasRevision ? 'bg-white dark:bg-gray-800' : ''}
                                ${index % 2 !== 0 && !isForced && !salaryInfo.hasRevision ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}
                              `}
                            >
                              <TableCell className="py-4 px-4">
                                <span className="font-mono text-sm font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg">
                                  {emp.code}
                                </span>
                              </TableCell>
                              <TableCell className="py-4">
                                <div>
                                  <p className="text-base font-medium text-gray-800 dark:text-white flex items-center gap-2">
                                    {emp.name}
                                    {salaryInfo.hasRevision && (
                                      <span className="text-lg" title="Promoted/Revised Salary">🎉</span>
                                    )}
                                  </p>
                                  {emp.department && (
                                    <p className="text-sm text-gray-500">{emp.department}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-4">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    ₹{salaryInfo.currentGross.toLocaleString()}
                                  </span>
                                  {salaryInfo.hasRevision && salaryInfo.isRevisionEffective && (
                                    <span className="text-xs text-gray-400 line-through">
                                      ₹{salaryInfo.oldGross.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                {salaryInfo.hasRevision ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge className={`
                                      text-xs px-2 py-0.5
                                      ${salaryInfo.isRevisionEffective 
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                                        : 'bg-gradient-to-r from-amber-500 to-orange-500'
                                      } text-white border-0
                                    `}>
                                      {salaryInfo.isRevisionEffective ? '✓ Effective' : '⏳ Pending'}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(salaryInfo.effectiveDate)}
                                    </div>
                                    <div className="text-xs">
                                      <span className="text-gray-400">₹{salaryInfo.oldGross.toLocaleString()}</span>
                                      <span className="text-emerald-500 mx-1">→</span>
                                      <span className="text-emerald-600 font-semibold">₹{salaryInfo.newGross.toLocaleString()}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400">No Revision</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-4">
                                {autoRule ? (
                                  <Badge variant="outline" className="text-sm border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1">
                                    {autoRule.ruleName}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-sm bg-red-100 text-red-600 dark:bg-red-900/30 px-3 py-1">
                                    No Match
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-4">
                                <Select
                                  value={mappedRuleId || 'auto'}
                                  onValueChange={(value) => handleMappingChange(emp.code, value)}
                                >
                                  <SelectTrigger className={`
                                    w-[220px] h-10 text-sm border-2 rounded-lg
                                    ${isForced ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'hover:border-purple-400'}
                                  `}>
                                    <SelectValue placeholder="Select Rule" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="auto" className="text-sm py-2">
                                      <span className="flex items-center gap-2">
                                        <RefreshCw className="h-4 w-4 text-blue-500" />
                                        Auto (Range Based)
                                      </span>
                                    </SelectItem>
                                    {rules.filter(r => r.isActive).map((rule) => (
                                      <SelectItem key={rule.id} value={rule.id} className="text-sm py-2">
                                        <span className="flex items-center gap-2">
                                          <Target className="h-4 w-4 text-orange-500" />
                                          {rule.ruleName}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                {isForced ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Badge className="text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 px-3 py-1 shadow-sm">
                                      <Target className="h-3 w-3 mr-1.5" />
                                      Forced
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleClearMapping(emp.code)}
                                      className="h-8 w-8 hover:bg-red-100 hover:text-red-600 transition-colors"
                                      title="Clear force mapping"
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-sm border-green-300 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-1">
                                    <UserCheck className="h-3 w-3 mr-1.5" />
                                    Auto
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ============================================ */}
            {/* CALCULATOR TAB CONTENT */}
            {/* ============================================ */}
            <TabsContent value="calculator" className="p-6">
              <div className="grid lg:grid-cols-2 gap-6">
                
                {/* Input Card */}
                <Card className="border-2 border-emerald-200 dark:border-emerald-800 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-500 to-green-500 text-white py-4 px-5">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Calculator className="h-6 w-6" />
                      </div>
                      Breakup Calculator
                    </CardTitle>
                    <CardDescription className="text-emerald-100">
                      Gross salary enter karo aur live breakup dekho
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold text-gray-700 dark:text-gray-200">
                        Gross Monthly Salary
                      </Label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                          <IndianRupee className="h-5 w-5 text-emerald-600" />
                        </div>
                        <Input
                          type="number"
                          value={testGross}
                          onChange={(e) => setTestGross(Number(e.target.value))}
                          className="pl-16 h-14 text-xl font-bold border-2 border-emerald-200 focus:border-emerald-500 rounded-xl"
                          placeholder="Enter amount"
                        />
                      </div>
                    </div>

                    {testRule ? (
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-500 rounded-full">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm text-green-600 dark:text-green-400">Applicable Rule</p>
                            <p className="font-bold text-green-800 dark:text-green-200 text-lg">
                              {testRule.ruleName}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500 rounded-full">
                            <AlertCircle className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm text-red-600 dark:text-red-400">No Rule Found</p>
                            <p className="font-medium text-red-800 dark:text-red-200">
                              Is amount ke liye koi rule match nahi hua
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Result Card */}
                <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-4 px-5">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      Salary Breakup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      {/* Basic */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500 rounded-lg">
                            <Shield className="h-5 w-5 text-white" />
                          </div>
                          <span className="text-base font-medium text-gray-700 dark:text-gray-200">Basic Salary</span>
                        </div>
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          ₹{testBreakup.basic.toLocaleString()}
                        </span>
                      </div>

                      {/* HRA */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-500 rounded-lg">
                            <span className="text-white font-bold text-xs">HRA</span>
                          </div>
                          <span className="text-base font-medium text-gray-700 dark:text-gray-200">House Rent Allowance</span>
                        </div>
                        <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                          ₹{testBreakup.hra.toLocaleString()}
                        </span>
                      </div>

                      {/* CA */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-cyan-500 rounded-lg">
                            <span className="text-white font-bold text-xs">CA</span>
                          </div>
                          <span className="text-base font-medium text-gray-700 dark:text-gray-200">Conveyance Allowance</span>
                        </div>
                        <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                          ₹{testBreakup.ca.toLocaleString()}
                        </span>
                      </div>

                      {/* Medical */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-pink-500 rounded-lg">
                            <span className="text-white font-bold text-xs">MED</span>
                          </div>
                          <span className="text-base font-medium text-gray-700 dark:text-gray-200">Medical Allowance</span>
                        </div>
                        <span className="text-xl font-bold text-pink-600 dark:text-pink-400">
                          ₹{testBreakup.medical.toLocaleString()}
                        </span>
                      </div>

                      {/* Other */}
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-500 rounded-lg">
                            <span className="text-white font-bold text-xs">OTH</span>
                          </div>
                          <span className="text-base font-medium text-gray-700 dark:text-gray-200">Other Allowance</span>
                        </div>
                        <span className="text-xl font-bold text-violet-600 dark:text-violet-400">
                          ₹{testBreakup.otherAllowance.toLocaleString()}
                        </span>
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl mt-4 shadow-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-lg">
                            <IndianRupee className="h-6 w-6 text-white" />
                          </div>
                          <span className="text-lg font-bold text-white">TOTAL GROSS</span>
                        </div>
                        <span className="text-2xl font-bold text-white">
                          ₹{testBreakup.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* ============================================ */}
        {/* ADD/EDIT RULE DIALOG */}
        {/* ============================================ */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl">
                  <Settings2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {editingRule ? 'Edit Rule' : 'Add New Rule'}
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Gross salary range aur breakup percentages define karo
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-6 py-5">
              {/* Rule Name */}
              <div className="space-y-2">
                <Label className="text-base font-semibold text-gray-700 dark:text-gray-200">
                  Rule Name *
                </Label>
                <Input
                  value={formData.ruleName}
                  onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
                  placeholder="e.g., Entry Level, Mid Level, Senior Level"
                  className="h-12 text-base border-2 focus:border-purple-500 rounded-xl"
                />
              </div>

              {/* Gross Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700 dark:text-gray-200">
                    Gross From (₹) *
                  </Label>
                  <Input
                    type="number"
                    value={formData.grossFrom}
                    onChange={(e) => setFormData({ ...formData, grossFrom: Number(e.target.value) })}
                    className="h-12 text-base border-2 focus:border-purple-500 rounded-xl"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700 dark:text-gray-200">
                    Gross To (₹) *
                  </Label>
                  <Input
                    type="number"
                    value={formData.grossTo}
                    onChange={(e) => setFormData({ ...formData, grossTo: Number(e.target.value) })}
                    className="h-12 text-base border-2 focus:border-purple-500 rounded-xl"
                    placeholder="15000"
                  />
                </div>
              </div>

              {/* Basic Type Configuration */}
              <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-800">
                <Label className="text-lg font-bold text-purple-700 dark:text-purple-300 mb-4 block">
                  Basic Salary Configuration
                </Label>
                
                <div className="flex items-center gap-6 mb-4">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      name="basicType"
                      checked={formData.basicType === 'fixed'}
                      onChange={() => setFormData({ ...formData, basicType: 'fixed', basicValue: 15010 })}
                      className="h-5 w-5 text-purple-600"
                    />
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <IndianRupee className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-base font-medium">Fixed Amount</span>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="radio"
                      name="basicType"
                      checked={formData.basicType === 'percentage'}
                      onChange={() => setFormData({ ...formData, basicType: 'percentage', basicValue: 40 })}
                      className="h-5 w-5 text-purple-600"
                    />
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <Percent className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-base font-medium">Percentage of Gross</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {formData.basicType === 'fixed' ? 'Fixed Basic Amount (₹)' : 'Basic Percentage (%)'}
                  </Label>
                  <Input
                    type="number"
                    value={formData.basicValue}
                    onChange={(e) => setFormData({ ...formData, basicValue: Number(e.target.value) })}
                    className="h-12 text-base border-2 focus:border-purple-500 bg-white dark:bg-gray-800 rounded-xl"
                    placeholder={formData.basicType === 'fixed' ? '15010' : '40'}
                  />
                </div>
              </div>

              {/* Other Percentages */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                  <Label className="text-sm font-semibold text-orange-700 dark:text-orange-300">HRA (%)</Label>
                  <Input
                    type="number"
                    value={formData.hraPercentage}
                    onChange={(e) => setFormData({ ...formData, hraPercentage: Number(e.target.value) })}
                    className="h-11 text-base mt-2 border-2 border-orange-200 focus:border-orange-500 rounded-lg"
                    placeholder="50"
                  />
                </div>
                <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800">
                  <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">CA (%)</Label>
                  <Input
                    type="number"
                    value={formData.caPercentage}
                    onChange={(e) => setFormData({ ...formData, caPercentage: Number(e.target.value) })}
                    className="h-11 text-base mt-2 border-2 border-cyan-200 focus:border-cyan-500 rounded-lg"
                    placeholder="20"
                  />
                </div>
                <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-xl border border-pink-200 dark:border-pink-800">
                  <Label className="text-sm font-semibold text-pink-700 dark:text-pink-300">Medical (%)</Label>
                  <Input
                    type="number"
                    value={formData.medicalPercentage}
                    onChange={(e) => setFormData({ ...formData, medicalPercentage: Number(e.target.value) })}
                    className="h-11 text-base mt-2 border-2 border-pink-200 focus:border-pink-500 rounded-lg"
                    placeholder="15"
                  />
                </div>
              </div>

              {/* Info Alert */}
              <Alert className="py-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
                <Sparkles className="h-5 w-5 text-violet-600" />
                <AlertDescription className="text-sm text-violet-700 dark:text-violet-300 ml-2">
                  <strong>Other Allowance</strong> = Gross - Basic - HRA - CA - Medical (Auto Calculate hoga)
                </AlertDescription>
              </Alert>

              {/* Active Switch */}
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl border">
                <div>
                  <Label className="text-lg font-bold">Rule Active</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Inactive rules salary calculation mein apply nahi honge
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  className="data-[state=checked]:bg-green-500 scale-125"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="px-6 h-11"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveRule}
                className="px-8 h-11 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg"
              >
                <Save className="h-5 w-5 mr-2" />
                {editingRule ? 'Update Rule' : 'Save Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============================================ */}
        {/* DELETE CONFIRMATION DIALOG */}
        {/* ============================================ */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="mx-auto p-4 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <Trash2 className="h-8 w-8 text-red-500" />
              </div>
              <DialogTitle className="text-center text-xl">Delete Rule?</DialogTitle>
              <DialogDescription className="text-center text-base">
                Yeh action undo nahi ho sakta. Rule permanently delete ho jayega.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-3 sm:justify-center mt-4">
              <Button 
                variant="outline" 
                onClick={() => setDeleteConfirm(null)}
                className="px-8 h-11"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="px-8 h-11 bg-gradient-to-r from-red-500 to-rose-500"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}