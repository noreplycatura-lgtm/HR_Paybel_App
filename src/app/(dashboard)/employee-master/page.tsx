
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
import { PlusCircle, Upload, Edit, Trash2, Download, Loader2 } from "lucide-react";
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
      return isValid(parseISO(val));
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
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);

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
    const newEmployee: EmployeeDetail = {
      id: values.code, 
      ...values,
    };
    const updatedEmployees = [...employees, newEmployee];
    setEmployees(updatedEmployees);
    saveEmployeesToLocalStorage(updatedEmployees);
    toast({ title: "Employee Added", description: `${values.name} has been added to the master list.` });
    setIsDialogOpen(false);
    form.reset();
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

        const newEmployees: EmployeeDetail[] = dataRows.map((row, rowIndex) => {
          const values = row.split(',').map(v => v.trim());
          if (values.length < expectedColumns) {
            console.warn(`Skipping row ${rowIndex + 1} due to insufficient columns. Expected ${expectedColumns}, got ${values.length}`);
            return null;
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
            console.warn(`Skipping row ${rowIndex + 1} due to invalid critical data (code, name, status, or salary). DOJ: ${doj}`);
            return null;
          }
          if (status !== "Active" && status !== "Left") {
            console.warn(`Skipping row ${rowIndex + 1} due to invalid status: ${status}. Must be 'Active' or 'Left'.`);
            return null;
          }
          // Basic check for DOJ format from CSV, assuming YYYY-MM-DD. More robust validation can be added.
          let formattedDoj = doj;
          if (doj && !/^\d{4}-\d{2}-\d{2}$/.test(doj)) {
             console.warn(`Row ${rowIndex + 1}: DOJ "${doj}" is not in YYYY-MM-DD format. Attempting to parse. Consider standardizing input.`);
             // Attempt to parse common formats or set as invalid. For now, keep original for parseISO to handle.
          }


          return {
            id: code, 
            status,
            division,
            code,
            name,
            designation,
            hq,
            doj: formattedDoj,
            grossMonthlySalary,
          };
        }).filter(item => item !== null) as EmployeeDetail[];

        if (newEmployees.length === 0) {
          toast({ title: "No Data Processed", description: "No valid employee data found in the file. Check column count, format, and required fields.", variant: "destructive"});
          return;
        }

        setEmployees(newEmployees); 
        saveEmployeesToLocalStorage(newEmployees);
        toast({
          title: "Employees Uploaded",
          description: `${newEmployees.length} employee records processed from ${file.name}.`,
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


  const handleEditEmployee = (employeeId: string) => {
    toast({
      title: "Prototype Action",
      description: `Editing employee ${employeeId} is not yet implemented.`,
    });
  };

  const handleDeleteEmployee = (employeeId: string) => {
    const employeeToDelete = employees.find(emp => emp.id === employeeId);
    const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
    setEmployees(updatedEmployees);
    saveEmployeesToLocalStorage(updatedEmployees);
    toast({
      title: "Employee Removed",
      description: `${employeeToDelete?.name || `Employee ID ${employeeId}`} has been removed from the list.`,
      variant: "destructive"
    });
  };

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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" title="Add a new employee to the master list">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>
                Fill in the details for the new employee. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                 <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem><FormLabel>Employee Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Button type="submit" title="Save this new employee">Save Employee</Button>
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
          <CardTitle>Employee List</CardTitle>
          <CardDescription>
            Displaying all employees. Key fields include Status, Division, HQ, and Gross Salary.
          </CardDescription>
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
              {employees.map((employee) => (
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
                          // Check if parseISO resulted in a valid date
                          if (!isValid(parsedDate)) { 
                            // console.warn(`Invalid DOJ string encountered: ${employee.doj}`);
                            return employee.doj; // Show original string if parseISO deems it invalid
                          }
                          return format(parsedDate, "dd MMM yyyy");
                        } catch (e) {
                          // console.warn(`Error formatting DOJ: ${employee.doj}`, e);
                          return employee.doj; // Show original string if any error during parsing/formatting
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
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No employee data available. Use 'Add New Employee' or 'Upload Employees'.
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

    

    