
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Download, Edit, Save, Trash2 } from "lucide-react";

const manualSalarySchema = z.object({
  code: z.string().min(1, "Employee code is required"),
  name: z.string().min(1, "Employee name is required"),
  designation: z.string().min(1, "Designation is required"),
  doj: z.string().min(1, "Date of Joining is required"), // Consider using a date picker
  grossMonthlySalary: z.coerce.number().positive("Gross salary must be positive"),
});

type ManualSalaryFormValues = z.infer<typeof manualSalarySchema>;

interface SalaryStructure extends ManualSalaryFormValues {
  id: string;
  basic: number;
  hra: number;
  ca: number;
  medical: number;
  otherAllowance: number;
  totalGross: number; // Should match grossMonthlySalary
}

const sampleSavedSalaries: SalaryStructure[] = [
  { id: "S001", code: "E001", name: "John Doe", designation: "Software Engineer", doj: "2022-01-15", grossMonthlySalary: 60000, basic: 15010, hra: 22495, ca: 8998, medical: 6748.5, otherAllowance: 6748.5, totalGross: 60000},
  { id: "S002", code: "E002", name: "Jane Smith", designation: "Project Manager", doj: "2021-05-20", grossMonthlySalary: 80000, basic: 15010, hra: 32495, ca: 12998, medical: 9748.5, otherAllowance: 9748.5, totalGross: 80000 },
];

export default function SalarySetupPage() {
  const { toast } = useToast();
  const [savedSalaries, setSavedSalaries] = React.useState<SalaryStructure[]>(sampleSavedSalaries);
  const [editingSalary, setEditingSalary] = React.useState<SalaryStructure | null>(null);

  const form = useForm<ManualSalaryFormValues>({
    resolver: zodResolver(manualSalarySchema),
    defaultValues: {
      code: "",
      name: "",
      designation: "",
      doj: "",
      grossMonthlySalary: 0,
    },
  });
  
  React.useEffect(() => {
    if (editingSalary) {
      form.reset(editingSalary);
    } else {
      form.reset({ code: "", name: "", designation: "", doj: "", grossMonthlySalary: 0 });
    }
  }, [editingSalary, form]);


  const handleFileUpload = (file: File) => {
    toast({
      title: "File Uploaded",
      description: `${file.name} for salary setup is being processed. (Prototype: File content not parsed)`,
    });
  };

  const calculateSalaryComponents = (grossMonthlySalary: number) => {
    const basic = 15010;
    const remainingAmount = Math.max(0, grossMonthlySalary - basic);
    const hra = remainingAmount * 0.50;
    const ca = remainingAmount * 0.20;
    const medical = remainingAmount * 0.15;
    const otherAllowance = remainingAmount * 0.15; // Ensures sum is 100% of remaining
    return { basic, hra, ca, medical, otherAllowance, totalGross: grossMonthlySalary };
  };

  function onSubmit(values: ManualSalaryFormValues) {
    const components = calculateSalaryComponents(values.grossMonthlySalary);
    const newSalary: SalaryStructure = {
      id: editingSalary ? editingSalary.id : `S${Date.now().toString().slice(-4)}`,
      ...values,
      ...components,
    };

    if (editingSalary) {
      setSavedSalaries(prev => prev.map(s => s.id === editingSalary.id ? newSalary : s));
      toast({ title: "Success", description: "Salary structure updated." });
    } else {
      setSavedSalaries(prev => [...prev, newSalary]);
      toast({ title: "Success", description: "Salary structure saved." });
    }
    setEditingSalary(null);
    form.reset();
  }

  const handleEdit = (salary: SalaryStructure) => {
    setEditingSalary(salary);
    // Switch to manual entry tab if not already there
    const manualTabTrigger = document.querySelector('[data-state="inactive"][role="tab"][value="manual"]');
    if (manualTabTrigger) (manualTabTrigger as HTMLElement).click();
  };

  const handleDelete = (salaryId: string) => {
    setSavedSalaries(prev => prev.filter(s => s.id !== salaryId));
    toast({ title: "Deleted", description: "Salary structure removed." });
  };

  const grossSalary = form.watch("grossMonthlySalary");
  const calculatedComponents = React.useMemo(() => {
    if (grossSalary && grossSalary > 0) {
      return calculateSalaryComponents(grossSalary);
    }
    return { basic: 0, hra: 0, ca: 0, medical: 0, otherAllowance: 0, totalGross: 0 };
  }, [grossSalary]);


  return (
    <>
      <PageHeader title="Salary Preparation" description="Setup employee salary structures."/>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] print:hidden">
          <TabsTrigger value="excel">Upload via Excel</TabsTrigger>
          <TabsTrigger value="manual">Manual Salary Entry</TabsTrigger>
        </TabsList>
        <TabsContent value="excel">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Upload Salary Data</CardTitle>
              <CardDescription>Upload an Excel file with employee salary details.
                Columns: Code, Name, Designation, DOJ, GrossSalary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUploadButton onFileUpload={handleFileUpload} buttonText="Upload Salary Excel" acceptedFileTypes=".xlsx,.xls,.csv"/>
              <Button variant="link" className="p-0 h-auto" onClick={() => toast({title: "Prototype Info", description: "Sample Excel template download not yet implemented."})}>
                <Download className="mr-2 h-4 w-4" /> Download Sample Excel Template
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manual">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>{editingSalary ? "Edit Salary Structure" : "Enter Salary Details Manually"}</CardTitle>
              <CardDescription>Fill in the form to add or update an employee's salary.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <FormField control={form.control} name="grossMonthlySalary" render={({ field }) => (
                      <FormItem><FormLabel>Gross Monthly Salary (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  
                  {grossSalary > 0 && (
                    <Card className="mt-4 bg-muted/50">
                      <CardHeader><CardTitle className="text-lg">Calculated Components</CardTitle></CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div><Label>Basic Salary:</Label> <p>₹{calculatedComponents.basic.toFixed(2)}</p></div>
                        <div><Label>HRA:</Label> <p>₹{calculatedComponents.hra.toFixed(2)}</p></div>
                        <div><Label>Conveyance Allowance:</Label> <p>₹{calculatedComponents.ca.toFixed(2)}</p></div>
                        <div><Label>Medical Allowance:</Label> <p>₹{calculatedComponents.medical.toFixed(2)}</p></div>
                        <div><Label>Other Allowance:</Label> <p>₹{calculatedComponents.otherAllowance.toFixed(2)}</p></div>
                        <div className="font-semibold"><Label>Total Gross:</Label> <p>₹{calculatedComponents.totalGross.toFixed(2)}</p></div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex justify-end gap-2">
                    {editingSalary && <Button type="button" variant="outline" onClick={() => { setEditingSalary(null); form.reset(); }}>Cancel Edit</Button>}
                    <Button type="submit">
                      <Save className="mr-2 h-4 w-4" /> {editingSalary ? "Update Salary" : "Save Salary"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-8 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Saved Salary Structures</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead className="text-right">Gross (₹)</TableHead>
                <TableHead className="text-right">Basic (₹)</TableHead>
                <TableHead className="text-right">HRA (₹)</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savedSalaries.map((salary) => (
                <TableRow key={salary.id}>
                  <TableCell>{salary.code}</TableCell>
                  <TableCell>{salary.name}</TableCell>
                  <TableCell>{salary.designation}</TableCell>
                  <TableCell className="text-right">{salary.grossMonthlySalary.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{salary.basic.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{salary.hra.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(salary)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(salary.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
               {savedSalaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">No salary structures saved yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
