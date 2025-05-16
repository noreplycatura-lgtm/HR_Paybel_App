
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast"; // Added useToast import

interface LeaveBalance {
  type: 'CL' | 'SL' | 'PL';
  accrued: number;
  used: number;
  balance: number;
}

interface LeaveHistoryEntry {
  id: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
}

const sampleLeaveBalances: LeaveBalance[] = [
  { type: 'CL', accrued: 1, used: 0, balance: 1 },
  { type: 'SL', accrued: 1, used: 0.5, balance: 0.5 },
  { type: 'PL', accrued: 2, used: 1, balance: 1 },
];

const sampleLeaveHistory: LeaveHistoryEntry[] = [
  { id: "L001", employeeName: "John Doe", leaveType: "PL", startDate: "2024-07-10", endDate: "2024-07-11", days: 2 },
  { id: "L002", employeeName: "Jane Smith", leaveType: "SL", startDate: "2024-07-15", endDate: "2024-07-15", days: 1 },
  { id: "L003", employeeName: "Mike Johnson", leaveType: "CL", startDate: "2024-07-20", endDate: "2024-07-20", days: 1 },
];

export default function LeavePage() {
  const { toast } = useToast(); // Initialized useToast

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
        description="View employee leave balances and history. Leaves are automatically recorded if sufficient balance is available."
      >
        <Button variant="outline" onClick={handleDownloadLeaveBalance}> {/* Added onClick handler */}
          <Download className="mr-2 h-4 w-4" />
          Download Leave Balance (Excel)
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        {sampleLeaveBalances.map(leave => (
          <Card key={leave.type} className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {leave.type} Balance
                <Badge variant={leave.balance > 0 ? "default" : "destructive"}>{leave.balance}</Badge>
              </CardTitle>
              <CardDescription>Monthly Accrued: {leave.accrued}, Used: {leave.used}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {leave.type === 'PL' && "Paid Leaves carry forward to the next year."}
                {(leave.type === 'CL' || leave.type === 'SL') && `${leave.type} reset at year end.`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
          <CardDescription>Recent leave applications. Leaves are automatically recorded based on available balance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-center">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleLeaveHistory.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.employeeName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{entry.leaveType}</Badge>
                  </TableCell>
                  <TableCell>{entry.startDate}</TableCell>
                  <TableCell>{entry.endDate}</TableCell>
                  <TableCell className="text-center">{entry.days}</TableCell>
                </TableRow>
              ))}
              {sampleLeaveHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No leave history found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
