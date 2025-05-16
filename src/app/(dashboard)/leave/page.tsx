
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { differenceInMonths, parseISO } from 'date-fns';

interface LeaveBalance {
  type: 'CL' | 'SL' | 'PL';
  accrued: number;
  used: number;
  balance: number;
  eligible?: boolean; // For PL
}

interface EmployeeDetail {
  id: string;
  name: string;
  doj: string; // YYYY-MM-DD
}

interface LeaveHistoryEntry {
  id: string;
  employeeId: string; // Added to link history to employee
  employeeName: string;
  leaveType: 'CL' | 'SL' | 'PL';
  startDate: string;
  endDate: string;
  days: number;
}

const sampleEmployeesWithDoj: EmployeeDetail[] = [
  { id: "E001", name: "John Doe", doj: "2023-01-15" },
  { id: "E002", name: "Jane Smith", doj: "2024-03-20" }, // Joined Mar 2024
  { id: "E003", name: "Mike Johnson", doj: "2022-10-01" },
  { id: "E004", name: "Alice Brown", doj: "2024-06-05" }, // Joined Jun 2024
];

const sampleLeaveHistory: LeaveHistoryEntry[] = [
  { id: "L001", employeeId: "E001", employeeName: "John Doe", leaveType: "PL", startDate: "2024-07-10", endDate: "2024-07-11", days: 2 },
  { id: "L002", employeeId: "E002", employeeName: "Jane Smith", leaveType: "SL", startDate: "2024-07-15", endDate: "2024-07-15", days: 1 },
  { id: "L003", employeeId: "E003", employeeName: "Mike Johnson", leaveType: "CL", startDate: "2024-07-20", endDate: "2024-07-20", days: 1 },
  { id: "L004", employeeId: "E001", employeeName: "John Doe", leaveType: "CL", startDate: "2024-06-05", endDate: "2024-06-05", days: 1 },
  { id: "L005", employeeId: "E003", employeeName: "Mike Johnson", leaveType: "SL", startDate: "2024-05-10", endDate: "2024-05-10", days: 0.5 },
  { id: "L006", employeeId: "E001", employeeName: "John Doe", leaveType: "SL", startDate: "2024-04-01", endDate: "2024-04-01", days: 1 },
];

const calculateMonthsOfService = (dojString: string, referenceDate: Date = new Date()): number => {
  const doj = parseISO(dojString);
  const months = differenceInMonths(referenceDate, doj);
  return Math.max(0, months); // Number of full months completed
};

export default function LeavePage() {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | undefined>();
  const [calculatedLeaveBalances, setCalculatedLeaveBalances] = React.useState<LeaveBalance[]>([]);
  const [filteredLeaveHistory, setFilteredLeaveHistory] = React.useState<LeaveHistoryEntry[]>([]);
  const [currentEmployee, setCurrentEmployee] = React.useState<EmployeeDetail | undefined>();

  React.useEffect(() => {
    if (selectedEmployeeId) {
      const employee = sampleEmployeesWithDoj.find(emp => emp.id === selectedEmployeeId);
      setCurrentEmployee(employee);

      if (employee) {
        const currentDate = new Date(); // Use current date for accrual calculation
        const completedMonths = calculateMonthsOfService(employee.doj, currentDate);

        const accruedCL = completedMonths * 0.6;
        const accruedSL = completedMonths * 0.6;
        
        let accruedPL = 0;
        const plEligible = completedMonths >= 6;
        if (plEligible) {
          // PL accrues for the 6th completed month onwards.
          // If 6 months completed, (6 - 5) = 1 month of PL accrual.
          accruedPL = (completedMonths - 5) * 1.2;
        }

        const usedCL = sampleLeaveHistory
          .filter(h => h.employeeId === selectedEmployeeId && h.leaveType === 'CL')
          .reduce((sum, h) => sum + h.days, 0);
        const usedSL = sampleLeaveHistory
          .filter(h => h.employeeId === selectedEmployeeId && h.leaveType === 'SL')
          .reduce((sum, h) => sum + h.days, 0);
        const usedPL = sampleLeaveHistory
          .filter(h => h.employeeId === selectedEmployeeId && h.leaveType === 'PL')
          .reduce((sum, h) => sum + h.days, 0);

        setCalculatedLeaveBalances([
          { type: 'CL', accrued: accruedCL, used: usedCL, balance: Math.max(0, accruedCL - usedCL) },
          { type: 'SL', accrued: accruedSL, used: usedSL, balance: Math.max(0, accruedSL - usedSL) },
          { type: 'PL', accrued: accruedPL, used: usedPL, balance: Math.max(0, accruedPL - usedPL), eligible: plEligible },
        ]);

        setFilteredLeaveHistory(sampleLeaveHistory.filter(h => h.employeeId === selectedEmployeeId));
      } else {
        setCalculatedLeaveBalances([]);
        setFilteredLeaveHistory([]);
      }
    } else {
      setCurrentEmployee(undefined);
      setCalculatedLeaveBalances([]);
      setFilteredLeaveHistory([]);
    }
  }, [selectedEmployeeId]);

  const handleDownloadLeaveBalance = () => {
    toast({
      title: "Feature Not Implemented",
      description: "Excel download for leave balance is not yet available.",
      variant: "default",
    });
  };

  return (
    <>
      <PageHeader 
        title="Leave Management" 
        description="View and manage individual employee leave balances and history. Leaves are automatically calculated based on service tenure and usage. PL is applicable after 6 months of service."
      >
        <Button variant="outline" onClick={handleDownloadLeaveBalance} disabled={!selectedEmployeeId}>
          <Download className="mr-2 h-4 w-4" />
          Download Leave Balance (Excel)
        </Button>
      </PageHeader>

      <Card className="mb-6 shadow-md">
        <CardHeader>
            <CardTitle>Select Employee</CardTitle>
        </CardHeader>
        <CardContent>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select an employee to view leave details" />
                </SelectTrigger>
                <SelectContent>
                    {sampleEmployeesWithDoj.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.id})</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      {selectedEmployeeId && currentEmployee ? (
        <>
          <div className="mb-4 text-lg font-semibold">
            Leave Balances for: {currentEmployee.name} (DOJ: {new Date(currentEmployee.doj).toLocaleDateString()})
            ({calculateMonthsOfService(currentEmployee.doj)} months completed)
          </div>
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            {calculatedLeaveBalances.map(leave => (
              <Card key={leave.type} className="shadow-md">
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
                    {(leave.type === 'CL' || leave.type === 'SL') && `${leave.type} reset at year end.`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Leave History for {currentEmployee.name}</CardTitle>
              <CardDescription>Recent leave applications for the selected employee.</CardDescription>
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
                  {filteredLeaveHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="secondary">{entry.leaveType}</Badge>
                      </TableCell>
                      <TableCell>{entry.startDate}</TableCell>
                      <TableCell>{entry.endDate}</TableCell>
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
      ) : (
        <Card className="shadow-md">
            <CardContent className="pt-6 text-center text-muted-foreground">
                <User className="mx-auto h-12 w-12 mb-4" />
                <p>Please select an employee to view their leave details.</p>
            </CardContent>
        </Card>
      )}
    </>
  );
}

    