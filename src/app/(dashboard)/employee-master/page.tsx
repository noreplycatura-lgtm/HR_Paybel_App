"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Upload, Edit, Trash2, Download, Loader2, Search, Users, UserCheck, UserX, Building2, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EmployeeDetail } from "@/lib/hr-data";
import { format, parseISO, isValid, isBefore } from "date-fns";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { getSalaryBreakupRules, type SalaryBreakupRule } from "@/lib/google-sheets";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "catura_employee_master_data_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";

const employeeFormSchema = z.object({
  code: z.string().min(1, "Employee code is required"),
  name: z.string().min(1, "Employee name is required"),
  designation: z.string().min(1, "Designation is required"),
  doj: z.string().refine((val) => {
    if (!val) return false;
    try {
        const date = parseISO(val);
        return isValid(date);
    } catch {
        return false;
    }
  }, { message: "Valid date of joining (YYYY-MM-DD) is required"}),
  status: z.enum(["Active", "Left"], { required_error: "Status is required" }),
  division: z.string().min(1, "Division is required"),
  hq: z.string().min(1, "HQ is required"),
  dor: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    try {
        const date = parseISO(val);
        return isValid(date);
    } catch {
        return false;
    }
  }, { message: "If provided, DOR must be a valid date (YYYY-MM-DD)"}),
  grossMonthlySalary: z.coerce.number().positive({ message: "Gross salary must be a positive number" }),
  revisedGrossMonthlySalary: z.coerce.number().optional().refine(val => val === undefined || val === null || val === 0 || val > 0, {
    message: "Revised gross salary must be a positive number if provided, or empty for no revision.",
  }),
  salaryEffectiveDate: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    try {
        const date = parseISO(val);
        return isValid(date);
    } catch {
        return false;
    }
  }, { message: "If provided, Salary Effective Date must be a valid date (YYYY-MM-DD)"}),
  breakupRuleId: z.string().optional(), // New field for override
}).refine(data => {
    if (data.status === "Active" && (data.dor && data.dor.trim() !== "")) {
        return false;
    }
    if (data.status === "Left" && data.doj && data.dor && data.dor.trim() !== "" && isValid(parseISO(data.doj)) && isValid(parseISO(data.dor))) {
        if (isBefore(parseISO(data.dor), parseISO(data.doj))) {
            return false;
        }
    }
    if (data.revisedGrossMonthlySalary && data.revisedGrossMonthlySalary > 0 && (!data.salaryEffectiveDate || data.salaryEffectiveDate.trim() === "")) {
      return false;
    }
    if ((!data.revisedGrossMonthlySalary || data.revisedGrossMonthlySalary === 0) && (data.salaryEffectiveDate && data.salaryEffectiveDate.trim() !== "")) {
      return false;
    }
    if (data.salaryEffectiveDate && data.doj && isValid(parseISO(data.salaryEffectiveDate)) && isValid(parseISO(data.doj))) {
        if (isBefore(parseISO(data.salaryEffectiveDate), parseISO(data.doj))) {
            return false;
        }
    }
    return true;
}, (data) => {
  if (data.status === "Active" && (data.dor && data.dor.trim() !== "")) {
    return { message: "DOR must be empty if status is 'Active'.", path: ["dor"] };
  }
  if (data.status === "Left" && data.doj && data.dor && data.dor.trim() !== "" && isValid(parseISO(data.doj)) && isValid(parseISO(data.dor))) {
    if (isBefore(parseISO(data.dor), parseISO(data.doj))) {
      return { message: "DOR cannot be before DOJ.", path: ["dor"] };
    }
  }
  if (data.revisedGrossMonthlySalary && data.revisedGrossMonthlySalary > 0 && (!data.salaryEffectiveDate || data.salaryEffectiveDate.trim() === "")) {
    return { message: "Salary Effective Date is required if Revised Gross Salary is provided.", path: ["salaryEffectiveDate"] };
  }
  if ((!data.revisedGrossMonthlySalary || data.revisedGrossMonthlySalary === 0) && (data.salaryEffectiveDate && data.salaryEffectiveDate.trim() !== "")) {
    return { message: "Revised Gross Salary is required if Salary Effective Date is provided.", path: ["revisedGrossMonthlySalary"] };
  }
   if (data.salaryEffectiveDate && data.doj && isValid(parseISO(data.salaryEffectiveDate)) && isValid(parseISO(data.doj))) {
      if (isBefore(parseISO(data.salaryEffectiveDate), parseISO(data.doj))) {
          return { message: "Salary Effective Date cannot be before DOJ.", path: ["salaryEffectiveDate"]};
      }
  }
  return {};
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

interface ActivityLogEntry {
  timestamp: string;
  message: string;
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = [];
    activities.unshift({ timestamp: new Date().toISOString(), message });
    activities = activities.slice(0, 10);
    localStorage.setItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error adding to activity log:", error);
  }
};

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-600 bg-blue-100', text: 'text-blue-700' },
    green: { bg: 'bg-green-50 border-green-200', icon: 'text-green-600 bg-green-100', text: 'text-green-700' },
    red: { bg: 'bg-red-50 border-red-200', icon: 'text-red-600 bg-red-100', text: 'text-red-700' },
    purple: { bg: 'bg-purple-50 border-purple-200', icon: 'text-purple-600 bg-purple-100', text: 'text-purple-700' },
  };
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`rounded-xl border-2 ${colors.bg} p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${colors.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function EmployeeMasterPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<EmployeeDetail[]>([]);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | null>(null);
  const [filterTerm, setFilterTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "Active" | "Left">("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<Set<string>>(new Set());
  const [isDeleteSelectedDialogOpen, setIsDeleteSelectedDialogOpen] = React.useState(false);
  const [employeeToDelete, setEmployeeToDelete] = React.useState<EmployeeDetail | null>(null);
  const [salaryBreakupRules, setSalaryBreakupRules] = React.useState<SalaryBreakupRule[]>([]);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      code: "", name: "", designation: "", doj: "", status: "Active",
      division: "FMCG", hq: "", dor: "", grossMonthlySalary: 0,
      revisedGrossMonthlySalary: undefined, salaryEffectiveDate: "",
      breakupRuleId: "default",
    },
  });

  const statusInForm = form.watch("status");

  React.useEffect(() => {
    if (statusInForm === "Active") {
      form.setValue("dor", "");
    }
  }, [statusInForm, form]);

  React.useEffect(() => {
    setIsLoadingData(true);
    async function loadInitialData() {
      if (typeof window !== 'undefined') {
        try {
          const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
          if (storedEmployeesStr) {
            try {
              const parsed = JSON.parse(storedEmployeesStr);
              setEmployees(Array.isArray(parsed) ? parsed : []);
            } catch (e) {
              console.error("Error parsing employees from localStorage:", e);
              toast({ title: "Storage Error", description: "Could not parse employee data.", variant: "destructive" });
              setEmployees([]);
            }
          } else {
            setEmployees([]);
          }
          
          const rules = await getSalaryBreakupRules();
          if (rules) {
            setSalaryBreakupRules(rules);
          }

        } catch (error) {
          console.error("Error loading data from localStorage:", error);
          toast({ title: "Storage Error", description: "Could not load initial data.", variant: "destructive" });
          setEmployees([]);
        }
      }
      setIsLoadingData(false);
    }
    loadInitialData();
  }, [toast]);

  const saveEmployeesToLocalStorage = (updatedEmployees: EmployeeDetail[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY, JSON.stringify(updatedEmployees));
      } catch (error) {
        console.error("Error saving employees to localStorage:", error);
        toast({ title: "Storage Error", description: "Could not save employee data locally.", variant: "destructive" });
      }
    }
  };

  const onSubmit = (values: EmployeeFormValues) => {
    const finalValues = {
      ...values,
      breakupRuleId: values.breakupRuleId === "default" ? undefined : values.breakupRuleId,
    };
    
    if (editingEmployeeId) {
      const updatedEmployees = employees.map(emp =>
        emp.id === editingEmployeeId ? { ...emp, ...finalValues, id: editingEmployeeId } : emp
      );
      setEmployees(updatedEmployees);
      saveEmployeesToLocalStorage(updatedEmployees);
      addActivityLog(`Employee ${values.name} details updated.`);
      toast({ title: "Employee Updated", description: `${values.name}'s details have been updated.` });
    } else {
      const existingEmployee = employees.find(emp => emp.code === values.code);
      if (existingEmployee) {
        toast({ title: "Duplicate Employee Code", description: `An employee with code '${values.code}' already exists.`, variant: "destructive" });
        form.setError("code", { type: "manual", message: "This employee code already exists." });
        return;
      }
      const newEmployee: EmployeeDetail = {
        id: values.code,
        ...finalValues,
        dor: values.dor || undefined,
        revisedGrossMonthlySalary: values.revisedGrossMonthlySalary || undefined,
        salaryEffectiveDate: values.salaryEffectiveDate || "",
      };
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      saveEmployeesToLocalStorage(updatedEmployees);
      addActivityLog(`New employee ${values.name} added.`);
      toast({ title: "Employee Added", description: `${values.name} has been added to the master list.` });
    }
    setIsEmployeeFormOpen(false);
    setEditingEmployeeId(null);
    form.reset();
  };

  const handleAddNewEmployee = () => {
    setEditingEmployeeId(null);
    form.reset({
      code: "", name: "", designation: "", doj: "", status: "Active",
      division: "FMCG", hq: "", dor: "", grossMonthlySalary: 0,
      revisedGrossMonthlySalary: undefined, salaryEffectiveDate: "",
      breakupRuleId: "default",
    });
    setIsEmployeeFormOpen(true);
  };

  const handleEditEmployee = (employeeId: string) => {
    const employeeToEdit = employees.find(emp => emp.id === employeeId);
    if (employeeToEdit) {
      setEditingEmployeeId(employeeId);
      const formValues = {
        ...employeeToEdit,
        doj: employeeToEdit.doj && isValid(parseISO(employeeToEdit.doj)) ? format(parseISO(employeeToEdit.doj), 'yyyy-MM-dd') : '',
        dor: employeeToEdit.dor && isValid(parseISO(employeeToEdit.dor)) ? format(parseISO(employeeToEdit.dor), 'yyyy-MM-dd') : '',
        salaryEffectiveDate: employeeToEdit.salaryEffectiveDate && isValid(parseISO(employeeToEdit.salaryEffectiveDate)) ? format(parseISO(employeeToEdit.salaryEffectiveDate), 'yyyy-MM-dd') : '',
        revisedGrossMonthlySalary: employeeToEdit.revisedGrossMonthlySalary || undefined,
        breakupRuleId: employeeToEdit.breakupRuleId || "default",
      };
      form.reset(formValues);
      setIsEmployeeFormOpen(true);
    }
  };

  const handleDeleteEmployeeClick = (employee: EmployeeDetail) => {
    setEmployeeToDelete(employee);
  };

  const confirmDeleteSingleEmployee = () => {
    if (!employeeToDelete) return;
    const updatedEmployees = employees.filter(emp => emp.id !== employeeToDelete.id);
    setEmployees(updatedEmployees);
    saveEmployeesToLocalStorage(updatedEmployees);
    setSelectedEmployeeIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(employeeToDelete.id);
      return newSet;
    });
    addActivityLog(`Employee ${employeeToDelete.name} (Code: ${employeeToDelete.code}) deleted.`);
    toast({ title: "Employee Removed", description: `${employeeToDelete.name} has been removed.`, variant: "destructive" });
    setEmployeeToDelete(null);
  };

  const handleUploadEmployees = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error Reading File", description: "Could not read the file content.", variant: "destructive" });
        return;
      }
      try {
        const lines = text.split(/\r\n|\n/).map(line => line.trim()).filter(line => line);
        if (lines.length < 2) {
          toast({ title: "Invalid File", description: "File is empty or has no data rows.", variant: "destructive" });
          return;
        }

        const expectedHeaders = ["status", "division", "code", "name", "designation", "hq", "doj", "dor", "grossmonthlysalary", "revisedgrossmonthlysalary", "salaryeffectivedate"];
        const headerLine = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/\s+/g, ''));

        const missingHeaders = expectedHeaders.filter(eh => !headerLine.includes(eh));
        if (missingHeaders.length > 0) {
          toast({ title: "File Header Error", description: `Missing/misnamed headers: ${missingHeaders.join(', ')}.`, variant: "destructive", duration: 9000 });
          return;
        }

        const getIndex = (headerName: string) => headerLine.indexOf(headerName);
        const idxStatus = getIndex("status");
        const idxDivision = getIndex("division");
        const idxCode = getIndex("code");
        const idxName = getIndex("name");
        const idxDesignation = getIndex("designation");
        const idxHq = getIndex("hq");
        const idxDoj = getIndex("doj");
        const idxDor = getIndex("dor");
        const idxGrossSalary = getIndex("grossmonthlysalary");
        const idxRevisedGrossSalary = getIndex("revisedgrossmonthlysalary");
        const idxSalaryEffectiveDate = getIndex("salaryeffectivedate");

        const dataRows = lines.slice(1);
        let newUploadedEmployees: EmployeeDetail[] = [];
        const currentEmployeesMap = new Map(employees.map(emp => [emp.code, emp]));
        const codesInCsv = new Set<string>();
        let skippedForDuplicateInCsv = 0;
        let malformedRows = 0;
        let addedCount = 0;
        let skippedForExistingInMaster = 0;

        dataRows.forEach((row, rowIndex) => {
          const values = row.split(',').map(v => v.trim());

          if (values.length <= Math.max(idxStatus, idxDivision, idxCode, idxName, idxDesignation, idxHq, idxDoj, idxDor, idxGrossSalary, idxRevisedGrossSalary, idxSalaryEffectiveDate)) {
            malformedRows++;
            return;
          }

          let status = values[idxStatus] as "Active" | "Left";
          const division = values[idxDivision];
          const code = values[idxCode];
          const name = values[idxName];
          const designation = values[idxDesignation];
          const hq = values[idxHq];
          const doj = values[idxDoj];
          let dor = values[idxDor] || "";
          const grossMonthlySalaryStr = values[idxGrossSalary];
          const revisedGrossMonthlySalaryStr = values[idxRevisedGrossSalary] || "";
          const salaryEffectiveDateStr = values[idxSalaryEffectiveDate] || "";

          const grossMonthlySalary = parseFloat(grossMonthlySalaryStr);
          const revisedGrossMonthlySalary = revisedGrossMonthlySalaryStr ? parseFloat(revisedGrossMonthlySalaryStr) : undefined;

          if (!code || !name || !status || !division || !designation || !hq || !doj || isNaN(grossMonthlySalary) || grossMonthlySalary <= 0) {
            malformedRows++;
            return;
          }
          if (status !== "Active" && status !== "Left") {
            status = "Active";
          }
          if (status === "Active") dor = "";

          if (codesInCsv.has(code)) {
            skippedForDuplicateInCsv++;
            return;
          }
          codesInCsv.add(code);

          if (currentEmployeesMap.has(code)) {
            skippedForExistingInMaster++;
            return;
          }

          let formattedDoj = doj;
          if (doj && !/^\d{4}-\d{2}-\d{2}$/.test(doj)) {
            try { const d = new Date(doj.replace(/[-/.]/g, '/')); if (isValid(d)) formattedDoj = format(d, 'yyyy-MM-dd'); } catch { /* ignore */ }
          }
          let formattedDor = dor;
          if (dor && !/^\d{4}-\d{2}-\d{2}$/.test(dor)) {
            try { const d = new Date(dor.replace(/[-/.]/g, '/')); if (isValid(d)) formattedDor = format(d, 'yyyy-MM-dd'); } catch { /* ignore */ }
          }
          let formattedSalaryEffectiveDate = salaryEffectiveDateStr;
          if (salaryEffectiveDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(salaryEffectiveDateStr)) {
            try { const d = new Date(salaryEffectiveDateStr.replace(/[-/.]/g, '/')); if (isValid(d)) formattedSalaryEffectiveDate = format(d, 'yyyy-MM-dd'); } catch { /* ignore */ }
          }

          const employeeData: EmployeeDetail = {
            id: code, status, division, code, name, designation, hq,
            doj: formattedDoj, dor: formattedDor || undefined, grossMonthlySalary,
            revisedGrossMonthlySalary: (revisedGrossMonthlySalary && revisedGrossMonthlySalary > 0) ? revisedGrossMonthlySalary : undefined,
            salaryEffectiveDate: (revisedGrossMonthlySalary && revisedGrossMonthlySalary > 0 && formattedSalaryEffectiveDate) ? formattedSalaryEffectiveDate : "",
          };
          newUploadedEmployees.push(employeeData);
          addedCount++;
        });

        let message = "";
        if (newUploadedEmployees.length > 0) {
          const combinedEmployees = [...employees, ...newUploadedEmployees];
          setEmployees(combinedEmployees);
          saveEmployeesToLocalStorage(combinedEmployees);
          message += `${addedCount} new employee(s) processed. `;
          addActivityLog(`Employee Master CSV uploaded: ${file.name} (${addedCount} added).`);
        } else {
          message += `No new employees were added from ${file.name}. `;
        }

        if (skippedForExistingInMaster > 0) message += `${skippedForExistingInMaster} skipped (exists). `;
        if (skippedForDuplicateInCsv > 0) message += `${skippedForDuplicateInCsv} skipped (duplicate in CSV). `;
        if (malformedRows > 0) message += `${malformedRows} skipped (invalid data). `;

        toast({
          title: "Employee Upload Processed",
          description: message.trim(),
          duration: 9000,
          variant: addedCount > 0 ? "default" : "destructive",
        });

      } catch (error) {
        console.error("Error parsing CSV for employees:", error);
        toast({ title: "Parsing Error", description: "Could not parse CSV. Check format/columns.", variant: "destructive", duration: 7000 });
      }
    };
    reader.onerror = () => {
      toast({ title: "File Read Error", description: "An error occurred while trying to read the file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleTemplate = () => {
    const headers = ["Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ", "DOR", "GrossMonthlySalary", "RevisedGrossMonthlySalary", "SalaryEffectiveDate"];
    const sampleData = [
      ["Active", "FMCG", "E006", "Sarah Lee", "Marketing Specialist", "Chicago", "2024-01-10", "", "62000", "65000", "2024-07-01"],
      ["Left", "Wellness", "E007", "Tom Brown", "IT Support", "Austin", "2023-11-05", "2024-06-30", "55000", "", ""],
    ];
    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "employee_master_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: "employee_master_template.csv downloaded." });
  };

  const filteredEmployees = React.useMemo(() => {
    if (isLoadingData) return [];
    return employees.filter(employee => {
      const matchesSearchTerm = (
        employee.code.toLowerCase().includes(filterTerm.toLowerCase()) ||
        employee.name.toLowerCase().includes(filterTerm.toLowerCase()) ||
        (employee.designation && employee.designation.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (employee.division && employee.division.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (employee.hq && employee.hq.toLowerCase().includes(filterTerm.toLowerCase()))
      );
      const matchesStatusFilter = (
        statusFilter === "all" ||
        (statusFilter === "Active" && employee.status === "Active") ||
        (statusFilter === "Left" && employee.status === "Left")
      );
      return matchesSearchTerm && matchesStatusFilter;
    });
  }, [employees, filterTerm, statusFilter, isLoadingData]);

  const employeeCounts = React.useMemo(() => {
    if (isLoadingData) return { activeCount: 0, leftCount: 0, totalCount: 0 };
    const activeCount = employees.filter(emp => emp.status === "Active").length;
    const leftCount = employees.filter(emp => emp.status === "Left").length;
    return { activeCount, leftCount, totalCount: employees.length };
  }, [employees, isLoadingData]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const allVisibleEmployeeIds = filteredEmployees.map(emp => emp.id);
      setSelectedEmployeeIds(new Set(allVisibleEmployeeIds));
    } else {
      setSelectedEmployeeIds(new Set());
    }
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (checked) {
        newSelected.add(employeeId);
      } else {
        newSelected.delete(employeeId);
      }
      return newSelected;
    });
  };

  const handleDeleteSelectedEmployees = () => {
    if (selectedEmployeeIds.size === 0) {
      toast({ title: "No Selection", description: "Please select employees to delete.", variant: "destructive" });
      return;
    }
    setIsDeleteSelectedDialogOpen(true);
  };

  const confirmDeleteSelectedEmployees = () => {
    const updatedEmployees = employees.filter(emp => !selectedEmployeeIds.has(emp.id));
    setEmployees(updatedEmployees);
    saveEmployeesToLocalStorage(updatedEmployees);
    addActivityLog(`${selectedEmployeeIds.size} employee(s) deleted from Master.`);
    toast({ title: "Employees Deleted", description: `${selectedEmployeeIds.size} employee(s) have been deleted.`, variant: "destructive" });
    setSelectedEmployeeIds(new Set());
    setIsDeleteSelectedDialogOpen(false);
  };

  const isAllSelected = filteredEmployees.length > 0 && selectedEmployeeIds.size === filteredEmployees.length;
  const isIndeterminate = selectedEmployeeIds.size > 0 && selectedEmployeeIds.size < filteredEmployees.length;

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading Employee Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Users className="h-7 w-7" />
                Employee Master
              </h1>
              <p className="text-indigo-100 text-sm">Manage all employee records and salary information</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog open={isEmployeeFormOpen} onOpenChange={(isOpen) => {
                setIsEmployeeFormOpen(isOpen);
                if (!isOpen) {
                  setEditingEmployeeId(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddNewEmployee} className="bg-white text-indigo-700 hover:bg-indigo-50">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Employee
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Users className="h-5 w-5 text-indigo-600" />
                      </div>
                      {editingEmployeeId ? "Edit Employee" : "Add New Employee"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingEmployeeId ? "Update the details for this employee." : "Fill in the details for the new employee."}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="code" render={({ field }) => (
                          <FormItem><FormLabel>Employee Code</FormLabel><FormControl><Input {...field} disabled={!!editingEmployeeId} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>Employee Name</FormLabel><FormControl><Input {...field} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="designation" render={({ field }) => (
                          <FormItem><FormLabel>Designation</FormLabel><FormControl><Input {...field} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="border-gray-300"><SelectValue placeholder="Select status" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Left">Left</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="division" render={({ field }) => (
                          <FormItem><FormLabel>Division</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger className="border-gray-300"><SelectValue placeholder="Select Division" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="FMCG">FMCG</SelectItem>
                                <SelectItem value="Wellness">Wellness</SelectItem>
                                <SelectItem value="Office-Staff">Office-Staff</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="hq" render={({ field }) => (
                          <FormItem><FormLabel>HQ</FormLabel><FormControl><Input {...field} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="doj" render={({ field }) => (
                          <FormItem><FormLabel>Date of Joining</FormLabel><FormControl><Input type="date" {...field} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="dor" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Resignation</FormLabel>
                            <FormControl><Input type="date" {...field} disabled={statusInForm === "Active"} className="border-gray-300" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="grossMonthlySalary" render={({ field }) => (
                          <FormItem><FormLabel>Gross Monthly Salary (₹)</FormLabel><FormControl><Input type="number" {...field} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="revisedGrossMonthlySalary" render={({ field }) => (
                          <FormItem><FormLabel>Revised Gross Salary (₹)</FormLabel><FormControl><Input type="number" placeholder="Optional" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="salaryEffectiveDate" render={({ field }) => (
                          <FormItem><FormLabel>Salary Effective Date</FormLabel><FormControl><Input type="date" placeholder="Optional" {...field} className="border-gray-300" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="breakupRuleId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Override Salary Breakup Rule</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "default"}>
                              <FormControl><SelectTrigger className="border-gray-300"><SelectValue placeholder="Default (based on Gross)" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="default">Default (based on Gross)</SelectItem>
                                {salaryBreakupRules.map(rule => (
                                    <SelectItem key={rule.id} value={rule.id}>
                                        Rule: {rule.from_gross} - {rule.to_gross}
                                    </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <DialogFooter className="pt-4">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">{editingEmployeeId ? "Update Employee" : "Save Employee"}</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <FileUploadButton
                onFileUpload={handleUploadEmployees}
                buttonText="Upload CSV"
                acceptedFileTypes=".csv"
                variant="secondary"
                className="bg-white/20 text-white border-white/30 hover:bg-white/30"
              />
              <Button variant="ghost" onClick={handleDownloadSampleTemplate} className="text-white hover:bg-white/20">
                <Download className="mr-2 h-4 w-4" /> Template
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Employees" value={employeeCounts.totalCount} icon={Users} color="blue" />
        <StatCard title="Active Employees" value={employeeCounts.activeCount} icon={UserCheck} color="green" />
        <StatCard title="Left Employees" value={employeeCounts.leftCount} icon={UserX} color="red" />
        <StatCard title="Divisions" value="3" icon={Building2} color="purple" subtitle="FMCG, Wellness, Office" />
      </div>

      {/* Employee Table Card */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Employee List
              </CardTitle>
              <CardDescription>
                Showing {filteredEmployees.length} of {employees.length} employees
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              {selectedEmployeeIds.size > 0 && (
                <Button variant="destructive" onClick={handleDeleteSelectedEmployees} size="sm">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedEmployeeIds.size})
                </Button>
              )}
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "Active" | "Left")}>
                <SelectTrigger className="w-full sm:w-[140px] bg-white">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active Only</SelectItem>
                  <SelectItem value="Left">Left Only</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search employees..."
                  className="pl-8 bg-white"
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected ? true : (isIndeterminate ? 'indeterminate' : false)}
                      onCheckedChange={(checkedState) => handleSelectAll(checkedState as boolean)}
                      aria-label="Select all visible rows"
                      disabled={filteredEmployees.length === 0}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Division</TableHead>
                  <TableHead className="font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Designation</TableHead>
                  <TableHead className="font-semibold">HQ</TableHead>
                  <TableHead className="font-semibold">DOJ</TableHead>
                  <TableHead className="font-semibold">DOR</TableHead>
                  <TableHead className="font-semibold text-right">Gross Salary</TableHead>
                  <TableHead className="font-semibold text-right">Revised Salary</TableHead>
                  <TableHead className="font-semibold">Effective Date</TableHead>
                  <TableHead className="text-center font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} className="hover:bg-indigo-50/50" data-state={selectedEmployeeIds.has(employee.id) ? "selected" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployeeIds.has(employee.id)}
                          onCheckedChange={(checked) => handleSelectEmployee(employee.id, !!checked)}
                          aria-label={`Select row for ${employee.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className={employee.status === "Active" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                          {employee.status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">{employee.division || "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-indigo-600">{employee.code}</TableCell>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.designation}</TableCell>
                      <TableCell>{employee.hq || "N/A"}</TableCell>
                      <TableCell>
                        {employee.doj && isValid(parseISO(employee.doj)) ? format(parseISO(employee.doj), "dd-MMM-yy") : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {employee.dor && isValid(parseISO(employee.dor)) ? format(parseISO(employee.dor), "dd-MMM-yy") : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{employee.grossMonthlySalary?.toLocaleString('en-IN') || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {employee.revisedGrossMonthlySalary ? `₹${employee.revisedGrossMonthlySalary.toLocaleString('en-IN')}` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {employee.salaryEffectiveDate && isValid(parseISO(employee.salaryEffectiveDate)) ? format(parseISO(employee.salaryEffectiveDate), "dd-MMM-yy") : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(employee.id)} className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployeeClick(employee)} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-12 w-12 text-gray-300" />
                        <p className="text-gray-500 font-medium">
                          {employees.length === 0 ? "No employees found" : "No employees match your filters"}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {employees.length === 0 ? "Click 'Add Employee' to get started" : "Try adjusting your search or filter"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Selected Dialog */}
      <AlertDialog open={isDeleteSelectedDialogOpen} onOpenChange={setIsDeleteSelectedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{selectedEmployeeIds.size}</span> selected employee(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelectedEmployees} className="bg-red-600 hover:bg-red-700">
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Employee Dialog */}
      <AlertDialog open={!!employeeToDelete} onOpenChange={(isOpen) => { if (!isOpen) setEmployeeToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete employee <span className="font-semibold">{employeeToDelete?.name}</span> (Code: {employeeToDelete?.code})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEmployeeToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSingleEmployee} className="bg-red-600 hover:bg-red-700">
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
