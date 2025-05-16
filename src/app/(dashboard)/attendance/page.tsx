
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ATTENDANCE_STATUS_COLORS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, Trash2, Loader2 } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data"; 
import { sampleLeaveHistory } from "@/lib/hr-data"; 
import { getLeaveBalancesAtStartOfMonth, PL_ELIGIBILITY_MONTHS, calculateMonthsOfService } from "@/lib/hr-calculations";
import { startOfDay, parseISO, isBefore, isEqual, format } from "date-fns";
import { useEditorAuth } from "@/hooks/useEditorAuth"; 

interface EmployeeAttendanceData extends EmployeeDetail {
  attendance: string[]; 
  processedAttendance?: string[]; 
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const LOCAL_STORAGE_ATTENDANCE_RAW_KEY = "novita_attendance_raw_data_v3"; 
const LOCAL_STORAGE_ATTENDANCE_FILENAME_KEY = "novita_attendance_filename_v3";
const LOCAL_STORAGE_ATTENDANCE_CONTEXT_KEY = "novita_attendance_context_v3";

export default function AttendancePage() {
  const { toast } = useToast();
  const { isEditor, isLoadingAuth } = useEditorAuth();
  const [rawAttendanceData, setRawAttendanceData] = React.useState<EmployeeAttendanceData[]>([]);
  const [processedAttendanceData, setProcessedAttendanceData] = React.useState<EmployeeAttendanceData[]>([]);
  
  const [currentMonthName, setCurrentMonthName] = React.useState('');
  const [currentYear, setCurrentYear] = React.useState(0);
  const [selectedMonth, setSelectedMonth] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);

  const [uploadMonth, setUploadMonth] = React.useState<string>('');
  const [uploadYear, setUploadYear] = React.useState<number>(0);

  const [isLoadingState, setIsLoadingState] = React.useState(true); 
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const [uploadContext, setUploadContext] = React.useState<{month: string, year: number} | null>(null);

  const [showDeleteConfirmation, setShowDeleteConfirmation] = React.useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');

  React.useEffect(() => {
    setIsLoadingState(true); 

    if (typeof window !== 'undefined') {
        const storedRawData = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_RAW_KEY);
        const storedFileName = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_FILENAME_KEY);
        const storedContext = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_CONTEXT_KEY);

        const now = new Date(); 
        const defaultYear = now.getFullYear();
        const defaultMonthName = months[now.getMonth()];
        setCurrentYear(defaultYear); 
        setCurrentMonthName(defaultMonthName); 

