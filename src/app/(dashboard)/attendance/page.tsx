
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { ATTENDANCE_STATUS_COLORS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, Loader2, Edit, Search } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { startOfDay, parseISO, isBefore, isEqual, format, endOfMonth, getDaysInMonth, isAfter, isValid } from "date-fns";

const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX = "novita_attendance_filename_v4_";
const LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY = "novita_last_upload_context_v4";
const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";


interface EmployeeAttendanceData extends EmployeeDetail {
  attendance: string[]; 
  processedAttendance?: string[]; 
  isMissingInMaster?: boolean;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const editEmployeeStatusFormSchema = z.object({
  dor: z.string().refine((val) => {
    if (!val) return false; 
    try {
        const date = parseISO(val);
        return isValid(date);
    } catch {
        return false;
    }
  }, { message: "Valid Date of Resignation (YYYY-MM-DD) is required"}),
  // @ts-ignore - This is a bit of a hack to get DOJ context for validation
  doj: z.string().optional(), 
}).refine((data) => {
  if (data.doj && data.dor && isValid(parseISO(data.doj)) && isValid(parseISO(data.dor))) {
    if (isBefore(parseISO(data.dor), parseISO(data.doj))) {
      return false;
    }
  }
  return true;
}, {
  message: "DOR cannot be before DOJ.",
  path: ["dor"],
});

type EditEmployeeStatusFormValues = z.infer<typeof editEmployeeStatusFormSchema>;


export default function AttendancePage() {
  const { toast } = useToast();
  const [rawAttendanceData, setRawAttendanceData] = React.useState<EmployeeAttendanceData[]>([]);
  const [processedAttendanceData, setProcessedAttendanceData] = React.useState<EmployeeAttendanceData[]>([]);
  const [filteredAttendanceData, setFilteredAttendanceData] = React.useState<EmployeeAttendanceData[]>([]);
  const [employeeMasterList, setEmployeeMasterList] = React.useState<EmployeeDetail[]>([]);
  
  const [currentMonthName, setCurrentMonthName] = React.useState('');
  const [currentYear, setCurrentYear] = React.useState(0);
  
  const [selectedMonth, setSelectedMonth] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [uploadMonth, setUploadMonth] = React.useState<string>('');
  const [uploadYear, setUploadYear] = React.useState<number>(0);

  const [isLoadingState, setIsLoadingState] = React.useState(true);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null); 
  
  const [isClearDataDialogOpen, setIsClearDataDialogOpen] = React.useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = React.useState('');
  const [dialogClearMonth, setDialogClearMonth] = React.useState<string>('');
  const [dialogClearYear, setDialogClearYear] = React.useState<number>(0);

  const [isEditAttendanceDialogOpen, setIsEditAttendanceDialogOpen] = React.useState(false);
  const [editingAttendanceEmployee, setEditingAttendanceEmployee] = React.useState<EmployeeAttendanceData | null>(null);
  const [editableDailyStatuses, setEditableDailyStatuses] = React.useState<string[]>([]);

  const [isEditEmployeeStatusDialogOpen, setIsEditEmployeeStatusDialogOpen] = React.useState(false);
  const [editingEmployeeForStatus, setEditingEmployeeForStatus] = React.useState<EmployeeDetail | null>(null);

  const [missingInMasterList, setMissingInMasterList] = React.useState<EmployeeAttendanceData[]>([]);
  const [missingInAttendanceList, setMissingInAttendanceList] = React.useState<EmployeeDetail[]>([]);

  const statusEditForm = useForm<EditEmployeeStatusFormValues>({
    resolver: zodResolver(editEmployeeStatusFormSchema),
    defaultValues: { dor: "", doj: "" },
  });

