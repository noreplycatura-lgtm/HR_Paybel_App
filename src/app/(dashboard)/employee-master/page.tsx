
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Upload, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sampleEmployees, type EmployeeDetail } from "@/lib/hr-data";
import { useEditorAuth } from "@/hooks/useEditorAuth";
import { format } from "date-fns";

export default function EmployeeMasterPage() {
  const { toast } = useToast();
  const { isEditor, isLoadingAuth } = useEditorAuth();
  const [employees, setEmployees] = React.useState<EmployeeDetail[]>(sampleEmployees);

  // In a real app, you'd fetch/manage employees here.
  // For this prototype, we'll just use the sample data.

  const handleAddNewEmployee = () => {
    if (!isEditor) {
      toast({ title: "Permission Denied", description: "Login as editor to add employees.", variant: "destructive" });
      return;
    }
    toast({
      title: "Prototype Action",
      description: "Adding a new employee directly is not yet implemented.",
    });
  };

  const handleUploadEmployees = () => {
     if (!isEditor) {
      toast({ title: "Permission Denied", description: "Login as editor to upload employees.", variant: "destructive" });
      return;
    }
    toast({
      title: "Prototype Action",
      description: "Uploading employees via Excel is not yet implemented.",
    });
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
    // Placeholder: In a real app, this would update state and backend.
    // setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
    toast({
      title: "Prototype Action",
      description: `Deleting employee ${employeeId} is not yet implemented. (Data is static sample)`,
      variant: "destructive"
    });
  };


  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <PageHeader 
        title="Employee Master" 
        description="View, add, or bulk upload employee master data. Includes status (Active/Left) and division."
      >
        <Button onClick={handleAddNewEmployee} variant="outline" disabled={!isEditor} title={!isEditor ? "Login as editor to add new employee" : ""}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
        </Button>
        <Button onClick={handleUploadEmployees} variant="outline" disabled={!isEditor} title={!isEditor ? "Login as editor to upload employees" : ""}>
          <Upload className="mr-2 h-4 w-4" /> Upload Employees (Excel/CSV)
        </Button>
      </PageHeader>

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
          <CardDescription>
            Displaying all employees. Status and Division are key for filtering and reports. Gross Salary management is part of Salary Setup.
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
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleEditEmployee(employee.id)} disabled={!isEditor} title={!isEditor ? "Login as editor to edit" : ""}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployee(employee.id)} className="text-destructive hover:text-destructive/80" disabled={!isEditor} title={!isEditor ? "Login as editor to delete" : ""}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