        if (storedRawData && storedFileName && storedContext) {
          try {
            const parsedRawData = JSON.parse(storedRawData) as EmployeeAttendanceData[];
            const parsedContext = JSON.parse(storedContext) as { month: string; year: number };

            setRawAttendanceData(parsedRawData);
            setUploadedFileName(storedFileName);
            setUploadContext(parsedContext);

            setSelectedMonth(parsedContext.month);
            setSelectedYear(parsedContext.year);
            setUploadMonth(parsedContext.month); 
            setUploadYear(parsedContext.year);
          } catch (error) {
            console.error("Error parsing attendance data from localStorage:", error);
            toast({
                title: "Data Load Error",
                description: "Could not load previously saved attendance data. It might be corrupted. Please clear data manually if needed or re-upload.",
                variant: "destructive",
                duration: 7000,
            });
            
            setSelectedMonth(defaultMonthName);
            setSelectedYear(defaultYear);
            setUploadMonth(defaultMonthName);
            setUploadYear(defaultYear);
          }
        } else {
          setSelectedMonth(defaultMonthName);
          setSelectedYear(defaultYear);
          setUploadMonth(defaultMonthName);
          setUploadYear(defaultYear);
        }
    }
    setIsLoadingState(false);
  }, [toast]);

  React.useEffect(() => {
    if (isLoadingState || rawAttendanceData.length === 0 || !selectedYear || !selectedMonth || selectedYear === 0) {
      setProcessedAttendanceData([]); 
      return;
    }

    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) return;

    const processedData = rawAttendanceData.map(emp => {
      if (!emp.doj) { 
        return { ...emp, processedAttendance: Array(new Date(selectedYear, monthIndex + 1, 0).getDate()).fill('A') }; 
      }
      const employeeStartDate = parseISO(emp.doj);
      const startOfSelectedMonth = startOfDay(new Date(selectedYear, monthIndex, 1));
      
      if (isBefore(startOfSelectedMonth, startOfDay(employeeStartDate)) && !isEqual(startOfSelectedMonth, startOfDay(employeeStartDate))) {
         return { ...emp, processedAttendance: Array(new Date(selectedYear, monthIndex + 1, 0).getDate()).fill('-') };
      }

      const employeeForLeaveCalc: EmployeeDetail = {
        id: emp.id,
        code: emp.code,
        name: emp.name,
        designation: emp.designation,
        doj: emp.doj,
        status: emp.status, 
        division: emp.division,
        grossMonthlySalary: emp.grossMonthlySalary || 0, 
      };
      let balances = getLeaveBalancesAtStartOfMonth(employeeForLeaveCalc, selectedYear, monthIndex, sampleLeaveHistory);
      
      const monthsOfServiceThisMonthStart = calculateMonthsOfService(emp.doj, new Date(selectedYear, monthIndex, 1));
      const isPLEligibleForThisMonth = monthsOfServiceThisMonthStart >= PL_ELIGIBILITY_MONTHS;

      const daysInCurrentMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
      const rawMonthlyAttendance = emp.attendance.slice(0, daysInCurrentMonth);

      const newProcessedAttendance = rawMonthlyAttendance.map(originalStatus => {
        let currentDayStatus = originalStatus;
        
        if (originalStatus === "CL") {
          if (balances.cl >= 1) {
            balances.cl -= 1;
          } else {
            currentDayStatus = "A";
          }
        } else if (originalStatus === "SL") {
          if (balances.sl >= 1) {
            balances.sl -= 1;
          } else {
            currentDayStatus = "A";
          }
        } else if (originalStatus === "PL") {
          if (isPLEligibleForThisMonth && balances.pl >= 1) {
            balances.pl -= 1;
          } else {
            currentDayStatus = "A"; 
          }
        }
        return currentDayStatus;
      });
      return { ...emp, processedAttendance: newProcessedAttendance };
    });
    setProcessedAttendanceData(processedData);
  }, [selectedMonth, selectedYear, rawAttendanceData, isLoadingState]);


  const handleFileUpload = (file: File) => {
    if (!uploadMonth || !uploadYear) {
      toast({
        title: "Selection Missing",
        description: "Please select the month and year for the attendance data before uploading.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error Reading File", description: "Could not read the file content.", variant: "destructive" });
        return;
      }

      try {
        const lines = text.split(/\r\n|\n/).map(line => line.trim()).filter(line => line); 
        if (lines.length < 2) { 
          toast({ title: "Invalid File", description: "File is empty or has no data rows. Header + at least one data row expected.", variant: "destructive" });
          return;
        }

        const dataRows = lines.slice(1);
        const daysInUploadMonth = new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate();
        const expectedBaseColumns = 6; 
        
        const newAttendanceData: EmployeeAttendanceData[] = dataRows.map((row, rowIndex) => {
          const values = row.split(',');
          if (values.length < expectedBaseColumns + daysInUploadMonth) {
            console.warn(`Skipping row ${rowIndex + 1} due to insufficient columns. Expected ${expectedBaseColumns + daysInUploadMonth}, got ${values.length}`);
            return null; 
          }
          const status = values[0]?.trim() || "Active";
          const division = values[1]?.trim() || "N/A";
          const code = values[2]?.trim() || `TEMP_ID_${rowIndex}`;
          const name = values[3]?.trim() || "N/A";
          const designation = values[4]?.trim() || "N/A";
          const doj = values[5]?.trim() || new Date().toISOString().split('T')[0]; 
          
          const dailyStatuses = values.slice(expectedBaseColumns, expectedBaseColumns + daysInUploadMonth).map(statusValue => {
            const trimmedUpperStatus = statusValue.trim().toUpperCase();
            if (trimmedUpperStatus === '' || trimmedUpperStatus === '-') {
              return 'A'; 
            }
            return trimmedUpperStatus;
          }); 

          return {
            id: code, 
            status,
            division,
            code,
            name,
            designation,
            doj,
            grossMonthlySalary: 0, // Will be populated from Employee Master if available, 0 for now.
            attendance: dailyStatuses,
          };
        }).filter(item => item !== null) as EmployeeAttendanceData[]; 

        if (newAttendanceData.length === 0) {
            toast({ title: "No Data Processed", description: "No valid employee attendance data found in the file. Check column count and format.", variant: "destructive"});
            return;
        }
        
        setRawAttendanceData([]); 
        setProcessedAttendanceData([]); 

        setRawAttendanceData(newAttendanceData);
        setUploadedFileName(file.name);
        const newUploadContext = { month: uploadMonth, year: uploadYear };
        setUploadContext(newUploadContext);
        
        if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_RAW_KEY, JSON.stringify(newAttendanceData));
              localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_FILENAME_KEY, file.name);
              localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_CONTEXT_KEY, JSON.stringify(newUploadContext));
            } catch (storageError) {
                console.error("Error saving attendance data to localStorage:", storageError);
                toast({ title: "Storage Error", description: "Could not save attendance data locally. It will be lost on refresh.", variant: "destructive" });
            }
        }
        
        setSelectedMonth(uploadMonth);
        setSelectedYear(uploadYear);
        setIsLoadingState(false); 

        toast({
          title: "Attendance Data Loaded",
          description: `${newAttendanceData.length} employee records loaded from ${file.name} for ${uploadMonth} ${uploadYear}. Switched to View tab.`,
        });
        
        const viewTabTrigger = document.querySelector('button[role="tab"][value="view"]') as HTMLElement | null;
        if (viewTabTrigger) {
          viewTabTrigger.click();
        }

      } catch (error)
      {
        console.error("Error parsing CSV:", error);
        toast({ title: "Parsing Error", description: "Could not parse the CSV file. Please check its format and column order.", variant: "destructive" });
        setRawAttendanceData([]);
        setProcessedAttendanceData([]);
        setUploadedFileName(null);
        setUploadContext(null);
      }
    };

    reader.onerror = () => {
      toast({ title: "File Read Error", description: "An error occurred while trying to read the file.", variant: "destructive" });
    };

    reader.readAsText(file);
  };

  const handleDownloadReport = () => {
    if (processedAttendanceData.length === 0 || !selectedMonth || !selectedYear) {
      toast({
        title: "No Data",
        description: "No attendance data available to download for the selected period. Please upload a file first.",
        variant: "destructive",
      });
      return;
    }

    const daysInCurrentMonth = new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate();
    const csvRows: string[][] = [];

    const headers = [
      "Status", "Division", "Code", "Name", "Designation", "DOJ",
      ...Array.from({ length: daysInCurrentMonth }, (_, i) => (i + 1).toString()),
      "Working Days (P)", "Absent-1 (A)", "Absent-2 (A+HD)", "Weekoff (W)",
      "Total CL (Used)", "Total PL (Used)", "Total SL (Used)", "Paid Holiday (PH)",
      "Total Days (Month)", "Paid Days"
    ];
    csvRows.push(headers);

    processedAttendanceData.forEach(emp => {
      if (!emp.processedAttendance) return;
      const finalAttendanceToUse = emp.processedAttendance;

      const workingDaysP = finalAttendanceToUse.filter(s => s === 'P').length;
      const absent1A = finalAttendanceToUse.filter(s => s === 'A').length;
      const halfDays = finalAttendanceToUse.filter(s => s === 'HD').length;
      const absent2AHd = absent1A + (halfDays * 0.5);
      const weekOffsW = finalAttendanceToUse.filter(s => s === 'W').length;
      const totalCLUsed = finalAttendanceToUse.filter(s => s === 'CL').length;
      const totalPLUsed = finalAttendanceToUse.filter(s => s === 'PL').length;
      const totalSLUsed = finalAttendanceToUse.filter(s => s === 'SL').length;
      const paidHolidaysPH = finalAttendanceToUse.filter(s => s === 'PH').length;
      const notJoinedDays = finalAttendanceToUse.filter(s => s === '-').length;
      
      const totalDaysInMonthForCalc = daysInCurrentMonth - notJoinedDays; 
      const paidDaysCalculated = workingDaysP + weekOffsW + totalCLUsed + totalSLUsed + totalPLUsed + paidHolidaysPH + (halfDays * 0.5);

      const row = [
        emp.status || "N/A",
        emp.division || "N/A",
        emp.code,
        emp.name,
        emp.designation,
        emp.doj,
        ...finalAttendanceToUse,
        workingDaysP.toString(),
        absent1A.toString(),
        absent2AHd.toFixed(1),
        weekOffsW.toString(),
        totalCLUsed.toString(),
        totalPLUsed.toString(),
        totalSLUsed.toString(),
        paidHolidaysPH.toString(),
        (totalDaysInMonthForCalc < 0 ? 0 : totalDaysInMonthForCalc).toString(),
        paidDaysCalculated.toFixed(1)
      ];
      csvRows.push(row);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyy-MM-dd'); 
    link.setAttribute("download", `attendance_report_${selectedMonth}_${selectedYear}_${formattedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: `Attendance report for ${selectedMonth} ${selectedYear} is being downloaded.`,
    });
  };

  const handleDownloadSampleTemplate = () => {
    const daysForTemplate = (uploadYear && uploadMonth) ? new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate() : 31;
    const csvRows: string[][] = [];
    const headers = ["Status", "Division", "Code", "Name", "Designation", "DOJ", ...Array.from({ length: daysForTemplate }, (_, i) => (i + 1).toString())];
    csvRows.push(headers);
    
    const sampleRow1 = ["Active", "Technology", "E001", "John Doe", "Software Engineer", "2023-01-15", ...Array(daysForTemplate).fill("P")];
    if (daysForTemplate >= 7) { sampleRow1[6+5] = "W"; sampleRow1[6+6] = "W"; } 
    if (daysForTemplate >= 11) sampleRow1[6+10] = "CL"; 
    csvRows.push(sampleRow1);

    const sampleRow2 = ["Active", "Sales", "E002", "Jane Smith", "Project Manager", "2024-03-20", ...Array(daysForTemplate).fill("P")];
    if (daysForTemplate >= 15) { sampleRow2[6+13] = "A"; sampleRow2[6+14] = "HD"; }
    csvRows.push(sampleRow2);


    const csvContent = csvRows.map(row => row.join(',')).join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url); 
    const monthYearForFilename = (uploadMonth && uploadYear) ? `${uploadMonth}_${uploadYear}` : "sample";
    link.setAttribute("download", `attendance_template_${monthYearForFilename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Sample Template Downloaded",
      description: `attendance_template_${monthYearForFilename}.csv has been downloaded.`,
    });
  };

  const triggerDeleteConfirmation = () => {
    if (canDeleteCurrentData && isEditor) {
        setShowDeleteConfirmation(true);
    } else if (!isEditor) {
        toast({
            title: "Permission Denied",
            description: "You do not have permission to delete data. Please login as editor.",
            variant: "destructive"
        });
    } else {
        toast({
            title: "No Data to Clear",
            description: `No specific uploaded data found for ${selectedMonth} ${selectedYear} to clear, or data might not match current view.`,
            variant: "destructive"
        });
    }
  };

  const confirmAndDeleteData = () => {
    if (deleteConfirmationText === "DELETE") {
        setRawAttendanceData([]);
        setProcessedAttendanceData([]);
        setUploadedFileName(null);
        setUploadContext(null); 
        
        if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_RAW_KEY);
              localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_FILENAME_KEY);
              localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_CONTEXT_KEY);
            } catch (error) {
                console.error("Error clearing attendance data from localStorage:", error);
            }
        }

        toast({
            title: "Data Cleared",
            description: `Uploaded attendance data for ${selectedMonth} ${selectedYear} has been cleared.`,
        });
    } else {
         toast({
            title: "Incorrect Confirmation",
            description: "The text you entered did not match 'DELETE'. Data has not been cleared.",
            variant: "destructive",
        });
    }
    setShowDeleteConfirmation(false);
    setDeleteConfirmationText('');
  };
  
  const daysInSelectedViewMonth = (selectedYear && selectedMonth && selectedYear > 0) ? new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate() : 0;
  const daysInSelectedUploadMonth = (uploadYear && uploadMonth && uploadYear > 0) ? new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate() : 31;

  const availableYears = currentYear > 0 ? Array.from({ length: 5 }, (_, i) => currentYear - i) : [];
  const canDeleteCurrentData = !!(uploadedFileName && uploadContext && uploadContext.month === selectedMonth && uploadContext.year === selectedYear && rawAttendanceData.length > 0);
  
  if (isLoadingAuth || isLoadingState) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Attendance Dashboard" description="Manage and view employee attendance. Blank/'-' in upload treated as Absent. Leaves without balance marked Absent.">
        <Button 
            variant="outline" 
            onClick={handleDownloadReport} 
            disabled={isLoadingAuth || !isEditor || processedAttendanceData.length === 0 || !selectedMonth || !selectedYear || selectedYear === 0}
            title={!isEditor ? "Login as editor to download" : ""}
        >
            <Download className="mr-2 h-4 w-4" />
            Download Report (CSV)
        </Button>
         <Button 
            variant="destructive" 
            onClick={triggerDeleteConfirmation} 
            disabled={isLoadingAuth || !isEditor || !canDeleteCurrentData}
            title={!isEditor ? "Login as editor to clear data" : ""}
        >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Data for {selectedMonth && selectedYear > 0 ? `${selectedMonth} ${selectedYear}`: 'Current View'}
        </Button>
      </PageHeader>

      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the uploaded attendance data for
              <strong> {selectedMonth} {selectedYear}</strong>.
              <br />
              Please type <strong>DELETE</strong> in the box below to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmationText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAndDeleteData} 
              disabled={deleteConfirmationText !== "DELETE"}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[450px]">
          <TabsTrigger value="view">View & Filter Attendance</TabsTrigger>
          <TabsTrigger value="upload">Upload Attendance Data</TabsTrigger>
        </TabsList>
        <TabsContent value="view">
          <Card className="my-6 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter attendance records by month and year. (More filters like employee/division are illustrative).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
              {isLoadingState && !selectedMonth ? (
                <div className="w-full sm:w-[180px] h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {isLoadingState && selectedYear === 0 ? (
                 <div className="w-full sm:w-[120px] h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Input placeholder="Filter by Employee Name/Code..." className="w-full sm:w-[250px]" disabled />
              <Select disabled>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">Technology</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled>
                <Filter className="mr-2 h-4 w-4" /> Apply Filters
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Attendance Records for {selectedMonth} {selectedYear > 0 ? selectedYear : ''}</CardTitle>
              <CardDescription>
                Color codes: P (Present), A (Absent), HD (Half-Day), W (Week Off), PH (Public Holiday), CL/SL/PL (Leaves).
                <br/> If CL/SL/PL is taken without sufficient balance, it is marked as 'A' (Absent).
                <br/> '-' indicates the employee had not joined by the selected month/day. Blank or '-' cells in uploaded file are treated as 'A'.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
            {(() => {
                if (isLoadingState && (!selectedMonth || selectedYear === 0)) {
                    return <div className="text-center py-8 text-muted-foreground">Initializing...</div>;
                }
                 if (!selectedMonth || !selectedYear || selectedYear === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Please select month and year to view records.
                    </div>
                  );
                }
                if (uploadedFileName && rawAttendanceData.length === 0 && uploadContext && uploadContext.month === selectedMonth && uploadContext.year === selectedYear) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Data parsed from '{uploadedFileName}' for {uploadContext.month} {uploadContext.year}.<br />
                      The file might be empty, have an incorrect format, or no valid data rows. Check console for errors or upload again.
                    </div>
                  );
                }
               
                if (processedAttendanceData.length === 0 && daysInSelectedViewMonth > 0) {
                    if (!uploadedFileName) {
                        return (
                            <div className="text-center py-8 text-muted-foreground">
                                No attendance data to display for {selectedMonth} {selectedYear}. <br/>
                                Please upload an attendance file in the 'Upload Attendance Data' tab.
                            </div>
                        );
                    }
                    return (
                        <div className="text-center py-8 text-muted-foreground">
                            No processed data available for {selectedMonth} {selectedYear}. <br/>
                            This might be because the uploaded file ('{uploadedFileName}') was for a different period, was empty, or had format issues.
                        </div>
                    );
                }
                if (processedAttendanceData.length === 0 && !uploadedFileName) {
                     return (
                        <div className="text-center py-8 text-muted-foreground">
                            No attendance data available. Please upload a file via the 'Upload Attendance Data' tab.
                        </div>
                    );
                }


                if (processedAttendanceData.length > 0 && daysInSelectedViewMonth > 0 && processedAttendanceData[0]?.processedAttendance) {
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="min-w-[120px]">Division</TableHead>
                          <TableHead className="min-w-[80px]">Code</TableHead>
                          <TableHead className="min-w-[150px]">Name</TableHead>
                          <TableHead className="min-w-[150px]">Designation</TableHead>
                          <TableHead className="min-w-[100px]">DOJ</TableHead>
                          {Array.from({ length: daysInSelectedViewMonth }, (_, i) => i + 1).map(day => (
                            <TableHead key={day} className="text-center min-w-[50px]">{day}</TableHead>
                          ))}
                          <TableHead className="text-center min-w-[100px]">Working Days (P)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Absent-1 (A)</TableHead>
                          <TableHead className="text-center min-w-[110px]">Absent-2 (A+HD)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Weekoff (W)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Total CL (Used)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Total PL (Used)</TableHead>
                          <TableHead className="text-center min-w-[100px]">Total SL (Used)</TableHead>
                          <TableHead className="text-center min-w-[110px]">Paid Holiday (PH)</TableHead>
                          <TableHead className="text-center min-w-[130px]">Total Days (Month)</TableHead>
                          <TableHead className="text-center min-w-[120px]">Paid Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedAttendanceData.map((emp) => {
                          if (!emp.processedAttendance) { 
                            return <TableRow key={emp.id}><TableCell colSpan={daysInSelectedViewMonth + 16}>Processing data for {emp.name}...</TableCell></TableRow>;
                          }
                          const finalAttendanceToUse = emp.processedAttendance; 

                          const workingDaysP = finalAttendanceToUse.filter(s => s === 'P').length;
                          const absent1A = finalAttendanceToUse.filter(s => s === 'A').length;
                          const halfDays = finalAttendanceToUse.filter(s => s === 'HD').length;
                          const absent2AHd = absent1A + (halfDays * 0.5); 
                          const weekOffsW = finalAttendanceToUse.filter(s => s === 'W').length;
                          const totalCLUsed = finalAttendanceToUse.filter(s => s === 'CL').length;
                          const totalPLUsed = finalAttendanceToUse.filter(s => s === 'PL').length;
                          const totalSLUsed = finalAttendanceToUse.filter(s => s === 'SL').length;
                          const paidHolidaysPH = finalAttendanceToUse.filter(s => s === 'PH').length;
                          const notJoinedDays = finalAttendanceToUse.filter(s => s === '-').length;

                          const totalDaysInMonthForCalc = daysInSelectedViewMonth - notJoinedDays; 
                          const paidDaysCalculated = workingDaysP + weekOffsW + totalCLUsed + totalSLUsed + totalPLUsed + paidHolidaysPH + (halfDays * 0.5);
                          
                          return (
                          <TableRow key={emp.id}>
                            <TableCell>{emp.status || "N/A"}</TableCell>
                            <TableCell>{emp.division || "N/A"}</TableCell>
                            <TableCell>{emp.code}</TableCell>
                            <TableCell>{emp.name}</TableCell>
                            <TableCell>{emp.designation}</TableCell>
                            <TableCell>{emp.doj}</TableCell>
                            {finalAttendanceToUse.map((status, index) => (
                              <TableCell key={index} className="text-center">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ATTENDANCE_STATUS_COLORS[status] || 'bg-gray-200 text-gray-800'}`}>
                                  {status}
                                </span>
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-semibold">{workingDaysP}</TableCell>
                            <TableCell className="text-center font-semibold">{absent1A}</TableCell>
                            <TableCell className="text-center font-semibold">{absent2AHd.toFixed(1)}</TableCell>
                            <TableCell className="text-center font-semibold">{weekOffsW}</TableCell>
                            <TableCell className="text-center font-semibold">{totalCLUsed}</TableCell>
                            <TableCell className="text-center font-semibold">{totalPLUsed}</TableCell>
                            <TableCell className="text-center font-semibold">{totalSLUsed}</TableCell>
                            <TableCell className="text-center font-semibold">{paidHolidaysPH}</TableCell>
                            <TableCell className="text-center font-semibold">{totalDaysInMonthForCalc < 0 ? 0 : totalDaysInMonthForCalc}</TableCell>
                            <TableCell className="text-center font-semibold">{paidDaysCalculated.toFixed(1)}</TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={6} className="font-semibold text-right">Total Employees Displayed:</TableCell>
                          <TableCell colSpan={daysInSelectedViewMonth + 10} className="font-semibold">{processedAttendanceData.filter(e => e.processedAttendance && e.processedAttendance.some(s => s!=='-')).length}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  );
                }
                return (
                  <div className="text-center py-8 text-muted-foreground">
                     An unexpected state occurred. Please try selecting month/year or uploading a file.
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upload">
          <Card className="my-6 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Upload Attendance Data</CardTitle>
              <CardDescription>
                Select the month and year, then upload a CSV file with employee attendance.
                <br/>Expected columns: Status, Division, Code, Name, Designation, DOJ, and daily status columns (1 to {daysInSelectedUploadMonth}).
                <br/>Only editors can upload files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={uploadMonth} onValueChange={setUploadMonth} disabled={isLoadingAuth}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Upload Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={uploadYear > 0 ? uploadYear.toString() : ""} onValueChange={(value) => setUploadYear(parseInt(value))} disabled={isLoadingAuth}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Upload Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <FileUploadButton 
                  onFileUpload={handleFileUpload} 
                  buttonText="Upload Attendance CSV" 
                  acceptedFileTypes=".csv"
                  disabled={isLoadingAuth || !uploadMonth || !uploadYear || uploadYear === 0 || !isEditor}
                  title={!isEditor ? "Login as editor to upload" : (!uploadMonth || !uploadYear || uploadYear === 0 ? "Select month and year first" : "Upload attendance CSV file")}
                />
                <Button 
                  variant="link" 
                  onClick={handleDownloadSampleTemplate} 
                  className="p-0 h-auto text-left"
                  disabled={!uploadMonth || !uploadYear || uploadYear === 0 } 
                >
                  <Download className="mr-2 h-4 w-4 flex-shrink-0" /> Download Sample Template (CSV for {uploadMonth && uploadYear > 0 ? `${uploadMonth} ${uploadYear}` : 'selected period'})
                </Button>
              </div>
               {uploadedFileName && uploadContext && (
                <p className="text-sm text-muted-foreground">
                  Last successful upload: {uploadedFileName} for {uploadContext.month} {uploadContext.year}.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
