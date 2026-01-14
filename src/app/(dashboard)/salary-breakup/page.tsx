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
  Zap,
  Target,
  PieChart,
  Layers,
  Search,
  UserCheck,
  UserX
} from 'lucide-react';
import type { SalaryBreakupRule } from '@/lib/hr-types';

// LocalStorage Keys
const RULES_STORAGE_KEY = 'novita_salary_breakup_rules_v1';
const MAPPING_STORAGE_KEY = 'novita_employee_rule_mapping_v1';
const EMPLOYEE_STORAGE_KEY = 'novita_employee_master_data_v1';

// Employee Interface
interface Employee {
  id?: string;
  code: string;
  name: string;
  grossMonthlySalary?: number;
  grossSalary?: number;
  monthlySalary?: number;
  salary?: number;
  department?: string;
  designation?: string;
  status?: string;
}

// Default Rule Template
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

export default function SalaryBreakupPage() {
  const { toast } = useToast();
  const { triggerSync } = useSyncContext();
  
  // States
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

  // Load Data on Mount
  useEffect(() => {
    loadAllData();
  }, []);

  // ============================================
  // FIXED: Employee Data Loading Function
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

      // ============================================
      // FIXED: Load Employees with Multiple Fallbacks
      // ============================================
      let employeeList: Employee[] = [];
      
      const savedEmployees = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
      
      if (savedEmployees) {
        try {
          const empData = JSON.parse(savedEmployees);
          
          // Check different possible structures
          if (Array.isArray(empData)) {
            // Direct array format
            employeeList = empData;
          } else if (empData && Array.isArray(empData.employees)) {
            // { employees: [...] } format
            employeeList = empData.employees;
          } else if (empData && Array.isArray(empData.data)) {
            // { data: [...] } format
            employeeList = empData.data;
          } else if (empData && typeof empData === 'object') {
            // Check if it's an object with employee entries
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
              grossMonthlySalary: emp.grossMonthlySalary || emp.grossSalary || emp.monthlySalary || emp.salary || 0
            }))
            .filter(emp => emp.status !== 'Inactive' && emp.status !== 'Resigned');
            
        } catch (parseError) {
          console.error('Error parsing employee data:', parseError);
        }
      }
      
      setEmployees(employeeList);
      
      // Debug log
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

  // Get Employee Gross Salary (handles multiple field names)
  const getEmployeeGross = (emp: Employee): number => {
    return emp.grossMonthlySalary || emp.grossSalary || emp.monthlySalary || emp.salary || 0;
  };

  const saveRules = (newRules: SalaryBreakupRule[]) => {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(newRules));
    setRules(newRules);
    triggerSync();
  };

  const saveMappings = (newMappings: Record<string, string>) => {
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(newMappings));
    setEmployeeMappings(newMappings);
    triggerSync();
  };

  const generateId = () => `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddNew = () => {
    setEditingRule(null);
    setFormData(DEFAULT_RULE);
    setIsDialogOpen(true);
  };

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
  // FORCE MAPPING: Employee ko specific rule assign karo
  // ============================================
  const handleMappingChange = (employeeCode: string, ruleId: string) => {
    const newMappings = { ...employeeMappings };
    
    if (ruleId === 'auto') {
      // Auto mode: Remove custom mapping, use range-based rule
      delete newMappings[employeeCode];
      toast({ 
        title: "Auto Mode ✅", 
        description: `${employeeCode} ab range ke hisab se rule lagega` 
      });
    } else {
      // Force specific rule
      newMappings[employeeCode] = ruleId;
      const ruleName = rules.find(r => r.id === ruleId)?.ruleName || 'Unknown';
      toast({ 
        title: "Force Applied ✅", 
        description: `${employeeCode} par "${ruleName}" force apply kiya` 
      });
    }
    
    saveMappings(newMappings);
  };

  // Clear all force mappings for an employee
  const handleClearMapping = (employeeCode: string) => {
    const newMappings = { ...employeeMappings };
    delete newMappings[employeeCode];
    saveMappings(newMappings);
    toast({ 
      title: "Mapping Cleared ✅", 
      description: `${employeeCode} ab auto mode mein hai` 
    });
  };

  // Find Applicable Rule (Range based)
  const findApplicableRule = (grossSalary: number): SalaryBreakupRule | null => {
    return rules.find(r => r.isActive && grossSalary >= r.grossFrom && grossSalary <= r.grossTo) || null;
  };

  // Get Applied Rule for Employee (considering force mapping)
  const getAppliedRule = (emp: Employee): { rule: SalaryBreakupRule | null; isForced: boolean } => {
    const mappedRuleId = employeeMappings[emp.code];
    
    if (mappedRuleId && mappedRuleId !== 'auto') {
      // Force mapped rule
      const forcedRule = rules.find(r => r.id === mappedRuleId);
      if (forcedRule) {
        return { rule: forcedRule, isForced: true };
      }
    }
    
    // Auto: Range based rule
    const autoRule = findApplicableRule(getEmployeeGross(emp));
    return { rule: autoRule, isForced: false };
  };

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

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.code?.toLowerCase().includes(searchLower) ||
      emp.name?.toLowerCase().includes(searchLower) ||
      emp.department?.toLowerCase().includes(searchLower)
    );
  });

  // Stats
  const activeRulesCount = rules.filter(r => r.isActive).length;
  const mappedEmployeesCount = Object.keys(employeeMappings).length;
  const testRule = findApplicableRule(testGross);
  const testBreakup = calculateBreakup(testGross, testRule);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto py-4 px-3 space-y-4">
        
        {/* ============ HEADER ============ */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 shadow-lg">
          <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <PieChart className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  Salary Breakup Rules
                  <Sparkles className="h-4 w-4 text-yellow-300" />
                </h1>
                <p className="text-purple-100 text-xs">
                  Gross salary range ke hisab se breakup rules
                </p>
              </div>
            </div>
            
            <Button 
              onClick={handleAddNew} 
              size="sm"
              className="bg-white text-purple-600 hover:bg-purple-50 shadow-md text-xs px-4"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Rule
            </Button>
          </div>
        </div>

        {/* ============ STATS CARDS ============ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Rules */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-3 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-[10px] font-medium">Total Rules</p>
                  <p className="text-2xl font-bold">{rules.length}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Settings2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Rules */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-emerald-500 to-green-600 text-white">
            <CardContent className="p-3 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-[10px] font-medium">Active</p>
                  <p className="text-2xl font-bold">{activeRulesCount}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Employees */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
            <CardContent className="p-3 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-cyan-100 text-[10px] font-medium">Employees</p>
                  <p className="text-2xl font-bold">{employees.length}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Force Mapped */}
          <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-orange-500 to-amber-600 text-white">
            <CardContent className="p-3 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-[10px] font-medium">Force Mapped</p>
                  <p className="text-2xl font-bold">{mappedEmployeesCount}</p>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Target className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============ MAIN TABS ============ */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
          <Tabs defaultValue="rules" className="w-full">
            <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-t-xl py-2 px-3">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 bg-white dark:bg-gray-700 p-0.5 rounded-lg shadow-inner h-8">
                <TabsTrigger 
                  value="rules" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded text-xs h-7"
                >
                  <Settings2 className="h-3 w-3 mr-1" />
                  Rules
                </TabsTrigger>
                <TabsTrigger 
                  value="mapping"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded text-xs h-7"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Mapping
                </TabsTrigger>
                <TabsTrigger 
                  value="calculator"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white rounded text-xs h-7"
                >
                  <Calculator className="h-3 w-3 mr-1" />
                  Calculator
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            {/* ========== RULES TAB ========== */}
            <TabsContent value="rules" className="p-3">
              {rules.length === 0 ? (
                <div className="text-center py-8">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-xl opacity-30" />
                    <div className="relative p-4 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 rounded-full">
                      <Settings2 className="h-8 w-8 text-purple-500" />
                    </div>
                  </div>
                  <h3 className="text-base font-bold mt-3 text-gray-800 dark:text-white">Koi Rule Nahi Hai</h3>
                  <p className="text-gray-500 text-xs mt-1 mb-3">Apna pehla rule add karo</p>
                  <Button 
                    onClick={handleAddNew} 
                    size="sm"
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add First Rule
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700">
                        <TableHead className="text-xs font-bold py-2">Rule Name</TableHead>
                        <TableHead className="text-xs font-bold py-2 text-right">Gross Range</TableHead>
                        <TableHead className="text-xs font-bold py-2 text-center">Basic</TableHead>
                        <TableHead className="text-xs font-bold py-2 text-center">HRA</TableHead>
                        <TableHead className="text-xs font-bold py-2 text-center">CA</TableHead>
                        <TableHead className="text-xs font-bold py-2 text-center">Medical</TableHead>
                        <TableHead className="text-xs font-bold py-2 text-center">Status</TableHead>
                        <TableHead className="text-xs font-bold py-2 text-center">Actions</TableHead>
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
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <div className={`
                                  p-1.5 rounded
                                  ${index % 3 === 0 ? 'bg-blue-100 text-blue-600' : ''}
                                  ${index % 3 === 1 ? 'bg-purple-100 text-purple-600' : ''}
                                  ${index % 3 === 2 ? 'bg-emerald-100 text-emerald-600' : ''}
                                `}>
                                  <Shield className="h-3 w-3" />
                                </div>
                                <span className="text-xs font-semibold text-gray-800 dark:text-white">
                                  {rule.ruleName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                ₹{rule.grossFrom.toLocaleString()} - ₹{rule.grossTo.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <Badge className={`
                                text-[10px] px-1.5 py-0
                                ${rule.basicType === 'fixed' 
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                  : 'bg-gradient-to-r from-purple-500 to-purple-600'
                                } text-white border-0
                              `}>
                                {rule.basicType === 'fixed' 
                                  ? `₹${rule.basicValue.toLocaleString()}` 
                                  : `${rule.basicValue}%`
                                }
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {rule.hraPercentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {rule.caPercentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {rule.medicalPercentage}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <Badge className={`
                                text-[10px] px-1.5 py-0
                                ${rule.isActive 
                                  ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                  : 'bg-gray-400'
                                } text-white border-0
                              `}>
                                {rule.isActive ? '✓ Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <div className="flex justify-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(rule)}
                                  className="h-7 w-7 hover:bg-blue-100 hover:text-blue-600"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteConfirm(rule.id)}
                                  className="h-7 w-7 hover:bg-red-100 hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
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

            {/* ========== MAPPING TAB (FIXED) ========== */}
            <TabsContent value="mapping" className="p-3 space-y-3">
              {/* Info Alert */}
              <Alert className="py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <AlertDescription className="text-[11px] text-amber-800">
                  <strong>Auto</strong> = Gross range se automatic rule lagega | 
                  <strong> Force</strong> = Range ignore karke specific rule lagega
                </AlertDescription>
              </Alert>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by code, name, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm border-2 focus:border-orange-400"
                />
              </div>
              
              {employees.length === 0 ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full inline-block">
                    <Users className="h-8 w-8 text-orange-500" />
                  </div>
                  <h3 className="text-sm font-bold mt-3">Koi Employee Nahi Mila</h3>
                  <p className="text-gray-500 text-xs mt-1">Employee Master mein employees add karo</p>
                  <Button 
                    onClick={loadAllData} 
                    size="sm" 
                    variant="outline" 
                    className="mt-3 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh Data
                  </Button>
                </div>
              ) : (
                <>
                  {/* Employee Count */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Showing {filteredEmployees.length} of {employees.length} employees</span>
                    <span className="text-orange-600 font-medium">
                      {mappedEmployeesCount} force mapped
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-gradient-to-r from-orange-100 to-amber-50 dark:from-orange-900/30">
                          <TableHead className="text-xs font-bold py-2">Code</TableHead>
                          <TableHead className="text-xs font-bold py-2">Name</TableHead>
                          <TableHead className="text-xs font-bold py-2 text-right">Gross</TableHead>
                          <TableHead className="text-xs font-bold py-2 text-center">Auto Rule</TableHead>
                          <TableHead className="text-xs font-bold py-2">Select Rule</TableHead>
                          <TableHead className="text-xs font-bold py-2 text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((emp, index) => {
                          const grossSalary = getEmployeeGross(emp);
                          const autoRule = findApplicableRule(grossSalary);
                          const mappedRuleId = employeeMappings[emp.code];
                          const { rule: appliedRule, isForced } = getAppliedRule(emp);
                          
                          return (
                            <TableRow 
                              key={emp.code}
                              className={`
                                hover:bg-orange-50 dark:hover:bg-orange-900/10
                                ${isForced ? 'bg-orange-50/50' : ''}
                                ${index % 2 === 0 && !isForced ? 'bg-white dark:bg-gray-800' : ''}
                                ${index % 2 !== 0 && !isForced ? 'bg-gray-50/50' : ''}
                              `}
                            >
                              <TableCell className="py-2">
                                <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                  {emp.code}
                                </span>
                              </TableCell>
                              <TableCell className="py-2">
                                <div>
                                  <p className="text-xs font-medium">{emp.name}</p>
                                  {emp.department && (
                                    <p className="text-[10px] text-gray-500">{emp.department}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-2">
                                <span className="text-xs font-semibold text-emerald-600">
                                  ₹{grossSalary.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-2">
                                {autoRule ? (
                                  <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 bg-blue-50">
                                    {autoRule.ruleName}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-600">
                                    No Match
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                <Select
                                  value={mappedRuleId || 'auto'}
                                  onValueChange={(value) => handleMappingChange(emp.code, value)}
                                >
                                  <SelectTrigger className={`
                                    w-[160px] h-7 text-xs border-2 
                                    ${isForced ? 'border-orange-400 bg-orange-50' : 'hover:border-purple-400'}
                                  `}>
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="auto" className="text-xs">
                                      <span className="flex items-center gap-1">
                                        <RefreshCw className="h-3 w-3 text-blue-500" />
                                        Auto (Range Based)
                                      </span>
                                    </SelectItem>
                                    {rules.filter(r => r.isActive).map((rule) => (
                                      <SelectItem key={rule.id} value={rule.id} className="text-xs">
                                        <span className="flex items-center gap-1">
                                          <Target className="h-3 w-3 text-orange-500" />
                                          {rule.ruleName} (₹{rule.grossFrom.toLocaleString()}-{rule.grossTo.toLocaleString()})
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center py-2">
                                {isForced ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Badge className="text-[10px] bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0">
                                      <Target className="h-2 w-2 mr-1" />
                                      Forced
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleClearMapping(emp.code)}
                                      className="h-5 w-5 hover:bg-red-100 hover:text-red-600"
                                      title="Clear force mapping"
                                    >
                                      <UserX className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] border-green-300 text-green-600">
                                    <UserCheck className="h-2 w-2 mr-1" />
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

            {/* ========== CALCULATOR TAB ========== */}
            <TabsContent value="calculator" className="p-3">
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Input Card */}
                <Card className="border-2 border-emerald-200 dark:border-emerald-800 shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-500 to-green-500 text-white py-2 px-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <div className="p-1 bg-white/20 rounded">
                        <Calculator className="h-4 w-4" />
                      </div>
                      Breakup Calculator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Gross Monthly Salary</Label>
                      <div className="relative">
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-emerald-100 rounded">
                          <IndianRupee className="h-3 w-3 text-emerald-600" />
                        </div>
                        <Input
                          type="number"
                          value={testGross}
                          onChange={(e) => setTestGross(Number(e.target.value))}
                          className="pl-10 h-9 text-sm font-bold border-2 border-emerald-200 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {testRule ? (
                      <div className="p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-green-500 rounded-full">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                          <div>
                            <p className="text-[10px] text-green-600">Applicable Rule</p>
                            <p className="text-xs font-bold text-green-800">{testRule.ruleName}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-200">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-red-500 rounded-full">
                            <AlertCircle className="h-3 w-3 text-white" />
                          </div>
                          <p className="text-xs text-red-800">No rule found for this range</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Result Card */}
                <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-md overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-2 px-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <div className="p-1 bg-white/20 rounded">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      Salary Breakup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {/* Basic */}
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-blue-500 rounded">
                            <Shield className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-xs font-medium">Basic</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">₹{testBreakup.basic.toLocaleString()}</span>
                      </div>

                      {/* HRA */}
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-orange-500 rounded">
                            <span className="text-white text-[8px] font-bold">HRA</span>
                          </div>
                          <span className="text-xs font-medium">HRA</span>
                        </div>
                        <span className="text-sm font-bold text-orange-600">₹{testBreakup.hra.toLocaleString()}</span>
                      </div>

                      {/* CA */}
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-cyan-50 to-cyan-100 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-cyan-500 rounded">
                            <span className="text-white text-[8px] font-bold">CA</span>
                          </div>
                          <span className="text-xs font-medium">Conveyance</span>
                        </div>
                        <span className="text-sm font-bold text-cyan-600">₹{testBreakup.ca.toLocaleString()}</span>
                      </div>

                      {/* Medical */}
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-pink-500 rounded">
                            <span className="text-white text-[8px] font-bold">MED</span>
                          </div>
                          <span className="text-xs font-medium">Medical</span>
                        </div>
                        <span className="text-sm font-bold text-pink-600">₹{testBreakup.medical.toLocaleString()}</span>
                      </div>

                      {/* Other */}
                      <div className="flex items-center justify-between p-2 bg-gradient-to-r from-violet-50 to-violet-100 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-violet-500 rounded">
                            <span className="text-white text-[8px] font-bold">OTH</span>
                          </div>
                          <span className="text-xs font-medium">Other</span>
                        </div>
                        <span className="text-sm font-bold text-violet-600">₹{testBreakup.otherAllowance.toLocaleString()}</span>
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg mt-2 shadow">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-white/20 rounded">
                            <IndianRupee className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-xs font-bold text-white">TOTAL</span>
                        </div>
                        <span className="text-lg font-bold text-white">₹{testBreakup.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* ============ ADD/EDIT DIALOG ============ */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader className="pb-2 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg">
                  <Settings2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-base">
                    {editingRule ? 'Edit Rule' : 'Add New Rule'}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Gross range aur breakup percentages define karo
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-4 py-3">
              {/* Rule Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Rule Name *</Label>
                <Input
                  value={formData.ruleName}
                  onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
                  placeholder="e.g., Entry Level, Mid Level, Senior"
                  className="h-8 text-sm border-2"
                />
              </div>

              {/* Gross Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Gross From (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.grossFrom}
                    onChange={(e) => setFormData({ ...formData, grossFrom: Number(e.target.value) })}
                    className="h-8 text-sm border-2"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Gross To (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.grossTo}
                    onChange={(e) => setFormData({ ...formData, grossTo: Number(e.target.value) })}
                    className="h-8 text-sm border-2"
                  />
                </div>
              </div>

              {/* Basic Type */}
              <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
                <Label className="text-xs font-bold text-purple-700 mb-2 block">Basic Salary Configuration</Label>
                
                <div className="flex items-center gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white">
                    <input
                      type="radio"
                      name="basicType"
                      checked={formData.basicType === 'fixed'}
                      onChange={() => setFormData({ ...formData, basicType: 'fixed', basicValue: 15010 })}
                      className="h-3 w-3"
                    />
                    <div className="flex items-center gap-1">
                      <div className="p-0.5 bg-blue-500 rounded">
                        <IndianRupee className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-medium">Fixed Amount</span>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white">
                    <input
                      type="radio"
                      name="basicType"
                      checked={formData.basicType === 'percentage'}
                      onChange={() => setFormData({ ...formData, basicType: 'percentage', basicValue: 40 })}
                      className="h-3 w-3"
                    />
                    <div className="flex items-center gap-1">
                      <div className="p-0.5 bg-purple-500 rounded">
                        <Percent className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-medium">Percentage</span>
                    </div>
                  </label>
                </div>

                <Input
                  type="number"
                  value={formData.basicValue}
                  onChange={(e) => setFormData({ ...formData, basicValue: Number(e.target.value) })}
                  className="h-8 text-sm border-2 bg-white"
                  placeholder={formData.basicType === 'fixed' ? '15010' : '40'}
                />
              </div>

              {/* Percentages */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-orange-50 rounded-lg border border-orange-200">
                  <Label className="text-[10px] font-semibold text-orange-700">HRA %</Label>
                  <Input
                    type="number"
                    value={formData.hraPercentage}
                    onChange={(e) => setFormData({ ...formData, hraPercentage: Number(e.target.value) })}
                    className="h-7 text-sm mt-1 border-orange-200"
                  />
                </div>
                <div className="p-2 bg-cyan-50 rounded-lg border border-cyan-200">
                  <Label className="text-[10px] font-semibold text-cyan-700">CA %</Label>
                  <Input
                    type="number"
                    value={formData.caPercentage}
                    onChange={(e) => setFormData({ ...formData, caPercentage: Number(e.target.value) })}
                    className="h-7 text-sm mt-1 border-cyan-200"
                  />
                </div>
                <div className="p-2 bg-pink-50 rounded-lg border border-pink-200">
                  <Label className="text-[10px] font-semibold text-pink-700">Medical %</Label>
                  <Input
                    type="number"
                    value={formData.medicalPercentage}
                    onChange={(e) => setFormData({ ...formData, medicalPercentage: Number(e.target.value) })}
                    className="h-7 text-sm mt-1 border-pink-200"
                  />
                </div>
              </div>

              <Alert className="py-2 bg-violet-50 border-violet-200">
                <Sparkles className="h-3 w-3 text-violet-600" />
                <AlertDescription className="text-[10px] text-violet-700">
                  <strong>Other Allowance</strong> = Gross - Basic - HRA - CA - Medical (Auto Calculate)
                </AlertDescription>
              </Alert>

              {/* Active Switch */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div>
                  <Label className="text-xs font-bold">Rule Active</Label>
                  <p className="text-[10px] text-gray-500">Inactive rules apply nahi honge</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} size="sm" className="text-xs">
                Cancel
              </Button>
              <Button 
                onClick={handleSaveRule}
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs"
              >
                <Save className="h-3 w-3 mr-1" />
                {editingRule ? 'Update Rule' : 'Save Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ DELETE CONFIRMATION ============ */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <div className="mx-auto p-3 bg-red-100 rounded-full mb-2">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <DialogTitle className="text-center text-base">Delete Rule?</DialogTitle>
              <DialogDescription className="text-center text-xs">
                Yeh action undo nahi ho sakta. Rule permanently delete ho jayega.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-center">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} size="sm" className="text-xs">
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                size="sm"
                className="bg-gradient-to-r from-red-500 to-rose-500 text-xs"
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