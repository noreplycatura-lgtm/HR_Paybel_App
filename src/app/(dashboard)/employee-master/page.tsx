
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
import { sampleEmployees, type EmployeeDetail } from "@/lib/hr-data";
import { format, parseISO, isValid, isBefore } from "date-fns";
import { FileUploadButton } from "@/components/shared/file-upload-button";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";

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
    if (!val || val.trim() === "") return true; // Optional is fine
    try {
        const date = parseISO(val); // Check if it's a valid date if provided
        return isValid(date);
    } catch {
        return false;
    }
  }, { message: "If provided, DOR must be a valid date (YYYY-MM-DD)"}),
  grossMonthlySalary: z.coerce.number().positive({ message: "Gross salary must be a positive number" }),
}).refine(data => {
    if (data.status === "Active" && (data.dor && data.dor.trim() !== "")) {
        return false; 
    }
    if (data.status === "Left" && data.doj && data.dor && data.dor.trim() !== "" && isValid(parseISO(data.doj)) && isValid(parseISO(data.dor))) {
        if (isBefore(parseISO(data.dor), parseISO(data.doj))) {
            return false;
        }
    }
    return true;
}, {
    message: "DOR must be empty if status is 'Active'. If status is 'Left', DOR cannot be before DOJ.",
    path: ["dor"], 
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

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


  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      code: "",
      name: "",
      designation: "",
      doj: "",
      status: "Active",
      division: "",
      hq: "",
      dor: "",
      grossMonthlySalary: 0,
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
      let loadedEmployees: EmployeeDetail[] = [];
      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployeesStr) {
          const parsedData = JSON.parse(storedEmployeesStr);
          if (Array.isArray(parsedData)) { 
            loadedEmployees = parsedData; 
          } else {
            console.warn("Employee master data in localStorage is corrupted or not an array. Using default sample data and resetting storage.");
            toast({ title: "Data Load Warning", description: "Stored employee master data might be corrupted. Defaulting to sample employees.", variant: "destructive", duration: 7000 });
            loadedEmployees = [...sampleEmployees];
            saveEmployeesToLocalStorage([...sampleEmployees]);
          }
        } else {
          // Key doesn't exist, likely first load. Use samples and save them.
          loadedEmployees = [...sampleEmployees];
          saveEmployeesToLocalStorage([...sampleEmployees]);
          toast({ title: "Using Sample Data", description: "No existing employee data found. Loaded sample employees.", duration: 5000 });
        }
      } catch (error) {
        console.error("Error loading or parsing employees from localStorage:", error);
        toast({ title: "Data Load Error", description: "Could not load employee master data. Stored data might be corrupted. Defaulting to sample employees and resetting storage.", variant: "destructive", duration: 7000 });
        loadedEmployees = [...sampleEmployees]; 
        saveEmployeesToLocalStorage([...sampleEmployees]);
      }
      setEmployees(loadedEmployees);
    }
    setIsLoadingData(false);
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
    let submissionValues = { ...values };
    if (submissionValues.status === "Active") {
      submissionValues.dor = ""; 
    }

    if (editingEmployeeId) {
      const updatedEmployees = employees.map(emp =>
        emp.id === editingEmployeeId ? { ...emp, ...submissionValues, id: editingEmployeeId } : emp
      );
      setEmployees(updatedEmployees);
      saveEmployeesToLocalStorage(updatedEmployees);
      toast({ title: "Employee Updated", description: `${submissionValues.name}'s details have been updated.` });
    } else {
      const existingEmployee = employees.find(emp => emp.code === submissionValues.code);
      if (existingEmployee) {
        toast({
          title: "Duplicate Employee Code",
          description: `An employee with code '${submissionValues.code}' already exists. Please use a unique code.`,
          variant: "destructive",
        });
        form.setError("code", { type: "manual", message: "This employee code already exists." });
        return;
      }
      const newEmployee: EmployeeDetail = {
        id: submissionValues.code, 
        ...submissionValues,
        dor: submissionValues.dor || undefined, 
      };
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      saveEmployeesToLocalStorage(updatedEmployees);
      toast({ title: "Employee Added", description: `${submissionValues.name} has been added to the master list.` });
    }
    setIsEmployeeFormOpen(false);
    setEditingEmployeeId(null);
    form.reset();
  };

  const handleAddNewEmployee = () => {
    setEditingEmployeeId(null);
    form.reset({
      code: "", name: "", designation: "", doj: "", status: "Active",
      division: "", hq: "", dor: "", grossMonthlySalary: 0,
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
    toast({
        title: "Employee Removed",
        description: `${employeeToDelete.name} has been removed from the list.`,
        variant: "destructive"
    });
    setEmployeeToDelete(null);
  };


  const handleUploadEmployees = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
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

        const expectedHeaders = ["status", "division", "code", "name", "designation", "hq", "doj", "dor", "grossmonthlysalary"];
        const headerLine = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/\s+/g, ''));
        
        const missingHeaders = expectedHeaders.filter(eh => !headerLine.includes(eh));
        if (missingHeaders.length > 0) {
             toast({ title: "File Header Error", description: `Missing/misnamed headers: ${missingHeaders.join(', ')}. Expected: ${expectedHeaders.join(', ')}. Check spelling and ensure all are present.`, variant: "destructive", duration: 9000 });
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

        const dataRows = lines.slice(1);
        let uploadedEmployees: EmployeeDetail[] = [];
        const currentEmployeesMap = new Map(employees.map(emp => [emp.code, emp]));
        const codesInCsv = new Set<string>();
        let skippedForDuplicateInCsv = 0;
        let skippedForExistingInDb = 0;
        let malformedRows = 0;
        let addedCount = 0;
        let updatedCount = 0;

        dataRows.forEach((row, rowIndex) => {
          const values = row.split(',').map(v => v.trim());
          
          if (values.length <= Math.max(idxStatus, idxDivision, idxCode, idxName, idxDesignation, idxHq, idxDoj, idxDor, idxGrossSalary)) {
             console.warn(`Skipping row ${rowIndex + 2} in Employee Master CSV: insufficient columns.`);
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
          
          const grossMonthlySalary = parseFloat(grossMonthlySalaryStr);

          if (!code || !name || !status || !division || !designation || !hq || !doj || isNaN(grossMonthlySalary) || grossMonthlySalary <= 0) {
            console.warn(`Skipping row ${rowIndex + 2} (Code: ${code}): missing or invalid critical data. Ensure all fields are present and Gross Salary is a positive number.`);
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

          let formattedDoj = doj;
          if (doj && !/^\d{4}-\d{2}-\d{2}$/.test(doj)) { 
             try { const d = new Date(doj.replace(/[-/.]/g, '/')); if (isValid(d)) formattedDoj = format(d, 'yyyy-MM-dd'); } catch { /* ignore */ }
          }
          let formattedDor = dor;
          if (dor && !/^\d{4}-\d{2}-\d{2}$/.test(dor)) {
             try { const d = new Date(dor.replace(/[-/.]/g, '/')); if (isValid(d)) formattedDor = format(d, 'yyyy-MM-dd'); } catch { /* ignore */ }
          }
          
          const employeeData: EmployeeDetail = {
            id: code, status, division, code, name, designation, hq, 
            doj: formattedDoj, dor: formattedDor || undefined, grossMonthlySalary,
          };

          if (currentEmployeesMap.has(code)) {
            // Update existing employee
            uploadedEmployees.push(employeeData);
            updatedCount++;
          } else {
            // Add new employee
            uploadedEmployees.push(employeeData);
            addedCount++;
          }
        });

        let message = "";
        if (addedCount > 0 || updatedCount > 0) {
            const newEmployeesMap = new Map(uploadedEmployees.map(emp => [emp.code, emp]));
            const combinedEmployees = employees.map(emp => newEmployeesMap.get(emp.code) || emp); // Update existing
            uploadedEmployees.forEach(upEmp => { // Add new ones not in original list
                if (!employees.some(e => e.code === upEmp.code)) {
                    combinedEmployees.push(upEmp);
                }
            });
            
            setEmployees(combinedEmployees);
            saveEmployeesToLocalStorage(combinedEmployees);
            if (addedCount > 0) message += `${addedCount} new employee(s) added. `;
            if (updatedCount > 0) message += `${updatedCount} existing employee(s) updated. `;
        } else {
            message += `No new employees were added or updated from ${file.name}. `;
        }

        if (skippedForDuplicateInCsv > 0) message += `${skippedForDuplicateInCsv} row(s) skipped due to duplicate codes within the CSV. `;
        if (malformedRows > 0) message += `${malformedRows} row(s) skipped due to missing or invalid data. `;

        toast({
          title: "Employee Upload Processed",
          description: message.trim(),
          duration: 9000,
          variant: (addedCount > 0 || updatedCount > 0) ? "default" : "destructive",
        });

      } catch (error) {
        console.error("Error parsing CSV for employees:", error);
        toast({ title: "Parsing Error", description: "Could not parse the CSV file. Please check its format and column order. Ensure all expected columns are present.", variant: "destructive", duration: 7000 });
      }
    };
    reader.onerror = () => {
      toast({ title: "File Read Error", description: "An error occurred while trying to read the file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleTemplate = () => {
    const headers = ["Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ", "DOR", "GrossMonthlySalary"];
    const sampleData = [
      ["Active", "Marketing", "E006", "Sarah Lee", "Marketing Specialist", "Chicago", "2024-01-10", "", "62000"],
      ["Left", "IT", "E007", "Tom Brown", "IT Support", "Austin", "2023-11-05", "2024-06-30", "55000"],
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
          (employee.division && employee.division.toLowerCase().includes(filterTerm.toLowerCase())) ||
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
  }, [employees, filterTerm, statusFilter, isLoadingData]);

  const employeeCounts = React.useMemo(() => {
    if (isLoadingData) return { activeCount: 0, leftCount: 0, totalCount:0 };
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
    if (selectedEmployeeIds.size > 0) {
      setIsDeleteSelectedDialogOpen(true);
    } else {
      toast({ title: "No Employees Selected", description: "Please select employees to delete.", variant: "destructive"});
    }
  };

  const confirmDeleteSelectedEmployees = () => {
    const updatedEmployees = employees.filter(emp => !selectedEmployeeIds.has(emp.id));
    setEmployees(updatedEmployees);
    saveEmployeesToLocalStorage(updatedEmployees);
    toast({ title: "Employees Deleted", description: `${selectedEmployeeIds.size} employee(s) have been deleted.`, variant: "destructive" });
    setSelectedEmployeeIds(new Set());
    setIsDeleteSelectedDialogOpen(false);
  };

  const isAllSelected = filteredEmployees.length > 0 && selectedEmployeeIds.size === filteredEmployees.length;
  const isIndeterminate = selectedEmployeeIds.size > 0 && selectedEmployeeIds.size < filteredEmployees.length;


  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Employee Master"
        description="View, add, or bulk upload employee master data. Columns: Status, Division, Code, Name, Designation, HQ, DOJ, DOR, Gross Salary."
      >
        <Button variant="destructive" onClick={handleDeleteSelectedEmployees} disabled={selectedEmployeeIds.size === 0} title="Delete selected employees">
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
            <Button variant="outline" onClick={handleAddNewEmployee} title="Add a new employee to the master list">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{editingEmployeeId ? "Edit Employee" : "Add New Employee"}</DialogTitle>
              <DialogDescription>
                {editingEmployeeId ? "Update the details for this employee." : "Fill in the details for the new employee. Click save when you're done."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                 <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <FormItem><FormLabel>Division</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                    <FormItem className="md:col-span-2"><FormLabel>Gross Monthly Salary (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
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
            icon={<Upload className="mr-2 h-4 w-4" />}
        />
        <Button variant="link" onClick={handleDownloadSampleTemplate} className="p-0 h-auto" title="Download sample CSV template for employee master data">
          <Download className="mr-2 h-4 w-4" /> Download Sample Template (CSV)
        </Button>
      </PageHeader>

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Employee List</CardTitle>
              <CardDescription>
                Displaying {filteredEmployees.length} of {employeeCounts.totalCount} total employees
                ({employeeCounts.activeCount} Active, {employeeCounts.leftCount} Left).
                Selected: {selectedEmployeeIds.size}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "Active" | "Left")}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      <SelectItem value="Active">Active Only</SelectItem>
                      <SelectItem value="Left">Left Only</SelectItem>
                  </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Filter by Code, Name, Div, HQ..."
                  className="pl-8"
                  value={filterTerm}
                  onChange={(e) => setFilterTerm(e.target.value)}
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
                <TableHead className="text-center min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
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
                          if (!isValid(parsedDate)) {
                            const parts = employee.doj.split(/[-/.]/); 
                            let reparsedDate = null;
                            if (parts.length === 3) { 
                                if (parseInt(parts[2]) > 1000) { 
                                     reparsedDate = parseISO(`${parts[2]}-${parts[1]}-${parts[0]}`); 
                                     if(!isValid(reparsedDate)) reparsedDate = parseISO(`${parts[2]}-${parts[0]}-${parts[1]}`); 
                                } else if (parseInt(parts[0]) > 1000) { 
                                     reparsedDate = parseISO(employee.doj); 
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd-MMM-yy");
                            return employee.doj; 
                          }
                          return format(parsedDate, "dd-MMM-yy");
                        } catch (e) {
                          return employee.doj; 
                        }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell>
                     {(() => {
                      if (employee.dor && typeof employee.dor === 'string' && employee.dor.trim() !== '') {
                        try {
                          const parsedDate = parseISO(employee.dor);
                          if (!isValid(parsedDate)) {
                             const parts = employee.dor.split(/[-/.]/);
                             let reparsedDate = null;
                             if (parts.length === 3) {
                                if (parseInt(parts[2]) > 1000) {
                                     reparsedDate = parseISO(`${parts[2]}-${parts[1]}-${parts[0]}`);
                                     if(!isValid(reparsedDate)) reparsedDate = parseISO(`${parts[2]}-${parts[0]}-${parts[1]}`);
                                } else if (parseInt(parts[0]) > 1000) {
                                     reparsedDate = parseISO(employee.dor);
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd-MMM-yy");
                            return employee.dor;
                          }
                          return format(parsedDate, "dd-MMM-yy");
                        } catch (e) {
                          return employee.dor;
                        }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell className="text-right">{employee.grossMonthlySalary ? employee.grossMonthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(employee.id)} title="Edit this employee's details">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployeeClick(employee)} className="text-destructive hover:text-destructive/80" title="Delete this employee">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && !isLoadingData && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    {filterTerm || statusFilter !== "all" ? "No employees match your filters." : (employees.length === 0 ? "No employee data available. Use 'Add New Employee' or 'Upload Employees'." : "No employees found.")}
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
              Are you sure you want to delete {selectedEmployeeIds.size} selected employee(s)? This action cannot be undone.
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
              Are you sure you want to delete employee {employeeToDelete?.name} (Code: {employeeToDelete?.code})? This action cannot be undone.
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

    
