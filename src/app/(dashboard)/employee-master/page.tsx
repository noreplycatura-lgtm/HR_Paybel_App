
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { PageHeader } from "@/components/shared/page-header";
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
import { PlusCircle, Upload, Edit, Trash2, Download, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EmployeeDetail } from "@/lib/hr-data";
import { format, parseISO, isValid, isBefore } from "date-fns";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import type { Division } from "@/lib/constants";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY_PREFIX = "novita_employee_master_data_v1_";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";
const LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY = "novita_current_logged_in_user_display_name_v1";

const getEmployeeMasterStorageKey = (division: Division) => `${LOCAL_STORAGE_EMPLOYEE_MASTER_KEY_PREFIX}${division}`;

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
  user: string;
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = []; 

    const loggedInUser = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY) || "System";

    activities.unshift({ timestamp: new Date().toISOString(), message, user: loggedInUser });
    activities = activities.slice(0, 10); 
    localStorage.setItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error adding to activity log:", error);
  }
};


export default function EmployeeMasterPage() {
  const { toast } = useToast();
  const [allDivisionEmployees, setAllDivisionEmployees] = React.useState<Record<Division, EmployeeDetail[]>>({ FMCG: [], Wellness: [] });
  const [selectedDivision, setSelectedDivision] = React.useState<Division | "">("");

  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | null>(null);
  const [filterTerm, setFilterTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "Active" | "Left">("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<Set<string>>(new Set());
  const [isDeleteSelectedDialogOpen, setIsDeleteSelectedDialogOpen] = React.useState(false);
  const [employeeToDelete, setEmployeeToDelete] = React.useState<EmployeeDetail | null>(null);


  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      code: "", name: "", designation: "", doj: "", status: "Active",
      division: "", hq: "", dor: "", grossMonthlySalary: 0,
      revisedGrossMonthlySalary: undefined, salaryEffectiveDate: "",
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
    if (typeof window !== 'undefined') {
      try {
        const fmcgEmployeesStr = localStorage.getItem(getEmployeeMasterStorageKey("FMCG"));
        const wellnessEmployeesStr = localStorage.getItem(getEmployeeMasterStorageKey("Wellness"));

        const fmcgEmployees = fmcgEmployeesStr ? JSON.parse(fmcgEmployeesStr) : [];
        const wellnessEmployees = wellnessEmployeesStr ? JSON.parse(wellnessEmployeesStr) : [];

        setAllDivisionEmployees({
            FMCG: Array.isArray(fmcgEmployees) ? fmcgEmployees : [],
            Wellness: Array.isArray(wellnessEmployees) ? wellnessEmployees : []
        });

      } catch (error) {
        console.error("Error loading/processing employees from localStorage:", error);
        toast({
          title: "Storage Error",
          description: "Could not load employee data. Using empty lists.",
          variant: "destructive",
          duration: 7000,
        });
        setAllDivisionEmployees({ FMCG: [], Wellness: [] });
      }
    }
    setIsLoadingData(false);
  }, []);

  const saveEmployeesToLocalStorage = (division: Division, updatedEmployees: EmployeeDetail[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(getEmployeeMasterStorageKey(division), JSON.stringify(updatedEmployees));
      } catch (error) {
        console.error(`Error saving ${division} employees to localStorage:`, error);
        toast({ title: "Storage Error", description: `Could not save ${division} employee data locally.`, variant: "destructive" });
      }
    }
  };

  const onSubmit = (values: EmployeeFormValues) => {
    if (!selectedDivision) {
      toast({ title: "Error", description: "No division selected.", variant: "destructive" });
      return;
    }
    
    let submissionValues = { ...values, division: selectedDivision };

    if (submissionValues.status === "Active") {
      submissionValues.dor = "";
    }
    if (!submissionValues.revisedGrossMonthlySalary || submissionValues.revisedGrossMonthlySalary === 0) {
      submissionValues.revisedGrossMonthlySalary = undefined;
      submissionValues.salaryEffectiveDate = "";
    }
    
    const currentEmployees = allDivisionEmployees[selectedDivision];

    if (editingEmployeeId) {
      const updatedEmployees = currentEmployees.map(emp =>
        emp.id === editingEmployeeId ? { ...emp, ...submissionValues, id: editingEmployeeId } : emp
      );
      setAllDivisionEmployees(prev => ({ ...prev, [selectedDivision]: updatedEmployees }));
      saveEmployeesToLocalStorage(selectedDivision, updatedEmployees);
      addActivityLog(`Employee ${submissionValues.name} (${selectedDivision}) details updated.`);
      toast({ title: "Employee Updated", description: `${submissionValues.name}'s details have been updated.` });
    } else {
      const existingEmployee = currentEmployees.find(emp => emp.code === submissionValues.code);
      if (existingEmployee) {
        toast({
          title: "Duplicate Employee Code",
          description: `An employee with code '${submissionValues.code}' already exists in the ${selectedDivision} division.`,
          variant: "destructive",
        });
        form.setError("code", { type: "manual", message: "This employee code already exists in this division." });
        return;
      }
      const newEmployee: EmployeeDetail = {
        id: `${selectedDivision}-${submissionValues.code}`,
        ...submissionValues,
        dor: submissionValues.dor || undefined,
        revisedGrossMonthlySalary: submissionValues.revisedGrossMonthlySalary || undefined,
        salaryEffectiveDate: submissionValues.salaryEffectiveDate || "",
      };
      const updatedEmployees = [...currentEmployees, newEmployee];
      setAllDivisionEmployees(prev => ({ ...prev, [selectedDivision]: updatedEmployees }));
      saveEmployeesToLocalStorage(selectedDivision, updatedEmployees);
      addActivityLog(`New employee ${submissionValues.name} (${selectedDivision}) added.`);
      toast({ title: "Employee Added", description: `${submissionValues.name} has been added to the master list for ${selectedDivision}.` });
    }
    setIsEmployeeFormOpen(false);
    setEditingEmployeeId(null);
    form.reset();
  };

  const handleAddNewEmployee = () => {
    if (!selectedDivision) {
        toast({ title: "No Division Selected", description: "Please select a division before adding an employee.", variant: "destructive" });
        return;
    }
    setEditingEmployeeId(null);
    form.reset({
      code: "", name: "", designation: "", doj: "", status: "Active",
      division: selectedDivision, hq: "", dor: "", grossMonthlySalary: 0,
      revisedGrossMonthlySalary: undefined, salaryEffectiveDate: "",
    });
    setIsEmployeeFormOpen(true);
  };

  const handleEditEmployee = (employeeId: string) => {
    if (!selectedDivision) return;
    const employeeToEdit = allDivisionEmployees[selectedDivision].find(emp => emp.id === employeeId);
    if (employeeToEdit) {
      setEditingEmployeeId(employeeId);
      const formValues = {
        ...employeeToEdit,
        doj: employeeToEdit.doj && isValid(parseISO(employeeToEdit.doj)) ? format(parseISO(employeeToEdit.doj), 'yyyy-MM-dd') : '',
        dor: employeeToEdit.dor && isValid(parseISO(employeeToEdit.dor)) ? format(parseISO(employeeToEdit.dor), 'yyyy-MM-dd') : '',
        salaryEffectiveDate: employeeToEdit.salaryEffectiveDate && isValid(parseISO(employeeToEdit.salaryEffectiveDate)) ? format(parseISO(employeeToEdit.salaryEffectiveDate), 'yyyy-MM-dd') : '',
        revisedGrossMonthlySalary: employeeToEdit.revisedGrossMonthlySalary || undefined,
      };
      form.reset(formValues);
      setIsEmployeeFormOpen(true);
    }
  };

  const handleDeleteEmployeeClick = (employee: EmployeeDetail) => {
    setEmployeeToDelete(employee);
  };

  const confirmDeleteSingleEmployee = () => {
    if (!employeeToDelete || !selectedDivision) return;
    const currentEmployees = allDivisionEmployees[selectedDivision];
    const updatedEmployees = currentEmployees.filter(emp => emp.id !== employeeToDelete.id);
    setAllDivisionEmployees(prev => ({ ...prev, [selectedDivision]: updatedEmployees }));
    saveEmployeesToLocalStorage(selectedDivision, updatedEmployees);
    setSelectedEmployeeIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(employeeToDelete.id);
        return newSet;
    });
    addActivityLog(`Employee ${employeeToDelete.name} (Code: ${employeeToDelete.code}) from ${selectedDivision} deleted.`);
    toast({
        title: "Employee Removed",
        description: `${employeeToDelete.name} has been removed from the ${selectedDivision} list.`,
        variant: "destructive"
    });
    setEmployeeToDelete(null);
  };


  const handleUploadEmployees = (file: File) => {
     if (!selectedDivision) {
        toast({ title: "No Division Selected", description: "Please select a division before uploading.", variant: "destructive" });
        return;
    }
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
          toast({ title: "Invalid File", description: "File is empty or has no data rows. Header + at least one data row expected.", variant: "destructive" });
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
        const currentEmployees = allDivisionEmployees[selectedDivision];
        const currentEmployeesMap = new Map(currentEmployees.map(emp => [emp.code, emp]));
        const codesInCsv = new Set<string>();
        let skippedForDuplicateInCsv = 0;
        let malformedRows = 0;
        let addedCount = 0;
        let skippedForExistingInMaster = 0;
        let skippedForWrongDivision = 0;

        dataRows.forEach((row, rowIndex) => {
          const values = row.split(',').map(v => v.trim());

          if (values.length <= Math.max(idxStatus, idxDivision, idxCode, idxName, idxDesignation, idxHq, idxDoj, idxDor, idxGrossSalary, idxRevisedGrossSalary, idxSalaryEffectiveDate )) {
             console.warn(`Skipping row ${rowIndex + 2}: insufficient columns.`);
             malformedRows++;
             return;
          }
          
          const divisionFromFile = values[idxDivision];
          if (divisionFromFile?.toLowerCase() !== selectedDivision.toLowerCase()) {
              skippedForWrongDivision++;
              return;
          }

          let status = values[idxStatus] as "Active" | "Left";
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

          if (!code || !name || !status || !designation || !hq || !doj || isNaN(grossMonthlySalary) || grossMonthlySalary <= 0) {
            console.warn(`Skipping row ${rowIndex + 2} (Code: ${code}): missing/invalid critical data.`);
            malformedRows++;
            return;
          }
          if (status !== "Active" && status !== "Left") {
            status = "Active"; 
            console.warn(`Row ${rowIndex + 2} (Code: ${code}): invalid status '${values[idxStatus]}'. Defaulted to 'Active'.`);
          }
          if (status === "Active") dor = ""; 

          if (codesInCsv.has(code)) {
            console.warn(`Skipping row ${rowIndex + 2} (Code: ${code}) due to duplicate code within this CSV file.`);
            skippedForDuplicateInCsv++;
            return;
          }
          codesInCsv.add(code);
          
          if (currentEmployeesMap.has(code)) {
            console.warn(`Skipping row ${rowIndex + 2} (Code: ${code}) as employee code already exists in ${selectedDivision} master list.`);
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
            id: `${selectedDivision}-${code}`, status, division: selectedDivision, code, name, designation, hq,
            doj: formattedDoj, dor: formattedDor || undefined, grossMonthlySalary,
            revisedGrossMonthlySalary: (revisedGrossMonthlySalary && revisedGrossMonthlySalary > 0) ? revisedGrossMonthlySalary : undefined,
            salaryEffectiveDate: (revisedGrossMonthlySalary && revisedGrossMonthlySalary > 0 && formattedSalaryEffectiveDate) ? formattedSalaryEffectiveDate : "",
          };
          newUploadedEmployees.push(employeeData);
          addedCount++;
        });

        let message = "";
        if (newUploadedEmployees.length > 0) {
            const combinedEmployees = [...currentEmployees, ...newUploadedEmployees];
            setAllDivisionEmployees(prev => ({ ...prev, [selectedDivision]: combinedEmployees }));
            saveEmployeesToLocalStorage(selectedDivision, combinedEmployees);
            message += `${addedCount} new employee(s) processed for ${selectedDivision}. `;
            addActivityLog(`Employee Master CSV uploaded for ${selectedDivision}: ${file.name} (${addedCount} added).`);
        } else {
            message += `No new employees were added from ${file.name} for ${selectedDivision}. `;
        }
        
        if (skippedForWrongDivision > 0) message += `${skippedForWrongDivision} row(s) skipped due to mismatched division. `;
        if (skippedForExistingInMaster > 0) message += `${skippedForExistingInMaster} row(s) skipped as employee code already exists in master. `;
        if (skippedForDuplicateInCsv > 0) message += `${skippedForDuplicateInCsv} row(s) skipped due to duplicate codes within the CSV. `;
        if (malformedRows > 0) message += `${malformedRows} row(s) skipped due to invalid/missing data. `;

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
      ["Left", "FMCG", "E007", "Tom Brown", "IT Support", "Austin", "2023-11-05", "2024-06-30", "55000", "", ""],
      ["Active", "Wellness", "E008", "David Green", "Sales Rep", "Miami", "2023-02-20", "", "58000", "", ""],
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

  const currentEmployees = selectedDivision ? allDivisionEmployees[selectedDivision] : [];

  const filteredEmployees = React.useMemo(() => {
    if (isLoadingData || !selectedDivision) return [];
    return currentEmployees.filter(employee => {
        const matchesSearchTerm = (
          employee.code.toLowerCase().includes(filterTerm.toLowerCase()) ||
          employee.name.toLowerCase().includes(filterTerm.toLowerCase()) ||
          (employee.designation && employee.designation.toLowerCase().includes(filterTerm.toLowerCase())) ||
          (employee.hq && employee.hq.toLowerCase().includes(filterTerm.toLowerCase()))
        );
        const matchesStatusFilter = (
            statusFilter === "all" ||
            (statusFilter === "Active" && employee.status === "Active") ||
            (statusFilter === "Left" && employee.status === "Left")
        );
        return matchesSearchTerm && matchesStatusFilter;
      });
  }, [currentEmployees, filterTerm, statusFilter, isLoadingData, selectedDivision]);

  const employeeCounts = React.useMemo(() => {
    if (isLoadingData || !selectedDivision) return { activeCount: 0, leftCount: 0, totalCount:0 };
    const activeCount = currentEmployees.filter(emp => emp.status === "Active").length;
    const leftCount = currentEmployees.filter(emp => emp.status === "Left").length;
    return { activeCount, leftCount, totalCount: currentEmployees.length };
  }, [currentEmployees, isLoadingData, selectedDivision]);

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
    if (!selectedDivision || selectedEmployeeIds.size === 0) {
      toast({ title: "No Selection", description: "Please select a division and employees to delete.", variant: "destructive"});
      return;
    }
    setIsDeleteSelectedDialogOpen(true);
  };

  const confirmDeleteSelectedEmployees = () => {
    if (!selectedDivision) return;
    const updatedEmployees = currentEmployees.filter(emp => !selectedEmployeeIds.has(emp.id));
    setAllDivisionEmployees(prev => ({ ...prev, [selectedDivision]: updatedEmployees }));
    saveEmployeesToLocalStorage(selectedDivision, updatedEmployees);
    addActivityLog(`${selectedEmployeeIds.size} employee(s) deleted from ${selectedDivision} Master.`);
    toast({ title: "Employees Deleted", description: `${selectedEmployeeIds.size} employee(s) have been deleted.`, variant: "destructive" });
    setSelectedEmployeeIds(new Set());
    setIsDeleteSelectedDialogOpen(false);
  };

  const isAllSelected = filteredEmployees.length > 0 && selectedEmployeeIds.size === filteredEmployees.length;
  const isIndeterminate = selectedEmployeeIds.size > 0 && selectedEmployeeIds.size < filteredEmployees.length;

  return (
    <>
      <PageHeader
        title="Employee Master"
        description={`Manage employee data for a selected division. Data is saved in your browser.`}
      >
        <Button variant="destructive" onClick={handleDeleteSelectedEmployees} disabled={selectedEmployeeIds.size === 0 || !selectedDivision} title="Delete selected employees">
            <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedEmployeeIds.size})
        </Button>
        <Dialog open={isEmployeeFormOpen} onOpenChange={(isOpen) => {
            setIsEmployeeFormOpen(isOpen);
            if (!isOpen) {
                setEditingEmployeeId(null);
                form.reset();
            }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={handleAddNewEmployee} disabled={!selectedDivision} title="Add a new employee to the master list">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>{editingEmployeeId ? `Edit Employee in ${selectedDivision}` : `Add New Employee to ${selectedDivision}`}</DialogTitle>
              <DialogDescription>
                {editingEmployeeId ? "Update the details for this employee." : "Fill in the details for the new employee."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                 <fieldset>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="code" render={({ field }) => (
                      <FormItem><FormLabel>Employee Code</FormLabel><FormControl><Input {...field} disabled={!!editingEmployeeId} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Employee Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="designation" render={({ field }) => (
                      <FormItem><FormLabel>Designation</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                              <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
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
                      <FormItem><FormLabel>Division</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField control={form.control} name="hq" render={({ field }) => (
                      <FormItem><FormLabel>HQ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="doj" render={({ field }) => (
                      <FormItem><FormLabel>Date of Joining</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField control={form.control} name="dor" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Date of Resignation</FormLabel>
                              <FormControl><Input type="date" {...field} disabled={statusInForm === "Active"} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="grossMonthlySalary" render={({ field }) => (
                      <FormItem><FormLabel>Gross Monthly Salary (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField control={form.control} name="revisedGrossMonthlySalary" render={({ field }) => (
                      <FormItem><FormLabel>Revised Gross Monthly Salary (₹)</FormLabel><FormControl><Input type="number" placeholder="Optional" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField control={form.control} name="salaryEffectiveDate" render={({ field }) => (
                      <FormItem><FormLabel>Salary Effective Date</FormLabel><FormControl><Input type="date" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                 </fieldset>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" title={editingEmployeeId ? "Update this employee's details" : "Save this new employee"}>
                    {editingEmployeeId ? "Update Employee" : "Save Employee"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <FileUploadButton
            onFileUpload={handleUploadEmployees}
            buttonText="Upload Employees (CSV)"
            acceptedFileTypes=".csv"
            title="Upload employee data from a CSV file"
            disabled={!selectedDivision}
        />
        <Button variant="link" onClick={handleDownloadSampleTemplate} className="p-0 h-auto" title="Download sample CSV template">
          <Download className="mr-2 h-4 w-4" /> Download Sample Template (CSV)
        </Button>
      </PageHeader>

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Employee List</CardTitle>
              <CardDescription>
                {selectedDivision ? `Displaying ${filteredEmployees.length} of ${employeeCounts.totalCount} employees in ${selectedDivision}.` : "Select a division to view employees."}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={selectedDivision} onValueChange={(value) => setSelectedDivision(value as Division)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Select Division" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="FMCG">FMCG Division</SelectItem>
                      <SelectItem value="Wellness">Wellness Division</SelectItem>
                  </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "Active" | "Left")} disabled={!selectedDivision}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Filter by Status" />
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
                  placeholder="Filter by Code, Name, HQ..."
                  className="pl-8"
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
                   disabled={!selectedDivision}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                   <Checkbox
                    checked={isAllSelected ? true : (isIndeterminate ? 'indeterminate' : false)}
                    onCheckedChange={(checkedState) => handleSelectAll(checkedState as boolean)}
                    aria-label="Select all visible rows"
                    disabled={filteredEmployees.length === 0}
                  />
                </TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[120px]">Division</TableHead>
                <TableHead className="min-w-[80px]">Code</TableHead>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[150px]">Designation</TableHead>
                <TableHead className="min-w-[120px]">HQ</TableHead>
                <TableHead className="min-w-[100px]">DOJ</TableHead>
                <TableHead className="min-w-[100px]">DOR</TableHead>
                <TableHead className="min-w-[150px] text-right">Gross Salary (₹)</TableHead>
                <TableHead className="min-w-[150px] text-right">Revised Salary (₹)</TableHead>
                <TableHead className="min-w-[120px]">Effective Date</TableHead>
                <TableHead className="text-center min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingData ? (
                 <TableRow><TableCell colSpan={13} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : !selectedDivision ? (
                 <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground">Please select a division to view employee data.</TableCell></TableRow>
              ) : filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                <TableRow key={employee.id} data-state={selectedEmployeeIds.has(employee.id) ? "selected" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedEmployeeIds.has(employee.id)}
                      onCheckedChange={(checked) => handleSelectEmployee(employee.id, !!checked)}
                      aria-label={`Select row for ${employee.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.status === "Active" ? "default" : "secondary"}>
                      {employee.status || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell>{employee.division || "N/A"}</TableCell>
                  <TableCell>{employee.code}</TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.designation}</TableCell>
                  <TableCell>{employee.hq || "N/A"}</TableCell>
                  <TableCell>
                    {(() => {
                      if (employee.doj && typeof employee.doj === 'string' && employee.doj.trim() !== '') {
                        try {
                          const parsedDate = parseISO(employee.doj);
                          return format(parsedDate, "dd-MMM-yy");
                        } catch (e) { return employee.doj; }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell>
                     {(() => {
                      if (employee.dor && typeof employee.dor === 'string' && employee.dor.trim() !== '') {
                        try {
                          const parsedDate = parseISO(employee.dor);
                          return format(parsedDate, "dd-MMM-yy");
                        } catch (e) { return employee.dor; }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell className="text-right">{employee.grossMonthlySalary ? employee.grossMonthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</TableCell>
                  <TableCell className="text-right">{employee.revisedGrossMonthlySalary ? employee.revisedGrossMonthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</TableCell>
                  <TableCell>
                    {(() => {
                      if (employee.salaryEffectiveDate && typeof employee.salaryEffectiveDate === 'string' && employee.salaryEffectiveDate.trim() !== '') {
                        try {
                          const parsedDate = parseISO(employee.salaryEffectiveDate);
                          return format(parsedDate, "dd-MMM-yy");
                        } catch (e) { return employee.salaryEffectiveDate; }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(employee.id)} title="Edit this employee's details">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployeeClick(employee)} className="text-destructive hover:text-destructive/80" title="Delete this employee">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
              ) : (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground">
                    {currentEmployees.length === 0 ? "No employees in this division." : "No employees match your filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteSelectedDialogOpen} onOpenChange={setIsDeleteSelectedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedEmployeeIds.size} selected employee(s) from the {selectedDivision} division? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelectedEmployees} variant="destructive">
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!employeeToDelete} onOpenChange={(isOpen) => { if(!isOpen) setEmployeeToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete employee {employeeToDelete?.name} (Code: {employeeToDelete?.code}) from {selectedDivision}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEmployeeToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSingleEmployee} variant="destructive">
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
