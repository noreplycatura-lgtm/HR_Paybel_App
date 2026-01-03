"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
import { Loader2, PlusCircle, Upload, Trash2, Download, TrendingDown, Users, IndianRupee, Calendar, AlertTriangle, FileText } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "catura_employee_master_data_v1";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "catura_performance_deductions_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";

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
    orange: { bg: 'bg-orange-50 border-orange-200', icon: 'text-orange-600 bg-orange-100', text: 'text-orange-700' },
    pink: { bg: 'bg-pink-50 border-pink-200', icon: 'text-pink-600 bg-pink-100', text: 'text-pink-700' },
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

export default function PerformanceDeductionPage() {
  const { toast } = useToast();
  const [employeeMasterList, setEmployeeMasterList] = React.useState<EmployeeDetail[]>([]);
  const [performanceDeductions, setPerformanceDeductions] = React.useState<PerformanceDeductionEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deductionToDelete, setDeductionToDelete] = React.useState<PerformanceDeductionEntry | null>(null);
  const [selectedDeductionIds, setSelectedDeductionIds] = React.useState<Set<string>>(new Set());
  const [isDeleteSelectedDialogOpen, setIsDeleteSelectedDialogOpen] = React.useState(false);

  const form = useForm<DeductionFormValues>({
    resolver: zodResolver(deductionFormSchema),
    defaultValues: {
      employeeCode: "",
      month: months[new Date().getMonth()],
      year: new Date().getFullYear(),
      amount: 0,
    },
  });

  // Load data from localStorage
  React.useEffect(() => {
    setIsLoadingData(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        setEmployeeMasterList(storedEmployees ? JSON.parse(storedEmployees) : []);

        const storedDeductions = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
        setPerformanceDeductions(storedDeductions ? JSON.parse(storedDeductions) : []);
      } catch (error) {
        console.error("Error loading data for Performance Deduction page:", error);
        toast({ title: "Storage Error", description: "Could not load initial data.", variant: "destructive" });
        setEmployeeMasterList([]);
        setPerformanceDeductions([]);
      }
    }
    setIsLoadingData(false);
  }, []);

  // Calculate stats
  const deductionStats = React.useMemo(() => {
    const totalAmount = performanceDeductions.reduce((sum, d) => sum + d.amount, 0);
    const uniqueEmployees = new Set(performanceDeductions.map(d => d.employeeCode)).size;
    const currentMonth = months[new Date().getMonth()];
    const currentYear = new Date().getFullYear();
    const thisMonthDeductions = performanceDeductions.filter(
      d => d.month === currentMonth && d.year === currentYear
    );
    const thisMonthTotal = thisMonthDeductions.reduce((sum, d) => sum + d.amount, 0);

    return {
      totalRecords: performanceDeductions.length,
      totalAmount,
      uniqueEmployees,
      thisMonthTotal,
    };
  }, [performanceDeductions]);

  const saveDeductionsToLocalStorage = (deductions: PerformanceDeductionEntry[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY, JSON.stringify(deductions));
      } catch (error) {
        console.error("Error saving performance deductions to localStorage:", error);
        toast({ title: "Storage Error", description: "Could not save performance deductions.", variant: "destructive" });
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

    const uniqueId = `${values.employeeCode}-${values.month}-${values.year}`;

    const newDeduction: PerformanceDeductionEntry = {
      id: uniqueId,
      employeeCode: values.employeeCode,
      employeeName: selectedEmployee.name,
      designation: selectedEmployee.designation,
      month: values.month,
      year: values.year,
      amount: values.amount,
    };

    let updatedDeductions;
    const existingIndex = performanceDeductions.findIndex(d => d.id === uniqueId);
    if (existingIndex > -1) {
      updatedDeductions = performanceDeductions.map((d, i) => i === existingIndex ? newDeduction : d);
      addActivityLog(`Performance deduction for ${selectedEmployee.name} (${values.month} ${values.year}) updated to ${values.amount}.`);
    } else {
      updatedDeductions = [...performanceDeductions, newDeduction];
      addActivityLog(`Performance deduction of ${values.amount} for ${selectedEmployee.name} (${values.month} ${values.year}) added.`);
    }

    setPerformanceDeductions(updatedDeductions);
    saveDeductionsToLocalStorage(updatedDeductions);
    toast({ title: "✅ Deduction Saved", description: `Performance deduction for ${selectedEmployee.name} saved.` });
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
    reader.onload = async (e) => {
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
          const amountStr = values[headersFromFile.indexOf("amount")]?.trim();
          const monthStr = values[headersFromFile.indexOf("month")]?.trim();
          const yearStr = values[headersFromFile.indexOf("year")]?.trim();

          const amount = parseFloat(amountStr);
          const year = parseInt(yearStr);

          if (!code || !monthStr || isNaN(year) || year < 1900 || year > 2200 || isNaN(amount) || amount <= 0 || !months.some(m => m.toLowerCase().startsWith(monthStr.toLowerCase().substring(0, 3)))) {
            console.warn(`Skipping row ${rowIndex + 1} in CSV: invalid or missing data.`);
            skippedCount++;
            return;
          }

          const matchedMonth = months.find(m => m.toLowerCase().startsWith(monthStr.toLowerCase().substring(0, 3))) || monthStr;
          const employeeDetails = employeeMasterList.find(emp => emp.code === code);
          if (!employeeDetails) {
            console.warn(`Skipping row ${rowIndex + 1}: Employee code '${code}' not found.`);
            skippedCount++;
            return;
          }

          const deductionId = `${code}-${matchedMonth}-${year}`;
          const deductionEntry: PerformanceDeductionEntry = {
            id: deductionId,
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
          addActivityLog(`Performance deductions CSV uploaded: ${file.name} (${addedCount} added, ${updatedCount} updated).`);
          toast({ title: "✅ Deductions Uploaded", description: `${addedCount} added, ${updatedCount} updated. ${skippedCount > 0 ? `${skippedCount} rows skipped.` : ''}` });
        } else {
          toast({ title: "No Valid Data", description: `No valid deduction records found. ${skippedCount > 0 ? `${skippedCount} rows skipped.` : ''}`, variant: "destructive" });
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
    addActivityLog(`Performance deduction for ${deductionToDelete.employeeName} (${deductionToDelete.month} ${deductionToDelete.year}) deleted.`);
    toast({ title: "Deduction Deleted", description: `Deduction for ${deductionToDelete.employeeName} deleted.`, variant: "destructive" });
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
    addActivityLog(`${selectedDeductionIds.size} performance deduction(s) deleted.`);
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

  // Loading State
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-pink-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading Performance Deductions...</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN JSX RETURN ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-pink-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <TrendingDown className="h-7 w-7" />
                Performance Deductions
              </h1>
              <p className="text-pink-100 text-sm">Manage employee performance-related salary deductions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={handleDeleteSelectedDeductions}
                disabled={selectedDeductionIds.size === 0}
                className="bg-red-500 hover:bg-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedDeductionIds.size})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Deductions"
          value={deductionStats.totalRecords}
          icon={FileText}
          color="blue"
          subtitle="All records"
        />
        <StatCard
          title="Total Amount"
          value={`₹${deductionStats.totalAmount.toLocaleString('en-IN')}`}
          icon={IndianRupee}
          color="red"
          subtitle="All time"
        />
        <StatCard
          title="Employees Affected"
          value={deductionStats.uniqueEmployees}
          icon={Users}
          color="purple"
          subtitle="Unique employees"
        />
        <StatCard
          title="This Month"
          value={`₹${deductionStats.thisMonthTotal.toLocaleString('en-IN')}`}
          icon={Calendar}
          color="pink"
          subtitle={months[new Date().getMonth()]}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Add Form & Upload */}
        <div className="lg:col-span-1 space-y-6">
          {/* Add Deduction Form */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-t-lg border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <PlusCircle className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Add Deduction</CardTitle>
                  <CardDescription>Enter new performance deduction</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
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
                            <SelectTrigger className="border-gray-300">
                              <SelectValue placeholder="Select Employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employeeMasterList.filter(emp => emp.status === "Active").map(emp => (
                              <SelectItem key={emp.code} value={emp.code}>
                                {emp.code} - {emp.name}
                              </SelectItem>
                            ))}
                            {employeeMasterList.length === 0 && <SelectItem value="" disabled>No employees loaded</SelectItem>}
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
                              <SelectTrigger className="border-gray-300"><SelectValue placeholder="Month" /></SelectTrigger>
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
                              <SelectTrigger className="border-gray-300"><SelectValue placeholder="Year" /></SelectTrigger>
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
                          <Input type="number" placeholder="Enter amount" {...field} className="border-gray-300" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSaving} className="w-full bg-pink-600 hover:bg-pink-700">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Save Deduction
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Upload CSV Card */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <Upload className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Upload via CSV</CardTitle>
                  <CardDescription>Bulk upload deductions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FileUploadButton
                onFileUpload={handleUploadDeductionsCSV}
                buttonText="Upload Deductions CSV"
                acceptedFileTypes=".csv"
                icon={<Upload className="mr-2 h-4 w-4" />}
                variant="outline"
                className="w-full"
              />
              <Button variant="ghost" onClick={handleDownloadTemplate} className="w-full text-pink-600 hover:text-pink-700 hover:bg-pink-50">
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-medium mb-1">📋 CSV Format:</p>
                <p>Code, Name, Designation, Amount, Month, Year</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Deductions Table */}
        <div className="lg:col-span-2">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-pink-600" />
                Saved Performance Deductions
              </CardTitle>
              <CardDescription>
                {performanceDeductions.length} deduction records stored locally
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected ? true : (isIndeterminate ? 'indeterminate' : false)}
                          onCheckedChange={(checkedState) => handleSelectAllDeductions(checkedState as boolean)}
                          aria-label="Select all deductions"
                          disabled={performanceDeductions.length === 0}
                        />
                      </TableHead>
                      <TableHead className="font-semibold">Code</TableHead>
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Designation</TableHead>
                      <TableHead className="font-semibold">Period</TableHead>
                      <TableHead className="text-right font-semibold">Amount (₹)</TableHead>
                      <TableHead className="text-center font-semibold w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceDeductions.length > 0 ? (
                      performanceDeductions
                        .sort((a, b) => b.year - a.year || months.indexOf(b.month) - months.indexOf(a.month))
                        .map((deduction) => (
                          <TableRow key={deduction.id} className="hover:bg-pink-50/50" data-state={selectedDeductionIds.has(deduction.id) ? "selected" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedDeductionIds.has(deduction.id)}
                                onCheckedChange={(checked) => handleSelectDeduction(deduction.id, !!checked)}
                                aria-label={`Select deduction for ${deduction.employeeName}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-pink-600">{deduction.employeeCode}</TableCell>
                            <TableCell className="font-medium">{deduction.employeeName}</TableCell>
                            <TableCell>{deduction.designation}</TableCell>
                            <TableCell>
                              <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                                {deduction.month.substring(0, 3)} {deduction.year}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-red-600">
                              ₹{deduction.amount.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteDeductionClick(deduction)}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <AlertTriangle className="h-12 w-12 text-gray-300" />
                            <p className="text-gray-500 font-medium">No performance deductions recorded</p>
                            <p className="text-gray-400 text-sm">Add deductions using the form or upload CSV</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ==================== DIALOGS ==================== */}

      {/* Delete Single Deduction Dialog */}
      <AlertDialog open={!!deductionToDelete} onOpenChange={(isOpen) => { if (!isOpen) setDeductionToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the performance deduction of <span className="font-semibold">₹{deductionToDelete?.amount.toLocaleString()}</span> for <span className="font-semibold">{deductionToDelete?.employeeName}</span> ({deductionToDelete?.month} {deductionToDelete?.year})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeductionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDeduction} className="bg-red-600 hover:bg-red-700">
              Delete Deduction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Multiple Deductions Dialog */}
      <AlertDialog open={isDeleteSelectedDialogOpen} onOpenChange={setIsDeleteSelectedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{selectedDeductionIds.size}</span> selected performance deduction(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelectedDeductions} className="bg-red-600 hover:bg-red-700">
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}