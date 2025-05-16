
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Upload, Edit, Trash2, Download, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sampleEmployees, type EmployeeDetail } from "@/lib/hr-data";
import { format, parseISO, isValid } from "date-fns";
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
  }, { message: "Valid date (YYYY-MM-DD) is required"}),
  status: z.enum(["Active", "Left"], { required_error: "Status is required" }),
  division: z.string().min(1, "Division is required"),
  hq: z.string().min(1, "HQ is required"),
  grossMonthlySalary: z.coerce.number().positive({ message: "Gross salary must be a positive number" }),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export default function EmployeeMasterPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<EmployeeDetail[]>([]);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | null>(null);
  const [filterTerm, setFilterTerm] = React.useState("");

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
      grossMonthlySalary: 0,
    },
  });

  React.useEffect(() => {
    setIsLoadingData(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployees) {
          setEmployees(JSON.parse(storedEmployees));
        } else {
          setEmployees(sampleEmployees); 
          saveEmployeesToLocalStorage(sampleEmployees);
        }
      } catch (error) {
        console.error("Error loading employees from localStorage:", error);
        setEmployees(sampleEmployees); 
        toast({ title: "Data Load Error", description: "Could not load employee data from local storage. Using defaults.", variant: "destructive" });
      }
    }
    setIsLoadingData(false);
  }, []); 

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
    if (editingEmployeeId) {
      const updatedEmployees = employees.map(emp => 
        emp.id === editingEmployeeId ? { ...emp, ...values, id: editingEmployeeId } : emp
      );
      setEmployees(updatedEmployees);
      saveEmployeesToLocalStorage(updatedEmployees);
      toast({ title: "Employee Updated", description: `${values.name}'s details have been updated.` });
    } else {
      const existingEmployee = employees.find(emp => emp.code === values.code);
      if (existingEmployee) {
        toast({
          title: "Duplicate Employee Code",
          description: `An employee with code '${values.code}' already exists. Please use a unique code.`,
          variant: "destructive",
        });
        form.setError("code", { type: "manual", message: "This employee code already exists." });
        return; 
      }
      const newEmployee: EmployeeDetail = {
        id: values.code, 
        ...values,
      };
      const updatedEmployees = [...employees, newEmployee];
      setEmployees(updatedEmployees);
      saveEmployeesToLocalStorage(updatedEmployees);
      toast({ title: "Employee Added", description: `${values.name} has been added to the master list.` });
    }
    setIsEmployeeFormOpen(false);
    setEditingEmployeeId(null);
    form.reset(); 
  };

  const handleAddNewEmployee = () => {
    setEditingEmployeeId(null); 
    form.reset(); 
    setIsEmployeeFormOpen(true);
  };

  const handleEditEmployee = (employeeId: string) => {
    const employeeToEdit = employees.find(emp => emp.id === employeeId);
    if (employeeToEdit) {
      setEditingEmployeeId(employeeId);
      const formValues = {
        ...employeeToEdit,
        doj: employeeToEdit.doj && isValid(parseISO(employeeToEdit.doj)) ? format(parseISO(employeeToEdit.doj), 'yyyy-MM-dd') : ''
      };
      form.reset(formValues);
      setIsEmployeeFormOpen(true);
    }
  };

  const handleDeleteEmployee = (employeeId: string) => {
    const employeeToDelete = employees.find(emp => emp.id === employeeId);
    if (confirm(`Are you sure you want to delete ${employeeToDelete?.name || `Employee ID ${employeeId}`}?`)) {
        const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
        setEmployees(updatedEmployees);
        saveEmployeesToLocalStorage(updatedEmployees);
        toast({
          title: "Employee Removed",
          description: `${employeeToDelete?.name || `Employee ID ${employeeId}`} has been removed from the list.`,
          variant: "destructive"
        });
    }
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

        const dataRows = lines.slice(1); 
        const expectedColumns = 8; 
        const uploadedEmployees: EmployeeDetail[] = [];
        const currentEmployeesMap = new Map(employees.map(emp => [emp.code, emp]));
        const codesInCsv = new Set<string>();
        let skippedForDuplicateInCsv = 0;
        let skippedForExistingInDb = 0;

        dataRows.forEach((row, rowIndex) => {
          const values = row.split(',').map(v => v.trim());
          if (values.length < expectedColumns) {
            console.warn(`Skipping row ${rowIndex + 1} due to insufficient columns. Expected ${expectedColumns}, got ${values.length}`);
            return;
          }
          
          const status = values[0] as "Active" | "Left";
          const division = values[1];
          const code = values[2];
          const name = values[3];
          const designation = values[4];
          const hq = values[5];
          const doj = values[6]; 
          const grossMonthlySalaryStr = values[7];
          
          const grossMonthlySalary = parseFloat(grossMonthlySalaryStr);

          if (!code || !name || !status || isNaN(grossMonthlySalary) || grossMonthlySalary <= 0) {
            console.warn(`Skipping row ${rowIndex + 1} due to invalid critical data (code, name, status, or salary).`);
            return;
          }
          if (status !== "Active" && status !== "Left") {
            console.warn(`Skipping row ${rowIndex + 1} due to invalid status: ${status}. Must be 'Active' or 'Left'.`);
            return;
          }
          if (codesInCsv.has(code)) {
            console.warn(`Skipping row ${rowIndex + 1} (Code: ${code}) due to duplicate code within CSV.`);
            skippedForDuplicateInCsv++;
            return;
          }
          if (currentEmployeesMap.has(code)) {
            console.warn(`Skipping row ${rowIndex + 1} (Code: ${code}) as code already exists in master list.`);
            skippedForExistingInDb++;
            return;
          }
          codesInCsv.add(code);

          let formattedDoj = doj;
          if (doj && !/^\d{4}-\d{2}-\d{2}$/.test(doj)) {
             try {
                const d = new Date(doj); 
                if (isValid(d)) formattedDoj = format(d, 'yyyy-MM-dd');
             } catch {}
          }

          uploadedEmployees.push({
            id: code, status, division, code, name, designation, hq, doj: formattedDoj, grossMonthlySalary,
          });
        });

        if (uploadedEmployees.length === 0 && (skippedForDuplicateInCsv > 0 || skippedForExistingInDb > 0)) {
             toast({ title: "No New Employees Added", description: `All rows skipped. ${skippedForDuplicateInCsv} duplicate(s) in CSV, ${skippedForExistingInDb} already in master.`, variant: "destructive", duration: 7000});
             return;
        }
        if (uploadedEmployees.length === 0) {
          toast({ title: "No Valid Data Processed", description: "No valid new employee data found in the file. Check columns and formats.", variant: "destructive"});
          return;
        }
        
        const combinedEmployees = [...employees, ...uploadedEmployees];
        setEmployees(combinedEmployees); 
        saveEmployeesToLocalStorage(combinedEmployees);

        let successMessage = `${uploadedEmployees.length} new employee(s) added from ${file.name}.`;
        if (skippedForDuplicateInCsv > 0) successMessage += ` ${skippedForDuplicateInCsv} row(s) skipped due to duplicate codes in CSV.`;
        if (skippedForExistingInDb > 0) successMessage += ` ${skippedForExistingInDb} row(s) skipped as codes already exist.`;
        toast({
          title: "Employees Processed",
          description: successMessage,
          duration: 7000,
        });

      } catch (error) {
        console.error("Error parsing CSV for employees:", error);
        toast({ title: "Parsing Error", description: "Could not parse the CSV file. Please check its format and column order.", variant: "destructive" });
      }
    };
    reader.onerror = () => {
      toast({ title: "File Read Error", description: "An error occurred while trying to read the file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleTemplate = () => {
    const headers = ["Status", "Division", "Code", "Name", "Designation", "HQ", "DOJ", "GrossMonthlySalary"];
    const sampleData = [
      ["Active", "Marketing", "E006", "Sarah Lee", "Marketing Specialist", "Chicago", "2024-01-10", "62000"],
      ["Left", "IT", "E007", "Tom Brown", "IT Support", "Austin", "2023-11-05", "55000"],
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
    return employees.filter(employee => {
        const searchTerm = filterTerm.toLowerCase();
        return (
          employee.code.toLowerCase().includes(searchTerm) ||
          employee.name.toLowerCase().includes(searchTerm) ||
          (employee.division && employee.division.toLowerCase().includes(searchTerm)) ||
          (employee.designation && employee.designation.toLowerCase().includes(searchTerm))
        );
      });
  }, [employees, filterTerm]);

  const employeeCounts = React.useMemo(() => {
    const activeCount = employees.filter(emp => emp.status === "Active").length;
    const leftCount = employees.filter(emp => emp.status === "Left").length;
    return { activeCount, leftCount };
  }, [employees]);

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
        description="View, add, or bulk upload employee master data. Columns: Status, Division, Code, Name, Designation, HQ, DOJ, Gross Salary."
      >
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
                    <FormField control={form.control} name="doj" render={({ field }) => (
                    <FormItem><FormLabel>Date of Joining</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
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
                    )}
                    />
                    <FormField control={form.control} name="division" render={({ field }) => (
                    <FormItem><FormLabel>Division</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="hq" render={({ field }) => (
                    <FormItem><FormLabel>HQ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                Displaying {filteredEmployees.length} of {employees.length} total employees
                ({employeeCounts.activeCount} Active, {employeeCounts.leftCount} Left).
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter by Code, Name, Division..."
                className="pl-8"
                value={filterTerm}
                onChange={(e) => setFilterTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[120px]">Division</TableHead>
                <TableHead className="min-w-[80px]">Code</TableHead>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[150px]">Designation</TableHead>
                <TableHead className="min-w-[120px]">HQ</TableHead>
                <TableHead className="min-w-[100px]">DOJ</TableHead>
                <TableHead className="min-w-[150px] text-right">Gross Salary (₹)</TableHead>
                <TableHead className="text-center min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
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
                            const parts = employee.doj.split(/[-/]/);
                            let reparsedDate = null;
                            if (parts.length === 3) {
                                // Attempt common non-ISO formats like dd-MM-yyyy or MM-dd-yyyy
                                if (parseInt(parts[2]) > 1000) { // Likely yyyy is last
                                     reparsedDate = parseISO(`${parts[2]}-${parts[1]}-${parts[0]}`); // dd-MM-yyyy
                                     if(!isValid(reparsedDate)) reparsedDate = parseISO(`${parts[2]}-${parts[0]}-${parts[1]}`); // MM-dd-yyyy
                                } else if (parseInt(parts[0]) > 1000) { // Likely yyyy is first (already ISO-like)
                                     reparsedDate = parseISO(employee.doj);
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd MMM yyyy");
                            return employee.doj; // Fallback to original string if still not parsable
                          }
                          return format(parsedDate, "dd MMM yyyy");
                        } catch (e) {
                          return employee.doj; // Fallback on any error
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
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployee(employee.id)} className="text-destructive hover:text-destructive/80" title="Delete this employee">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {filterTerm ? "No employees match your filter." : "No employee data available. Use 'Add New Employee' or 'Upload Employees'."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
