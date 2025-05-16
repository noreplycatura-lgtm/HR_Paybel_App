
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
import { useEditorAuth } from "@/hooks/useEditorAuth";
import { format } from "date-fns";
import { FileUploadButton } from "@/components/shared/file-upload-button";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";

const employeeFormSchema = z.object({
  code: z.string().min(1, "Employee code is required"),
  name: z.string().min(1, "Employee name is required"),
  designation: z.string().min(1, "Designation is required"),
  doj: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Valid date is required"}),
  status: z.enum(["Active", "Left"], { required_error: "Status is required" }),
  division: z.string().min(1, "Division is required"),
  grossMonthlySalary: z.coerce.number().positive({ message: "Gross salary must be a positive number" }),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export default function EmployeeMasterPage() {
  const { toast } = useToast();
  const { isEditor, isLoadingAuth } = useEditorAuth();
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
        }
      } catch (error) {
        console.error("Error loading employees from localStorage:", error);
        setEmployees(sampleEmployees); 
        toast({ title: "Data Load Error", description: "Could not load employee data. Using defaults.", variant: "destructive" });
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
    if (!isEditor) {
        toast({ title: "Permission Denied", description: "Login as editor to add employees.", variant: "destructive"});
        return;
    }
    const newEmployee: EmployeeDetail = {
      id: `E${Date.now().toString().slice(-4)}`, 
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
    if (!isEditor) {
      toast({ title: "Permission Denied", description: "Login as editor to upload employees.", variant: "destructive" });
      return;
    }
    toast({
      title: "File Received",
      description: `${file.name} received. (Prototype: Full CSV parsing not yet implemented for Employee Master).`,
    });
  };
  
  const handleDownloadSampleTemplate = () => {
    const headers = ["Code", "Name", "Designation", "DOJ", "Status", "Division", "GrossMonthlySalary"];
    const sampleData = [
      ["E006", "Sarah Lee", "Marketing Specialist", "2024-01-10", "Active", "Marketing", "62000"],
      ["E007", "Tom Brown", "IT Support", "2023-11-05", "Left", "IT", "55000"],
    ];
    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\\n');
    
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
    if (!isEditor) {
      toast({ title: "Permission Denied", description: "Login as editor to edit employees.", variant: "destructive" });
      return;
    }
    toast({
      title: "Prototype Action",
      description: `Editing employee ${employeeId} is not yet implemented.`,
    });
  };

  const handleDeleteEmployee = (employeeId: string) => {
    if (!isEditor) {
      toast({ title: "Permission Denied", description: "Login as editor to delete employees.", variant: "destructive" });
      return;
    }
    toast({
      title: "Prototype Action",
      description: `Deleting employee ${employeeId} is not yet implemented. (Data is from localStorage/sample)`,
      variant: "destructive"
    });
  };

  if (isLoadingAuth || isLoadingData) {
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
        description="View, add, or bulk upload employee master data. Includes status, division, and gross salary."
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={isLoadingAuth || !isEditor} title={!isEditor ? "Login as editor to add new employee" : "Add a new employee to the master list"}>
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
                 <fieldset disabled={isLoadingAuth || !isEditor} className="space-y-4" title={!isEditor ? "Login as editor to make changes" : ""}>
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
                    <FormField control={form.control} name="grossMonthlySalary" render={({ field }) => (
                    <FormItem><FormLabel>Gross Monthly Salary (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                 </fieldset>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isLoadingAuth || !isEditor} title={!isEditor ? "Login as editor to save employee" : "Save this new employee"}>Save Employee</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        <FileUploadButton
            onFileUpload={handleUploadEmployees}
            buttonText="Upload Employees (CSV)"
            acceptedFileTypes=".csv"
            disabled={isLoadingAuth || !isEditor}
            title={!isEditor ? "Login as editor to upload" : "Upload employee data from a CSV file"}
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
            Displaying all employees. Status, Division and Gross Salary are key fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[80px]">Code</TableHead>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[150px]">Designation</TableHead>
                <TableHead className="min-w-[100px]">DOJ</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[120px]">Division</TableHead>
                <TableHead className="min-w-[150px] text-right">Gross Salary (₹)</TableHead>
                <TableHead className="text-center min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.code}</TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.designation}</TableCell>
                  <TableCell>{employee.doj ? format(new Date(employee.doj), "dd MMM yyyy") : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={employee.status === "Active" ? "default" : "secondary"}>
                      {employee.status || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell>{employee.division || "N/A"}</TableCell>
                  <TableCell className="text-right">{employee.grossMonthlySalary ? employee.grossMonthlySalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(employee.id)} disabled={isLoadingAuth || !isEditor} title={!isEditor ? "Login as editor to edit" : "Edit this employee's details"}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployee(employee.id)} className="text-destructive hover:text-destructive/80" disabled={isLoadingAuth || !isEditor} title={!isEditor ? "Login as editor to delete" : "Delete this employee"}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
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

  
