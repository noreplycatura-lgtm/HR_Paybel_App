
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Upload, Trash2, Download, Edit } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { format, parseISO, isValid } from "date-fns";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "novita_performance_deductions_v1";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface PerformanceDeductionEntry {
  id: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  month: string;
  year: number;
  amount: number;
}

const deductionFormSchema = z.object({
  employeeCode: z.string().min(1, "Employee selection is required."),
  month: z.string().min(1, "Month is required."),
  year: z.coerce.number().gt(1900, "Year is required."),
  amount: z.coerce.number().positive({ message: "Deduction amount must be a positive number." }),
});

type DeductionFormValues = z.infer<typeof deductionFormSchema>;

export default function PerformanceDeductionPage() {
  const { toast } = useToast();
  const [employeeMasterList, setEmployeeMasterList] = React.useState<EmployeeDetail[]>([]);
  const [performanceDeductions, setPerformanceDeductions] = React.useState<PerformanceDeductionEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deductionToDelete, setDeductionToDelete] = React.useState<PerformanceDeductionEntry | null>(null);
  const [selectedDeductionIds, setSelectedDeductionIds] = React.useState<Set<string>>(new Set());
  const [isDeleteSelectedDialogOpen, setIsDeleteSelectedDialogOpen] = React.useState(false);
  
  const [currentActionYear, setCurrentActionYear] = React.useState<number>(new Date().getFullYear());


  const form = useForm<DeductionFormValues>({
    resolver: zodResolver(deductionFormSchema),
    defaultValues: {
      employeeCode: "",
      month: months[new Date().getMonth()],
      year: new Date().getFullYear(),
      amount: 0,
    },
  });
  
  React.useEffect(() => {
    setIsLoadingData(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployees) {
          const parsed = JSON.parse(storedEmployees);
          setEmployeeMasterList(Array.isArray(parsed) ? parsed : []);
        } else {
           setEmployeeMasterList([]);
           toast({ title: "Employee Data Missing", description: "Employee master data not found. Please add employees in Employee Master.", variant: "destructive", duration: 7000 });
        }
        const storedDeductions = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
        if (storedDeductions) {
          const parsedDeductions = JSON.parse(storedDeductions);
          setPerformanceDeductions(Array.isArray(parsedDeductions) ? parsedDeductions : []);
        } else {
          setPerformanceDeductions([]);
        }
      } catch (error) {
        console.error("Error loading data for performance deduction page:", error);
        toast({ title: "Data Load Error", description: "Could not load initial data.", variant: "destructive" });
        setEmployeeMasterList([]);
        setPerformanceDeductions([]);
      }
    }
    setIsLoadingData(false);
  }, [toast]);

  const saveDeductionsToLocalStorage = (deductions: PerformanceDeductionEntry[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY, JSON.stringify(deductions));
      } catch (error) {
        console.error("Error saving performance deductions:", error);
        toast({ title: "Storage Error", description: "Could not save deductions.", variant: "destructive" });
      }
    }
  };

  const handleSaveDeduction = (values: DeductionFormValues) => {
    setIsSaving(true);
    const selectedEmployee = employeeMasterList.find(emp => emp.code === values.employeeCode);
    if (!selectedEmployee) {
      toast({ title: "Error", description: "Selected employee not found.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    const newDeduction: PerformanceDeductionEntry = {
      id: `${values.employeeCode}-${values.month}-${values.year}`, 
      employeeCode: values.employeeCode,
      employeeName: selectedEmployee.name,
      designation: selectedEmployee.designation,
      month: values.month,
      year: values.year,
      amount: values.amount,
    };

    const updatedDeductions = performanceDeductions.filter(
      d => !(d.employeeCode === newDeduction.employeeCode && d.month === newDeduction.month && d.year === newDeduction.year)
    );
    updatedDeductions.push(newDeduction);
    
    setPerformanceDeductions(updatedDeductions);
    saveDeductionsToLocalStorage(updatedDeductions);
    toast({ title: "Deduction Saved", description: `Performance deduction for ${selectedEmployee.name} for ${values.month} ${values.year} saved.` });
    form.reset({ employeeCode: "", month: months[new Date().getMonth()], year: new Date().getFullYear(), amount: 0 });
    setIsSaving(false);
  };

  const handleDownloadTemplate = () => {
    const headers = ["Code", "Name", "Designation", "Amount", "Month", "Year"];
    const csvRows: string[][] = [headers];

    employeeMasterList.filter(emp => emp.status === "Active").forEach(emp => {
      csvRows.push([`"${emp.code}"`, `"${emp.name}"`, `"${emp.designation}"`, "", "", ""]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "performance_deduction_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: "Performance deduction CSV template downloaded." });
  };

  const handleUploadDeductionsCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error Reading File", description: "Could not read file content.", variant: "destructive" });
        return;
      }
      try {
        const lines = text.split(/\r\n|\n/).map(line => line.trim()).filter(line => line);
        if (lines.length < 2) {
          toast({ title: "Invalid File", description: "File is empty or has no data rows.", variant: "destructive" });
          return;
        }
        const headersFromFile = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/\s+/g, ''));
        const expectedHeaders = ["code", "name", "designation", "amount", "month", "year"];
        const missingHeaders = expectedHeaders.filter(eh => !headersFromFile.includes(eh));
        if (missingHeaders.length > 0) {
          toast({ title: "File Header Error", description: `Missing headers: ${missingHeaders.join(', ')}.`, variant: "destructive", duration: 7000 });
          return;
        }

        const dataRows = lines.slice(1);
        const newUploadedDeductions: PerformanceDeductionEntry[] = [];
        let skippedCount = 0;
        let updatedCount = 0;
        let addedCount = 0;

        dataRows.forEach((row, rowIndex) => {
          const values = row.split(',');
          const code = values[headersFromFile.indexOf("code")]?.trim().replace(/"/g, '');
          const name = values[headersFromFile.indexOf("name")]?.trim().replace(/"/g, ''); 
          const designation = values[headersFromFile.indexOf("designation")]?.trim().replace(/"/g, ''); 
          const amountStr = values[headersFromFile.indexOf("amount")]?.trim();
          const monthStr = values[headersFromFile.indexOf("month")]?.trim();
          const yearStr = values[headersFromFile.indexOf("year")]?.trim();

          const amount = parseFloat(amountStr);
          const year = parseInt(yearStr);

          if (!code || !monthStr || isNaN(year) || year < 1900 || year > 2200 || isNaN(amount) || amount <= 0 || !months.some(m => m.toLowerCase().startsWith(monthStr.toLowerCase().substring(0,3)))) {
            console.warn(`Skipping row ${rowIndex + 1} in CSV: invalid or missing data (Code: ${code}, Amount: ${amountStr}, Month: ${monthStr}, Year: ${yearStr}).`);
            skippedCount++;
            return;
          }
          
          const matchedMonth = months.find(m => m.toLowerCase().startsWith(monthStr.toLowerCase().substring(0,3))) || monthStr;

          const employeeDetails = employeeMasterList.find(emp => emp.code === code);
          if (!employeeDetails) {
            console.warn(`Skipping row ${rowIndex + 1}: Employee code '${code}' not found in master list.`);
            skippedCount++;
            return;
          }

          const deductionEntry: PerformanceDeductionEntry = {
            id: `${code}-${matchedMonth}-${year}`,
            employeeCode: code,
            employeeName: employeeDetails.name, 
            designation: employeeDetails.designation,
            month: matchedMonth,
            year: year,
            amount: amount,
          };
          
          const existingIndex = performanceDeductions.findIndex(d => d.id === deductionEntry.id);
          if (existingIndex > -1) {
            updatedCount++;
          } else {
            addedCount++;
          }
          newUploadedDeductions.push(deductionEntry);
        });

        if (newUploadedDeductions.length > 0) {
          const updatedDeductionsMap = new Map(performanceDeductions.map(d => [d.id, d]));
          newUploadedDeductions.forEach(nd => {
            updatedDeductionsMap.set(nd.id, nd);
          });
          const finalDeductions = Array.from(updatedDeductionsMap.values());
          setPerformanceDeductions(finalDeductions);
          saveDeductionsToLocalStorage(finalDeductions);
          toast({ title: "Deductions Uploaded", description: `${addedCount} added, ${updatedCount} updated. ${skippedCount > 0 ? `${skippedCount} rows skipped.` : ''}` });
        } else {
          toast({ title: "No Valid Data", description: `No valid deduction records found in the uploaded CSV. ${skippedCount > 0 ? `${skippedCount} rows skipped.` : ''}`, variant: "destructive" });
        }

      } catch (error) {
        console.error("Error parsing performance deduction CSV:", error);
        toast({ title: "Parsing Error", description: "Could not parse CSV. Check format and data.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteDeductionClick = (deduction: PerformanceDeductionEntry) => {
    setDeductionToDelete(deduction);
  };

  const confirmDeleteDeduction = () => {
    if (!deductionToDelete) return;
    const updatedDeductions = performanceDeductions.filter(d => d.id !== deductionToDelete.id);
    setPerformanceDeductions(updatedDeductions);
    saveDeductionsToLocalStorage(updatedDeductions);
    toast({ title: "Deduction Deleted", description: `Deduction for ${deductionToDelete.employeeName} for ${deductionToDelete.month} ${deductionToDelete.year} deleted.`, variant: "destructive" });
    setDeductionToDelete(null);
  };

  const handleSelectDeduction = (deductionId: string, checked: boolean) => {
    setSelectedDeductionIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (checked) {
        newSelected.add(deductionId);
      } else {
        newSelected.delete(deductionId);
      }
      return newSelected;
    });
  };

  const handleSelectAllDeductions = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const allVisibleDeductionIds = performanceDeductions.map(d => d.id);
      setSelectedDeductionIds(new Set(allVisibleDeductionIds));
    } else {
      setSelectedDeductionIds(new Set());
    }
  };
  
  const handleDeleteSelectedDeductions = () => {
    if (selectedDeductionIds.size === 0) {
      toast({ title: "No Deductions Selected", description: "Please select deductions to delete.", variant: "destructive" });
      return;
    }
    setIsDeleteSelectedDialogOpen(true);
  };

  const confirmDeleteSelectedDeductions = () => {
    const updatedDeductions = performanceDeductions.filter(d => !selectedDeductionIds.has(d.id));
    setPerformanceDeductions(updatedDeductions);
    saveDeductionsToLocalStorage(updatedDeductions);
    toast({ title: "Deductions Deleted", description: `${selectedDeductionIds.size} deduction(s) deleted.`, variant: "destructive" });
    setSelectedDeductionIds(new Set());
    setIsDeleteSelectedDialogOpen(false);
  };
  
  const availableYears = React.useMemo(() => {
    const currentYr = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYr - i);
  }, []);

  const isAllSelected = performanceDeductions.length > 0 && selectedDeductionIds.size === performanceDeductions.length;
  const isIndeterminate = selectedDeductionIds.size > 0 && selectedDeductionIds.size < performanceDeductions.length;


  if (isLoadingData) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <PageHeader title="Performance Deductions Management" description="Manage employee performance-related salary deductions.">
        <Button
          variant="destructive"
          onClick={handleDeleteSelectedDeductions}
          disabled={selectedDeductionIds.size === 0}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedDeductionIds.size})
        </Button>
      </PageHeader>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Add Performance Deduction</CardTitle>
              <CardDescription>Enter details for a new performance deduction.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveDeduction)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="employeeCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employeeMasterList.filter(emp => emp.status === "Active").map(emp => (
                              <SelectItem key={emp.code} value={emp.code}>
                                {emp.code} - {emp.name} ({emp.designation})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Month</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select Month" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year</FormLabel>
                           <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deduction Amount (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter amount" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Save Deduction
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Upload Deductions via CSV</CardTitle>
              <CardDescription>Columns: Code, Name, Designation, Amount, Month (e.g., Jan), Year (YYYY).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUploadButton
                onFileUpload={handleUploadDeductionsCSV}
                buttonText="Upload Deductions CSV"
                acceptedFileTypes=".csv"
                icon={<Upload className="mr-2 h-4 w-4" />}
              />
              <Button variant="link" onClick={handleDownloadTemplate} className="p-0 h-auto">
                <Download className="mr-2 h-4 w-4" /> Download Sample Template (CSV)
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Saved Performance Deductions</CardTitle>
              <CardDescription>List of all recorded performance deductions.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected ? true : (isIndeterminate ? 'indeterminate' : false)}
                        onCheckedChange={(checkedState) => handleSelectAllDeductions(checkedState as boolean)}
                        aria-label="Select all visible deductions"
                        disabled={performanceDeductions.length === 0}
                      />
                    </TableHead>
                    <TableHead className="min-w-[80px]">Code</TableHead>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="min-w-[150px]">Designation</TableHead>
                    <TableHead className="min-w-[100px]">Period</TableHead>
                    <TableHead className="text-right min-w-[100px]">Amount (₹)</TableHead>
                    <TableHead className="text-center min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceDeductions.length > 0 ? (
                    performanceDeductions.sort((a,b) => b.year - a.year || months.indexOf(b.month) - months.indexOf(a.month)).map((deduction) => (
                      <TableRow key={deduction.id} data-state={selectedDeductionIds.has(deduction.id) ? "selected" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDeductionIds.has(deduction.id)}
                            onCheckedChange={(checked) => handleSelectDeduction(deduction.id, !!checked)}
                            aria-label={`Select deduction for ${deduction.employeeName}`}
                          />
                        </TableCell>
                        <TableCell>{deduction.employeeCode}</TableCell>
                        <TableCell>{deduction.employeeName}</TableCell>
                        <TableCell>{deduction.designation}</TableCell>
                        <TableCell>{deduction.month} {deduction.year}</TableCell>
                        <TableCell className="text-right">{deduction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteDeductionClick(deduction)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No performance deductions recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!deductionToDelete} onOpenChange={(isOpen) => { if(!isOpen) setDeductionToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the performance deduction of ₹{deductionToDelete?.amount.toLocaleString()} for {deductionToDelete?.employeeName} for {deductionToDelete?.month} {deductionToDelete?.year}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeductionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDeduction} variant="destructive">
              Delete Deduction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteSelectedDialogOpen} onOpenChange={setIsDeleteSelectedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedDeductionIds.size} selected performance deduction(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelectedDeductions} variant="destructive">
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    