
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, getYear, getMonth, isValid } from 'date-fns';
import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateEmployeeLeaveDetailsForPeriod } from "@/lib/hr-calculations";
import type { LeaveApplication } from "@/lib/hr-types";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1"; // For storing applied leaves

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
  
  const [currentYearState, setCurrentYearState] = React.useState(0); // Renamed to avoid conflict
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  
  const [displayData, setDisplayData] = React.useState<LeaveDisplayData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

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
      } catch (error) {
        console.error("Error loading data from localStorage:", error);
        toast({ title: "Data Load Error", description: "Could not load data from local storage.", variant: "destructive" });
        setEmployees([]);
        setLeaveApplications([]);
      }
    }
    setIsLoading(false); // Set to false after initial load attempt
  }, [toast]);

  React.useEffect(() => {
    // Prevent calculation if initial state isn't ready or employees not loaded
    if (!selectedMonth || !selectedYear || selectedYear === 0 || employees.length === 0 || isLoading) {
      setDisplayData([]);
      if (!isLoading && employees.length > 0) setIsLoading(false); // Ensure loading is false if we bail early but have employees
      return;
    }
    
    setIsLoading(true); // Set loading true at the start of this effect
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) {
      setDisplayData([]);
      setIsLoading(false);
      return;
    }

    const newDisplayData = employees
      .filter(emp => emp.status === "Active") // Process only Active employees
      .map(emp => {
        const leaveDetails = calculateEmployeeLeaveDetailsForPeriod(emp, selectedYear, monthIndex, leaveApplications);
        return {
          ...emp,
          ...leaveDetails,
        };
    });
    setDisplayData(newDisplayData);
    setIsLoading(false);
  }, [employees, leaveApplications, selectedMonth, selectedYear, isLoading]);


  const handleDownloadReport = () => {
     if (displayData.length === 0) {
      toast({
        title: "No Data",
        description: "No leave data available to download for the selected period.",
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
      "PL Eligible This Month"
    ];
    csvRows.push(headers);

    displayData.forEach(emp => {
      let formattedDoj = 'N/A';
      if (emp.doj) {
        try {
          const parsed = parseISO(emp.doj);
          if (isValid(parsed)) {
            formattedDoj = format(parsed, 'dd-MMM-yyyy');
          } else {
            formattedDoj = emp.doj; // Show original if not parsable by ISO
          }
        } catch {
          formattedDoj = emp.doj; // Show original on any parsing error
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
        emp.isPLEligibleThisMonth ? emp.balancePLAtMonthEnd.toFixed(1) : "0.0",
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
    link.setAttribute("download", `leave_summary_report_${selectedMonth}_${selectedYear}_${formattedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: `Leave summary report for ${selectedMonth} ${selectedYear} is being downloaded.`,
    });
  };
  
  const availableYears = currentYearState > 0 ? Array.from({ length: 5 }, (_, i) => currentYearState - i) : [];

  if (isLoading && employees.length === 0) { // Initial page load state
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
        description="View employee leave balances based on accruals, usage, and financial year policies. CL/SL (0.6/month) reset annually (Apr-Mar); PL (1.2/month) carries forward after 6 months eligibility."
      >
         <Button onClick={handleDownloadReport} variant="outline" disabled={displayData.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download Report (CSV)
        </Button>
      </PageHeader>

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
            (Note: Leave application functionality is not yet part of this prototype, so 'Used' leaves will be 0 unless applications are manually added to localStorage).
            <br/>Only 'Active' employees are shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableHead className="text-center min-w-[100px]">PL Eligible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && displayData.length === 0 && employees.length > 0 ? ( // Recalculation in progress
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    Calculating leave balances...
                  </TableCell>
                </TableRow>
              ) : displayData.length > 0 ? displayData.map((emp) => (
                <TableRow key={emp.id}>
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
                          if (!isValid(parsedDate)) { // Check if parseISO resulted in a valid date
                            // Attempt to parse common formats if ISO fails
                            const parts = emp.doj.split(/[-/]/);
                            let reparsedDate = null;
                            if (parts.length === 3) {
                                // Try DD-MM-YYYY or MM-DD-YYYY (assuming year is last part)
                                // This is a basic attempt and might need refinement for more formats
                                if (parseInt(parts[2]) > 1000) { // year is likely last
                                     reparsedDate = parseISO(`${parts[2]}-${parts[1]}-${parts[0]}`); // Try YYYY-MM-DD from DD-MM-YYYY
                                     if(!isValid(reparsedDate)) reparsedDate = parseISO(`${parts[2]}-${parts[0]}-${parts[1]}`); // Try YYYY-DD-MM from MM-DD-YYYY
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd MMM yyyy");
                            return emp.doj; // Show original if still not valid
                          }
                          return format(parsedDate, "dd MMM yyyy");
                        } catch (e) {
                          return emp.doj; // Show original if any error during parsing
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
                  <TableCell className="text-center font-semibold">{emp.isPLEligibleThisMonth ? emp.balancePLAtMonthEnd.toFixed(1) : "0.0"}</TableCell>
                  <TableCell className="text-center">{emp.isPLEligibleThisMonth ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
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


