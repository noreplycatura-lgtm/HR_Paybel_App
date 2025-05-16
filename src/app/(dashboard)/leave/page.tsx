
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, Edit, PlusCircle, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, getYear, getMonth, isValid, startOfMonth, addDays as dateFnsAddDays, differenceInCalendarDays, endOfMonth, isBefore } from 'date-fns';
import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateEmployeeLeaveDetailsForPeriod } from "@/lib/hr-calculations";
import type { LeaveApplication, LeaveType, OpeningLeaveBalance } from "@/lib/hr-types";
import { FileUploadButton } from "@/components/shared/file-upload-button";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1"; 
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";


const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface LeaveDisplayData extends EmployeeDetail {
  usedCLInMonth: number;
  usedSLInMonth: number;
  usedPLInMonth: number;
  balanceCLAtMonthEnd: number;
  balanceSLAtMonthEnd: number;
  balancePLAtMonthEnd: number;
  isPLEligibleThisMonth: boolean;
}

export default function LeavePage() {
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<EmployeeDetail[]>([]);
  const [leaveApplications, setLeaveApplications] = React.useState<LeaveApplication[]>([]); 
  const [openingBalances, setOpeningBalances] = React.useState<OpeningLeaveBalance[]>([]);
  
  const [currentYearState, setCurrentYearState] = React.useState(0);
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  
  const [displayData, setDisplayData] = React.useState<LeaveDisplayData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<Set<string>>(new Set());

  const [isEditOpeningBalanceDialogOpen, setIsEditOpeningBalanceDialogOpen] = React.useState(false);
  const [editingEmployeeForOB, setEditingEmployeeForOB] = React.useState<EmployeeDetail | null>(null);
  const [editingOBYear, setEditingOBYear] = React.useState<number>(0); 
  const [editableOB_CL, setEditableOB_CL] = React.useState<number>(0);
  const [editableOB_SL, setEditableOB_SL] = React.useState<number>(0);
  const [editableOB_PL, setEditableOB_PL] = React.useState<number>(0);


  React.useEffect(() => {
    const now = new Date();
    setCurrentYearState(now.getFullYear());
    setSelectedMonth(months[now.getMonth()]);
    setSelectedYear(now.getFullYear());
  }, []);

  React.useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployees) {
          setEmployees(JSON.parse(storedEmployees));
        } else {
          setEmployees([]); 
          toast({ title: "No Employee Data", description: "Employee master data not found. Please set up employees first.", variant: "destructive" });
        }

        const storedLeaveApplications = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedLeaveApplications) {
          setLeaveApplications(JSON.parse(storedLeaveApplications));
        } else {
          setLeaveApplications([]); 
        }

        const storedOpeningBalances = localStorage.getItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
        if (storedOpeningBalances) {
            setOpeningBalances(JSON.parse(storedOpeningBalances));
        } else {
            setOpeningBalances([]);
        }

      } catch (error) {
        console.error("Error loading data from localStorage:", error);
        toast({ title: "Data Load Error", description: "Could not load data from local storage.", variant: "destructive" });
        setEmployees([]);
        setLeaveApplications([]);
        setOpeningBalances([]);
      }
    }
  }, [toast]);

  React.useEffect(() => {
    if (!selectedMonth || !selectedYear || selectedYear === 0 || employees.length === 0) {
      setDisplayData([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true); 
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) {
      setDisplayData([]);
      setIsLoading(false);
      return;
    }

    const newDisplayData = employees
      .filter(emp => emp.status === "Active") 
      .map(emp => {
        const leaveDetails = calculateEmployeeLeaveDetailsForPeriod(emp, selectedYear, monthIndex, leaveApplications, openingBalances);
        return {
          ...emp,
          ...leaveDetails,
        };
    });
    setDisplayData(newDisplayData);
    setSelectedEmployeeIds(new Set()); 
    setIsLoading(false);
  }, [employees, leaveApplications, openingBalances, selectedMonth, selectedYear]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const allActiveEmployeeIds = displayData.map(emp => emp.id);
      setSelectedEmployeeIds(new Set(allActiveEmployeeIds));
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
  
  const handleOpenEditOpeningBalanceDialog = (employee: EmployeeDetail) => {
    setEditingEmployeeForOB(employee);
    const currentFinancialYearStart = selectedMonth && months.indexOf(selectedMonth) >=3 ? selectedYear : selectedYear -1;
    setEditingOBYear(currentFinancialYearStart);

    const existingOB = openingBalances.find(
      (ob) => ob.employeeCode === employee.code && ob.financialYearStart === currentFinancialYearStart
    );

    if (existingOB) {
      setEditableOB_CL(existingOB.openingCL);
      setEditableOB_SL(existingOB.openingSL);
      setEditableOB_PL(existingOB.openingPL);
    } else {
      setEditableOB_CL(0);
      setEditableOB_SL(0);
      setEditableOB_PL(0);
    }
    setIsEditOpeningBalanceDialogOpen(true);
  };

  const handleSaveOpeningBalances = () => {
    if (!editingEmployeeForOB || editingOBYear === 0) {
      toast({ title: "Error", description: "No employee or financial year selected for editing opening balances.", variant: "destructive"});
      return;
    }

    const updatedOpeningBalances = [...openingBalances];
    const existingOBIndex = updatedOpeningBalances.findIndex(
      (ob) => ob.employeeCode === editingEmployeeForOB.code && ob.financialYearStart === editingOBYear
    );

    const newBalanceRecord: OpeningLeaveBalance = {
      employeeCode: editingEmployeeForOB.code,
      openingCL: editableOB_CL,
      openingSL: editableOB_SL,
      openingPL: editableOB_PL,
      financialYearStart: editingOBYear,
    };

    if (existingOBIndex > -1) {
      updatedOpeningBalances[existingOBIndex] = newBalanceRecord;
    } else {
      updatedOpeningBalances.push(newBalanceRecord);
    }

    setOpeningBalances(updatedOpeningBalances);
    if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedOpeningBalances));
    
    toast({ title: "Opening Balances Saved", description: `Opening balances for ${editingEmployeeForOB.name} for FY starting ${editingOBYear} have been saved.`});
    setIsEditOpeningBalanceDialogOpen(false);
    setEditingEmployeeForOB(null);
  };


  const handleDownloadReport = () => {
     if (selectedEmployeeIds.size === 0) {
      toast({
        title: "No Employees Selected",
        description: "Please select at least one employee to download the report.",
        variant: "destructive",
      });
      return;
    }

    const selectedEmployeesData = displayData.filter(emp => selectedEmployeeIds.has(emp.id));

    if (selectedEmployeesData.length === 0) {
         toast({
            title: "No Data",
            description: "No leave data available to download for the selected employees.",
            variant: "destructive",
        });
        return;
    }

    const csvRows: string[][] = [];
    const headers = [
      "Division", "Code", "Name", "Designation", "HQ", "DOJ",
      `Used CL (${selectedMonth} ${selectedYear})`,
      `Used SL (${selectedMonth} ${selectedYear})`,
      `Used PL (${selectedMonth} ${selectedYear})`,
      `Balance CL (End of ${selectedMonth} ${selectedYear})`,
      `Balance SL (End of ${selectedMonth} ${selectedYear})`,
      `Balance PL (End of ${selectedMonth} ${selectedYear})`
    ];
    csvRows.push(headers);

    selectedEmployeesData.forEach(emp => {
      let formattedDoj = 'N/A';
      if (emp.doj) {
        try {
          const parsed = parseISO(emp.doj);
          if (isValid(parsed)) {
            formattedDoj = format(parsed, 'dd-MMM-yyyy');
          } else {
            formattedDoj = emp.doj; 
          }
        } catch {
          formattedDoj = emp.doj; 
        }
      }

      const row = [
        emp.division || "N/A",
        emp.code,
        emp.name,
        emp.designation,
        emp.hq || "N/A",
        formattedDoj,
        emp.usedCLInMonth.toFixed(1),
        emp.usedSLInMonth.toFixed(1),
        emp.usedPLInMonth.toFixed(1),
        emp.balanceCLAtMonthEnd.toFixed(1),
        emp.balanceSLAtMonthEnd.toFixed(1),
        emp.balancePLAtMonthEnd.toFixed(1)
      ];
      csvRows.push(row);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute("download", `selected_leave_summary_${selectedMonth}_${selectedYear}_${formattedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: `Leave summary report for selected employees (${selectedMonth} ${selectedYear}) is being downloaded.`,
    });
  };

  const handleOpeningBalanceUpload = (file: File) => {
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
                toast({ title: "Invalid File", description: "File empty or no data. Header + data row expected.", variant: "destructive" });
                return;
            }
            const headersFromFile = lines[0].split(',').map(h => h.trim().toLowerCase());
            const expectedHeaders = ["employeecode", "openingcl", "openingsl", "openingpl", "financialyearstart"];
            const missingHeaders = expectedHeaders.filter(eh => !headersFromFile.includes(eh));
            if (missingHeaders.length > 0) {
                toast({ title: "File Header Error", description: `Missing headers: ${missingHeaders.join(', ')}. Expected: ${expectedHeaders.join(', ')}`, variant: "destructive", duration: 7000 });
                return;
            }

            const dataRows = lines.slice(1);
            const newOpeningBalances: OpeningLeaveBalance[] = [];
            const employeeCodesInFile = new Set<string>();
            let skippedDuplicatesInFile = 0;

            dataRows.forEach((row, index) => {
                const values = row.split(',');
                if (values.length < expectedHeaders.length) {
                     console.warn(`Skipping row ${index + 1} in opening balance CSV: insufficient columns.`);
                     return;
                }
                const employeeCode = values[headersFromFile.indexOf("employeecode")]?.trim();
                const openingCL = parseFloat(values[headersFromFile.indexOf("openingcl")]?.trim());
                const openingSL = parseFloat(values[headersFromFile.indexOf("openingsl")]?.trim());
                const openingPL = parseFloat(values[headersFromFile.indexOf("openingpl")]?.trim());
                const financialYearStart = parseInt(values[headersFromFile.indexOf("financialyearstart")]?.trim());

                if (!employeeCode || isNaN(openingCL) || isNaN(openingSL) || isNaN(openingPL) || isNaN(financialYearStart)) {
                    console.warn(`Skipping row ${index + 1} in opening balance CSV: invalid data for ${employeeCode}.`);
                    return;
                }
                const uniqueKeyInFile = `${employeeCode}-${financialYearStart}`;
                if (employeeCodesInFile.has(uniqueKeyInFile)) {
                    skippedDuplicatesInFile++;
                    console.warn(`Skipping row ${index + 1} (Code: ${employeeCode}, FY: ${financialYearStart}) due to duplicate entry within this CSV file.`);
                    return;
                }
                employeeCodesInFile.add(uniqueKeyInFile);
                newOpeningBalances.push({ employeeCode, openingCL, openingSL, openingPL, financialYearStart });
            });

            if (newOpeningBalances.length === 0 && skippedDuplicatesInFile > 0) {
                toast({ title: "No New Balances Processed", description: `All ${skippedDuplicatesInFile} rows in the file were duplicates of each other for the same employee/year.`, variant: "destructive", duration: 7000 });
                return;
            }
            if (newOpeningBalances.length === 0) {
                toast({ title: "No Valid Data Processed", description: "No valid new opening balance data found in the file. Check columns and formats.", variant: "destructive", duration: 7000 });
                return;
            }

            setOpeningBalances(prevBalances => {
                const existingRecordsMap = new Map(prevBalances.map(b => [`${b.employeeCode}-${b.financialYearStart}`, b]));
                newOpeningBalances.forEach(nb => {
                    existingRecordsMap.set(`${nb.employeeCode}-${nb.financialYearStart}`, nb); // Add or overwrite
                });
                const updatedBalances = Array.from(existingRecordsMap.values());
                
                if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedBalances));
                return updatedBalances;
            });
            
            let successMessage = `${newOpeningBalances.length} records processed from ${file.name}.`;
            if (skippedDuplicatesInFile > 0) {
                successMessage += ` ${skippedDuplicatesInFile} duplicate rows (same employee/year) within the file were skipped.`;
            }
            toast({ title: "Opening Balances Processed", description: successMessage, duration: 7000 });

        } catch (error) {
            console.error("Error parsing opening balance CSV:", error);
            toast({ title: "Parsing Error", description: "Could not parse opening balance CSV. Check format.", variant: "destructive" });
        }
    };
    reader.onerror = () => {
        toast({ title: "File Read Error", description: "Error reading file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  const handleDownloadOpeningBalanceTemplate = () => {
    const headers = ["EmployeeCode", "OpeningCL", "OpeningSL", "OpeningPL", "FinancialYearStart"];
    const sampleData = [
        ["E001", "2.0", "3.0", "5.0", "2024"],
        ["E002", "1.5", "2.5", "10.0", "2024"],
    ];
    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `opening_leave_balance_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: "opening_leave_balance_template.csv downloaded." });
  };
  
  const availableYears = currentYearState > 0 ? Array.from({ length: 5 }, (_, i) => currentYearState - i) : [];
  const activeEmployeesInDisplay = displayData.filter(emp => emp.status === "Active");
  const isAllSelected = activeEmployeesInDisplay.length > 0 && selectedEmployeeIds.size === activeEmployeesInDisplay.length;
  const isIndeterminate = selectedEmployeeIds.size > 0 && selectedEmployeeIds.size < activeEmployeesInDisplay.length;


  if (isLoading && employees.length === 0 && !selectedMonth && !selectedYear) { 
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Leave Management Dashboard"
        description="View employee leave balances. CL/SL (0.6/month after 5 months service) reset Apr-Mar; PL (1.2/month after 5 months service) carries forward. Opening balances can be uploaded or edited per employee."
      >
        <FileUploadButton
            onFileUpload={handleOpeningBalanceUpload}
            buttonText="Upload Opening Balances (CSV)"
            acceptedFileTypes=".csv"
            icon={<Upload className="mr-2 h-4 w-4" />}
            title="Upload CSV with opening leave balances for employees"
        />
        <Button onClick={handleDownloadOpeningBalanceTemplate} variant="link" className="p-0 h-auto">
            <Download className="mr-2 h-4 w-4" />
            Download Opening Balance Template (CSV)
        </Button>
         <Button onClick={handleDownloadReport} variant="outline" disabled={selectedEmployeeIds.size === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download Report for Selected (CSV)
        </Button>
      </PageHeader>

      <Dialog open={isEditOpeningBalanceDialogOpen} onOpenChange={(isOpen) => {
          setIsEditOpeningBalanceDialogOpen(isOpen);
          if (!isOpen) setEditingEmployeeForOB(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Opening Balances for {editingEmployeeForOB?.name}</DialogTitle>
            <DialogDescription>
              Set opening leave balances for the financial year starting April {editingOBYear}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
                <Label htmlFor="ob-fy-year">Financial Year Start (e.g., 2024 for Apr 2024 - Mar 2025)</Label>
                <Input id="ob-fy-year" type="number" value={editingOBYear} onChange={(e) => setEditingOBYear(parseInt(e.target.value))} placeholder="Enter year" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="ob-cl">Opening CL</Label>
                <Input id="ob-cl" type="number" value={editableOB_CL} onChange={(e) => setEditableOB_CL(parseFloat(e.target.value))} step="0.1" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="ob-sl">Opening SL</Label>
                <Input id="ob-sl" type="number" value={editableOB_SL} onChange={(e) => setEditableOB_SL(parseFloat(e.target.value))} step="0.1" />
            </div>
             <div className="space-y-1">
                <Label htmlFor="ob-pl">Opening PL</Label>
                <Input id="ob-pl" type="number" value={editableOB_PL} onChange={(e) => setEditableOB_PL(parseFloat(e.target.value))} step="0.1" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveOpeningBalances}>Save Balances</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
            <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Employee Leave Summary for {selectedMonth} {selectedYear > 0 ? selectedYear : ''}</CardTitle>
          <CardDescription>
            Balances are calculated at the end of the selected month. Used leaves are for the selected month only.
            <br/>Only 'Active' employees are shown. Leave accrual starts after 5 months of service.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected ? true : (isIndeterminate ? 'indeterminate' : false)}
                    onCheckedChange={(checkedState) => handleSelectAll(checkedState as boolean)}
                    aria-label="Select all rows"
                  />
                </TableHead>
                <TableHead className="min-w-[60px]">Edit OB</TableHead>
                <TableHead className="min-w-[120px]">Division</TableHead>
                <TableHead className="min-w-[80px]">Code</TableHead>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[150px]">Designation</TableHead>
                <TableHead className="min-w-[100px]">HQ</TableHead>
                <TableHead className="min-w-[100px]">DOJ</TableHead>
                <TableHead className="text-center min-w-[80px]">Used CL</TableHead>
                <TableHead className="text-center min-w-[80px]">Used SL</TableHead>
                <TableHead className="text-center min-w-[80px]">Used PL</TableHead>
                <TableHead className="text-center min-w-[90px]">Balance CL</TableHead>
                <TableHead className="text-center min-w-[90px]">Balance SL</TableHead>
                <TableHead className="text-center min-w-[90px]">Balance PL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && displayData.length === 0 ? ( 
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    {employees.length > 0 ? "Calculating leave balances..." : "Loading employee data..."}
                  </TableCell>
                </TableRow>
              ) : activeEmployeesInDisplay.length > 0 ? activeEmployeesInDisplay.map((emp) => (
                <TableRow key={emp.id} data-state={selectedEmployeeIds.has(emp.id) ? "selected" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedEmployeeIds.has(emp.id)}
                      onCheckedChange={(checked) => handleSelectEmployee(emp.id, !!checked)}
                      aria-label={`Select row for ${emp.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditOpeningBalanceDialog(emp)} title={`Edit opening balances for ${emp.name}`}>
                        <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell>{emp.division || "N/A"}</TableCell>
                  <TableCell>{emp.code}</TableCell>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell>{emp.designation}</TableCell>
                  <TableCell>{emp.hq || "N/A"}</TableCell>
                  <TableCell>
                    {(() => {
                      if (emp.doj && typeof emp.doj === 'string' && emp.doj.trim() !== '') {
                        try {
                          const parsedDate = parseISO(emp.doj);
                          if (!isValid(parsedDate)) { 
                            const parts = emp.doj.split(/[-/]/);
                            let reparsedDate = null;
                            if (parts.length === 3) {
                                if (parseInt(parts[2]) > 1000) { 
                                     reparsedDate = parseISO(`${parts[2]}-${parts[1]}-${parts[0]}`); 
                                     if(!isValid(reparsedDate)) reparsedDate = parseISO(`${parts[2]}-${parts[0]}-${parts[1]}`); 
                                } else if (parseInt(parts[0]) > 1000) { 
                                     reparsedDate = parseISO(emp.doj); 
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd MMM yyyy");
                            return emp.doj; 
                          }
                          return format(parsedDate, "dd MMM yyyy");
                        } catch (e) {
                          return emp.doj; 
                        }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell className="text-center">{emp.usedCLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedSLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedPLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.balanceCLAtMonthEnd.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.balanceSLAtMonthEnd.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.balancePLAtMonthEnd.toFixed(1)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                    {employees.length === 0 && !isLoading ? "No employees found in Employee Master. Please add employees to view leave data." : 
                     selectedMonth && selectedYear > 0 && !isLoading ? "No active employees or no data to display for the selected period." :
                     "Please select month and year to view leave summary."}
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
