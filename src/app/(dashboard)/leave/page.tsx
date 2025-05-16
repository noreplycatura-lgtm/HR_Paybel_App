
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';
import { sampleEmployees, sampleLeaveHistory, type EmployeeDetail, type LeaveHistoryEntry } from "@/lib/hr-data";
import { calculateMonthsOfService, calculateAllLeaveBalancesForEmployee } from "@/lib/hr-calculations";
import type { LeaveBalanceItem } from "@/lib/hr-types";


export default function LeavePage() {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | undefined>();
  const [calculatedLeaveBalances, setCalculatedLeaveBalances] = React.useState<LeaveBalanceItem[]>([]);
  const [filteredLeaveHistory, setFilteredLeaveHistory] = React.useState<LeaveHistoryEntry[]>([]);
  const [currentEmployee, setCurrentEmployee] = React.useState<EmployeeDetail | undefined>();
  const [monthsCompleted, setMonthsCompleted] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);


  React.useEffect(() => {
    if (selectedEmployeeId) {
      setIsLoading(true);
      const employee = sampleEmployees.find(emp => emp.id === selectedEmployeeId);
      setCurrentEmployee(employee);

      if (employee) {
        const today = new Date();
        setMonthsCompleted(calculateMonthsOfService(employee.doj, today));

        const balances = calculateAllLeaveBalancesForEmployee(employee, sampleLeaveHistory, today);

        setCalculatedLeaveBalances([balances.CL, balances.SL, balances.PL]);
        setFilteredLeaveHistory(sampleLeaveHistory.filter(h => h.employeeId === selectedEmployeeId).sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()));
      } else {
        setCalculatedLeaveBalances([]);
        setFilteredLeaveHistory([]);
        setMonthsCompleted(0);
      }
      setIsLoading(false);
    } else {
      setCurrentEmployee(undefined);
      setCalculatedLeaveBalances([]);
      setFilteredLeaveHistory([]);
      setMonthsCompleted(0);
    }
  }, [selectedEmployeeId]);

  const handleDownloadLeaveBalance = () => {
    if (!currentEmployee || calculatedLeaveBalances.length === 0) {
      toast({
        title: "No Data",
        description: "Please select an employee to download their leave details.",
        variant: "destructive",
      });
      return;
    }

    const csvRows: string[][] = [];
    csvRows.push([`Leave History for ${currentEmployee.name} (${currentEmployee.code})`]);
    csvRows.push(["Month", "Start Date", "End Date", "Leave Type", "Days Taken"]);
    if (filteredLeaveHistory.length > 0) {
      const sortedHistoryForCSV = [...filteredLeaveHistory].sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
      sortedHistoryForCSV.forEach(entry => {
        csvRows.push([
          format(parseISO(entry.startDate), 'MMMM yyyy'),
          entry.startDate,
          entry.endDate,
          entry.leaveType,
          entry.days.toString()
        ]);
      });
    } else {
      csvRows.push(["No leave history found for this period."]);
    }
    csvRows.push([""]);
    csvRows.push(["Current Leave Balances Summary as of " + format(new Date(), 'yyyy-MM-dd')]);
    csvRows.push(["Leave Type", "Total Accrued", "Total Used", "Current Balance", "PL Eligible"]);
    calculatedLeaveBalances.forEach(lb => {
      csvRows.push([
        lb.type,
        lb.accrued.toFixed(1),
        lb.used.toFixed(1),
        lb.balance.toFixed(1),
        lb.type === 'PL' ? (lb.eligible ? 'Yes' : 'No') : 'N/A'
      ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute("download", `leave_report_${currentEmployee.name.replace(/\s+/g, '_')}_${formattedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: `Detailed leave report for ${currentEmployee.name} is being downloaded.`,
    });
  };

  if (isLoading && !currentEmployee) { // Show loader only when actively fetching for a selected ID
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Leave Management"
        description="View and manage individual employee leave balances and history. Leaves are automatically calculated based on service tenure and usage. PL is applicable after 6 months of service."
      >
        <Button
            variant="outline"
            onClick={handleDownloadLeaveBalance}
            disabled={!selectedEmployeeId}
        >
          <Download className="mr-2 h-4 w-4" />
          Download Leave Report (CSV)
        </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
            <CardTitle>Select Employee</CardTitle>
        </CardHeader>
        <CardContent>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select an employee to view leave details" />
                </SelectTrigger>
                <SelectContent>
                    {sampleEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code})</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      {isLoading && currentEmployee && ( // Show loader when employee is selected and data is loading
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}


      {!isLoading && selectedEmployeeId && currentEmployee ? (
        <>
          <div className="mb-4 text-lg font-semibold">
            Leave Balances for: {currentEmployee.name} (DOJ: {currentEmployee.doj ? format(parseISO(currentEmployee.doj), 'dd MMM yyyy') : 'N/A'})
            ({monthsCompleted} months completed)
          </div>
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            {calculatedLeaveBalances.map(leave => (
              <Card key={leave.type} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {leave.type} Balance
                    <Badge variant={(leave.balance > 0 || (leave.type === 'PL' && !leave.eligible)) ? "default" : "destructive"}>
                      {leave.type === 'PL' && !leave.eligible ? 'N/A' : leave.balance.toFixed(1)}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Total Accrued: {leave.accrued.toFixed(1)}, Used: {leave.used.toFixed(1)}
                    {leave.type === 'PL' && !leave.eligible && " (Not eligible yet)"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {leave.type === 'PL' && "Paid Leaves carry forward. Eligible after 6 months."}
                    {(leave.type === 'CL' || leave.type === 'SL') && `${leave.type} reset at year end (policy not yet implemented).`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Leave History for {currentEmployee.name}</CardTitle>
              <CardDescription>Recent leave applications for the selected employee (chronological order).</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaveHistory.slice().sort((a,b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="secondary">{entry.leaveType}</Badge>
                      </TableCell>
                      <TableCell>{format(parseISO(entry.startDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{format(parseISO(entry.endDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-center">{entry.days}</TableCell>
                    </TableRow>
                  ))}
                  {filteredLeaveHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">No leave history found for {currentEmployee.name}.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : !isLoading && ( // Only show this if not loading and no employee selected
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center text-muted-foreground">
                <User className="mx-auto h-12 w-12 mb-4" />
                <p>Please select an employee to view their leave details.</p>
            </CardContent>
        </Card>
      )}
    </>
  );
}