  React.useEffect(() => {
    setIsLoadingState(true);
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonthName = months[now.getMonth()];

    setCurrentYear(defaultYear);
    setCurrentMonthName(defaultMonthName);
    
    setSelectedMonth(defaultMonthName);
    setSelectedYear(defaultYear);
    setUploadMonth(defaultMonthName); 
    setUploadYear(defaultYear);
    
    if (typeof window !== 'undefined') {
      try {
        const storedMaster = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedMaster) {
          const parsedMaster = JSON.parse(storedMaster);
          if (Array.isArray(parsedMaster)) {
            setEmployeeMasterList(parsedMaster);
          } else {
            setEmployeeMasterList([]);
            toast({ title: "Data Error", description: "Employee master data in localStorage is corrupted. Please check Employee Master page. Using empty list.", variant: "destructive", duration: 7000 });
          }
        } else {
          setEmployeeMasterList([]);
        }
      } catch (error) {
        console.error("Error loading employee master from localStorage:", error);
        setEmployeeMasterList([]);
        toast({ title: "Storage Error", description: "Could not load employee master data. Using empty list.", variant: "destructive", duration: 7000 });
      }
    }
    setIsLoadingState(false); 
  }, [toast]);

  React.useEffect(() => {
    if (!selectedMonth || !selectedYear || selectedYear === 0) {
      setRawAttendanceData([]);
      setUploadedFileName(null);
      return;
    }
    setIsLoadingState(true);
    if (typeof window !== 'undefined') {
      const rawDataKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${selectedMonth}_${selectedYear}`;
      const filenameKey = `${LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX}${selectedMonth}_${selectedYear}`;
      try {
        const storedRawData = localStorage.getItem(rawDataKey);
        const storedFilename = localStorage.getItem(filenameKey);

        if (storedRawData) {
          const parsedRawData = JSON.parse(storedRawData);
          if (Array.isArray(parsedRawData)) {
            setRawAttendanceData(parsedRawData);
            setUploadedFileName(storedFilename || null);
          } else {
            toast({ title: "Data Error", description: `Attendance data for ${selectedMonth} ${selectedYear} in localStorage is corrupted. Data not loaded. Please re-upload if needed.`, variant: "destructive", duration: 7000 });
            setRawAttendanceData([]);
            setUploadedFileName(null);
          }
        } else {
          setRawAttendanceData([]);
          setUploadedFileName(null);
        }
      } catch (error) {
        console.error(`Error loading attendance data for ${selectedMonth} ${selectedYear} from localStorage:`, error);
        toast({ title: "Storage Error", description: `Could not load attendance data for ${selectedMonth} ${selectedYear}. Data may be corrupted.`, variant: "destructive", duration: 7000 });
        setRawAttendanceData([]);
        setUploadedFileName(null);
      }
    }
    setIsLoadingState(false);
  }, [selectedMonth, selectedYear, toast]);


  React.useEffect(() => {
    if (rawAttendanceData.length === 0 || !selectedYear || !selectedMonth || selectedYear === 0) {
      setProcessedAttendanceData([]);
      setMissingInMasterList([]);
      setMissingInAttendanceList([]);
      return;
    }

    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) { 
        setProcessedAttendanceData([]);
        setMissingInMasterList([]);
        setMissingInAttendanceList([]);
        return;
    }
    const masterEmployeeCodes = new Set(employeeMasterList.map(emp => emp.code));
    const attendanceEmployeeCodes = new Set(rawAttendanceData.map(emp => emp.code));
    
    const currentMissingInMaster: EmployeeAttendanceData[] = [];
    const selectedMonthStartDate = startOfDay(new Date(selectedYear, monthIndex, 1));
    const selectedMonthEndDate = endOfMonth(selectedMonthStartDate);

    const processedData = rawAttendanceData.map(emp => {
      const isMissingInMaster = !masterEmployeeCodes.has(emp.code);
      if (isMissingInMaster) {
        currentMissingInMaster.push(emp);
      }

      let employeeStartDate = new Date(1900, 0, 1); 
      if (emp.doj) {
          try {
              const parsedDoj = parseISO(emp.doj); 
              if (isValid(parsedDoj)) {
                  employeeStartDate = parsedDoj;
              } else {
                  console.warn(`Invalid DOJ format "${emp.doj}" for employee ${emp.code} during processing. Defaulting to past date.`);
              }
          } catch (e) {
              console.warn(`Error parsing DOJ "${emp.doj}" for employee ${emp.code} during processing. Defaulting to past date. Error: ${e}`);
          }
      } else {
          console.warn(`Missing DOJ for employee ${emp.code} during processing. Defaulting to past date.`);
      }

      if (isBefore(selectedMonthEndDate, startOfDay(employeeStartDate))) {
         return { ...emp, processedAttendance: Array(new Date(selectedYear, monthIndex + 1, 0).getDate()).fill('-'), isMissingInMaster };
      }

      const daysInCurrentMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
      const rawDailyStatuses = emp.attendance.slice(0, daysInCurrentMonth);

      const newProcessedAttendance = rawDailyStatuses.map((status, dayIndex) => {
        const currentDateInLoop = new Date(selectedYear, monthIndex, dayIndex + 1);
        if (isBefore(currentDateInLoop, startOfDay(employeeStartDate))) {
          return '-'; 
        }
        return status; 
      });
      
      return { ...emp, processedAttendance: newProcessedAttendance, isMissingInMaster };
    });
    setProcessedAttendanceData(processedData);
    setMissingInMasterList(currentMissingInMaster);

    const currentMissingInAttendance = employeeMasterList.filter(emp => {
      if (emp.status !== "Active" || attendanceEmployeeCodes.has(emp.code) || !emp.doj) {
        return false;
      }
      try {
        const employeeDOJ = startOfDay(parseISO(emp.doj));
        return !isAfter(employeeDOJ, selectedMonthEndDate);
      } catch (e) {
        console.warn(`Invalid DOJ for employee ${emp.code} in master list when checking mismatch: ${emp.doj}`);
        return false; 
      }
    });
    setMissingInAttendanceList(currentMissingInAttendance);

  }, [rawAttendanceData, selectedYear, selectedMonth, employeeMasterList]);

  React.useEffect(() => {
    if (!searchTerm) {
      setFilteredAttendanceData(processedAttendanceData);
      return;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = processedAttendanceData.filter(emp => {
      return (
        emp.name.toLowerCase().includes(lowercasedFilter) ||
        emp.code.toLowerCase().includes(lowercasedFilter)
      );
    });
    setFilteredAttendanceData(filtered);
  }, [processedAttendanceData, searchTerm]);


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
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error Reading File", description: "Could not read the file content.", variant: "destructive" });
        return;
      }

      const fileNameLower = file.name.toLowerCase();
      const uploadMonthLower = uploadMonth.toLowerCase();
      const uploadYearStr = uploadYear.toString();

      if (!fileNameLower.includes(uploadMonthLower) || !fileNameLower.includes(uploadYearStr)) {
        toast({
          title: "Filename Mismatch",
          description: `The filename '${file.name}' does not seem to correspond to the selected period '${uploadMonth} ${uploadYear}'. Please ensure the filename contains both the month name (e.g., '${uploadMonthLower}') and the year (e.g., '${uploadYearStr}').`,
          variant: "destructive",
          duration: 9000,
        });
        return;
      }

      try {
        const lines = text.split(/\r\n|\n/).map(line => line.trim()).filter(line => line);
        if (lines.length < 2) {
          toast({ title: "Invalid File", description: "File is empty or has no data rows. Header + at least one data row expected.", variant: "destructive" });
          return;
        }

        const headerLine = lines[0];
        const headerValues = headerLine.split(',');
        const expectedBaseColumns = 6; 
        const actualDayColumnsInFile = headerValues.length - expectedBaseColumns;
        const daysInUploadMonth = new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate();

        if (actualDayColumnsInFile !== daysInUploadMonth) {
          toast({
            title: "File Format Error",
            description: `The number of day columns in the file (${actualDayColumnsInFile}) does not match the number of days in ${uploadMonth} ${uploadYear} (${daysInUploadMonth}). Please ensure the file corresponds to the selected month.`,
            variant: "destructive",
            duration: 7000,
          });
          return;
        }

        const dataRows = lines.slice(1);
        const newAttendanceData: EmployeeAttendanceData[] = [];
        const encounteredCodes = new Set<string>();
        let skippedDuplicateCount = 0;
        let malformedRowCount = 0;

        dataRows.forEach((row, rowIndex) => {
          const values = row.split(',').map(v => v.trim());
          if (values.length < expectedBaseColumns + daysInUploadMonth) {
            console.warn(`Skipping row ${rowIndex + 1} in attendance CSV: insufficient columns. Expected ${expectedBaseColumns + daysInUploadMonth}, got ${values.length}`);
            malformedRowCount++;
            return;
          }
          const statusValue = values[0] || "Active";
          const division = values[1] || "N/A";
          const code = values[2] || `TEMP_ID_${rowIndex}`;
          const name = values[3] || "N/A";
          const designation = values[4] || "N/A";
          
          const dojFromCsv = values[5];
          let standardizedDoj = new Date(1900,0,1).toISOString().split('T')[0]; 
          if (dojFromCsv) {
            let parsedCsvDoj = parseISO(dojFromCsv); 
            if (isValid(parsedCsvDoj)) {
                standardizedDoj = format(parsedCsvDoj, 'yyyy-MM-dd');
            } else {
                const dateParts = dojFromCsv.match(/^(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{2,4})$/);
                if (dateParts) {
                    let day, month, yearStr;
                    const part1 = parseInt(dateParts[1]); 
                    const part2 = parseInt(dateParts[2]); 
                    const part3 = parseInt(dateParts[3]); 

                    if (part3 > 1000) { 
                        yearStr = part3;
                        if (part2 <= 12 && part1 <=31 && isValid(new Date(yearStr, part2 - 1, part1))) {
                           standardizedDoj = format(new Date(yearStr, part2 - 1, part1), 'yyyy-MM-dd');
                        } 
                        else if (part1 <= 12 && part2 <=31 && isValid(new Date(yearStr, part1 - 1, part2))) {
                           standardizedDoj = format(new Date(yearStr, part1 - 1, part2), 'yyyy-MM-dd');
                        }
                    } else { 
                        yearStr = part3 + 2000; 
                         if (part2 <= 12 && part1 <=31 && isValid(new Date(yearStr, part2 - 1, part1))) {
                           standardizedDoj = format(new Date(yearStr, part2 - 1, part1), 'yyyy-MM-dd');
                        }
                        else if (part1 <= 12 && part2 <=31 && isValid(new Date(yearStr, part1 - 1, part2))) {
                           standardizedDoj = format(new Date(yearStr, part1 - 1, part2), 'yyyy-MM-dd');
                        }
                    }
                }
                 if (standardizedDoj === new Date(1900,0,1).toISOString().split('T')[0]) { 
                    console.warn(`Could not parse DOJ "${dojFromCsv}" for employee ${code}. Using default 1900-01-01. Please use YYYY-MM-DD, DD-MM-YYYY, or MM-DD-YYYY format in CSV.`);
                 }
            }
          } else {
             console.warn(`Missing DOJ for employee ${code}. Using default 1900-01-01.`);
          }
          
          const hq = "N/A"; 
          const grossMonthlySalary = 0; 

          if (!code || !name || !designation ) { 
            console.warn(`Skipping row ${rowIndex + 1} (Code: ${code}) in attendance CSV: missing critical employee details.`);
            malformedRowCount++;
            return;
          }

          if (encounteredCodes.has(code)) {
            skippedDuplicateCount++;
            console.warn(`Skipping duplicate employee code '${code}' in uploaded file at row ${rowIndex + 1}.`);
            return;
          }
          encounteredCodes.add(code);

          const dailyStatuses = values.slice(expectedBaseColumns, expectedBaseColumns + daysInUploadMonth).map(statusCsvValue => {
            const trimmedUpperStatus = statusCsvValue.trim().toUpperCase();
            if (trimmedUpperStatus === '' || trimmedUpperStatus === '-') {
              return 'A'; 
            }
            return trimmedUpperStatus;
          });

          newAttendanceData.push({
            id: code, status: statusValue, division, code, name, designation, hq, doj: standardizedDoj, grossMonthlySalary, attendance: dailyStatuses,
          });
        });
        
        let toastMessage = "";
        if (newAttendanceData.length > 0) {
            if (typeof window !== 'undefined') {
              const rawDataKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${uploadMonth}_${uploadYear}`;
              const filenameKey = `${LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX}${uploadMonth}_${uploadYear}`;
              const lastUploadContext = { month: uploadMonth, year: uploadYear };
              try {
                localStorage.setItem(rawDataKey, JSON.stringify(newAttendanceData));
                localStorage.setItem(filenameKey, file.name);
                localStorage.setItem(LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY, JSON.stringify(lastUploadContext));
              } catch (error) {
                console.error("Error saving attendance data to localStorage:", error);
                toast({ title: "Storage Error", description: "Could not save attendance data locally. Data will be lost on refresh.", variant: "destructive" });
              }
            }
            setRawAttendanceData(newAttendanceData); 
            setUploadedFileName(file.name);
            if (uploadMonth !== selectedMonth || uploadYear !== selectedYear) {
                setSelectedMonth(uploadMonth); 
                setSelectedYear(uploadYear);
            }
            toast({ title: "Attendance Data Processed", description: `${newAttendanceData.length} records loaded from ${file.name} for ${uploadMonth} ${uploadYear}. Data saved to local storage.`});
            setSearchTerm(''); 
            const viewTabTrigger = document.querySelector('button[role="tab"][value="view"]') as HTMLElement | null;
            if (viewTabTrigger) viewTabTrigger.click();

        } else {
            toastMessage += `No valid employee attendance data processed from ${file.name}. `;
        }
        
        if (skippedDuplicateCount > 0) toastMessage += `${skippedDuplicateCount} rows skipped due to duplicate employee codes in the file. `;
        if (malformedRowCount > 0) toastMessage += `${malformedRowCount} rows skipped due to missing/invalid data or column count. `;
        
        if(toastMessage && newAttendanceData.length === 0){
            toast({
              title: "Upload Issue",
              description: toastMessage.trim(),
              duration: 9000,
              variant: "destructive",
            });
        } else if (toastMessage) {
             toast({
                title: "Processing Notes",
                description: toastMessage.trim(),
                duration: 9000,
            });
        }


      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast({ title: "Parsing Error", description: "Could not parse the CSV file. Please check its format and column order. Ensure DOJ is in YYYY-MM-DD, DD-MM-YYYY, or MM-DD-YYYY.", variant: "destructive", duration: 7000 });
      }
    };

    reader.onerror = () => {
      toast({ title: "File Read Error", description: "An error occurred while trying to read the file.", variant: "destructive" });
    };

    reader.readAsText(file);
  };

  const handleDownloadReport = () => {
    if (filteredAttendanceData.length === 0 || !selectedMonth || !selectedYear || selectedYear === 0) {
      toast({
        title: "No Data",
        description: "No attendance data available to download for the selected period and filter. Please upload or select a period with data and ensure your filter returns results.",
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

    filteredAttendanceData.forEach(emp => {
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

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute("download", `attendance_report_${selectedMonth}_${selectedYear}_${searchTerm ? 'filtered_' : ''}${formattedDate}.csv`);
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
    const daysForTemplate = (uploadYear && uploadMonth && uploadYear > 0) ? new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate() : 31;
    const csvRows: string[][] = [];
    const headers = ["Status", "Division", "Code", "Name", "Designation", "DOJ", ...Array.from({ length: daysForTemplate }, (_, i) => (i + 1).toString())];
    csvRows.push(headers);

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.href) URL.revokeObjectURL(link.href); 
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const monthYearForFilename = (uploadMonth && uploadYear && uploadYear > 0) ? `${uploadMonth}_${uploadYear}` : "sample";
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
    setDialogClearMonth(''); 
    setDialogClearYear(0);
    setDeleteConfirmationText('');
    setIsClearDataDialogOpen(true);
  };

  const confirmAndDeleteData = () => {
    if (deleteConfirmationText === "DELETE" && dialogClearMonth && dialogClearYear > 0) {
        if (typeof window !== 'undefined') {
          const rawDataKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${dialogClearMonth}_${dialogClearYear}`;
          const filenameKey = `${LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX}${dialogClearMonth}_${dialogClearYear}`;
          try {
            localStorage.removeItem(rawDataKey);
            localStorage.removeItem(filenameKey);
            
            const lastUploadContextStr = localStorage.getItem(LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY);
            if (lastUploadContextStr) {
                const lastUploadContext = JSON.parse(lastUploadContextStr);
                if (lastUploadContext.month === dialogClearMonth && lastUploadContext.year === dialogClearYear) {
                    localStorage.removeItem(LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY);
                }
            }
          } catch (error) {
            console.error("Error clearing attendance data from localStorage:", error);
            toast({ title: "Storage Error", description: "Could not clear attendance data from local storage.", variant: "destructive" });
          }
        }
        
        if (dialogClearMonth === selectedMonth && dialogClearYear === selectedYear) {
            setRawAttendanceData([]);
            setUploadedFileName(null); 
        }
        
        toast({
            title: "Data Cleared",
            description: `Uploaded attendance data for ${dialogClearMonth} ${dialogClearYear} has been cleared from local storage.`,
        });
    } else {
         toast({
            title: "Incorrect Confirmation or Missing Selection",
            description: "The text you entered did not match 'DELETE' or month/year not selected for deletion. Data has not been cleared.",
            variant: "destructive",
        });
    }
    setIsClearDataDialogOpen(false);
    setDeleteConfirmationText('');
    setDialogClearMonth('');
    setDialogClearYear(0);
  };
  
  const handleOpenEditAttendanceDialog = (employeeCode: string) => {
    const employee = rawAttendanceData.find(emp => emp.code === employeeCode); 
    if (employee && selectedYear > 0 && selectedMonth) {
      const monthIndex = months.indexOf(selectedMonth);
      if (monthIndex === -1) {
        toast({ title: "Error", description: "Selected month is invalid.", variant: "destructive"});
        return;
      }
      const daysInMonth = getDaysInMonth(new Date(selectedYear, monthIndex));
      const currentRawAttendance = [...employee.attendance];
      while(currentRawAttendance.length < daysInMonth) {
        currentRawAttendance.push('A'); 
      }
      setEditableDailyStatuses(currentRawAttendance.slice(0, daysInMonth));
      setEditingAttendanceEmployee(employee);
      setIsEditAttendanceDialogOpen(true);
    } else {
       toast({ title: "Error", description: "Could not find employee's raw attendance data to edit or month/year not set.", variant: "destructive"});
    }
  };

  const handleDailyStatusChange = (dayIndex: number, newStatus: string) => {
    setEditableDailyStatuses(prevStatuses => {
      const newStatuses = [...prevStatuses];
      newStatuses[dayIndex] = newStatus;
      return newStatuses;
    });
  };

  const handleUpdateAttendance = () => {
    if (!editingAttendanceEmployee || !selectedMonth || selectedYear === 0) {
      toast({ title: "Error", description: "No employee selected for update or invalid period.", variant: "destructive"});
      return;
    }

    const updatedRawAttendanceData = rawAttendanceData.map(emp => {
      if (emp.code === editingAttendanceEmployee.code) {
        return { ...emp, attendance: [...editableDailyStatuses] }; 
      }
      return emp;
    });

    setRawAttendanceData(updatedRawAttendanceData); 
    
    if (typeof window !== 'undefined') {
        const rawDataKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${selectedMonth}_${selectedYear}`;
        try {
            localStorage.setItem(rawDataKey, JSON.stringify(updatedRawAttendanceData));
             toast({ title: "Attendance Updated", description: `Attendance for ${editingAttendanceEmployee.name} for ${selectedMonth} ${selectedYear} has been updated in local storage.`});
        } catch (error) {
            console.error("Error saving updated attendance to localStorage:", error);
            toast({ title: "Storage Error", description: "Could not save updated attendance data locally.", variant: "destructive" });
        }
    }
    
    setIsEditAttendanceDialogOpen(false);
    setEditingAttendanceEmployee(null);
  };

  const handleOpenEditEmployeeStatusDialog = (employee: EmployeeDetail) => {
    setEditingEmployeeForStatus(employee);
    statusEditForm.reset({ dor: employee.dor || "", doj: employee.doj }); 
    setIsEditEmployeeStatusDialogOpen(true);
  };

  const handleSaveEmployeeStatus = (values: EditEmployeeStatusFormValues) => {
    if (!editingEmployeeForStatus) return;

    const updatedMasterList = employeeMasterList.map(emp =>
      emp.id === editingEmployeeForStatus.id
        ? { ...emp, status: "Left" as "Left" | "Active", dor: values.dor }
        : emp
    );
    setEmployeeMasterList(updatedMasterList); 
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY, JSON.stringify(updatedMasterList));
        toast({ title: "Employee Status Updated", description: `${editingEmployeeForStatus.name} marked as 'Left' with DOR ${values.dor}. Master list updated in local storage.` });
      } catch (error) {
         console.error("Error saving updated employee master to localStorage:", error);
         toast({ title: "Storage Error", description: "Could not save updated employee master data locally.", variant: "destructive" });
      }
    }
    setIsEditEmployeeStatusDialogOpen(false);
    setEditingEmployeeForStatus(null);
  };


  const daysInSelectedViewMonth = (selectedYear && selectedMonth && selectedYear > 0 && months.indexOf(selectedMonth) !== -1) 
    ? getDaysInMonth(new Date(selectedYear, months.indexOf(selectedMonth))) 
    : 0;

  const daysInSelectedUploadMonth = (uploadYear && uploadMonth && uploadYear > 0 && months.indexOf(uploadMonth) !== -1) 
    ? getDaysInMonth(new Date(uploadYear, months.indexOf(uploadMonth))) 
    : 31;


  const availableYears = currentYear > 0 ? Array.from({ length: 5 }, (_, i) => currentYear - i) : [];
  const validAttendanceStatuses = Object.keys(ATTENDANCE_STATUS_COLORS).filter(status => status !== '-');


  if (isLoadingState && !selectedMonth && currentYear === 0) { 
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Attendance Dashboard" description="Manage and view employee attendance. Blank/'-' in upload treated as Absent. Leave statuses (CL/SL/PL) are recorded as is; balances (managed on Leave Mgt page) can go negative.">
        <Button
            variant="outline"
            onClick={handleDownloadReport}
            disabled={filteredAttendanceData.length === 0 || !selectedMonth || !selectedYear || selectedYear === 0}
        >
            <Download className="mr-2 h-4 w-4" />
            Download Report (CSV)
        </Button>
         <Button
            variant="destructive"
            onClick={triggerDeleteConfirmation}
            disabled={isLoadingState} 
        >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Uploaded Data
        </Button>
      </PageHeader>

      <AlertDialog open={isClearDataDialogOpen} onOpenChange={(isOpen) => {
          setIsClearDataDialogOpen(isOpen);
          if (!isOpen) {
              setDeleteConfirmationText('');
              setDialogClearMonth('');
              setDialogClearYear(0);
          }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Uploaded Attendance Data</AlertDialogTitle>
            <AlertDialogDescription>
              Select the month and year to permanently delete its uploaded attendance data from local storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            <Select value={dialogClearMonth} onValueChange={setDialogClearMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Month to Clear" />
              </SelectTrigger>
              <SelectContent>
                {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dialogClearYear > 0 ? dialogClearYear.toString() : ""} onValueChange={(value) => setDialogClearYear(parseInt(value))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Year to Clear" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {dialogClearMonth && dialogClearYear > 0 && (
            <p className="text-sm text-muted-foreground mb-2">
              You are about to delete data for <strong>{dialogClearMonth} {dialogClearYear}</strong>.
              <br />
              Please type <strong>DELETE</strong> in the box below to confirm.
            </p>
          )}
          
          <Input
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="my-2"
            disabled={!dialogClearMonth || dialogClearYear === 0}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
                setDeleteConfirmationText('');
                setDialogClearMonth('');
                setDialogClearYear(0);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndDeleteData}
              disabled={deleteConfirmationText !== "DELETE" || !dialogClearMonth || dialogClearYear === 0}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditAttendanceDialogOpen} onOpenChange={(isOpen) => {
          setIsEditAttendanceDialogOpen(isOpen);
          if (!isOpen) setEditingAttendanceEmployee(null);
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Attendance for {editingAttendanceEmployee?.name}</DialogTitle>
            <DialogDescription>
              Month: {selectedMonth} {selectedYear}. Modify daily attendance statuses below.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-1">
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-x-2 gap-y-4 p-2">
              {editableDailyStatuses.map((status, dayIndex) => (
                <div key={dayIndex} className="flex flex-col space-y-1">
                  <Label htmlFor={`day-${dayIndex + 1}`} className="text-xs font-medium text-center">Day {dayIndex + 1}</Label>
                  <Select
                    value={status}
                    onValueChange={(newStatus) => handleDailyStatusChange(dayIndex, newStatus)}
                  >
                    <SelectTrigger id={`day-${dayIndex + 1}`} className="h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {validAttendanceStatuses.map(statOpt => (
                        <SelectItem key={statOpt} value={statOpt}>{statOpt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleUpdateAttendance}>Update Attendance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditEmployeeStatusDialogOpen} onOpenChange={(isOpen) => {
        setIsEditEmployeeStatusDialogOpen(isOpen);
        if (!isOpen) setEditingEmployeeForStatus(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Employee Status for {editingEmployeeForStatus?.name}</DialogTitle>
            <DialogDescription>
              Mark employee as 'Left' and set their Date of Resignation (DOR). This will update the Employee Master in local storage.
            </DialogDescription>
          </DialogHeader>
          <Form {...statusEditForm}>
            <form 
              onSubmit={statusEditForm.handleSubmit(handleSaveEmployeeStatus)} 
              className="space-y-4 py-4"
            >
              <FormField
                control={statusEditForm.control}
                name="dor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Resignation (DOR)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>


      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="view">View & Filter Attendance</TabsTrigger>
          <TabsTrigger value="upload">Upload Attendance Data</TabsTrigger>
          <TabsTrigger value="mismatch">Data Mismatch Report</TabsTrigger>
        </TabsList>
        <TabsContent value="view">
          <Card className="my-6 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter attendance records by month, year, and employee name/code. (Division filter is illustrative).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
              {(isLoadingState && !selectedMonth) ? (
                <div className="w-full sm:w-[180px] h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Select value={selectedMonth} onValueChange={(value) => { setSelectedMonth(value); setSearchTerm(''); }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {(isLoadingState && selectedYear === 0 && currentYear > 0) ? ( 
                 <div className="w-full sm:w-[120px] h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => { setSelectedYear(parseInt(value)); setSearchTerm(''); }} >
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="relative w-full sm:w-auto sm:flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="search"
                    placeholder="Filter by Employee Name/Code..." 
                    className="w-full sm:w-[250px] pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select disabled>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech">Technology</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Attendance Records for {selectedMonth} {selectedYear > 0 ? selectedYear : ''}</CardTitle>
              <CardDescription>
                Color codes: P (Present), A (Absent), HD (Half-Day), W (Week Off), PH (Public Holiday), CL/SL/PL (Leaves).
                <br/> Leave statuses (CL, SL, PL) are taken as uploaded; balances are managed on the Leave Management page and can go negative.
                <br/> '-' indicates the employee had not joined by the selected month/day. Blank or '-' cells in uploaded file are treated as 'A'.
                <br/>Rows highlighted in light red indicate employee codes present in attendance but not found in the Employee Master.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
            {(() => {
                if (isLoadingState && (!selectedMonth || selectedYear === 0)) { 
                    return <div className="text-center py-8 text-muted-foreground">Initializing filters...</div>;
                }
                 if (!selectedMonth || !selectedYear || selectedYear === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      Please select month and year to view records.
                    </div>
                  );
                }
                
                if (rawAttendanceData.length === 0 && !isLoadingState) { 
                     return (
                        <div className="text-center py-8 text-muted-foreground">
                            No attendance data found for {selectedMonth} {selectedYear}.<br />
                            Please upload a file via the 'Upload Attendance Data' tab. (Data saved in browser's local storage).
                        </div>
                    );
                }
                
                if (filteredAttendanceData.length > 0 && daysInSelectedViewMonth > 0) {
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[60px]">Edit</TableHead>
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
                        {filteredAttendanceData.map((emp) => {
                          if (!emp.processedAttendance) { 
                            return <TableRow key={emp.id}><TableCell colSpan={daysInSelectedViewMonth + 17}>Loading processed data for {emp.name}...</TableCell></TableRow>;
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
                          <TableRow key={emp.id} className={emp.isMissingInMaster ? "bg-red-100 dark:bg-red-900/20" : ""}>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEditAttendanceDialog(emp.code)} title={`Edit attendance for ${emp.name}`}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </TableCell>
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
                          <TableCell colSpan={7} className="font-semibold text-right">
                            {searchTerm ? `Filtered Employees Displayed:` : `Total Employees Displayed:`}
                          </TableCell>
                          <TableCell colSpan={daysInSelectedViewMonth + 10} className="font-semibold">
                            {filteredAttendanceData.filter(e => e.processedAttendance && e.processedAttendance.some(s => s!=='-')).length}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  );
                }
                 if (searchTerm && filteredAttendanceData.length === 0 && processedAttendanceData.length > 0 && !isLoadingState) {
                    return (
                        <div className="text-center py-8 text-muted-foreground">
                            No employees found matching "{searchTerm}" for {selectedMonth} {selectedYear}.
                        </div>
                    );
                }
                if (isLoadingState) { 
                     return <div className="text-center py-8 text-muted-foreground">Loading attendance data for {selectedMonth} {selectedYear}... (Data saved in browser's local storage)</div>;
                }
                
                return ( 
                  <div className="text-center py-8 text-muted-foreground">
                     No attendance data available to display for {selectedMonth} {selectedYear}.
                     {uploadedFileName ? `Ensure data exists in local storage for this period or re-upload.` : ` Please upload an attendance file. (Data saved in browser's local storage).`}
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
                <br/>Filename must contain the selected month and year (e.g., 'attendance_april_2025.csv').
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={uploadMonth} onValueChange={setUploadMonth} >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Select Upload Month" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={uploadYear > 0 ? uploadYear.toString() : ""} onValueChange={(value) => setUploadYear(parseInt(value))} >
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue placeholder="Select Upload Year" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <FileUploadButton
                  onFileUpload={handleFileUpload}
                  buttonText="Upload Attendance CSV"
                  acceptedFileTypes=".csv"
                  disabled={!uploadMonth || !uploadYear || uploadYear === 0}
                  title={(!uploadMonth || !uploadYear || uploadYear === 0 ? "Select month and year first" : "Upload attendance CSV file")}
                />
                <Button
                  variant="link"
                  onClick={handleDownloadSampleTemplate}
                  className="p-0 h-auto text-left"
                >
                  <Download className="mr-2 h-4 w-4 flex-shrink-0" /> Download Sample Template (CSV for {uploadMonth && uploadYear > 0 ? `${uploadMonth} ${uploadYear}` : 'selected period'})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="mismatch">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle>Employees in Attendance, NOT in Master List</CardTitle>
                        <CardDescription>
                            These employees were found in the attendance data for {selectedMonth} {selectedYear > 0 ? selectedYear : ''} but their codes are not in the Employee Master. (Employee Master data saved in browser's local storage).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingState ? (
                             <div className="text-center py-8 text-muted-foreground">Loading mismatch report...</div>
                        ) : !selectedMonth || !selectedYear || selectedYear === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">Please select month and year to view mismatch report.</div>
                        ) : missingInMasterList.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Name (from Attendance)</TableHead>
                                        <TableHead>Designation (from Attendance)</TableHead>
                                        <TableHead>DOJ (from Attendance)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {missingInMasterList.map(emp => (
                                        <TableRow key={`missing-master-${emp.code}`}>
                                            <TableCell>{emp.code}</TableCell>
                                            <TableCell>{emp.name}</TableCell>
                                            <TableCell>{emp.designation}</TableCell>
                                            <TableCell>{emp.doj}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-sm text-muted-foreground">No employees found in attendance data for {selectedMonth} {selectedYear > 0 ? selectedYear : ''} that are missing from the Employee Master list.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle>Active Employees in Master, NOT in Attendance Sheet</CardTitle>
                        <CardDescription>
                            These "Active" employees from the Employee Master were not found in the attendance data for {selectedMonth} {selectedYear > 0 ? selectedYear : ''}. (Employee Master data saved in browser's local storage).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isLoadingState ? (
                             <div className="text-center py-8 text-muted-foreground">Loading mismatch report...</div>
                        ) : !selectedMonth || !selectedYear || selectedYear === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">Please select month and year to view mismatch report.</div>
                        ) : missingInAttendanceList.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[60px]">Edit</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Name (from Master)</TableHead>
                                        <TableHead>Designation (from Master)</TableHead>
                                        <TableHead>DOJ (from Master)</TableHead>
                                        <TableHead>Status (from Master)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {missingInAttendanceList.map(emp => (
                                        <TableRow key={`missing-att-${emp.id}`}>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenEditEmployeeStatusDialog(emp)} title={`Edit status for ${emp.name}`}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                            <TableCell>{emp.code}</TableCell>
                                            <TableCell>{emp.name}</TableCell>
                                            <TableCell>{emp.designation}</TableCell>
                                            <TableCell>{emp.doj}</TableCell>
                                            <TableCell>{emp.status}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-sm text-muted-foreground">All "Active" employees from the Employee Master were found in the attendance data for {selectedMonth} {selectedYear > 0 ? selectedYear : ''} (or no active employees in master).</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

    
