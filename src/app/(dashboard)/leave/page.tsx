
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

  const [isEditLeaveDialogOpen, setIsEditLeaveDialogOpen] = React.useState(false);
  const [editingEmployeeForLeave, setEditingEmployeeForLeave] = React.useState<EmployeeDetail | null>(null);
  const [newLeaveType, setNewLeaveType] = React.useState<LeaveType>('CL');
  const [newLeaveDays, setNewLeaveDays] = React.useState<number>(1);


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
    // Keep isLoading true initially, let the data calculation useEffect handle it
  }, [toast]);

  React.useEffect(() => {
    if (!selectedMonth || !selectedYear || selectedYear === 0 || employees.length === 0) {
      setDisplayData([]);
      setIsLoading(false); // Set loading to false if prerequisites aren't met
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
  }, [employees, leaveApplications, openingBalances, selectedMonth, selectedYear]); // Removed isLoading from dependencies

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
  
  const handleOpenEditLeaveDialog = (employee: EmployeeDetail) => {
    setEditingEmployeeForLeave(employee);
    setNewLeaveType('CL');
    setNewLeaveDays(1);
    setIsEditLeaveDialogOpen(true);
  };

  const handleAddLeaveApplication = () => {
    if (!editingEmployeeForLeave || !selectedMonth || !selectedYear || newLeaveDays <= 0) {
      toast({ title: "Error", description: "Invalid employee, period, or leave days.", variant: "destructive" });
      return;
    }
    const monthIndex = months.indexOf(selectedMonth);
    const leaveStartDate = startOfMonth(new Date(selectedYear, monthIndex, 1));
    
    const monthEndDate = endOfMonth(leaveStartDate);
    let tentativeEndDate = dateFnsAddDays(leaveStartDate, newLeaveDays - 1);
    if (isBefore(monthEndDate, tentativeEndDate)) {
        tentativeEndDate = monthEndDate;
    }
    // For prototype, if leave days make it span multiple days, keep days as entered, but visually note in dialog
    // For simplicity, we take the entered days as is, assuming they are within the month. More complex date logic can be added.
    const actualLeaveDays = newLeaveDays;


    const newApp: LeaveApplication = {
      id: `LAPP-${Date.now()}`,
      employeeId: editingEmployeeForLeave.id,
      leaveType: newLeaveType,
      startDate: format(leaveStartDate, 'yyyy-MM-dd'), // For simplicity, all leaves start on 1st of selected month
      endDate: format(dateFnsAddDays(leaveStartDate, Math.max(0, actualLeaveDays - 1)), 'yyyy-MM-dd'), 
      days: actualLeaveDays, 
    };

    const updatedApplications = [...leaveApplications, newApp];
    setLeaveApplications(updatedApplications);
    if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY, JSON.stringify(updatedApplications));
    toast({ title: "Leave Added", description: `${newLeaveType} for ${actualLeaveDays} day(s) added for ${editingEmployeeForLeave.name} in ${selectedMonth} ${selectedYear}.` });
    setNewLeaveDays(1); // Reset for next entry
  };

  const handleRemoveLeaveApplication = (appId: string) => {
    const updatedApplications = leaveApplications.filter(app => app.id !== appId);
    setLeaveApplications(updatedApplications);
    if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY, JSON.stringify(updatedApplications));
    toast({ title: "Leave Removed", description: `Leave application has been removed.` });
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
      `Balance PL (End of ${selectedMonth} ${selectedYear})`,
      "Eligible For Accrual This Month"
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
        emp.balancePLAtMonthEnd.toFixed(1), 
        emp.isPLEligibleThisMonth ? 'Yes' : 'No'
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
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const expectedHeaders = ["employeecode", "openingcl", "openingsl", "openingpl", "financialyearstart"];
            const missingHeaders = expectedHeaders.filter(eh => !headers.includes(eh));
            if (missingHeaders.length > 0) {
                toast({ title: "File Header Error", description: `Missing headers: ${missingHeaders.join(', ')}.`, variant: "destructive", duration: 7000 });
                return;
            }

            const dataRows = lines.slice(1);
            const newOpeningBalances: OpeningLeaveBalance[] = [];
            dataRows.forEach((row, index) => {
                const values = row.split(',');
                if (values.length < expectedHeaders.length) {
                     console.warn(`Skipping row ${index + 1} in opening balance CSV: insufficient columns.`);
                     return;
                }
                const employeeCode = values[headers.indexOf("employeecode")]?.trim();
                const openingCL = parseFloat(values[headers.indexOf("openingcl")]?.trim());
                const openingSL = parseFloat(values[headers.indexOf("openingsl")]?.trim());
                const openingPL = parseFloat(values[headers.indexOf("openingpl")]?.trim());
                const financialYearStart = parseInt(values[headers.indexOf("financialyearstart")]?.trim());

                if (!employeeCode || isNaN(openingCL) || isNaN(openingSL) || isNaN(openingPL) || isNaN(financialYearStart)) {
                    console.warn(`Skipping row ${index + 1} in opening balance CSV: invalid data for ${employeeCode}.`);
                    return;
                }
                newOpeningBalances.push({ employeeCode, openingCL, openingSL, openingPL, financialYearStart });
            });

            if (newOpeningBalances.length > 0) {
                setOpeningBalances(prevBalances => {
                    const existingCodes = new Set(prevBalances.map(b => `${b.employeeCode}-${b.financialYearStart}`));
                    const uniqueNewBalances = newOpeningBalances.filter(nb => !existingCodes.has(`${nb.employeeCode}-${nb.financialYearStart}`));
                    const updatedBalances = [...prevBalances.filter(pb => !newOpeningBalances.some(nb => nb.employeeCode === pb.employeeCode && nb.financialYearStart === pb.financialYearStart)), ...uniqueNewBalances];
                    
                    if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedBalances));
                    return updatedBalances;
                });
                toast({ title: "Opening Balances Processed", description: `${newOpeningBalances.length} records processed from ${file.name}. Existing records for same employee/year were updated/added.` });
            } else {
                 toast({ title: "No New Balances Added", description: "No valid new opening balance data found or all data was duplicate.", variant: "destructive" });
            }

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


  const applicationsForDialog = editingEmployeeForLeave && selectedMonth && selectedYear ? 
    leaveApplications.filter(app => {
        if (app.employeeId !== editingEmployeeForLeave.id) return false;
        try {
            const appStartDate = parseISO(app.startDate);
            return getYear(appStartDate) === selectedYear && getMonth(appStartDate) === months.indexOf(selectedMonth);
        } catch { return false; }
    }) : [];


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
        description="View employee leave balances. CL/SL (0.6/month after 5 months service) reset Apr-Mar; PL (1.2/month after 5 months service) carries forward."
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

      <Dialog open={isEditLeaveDialogOpen} onOpenChange={(isOpen) => {
          setIsEditLeaveDialogOpen(isOpen);
          if (!isOpen) setEditingEmployeeForLeave(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Leaves for {editingEmployeeForLeave?.name}</DialogTitle>
            <DialogDescription>
              Selected Period: {selectedMonth} {selectedYear}. Manage leave applications for this month.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Add New Leave for {selectedMonth} {selectedYear}</Label>
              <div className="flex items-center gap-2">
                <Select value={newLeaveType} onValueChange={(val) => setNewLeaveType(val as LeaveType)}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="CL">CL</SelectItem>
                        <SelectItem value="SL">SL</SelectItem>
                        <SelectItem value="PL">PL</SelectItem>
                    </SelectContent>
                </Select>
                <Input 
                    type="number" 
                    value={newLeaveDays} 
                    onChange={(e) => setNewLeaveDays(Math.max(0.5, parseFloat(e.target.value)))} 
                    min="0.5" 
                    step="0.5"
                    className="w-[80px]"
                />
                 <Label className="text-sm">days</Label>
                <Button onClick={handleAddLeaveApplication} size="sm"><PlusCircle className="mr-1 h-4 w-4" /> Add</Button>
              </div>
               <p className="text-xs text-muted-foreground">Note: For prototype, leaves are added from 1st of selected month.</p>
            </div>
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-base">Applied Leaves in {selectedMonth} {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {applicationsForDialog.length > 0 ? (
                  <ScrollArea className="h-[150px]">
                    <ul className="space-y-2">
                      {applicationsForDialog.map(app => (
                        <li key={app.id} className="flex justify-between items-center text-sm p-2 border rounded-md">
                          <div>
                            <span className="font-medium">{app.leaveType}</span> - {app.days} day(s)
                            <span className="text-xs text-muted-foreground ml-2">({format(parseISO(app.startDate), 'dd/MM')} - {format(parseISO(app.endDate), 'dd/MM')})</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveLeaveApplication(app.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No leaves applied in this month.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Card className="mb-6 shadow-md">
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

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Employee Leave Summary for {selectedMonth} {selectedYear > 0 ? selectedYear : ''}</CardTitle>
          <CardDescription>
            Balances are calculated at the end of the selected month. Used leaves are for the selected month only.
            <br/>Only 'Active' employees are shown. 'Eligible Accrual' column indicates completion of 5 months service for any leave type.
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
                <TableHead className="min-w-[60px]">Edit</TableHead>
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
                <TableHead className="text-center min-w-[100px]">Eligible Accrual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && displayData.length === 0 ? ( 
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8">
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
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditLeaveDialog(emp)} title={`Edit leave applications for ${emp.name}`}>
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
                            const parts = emp.doj.split(/[-/]/); // More robust split
                            let reparsedDate = null;
                            // Attempt common non-ISO formats like DD-MM-YYYY or MM-DD-YYYY (assuming YYYY is always last or first)
                            if (parts.length === 3) {
                                if (parseInt(parts[2]) > 1000) { // YYYY is likely last
                                     reparsedDate = parseISO(`${parts[2]}-${parts[1]}-${parts[0]}`); // DD-MM-YYYY
                                     if(!isValid(reparsedDate)) reparsedDate = parseISO(`${parts[2]}-${parts[0]}-${parts[1]}`); // MM-DD-YYYY
                                } else if (parseInt(parts[0]) > 1000) { // YYYY is likely first
                                     reparsedDate = parseISO(emp.doj); // Try as is for YYYY-MM-DD or YYYY-DD-MM
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd MMM yyyy");
                            return emp.doj; // Fallback to original string if complex parsing fails
                          }
                          return format(parsedDate, "dd MMM yyyy");
                        } catch (e) {
                          return emp.doj; // Fallback for any other error
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
                  <TableCell className="text-center">{emp.isPLEligibleThisMonth ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
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
