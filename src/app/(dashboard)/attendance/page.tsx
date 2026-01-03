"use client";

import * as React from "react";
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
import { Download, Trash2, Loader2, Edit, Search, Calendar, Users, Upload, FileText, CheckCircle, XCircle, AlertTriangle, ClipboardList, UserCheck, UserX } from "lucide-react";
import type { EmployeeDetail } from "@/lib/hr-data";
import { startOfDay, parseISO, isBefore, isEqual, format, endOfMonth, getDaysInMonth, isAfter, isValid } from "date-fns";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "catura_employee_master_data_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "catura_attendance_raw_data_v4_";
const LOCAL_STORAGE_ATTENDANCE_FILENAME_PREFIX = "catura_attendance_filename_v4_";
const LOCAL_STORAGE_LAST_UPLOAD_CONTEXT_KEY = "catura_last_upload_context_v4";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";

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
  }, { message: "Valid Date of Resignation (YYYY-MM-DD) is required" }),
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
    teal: { bg: 'bg-teal-50 border-teal-200', icon: 'text-teal-600 bg-teal-100', text: 'text-teal-700' },
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

  // Initialize default values
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
            toast({ title: "Data Error", description: "Employee master data corrupted.", variant: "destructive" });
            localStorage.removeItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
          }
        } else {
          setEmployeeMasterList([]);
        }
      } catch (error) {
        console.error("Error loading employee master:", error);
        setEmployeeMasterList([]);
        toast({ title: "Storage Error", description: "Could not load employee master data.", variant: "destructive" });
      }
    }
    setIsLoadingState(false);
  }, []);

  // Load attendance data when month/year changes
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
            toast({ title: "Data Error", description: `Attendance data for ${selectedMonth} ${selectedYear} corrupted.`, variant: "destructive" });
            setRawAttendanceData([]);
            setUploadedFileName(null);
            localStorage.removeItem(rawDataKey);
            localStorage.removeItem(filenameKey);
          }
        } else {
          setRawAttendanceData([]);
          setUploadedFileName(null);
        }
      } catch (error) {
        console.error(`Error loading attendance data:`, error);
        toast({ title: "Storage Error", description: `Could not load attendance data for ${selectedMonth} ${selectedYear}.`, variant: "destructive" });
        setRawAttendanceData([]);
        setUploadedFileName(null);
      }
    }
    setIsLoadingState(false);
  }, [selectedMonth, selectedYear]);

  // Process attendance data
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
          }
        } catch (e) {
          console.warn(`Error parsing DOJ for ${emp.code}`);
        }
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
        return false;
      }
    });
    setMissingInAttendanceList(currentMissingInAttendance);
  }, [rawAttendanceData, selectedYear, selectedMonth, employeeMasterList]);

  // Filter attendance data based on search
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

  // Calculate stats
  const attendanceStats = React.useMemo(() => {
    if (filteredAttendanceData.length === 0) {
      return { present: 0, absent: 0, leaves: 0, totalRecords: 0 };
    }

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeaves = 0;

    filteredAttendanceData.forEach(emp => {
      if (emp.processedAttendance) {
        emp.processedAttendance.forEach(status => {
          const s = status.toUpperCase();
          if (s === 'P') totalPresent++;
          else if (s === 'A') totalAbsent++;
          else if (['CL', 'SL', 'PL', 'HCL', 'HSL', 'HPL'].includes(s)) totalLeaves++;
        });
      }
    });

    return {
      present: totalPresent,
      absent: totalAbsent,
      leaves: totalLeaves,
      totalRecords: filteredAttendanceData.length
    };
  }, [filteredAttendanceData]);
  // ==================== HANDLER FUNCTIONS ====================

  const handleFileUpload = (file: File) => {
    if (!uploadMonth || !uploadYear) {
      toast({ title: "Selection Missing", description: "Please select month and year before uploading.", variant: "destructive" });
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
          description: `Filename '${file.name}' doesn't match '${uploadMonth} ${uploadYear}'.`,
          variant: "destructive",
          duration: 9000,
        });
        return;
      }

      try {
        const lines = text.split(/\r\n|\n/).map(line => line.trim()).filter(line => line);
        if (lines.length < 2) {
          toast({ title: "Invalid File", description: "File is empty or has no data rows.", variant: "destructive" });
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
            description: `Day columns (${actualDayColumnsInFile}) don't match days in ${uploadMonth} ${uploadYear} (${daysInUploadMonth}).`,
            variant: "destructive",
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
            malformedRowCount++;
            return;
          }

          const statusValueRaw = values[0] || "Active";
const statusValue: "Active" | "Left" = (statusValueRaw === "Active" || statusValueRaw === "Left") ? statusValueRaw : "Active";
          const division = values[1] || "N/A";
          const code = values[2] || `TEMP_ID_${rowIndex}`;
          const name = values[3] || "N/A";
          const designation = values[4] || "N/A";
          const dojFromCsv = values[5];

          let standardizedDoj = new Date(1900, 0, 1).toISOString().split('T')[0];
          if (dojFromCsv) {
            let parsedCsvDoj = parseISO(dojFromCsv);
            if (isValid(parsedCsvDoj)) {
              standardizedDoj = format(parsedCsvDoj, 'yyyy-MM-dd');
            } else {
              const dateParts = dojFromCsv.match(/^(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{2,4})$/);
              if (dateParts) {
                const part1 = parseInt(dateParts[1]);
                const part2 = parseInt(dateParts[2]);
                const part3 = parseInt(dateParts[3]);
                let yearStr = part3 > 1000 ? part3.toString() : (part3 + 2000).toString();
                if (part2 <= 12 && part1 <= 31 && isValid(new Date(parseInt(yearStr), part2 - 1, part1))) {
                  standardizedDoj = format(new Date(parseInt(yearStr), part2 - 1, part1), 'yyyy-MM-dd');
                } else if (part1 <= 12 && part2 <= 31 && isValid(new Date(parseInt(yearStr), part1 - 1, part2))) {
                  standardizedDoj = format(new Date(parseInt(yearStr), part1 - 1, part2), 'yyyy-MM-dd');
                }
              }
            }
          }

          const hq = "N/A";
          const grossMonthlySalary = 0;

          if (!code || !name || !designation) {
            malformedRowCount++;
            return;
          }

          if (encounteredCodes.has(code)) {
            skippedDuplicateCount++;
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
            id: code,
            status: statusValue,
            division,
            code,
            name,
            designation,
            hq,
            doj: standardizedDoj,
            grossMonthlySalary,
            attendance: dailyStatuses,
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
              addActivityLog(`Attendance for ${uploadMonth} ${uploadYear} uploaded from ${file.name}.`);
            } catch (error) {
              toast({ title: "Storage Error", description: "Could not save attendance data.", variant: "destructive" });
            }
          }
          setRawAttendanceData(newAttendanceData);
          setUploadedFileName(file.name);
          if (uploadMonth !== selectedMonth || uploadYear !== selectedYear) {
            setSelectedMonth(uploadMonth);
            setSelectedYear(uploadYear);
          }
          toast({ title: "✅ Attendance Uploaded", description: `${newAttendanceData.length} records from ${file.name}` });
          setSearchTerm('');
        } else {
          toastMessage += `No valid data from ${file.name}. `;
        }

        if (skippedDuplicateCount > 0) toastMessage += `${skippedDuplicateCount} duplicates skipped. `;
        if (malformedRowCount > 0) toastMessage += `${malformedRowCount} malformed rows skipped. `;

        if (toastMessage && newAttendanceData.length === 0) {
          toast({ title: "Upload Issue", description: toastMessage.trim(), variant: "destructive" });
        } else if (toastMessage) {
          toast({ title: "Processing Notes", description: toastMessage.trim() });
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast({ title: "Parsing Error", description: "Could not parse CSV file.", variant: "destructive" });
      }
    };

    reader.onerror = () => {
      toast({ title: "File Read Error", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  const handleDownloadReport = () => {
    if (filteredAttendanceData.length === 0 || !selectedMonth || !selectedYear || selectedYear === 0) {
      toast({ title: "No Data", description: "No attendance data to download.", variant: "destructive" });
      return;
    }

    const daysInCurrentMonth = new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate();
    const csvRows: string[][] = [];

    const headers = [
      "Status", "Division", "Code", "Name", "Designation", "DOJ",
      ...Array.from({ length: daysInCurrentMonth }, (_, i) => (i + 1).toString()),
      "Working Days (P)", "Absent-1 (A)", "Absent-2 (A+HD)", "Weekoff (W)",
      "Total CL", "Total PL", "Total SL", "Paid Holiday (PH)",
      "Total Days", "Paid Days"
    ];
    csvRows.push(headers);

    filteredAttendanceData.forEach(emp => {
      if (!emp.processedAttendance) return;
      const finalAttendance = emp.processedAttendance;

      let workingDaysP = 0, absent1A = 0, weekOffsW = 0;
      let totalCLUsed = 0, totalPLUsed = 0, totalSLUsed = 0, paidHolidaysPH = 0, notJoinedDays = 0;

      finalAttendance.forEach(s => {
        const status = s.toUpperCase();
        switch (status) {
          case 'P': workingDaysP++; break;
          case 'A': absent1A++; break;
          case 'HD': workingDaysP += 0.5; absent1A += 0.5; break;
          case 'W': weekOffsW++; break;
          case 'PH': paidHolidaysPH++; break;
          case 'CL': totalCLUsed++; break;
          case 'PL': totalPLUsed++; break;
          case 'SL': totalSLUsed++; break;
          case 'HCL': workingDaysP += 0.5; totalCLUsed += 0.5; break;
          case 'HPL': workingDaysP += 0.5; totalPLUsed += 0.5; break;
          case 'HSL': workingDaysP += 0.5; totalSLUsed += 0.5; break;
          case '-': notJoinedDays++; break;
        }
      });

      const absent2AHd = absent1A;
      const paidDays = workingDaysP + weekOffsW + totalCLUsed + totalSLUsed + totalPLUsed + paidHolidaysPH;
      const totalDaysCalc = daysInCurrentMonth - notJoinedDays;

      const row = [
        emp.status || "N/A", emp.division || "N/A", emp.code, emp.name, emp.designation, emp.doj,
        ...finalAttendance,
        workingDaysP.toFixed(1), absent1A.toFixed(1), absent2AHd.toFixed(1), weekOffsW.toString(),
        totalCLUsed.toFixed(1), totalPLUsed.toFixed(1), totalSLUsed.toFixed(1), paidHolidaysPH.toString(),
        (totalDaysCalc < 0 ? 0 : totalDaysCalc).toString(), paidDays.toFixed(1)
      ];
      csvRows.push(row);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_report_${selectedMonth}_${selectedYear}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addActivityLog(`Attendance report for ${selectedMonth} ${selectedYear} downloaded.`);
    toast({ title: "Download Started", description: `Report for ${selectedMonth} ${selectedYear} downloading.` });
  };

  const handleDownloadSampleTemplate = () => {
    const daysForTemplate = (uploadYear && uploadMonth && uploadYear > 0) ? new Date(uploadYear, months.indexOf(uploadMonth) + 1, 0).getDate() : 31;
    const headers = ["Status", "Division", "Code", "Name", "Designation", "DOJ", ...Array.from({ length: daysForTemplate }, (_, i) => (i + 1).toString())];
    const csvContent = headers.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const monthYearForFilename = (uploadMonth && uploadYear && uploadYear > 0) ? `${uploadMonth}_${uploadYear}` : "sample";
    link.download = `attendance_template_${monthYearForFilename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Template Downloaded" });
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
          toast({ title: "Storage Error", variant: "destructive" });
        }
      }
      if (dialogClearMonth === selectedMonth && dialogClearYear === selectedYear) {
        setRawAttendanceData([]);
        setUploadedFileName(null);
      }
      addActivityLog(`Attendance data for ${dialogClearMonth} ${dialogClearYear} cleared.`);
      toast({ title: "Data Cleared", description: `Data for ${dialogClearMonth} ${dialogClearYear} deleted.` });
    } else {
      toast({ title: "Incorrect Confirmation", variant: "destructive" });
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
        toast({ title: "Error", description: "Invalid month.", variant: "destructive" });
        return;
      }
      const daysInMonth = getDaysInMonth(new Date(selectedYear, monthIndex));
      const currentRawAttendance = [...employee.attendance];
      while (currentRawAttendance.length < daysInMonth) {
        currentRawAttendance.push('A');
      }
      setEditableDailyStatuses(currentRawAttendance.slice(0, daysInMonth));
      setEditingAttendanceEmployee(employee);
      setIsEditAttendanceDialogOpen(true);
    } else {
      toast({ title: "Error", description: "Could not find employee data.", variant: "destructive" });
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
      toast({ title: "Error", description: "No employee selected.", variant: "destructive" });
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
        addActivityLog(`Attendance for ${editingAttendanceEmployee.name} (${selectedMonth} ${selectedYear}) updated.`);
        toast({ title: "Attendance Updated", description: `${editingAttendanceEmployee.name}'s attendance updated.` });
      } catch (error) {
        toast({ title: "Storage Error", variant: "destructive" });
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
        addActivityLog(`Employee ${editingEmployeeForStatus.name} status updated to 'Left'.`);
        toast({ title: "Employee Status Updated", description: `${editingEmployeeForStatus.name} marked as 'Left'.` });
      } catch (error) {
        toast({ title: "Storage Error", variant: "destructive" });
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

  // ==================== LOADING STATE ====================
  if (isLoadingState && !selectedMonth && currentYear === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading Attendance...</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN JSX RETURN ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-teal-600 to-green-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Calendar className="h-7 w-7" />
                Attendance Dashboard
              </h1>
              <p className="text-green-100 text-sm">Upload, view and manage employee attendance records</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadReport} disabled={filteredAttendanceData.length === 0} className="bg-white text-green-700 hover:bg-green-50">
                <Download className="mr-2 h-4 w-4" /> Download Report
              </Button>
              <Button onClick={triggerDeleteConfirmation} variant="destructive" className="bg-red-500 hover:bg-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Clear Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Records" value={attendanceStats.totalRecords} icon={Users} color="blue" subtitle={`${selectedMonth} ${selectedYear}`} />
        <StatCard title="Present Days" value={attendanceStats.present} icon={CheckCircle} color="green" />
        <StatCard title="Absent Days" value={attendanceStats.absent} icon={XCircle} color="red" />
        <StatCard title="Leave Days" value={attendanceStats.leaves} icon={Calendar} color="purple" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="view" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardList className="mr-2 h-4 w-4" /> View Attendance
          </TabsTrigger>
          <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Upload className="mr-2 h-4 w-4" /> Upload Data
          </TabsTrigger>
          <TabsTrigger value="mismatch" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <AlertTriangle className="mr-2 h-4 w-4" /> Mismatch Report
          </TabsTrigger>
        </TabsList>

        {/* VIEW TAB */}
        <TabsContent value="view" className="space-y-4 mt-4">
          {/* Filters Card */}
          <Card className="shadow-md border-0">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-5 w-5 text-green-600" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
                <Select value={selectedMonth} onValueChange={(value) => { setSelectedMonth(value); setSearchTerm(''); }}>
                  <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => { setSelectedYear(parseInt(value)); setSearchTerm(''); }}>
                  <SelectTrigger className="w-full sm:w-[120px] border-gray-300">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="relative w-full sm:w-auto sm:flex-grow max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by Name/Code..."
                    className="pl-8 border-gray-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {uploadedFileName && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{uploadedFileName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attendance Table */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Attendance Records - {selectedMonth} {selectedYear > 0 ? selectedYear : ''}
              </CardTitle>
              <CardDescription>
                P=Present, A=Absent, HD=Half-Day, W=Week Off, PH=Public Holiday, CL/SL/PL=Leaves
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {(() => {
                  if (!selectedMonth || !selectedYear || selectedYear === 0) {
                    return (
                      <div className="text-center py-12">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Select month and year to view records</p>
                      </div>
                    );
                  }

                  if (rawAttendanceData.length === 0 && !isLoadingState) {
                    return (
                      <div className="text-center py-12">
                        <Upload className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No attendance data for {selectedMonth} {selectedYear}</p>
                        <p className="text-gray-400 text-sm mt-1">Upload via 'Upload Data' tab</p>
                      </div>
                    );
                  }

                  if (filteredAttendanceData.length > 0 && daysInSelectedViewMonth > 0) {
                    return (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 hover:bg-gray-50">
                            <TableHead className="font-semibold w-[60px]">Edit</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Division</TableHead>
                            <TableHead className="font-semibold">Code</TableHead>
                            <TableHead className="font-semibold">Name</TableHead>
                            <TableHead className="font-semibold">Designation</TableHead>
                            <TableHead className="font-semibold">DOJ</TableHead>
                            {Array.from({ length: daysInSelectedViewMonth }, (_, i) => i + 1).map(day => (
                              <TableHead key={day} className="text-center font-semibold min-w-[45px]">{day}</TableHead>
                            ))}
                            <TableHead className="text-center font-semibold bg-green-50">P</TableHead>
                            <TableHead className="text-center font-semibold bg-red-50">A</TableHead>
                            <TableHead className="text-center font-semibold bg-blue-50">W</TableHead>
                            <TableHead className="text-center font-semibold bg-purple-50">Leaves</TableHead>
                            <TableHead className="text-center font-semibold bg-teal-50">Paid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAttendanceData.map((emp) => {
                            if (!emp.processedAttendance) return null;
                            const finalAttendance = emp.processedAttendance;

                            let workingDaysP = 0, absent1A = 0, weekOffsW = 0;
                            let totalLeaves = 0, paidHolidaysPH = 0, notJoinedDays = 0;

                            finalAttendance.forEach(s => {
                              const status = s.toUpperCase();
                              switch (status) {
                                case 'P': workingDaysP++; break;
                                case 'A': absent1A++; break;
                                case 'HD': workingDaysP += 0.5; absent1A += 0.5; break;
                                case 'W': weekOffsW++; break;
                                case 'PH': paidHolidaysPH++; break;
                                case 'CL': case 'PL': case 'SL': totalLeaves++; break;
                                case 'HCL': case 'HPL': case 'HSL': workingDaysP += 0.5; totalLeaves += 0.5; break;
                                case '-': notJoinedDays++; break;
                              }
                            });

                            const paidDays = workingDaysP + weekOffsW + totalLeaves + paidHolidaysPH;

                            return (
                              <TableRow key={emp.id} className={`hover:bg-green-50/50 ${emp.isMissingInMaster ? "bg-red-50" : ""}`}>
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenEditAttendanceDialog(emp.code)} className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                                <TableCell>{emp.status || "N/A"}</TableCell>
                                <TableCell>{emp.division || "N/A"}</TableCell>
                                <TableCell className="font-medium text-green-600">{emp.code}</TableCell>
                                <TableCell className="font-medium">{emp.name}</TableCell>
                                <TableCell>{emp.designation}</TableCell>
                                <TableCell>{emp.doj}</TableCell>
                                {finalAttendance.map((status, index) => (
                                  <TableCell key={index} className="text-center p-1">
                                    <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${ATTENDANCE_STATUS_COLORS[status] || 'bg-gray-200 text-gray-800'}`}>
                                      {status}
                                    </span>
                                  </TableCell>
                                ))}
                                <TableCell className="text-center font-semibold bg-green-50 text-green-700">{workingDaysP}</TableCell>
                                <TableCell className="text-center font-semibold bg-red-50 text-red-700">{absent1A}</TableCell>
                                <TableCell className="text-center font-semibold bg-blue-50 text-blue-700">{weekOffsW}</TableCell>
                                <TableCell className="text-center font-semibold bg-purple-50 text-purple-700">{totalLeaves}</TableCell>
                                <TableCell className="text-center font-bold bg-teal-50 text-teal-700">{paidDays}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="bg-gray-100">
                            <TableCell colSpan={7} className="font-semibold text-right">Total Employees:</TableCell>
                            <TableCell colSpan={daysInSelectedViewMonth + 5} className="font-bold text-green-600">{filteredAttendanceData.length}</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    );
                  }

                  if (searchTerm && filteredAttendanceData.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No employees matching "{searchTerm}"</p>
                      </div>
                    );
                  }

                  return (
                    <div className="text-center py-12">
                      <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-3" />
                      <p className="text-gray-500">Loading...</p>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UPLOAD TAB */}
        <TabsContent value="upload" className="mt-4">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 rounded-t-lg border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Upload className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Upload Attendance Data</CardTitle>
                  <CardDescription>Select month/year and upload CSV file</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={uploadMonth} onValueChange={setUploadMonth}>
                  <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={uploadYear > 0 ? uploadYear.toString() : ""} onValueChange={(value) => setUploadYear(parseInt(value))}>
                  <SelectTrigger className="w-full sm:w-[120px] border-gray-300">
                    <SelectValue placeholder="Year" />
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
  disabled={!uploadMonth || !uploadYear || uploadYear === 0}
  variant="default"
  className="bg-green-600 hover:bg-green-700 text-white"
/>
                <Button variant="outline" onClick={handleDownloadSampleTemplate}>
                  <Download className="mr-2 h-4 w-4" /> Download Template
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-semibold mb-2">📋 Expected CSV Format:</p>
                <p>Columns: Status, Division, Code, Name, Designation, DOJ, 1, 2, 3... {daysInSelectedUploadMonth}</p>
                <p className="mt-1 text-blue-600">Filename must contain month and year (e.g., attendance_april_2025.csv)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MISMATCH TAB */}
        <TabsContent value="mismatch" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Missing in Master */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 rounded-t-lg border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <UserX className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">In Attendance, NOT in Master</CardTitle>
                    <CardDescription>Employees in attendance but missing from master list</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {!selectedMonth || !selectedYear || selectedYear === 0 ? (
                  <p className="text-gray-500 text-center py-8">Select month and year to view</p>
                ) : missingInMasterList.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50">
                        <TableHead className="font-semibold">Code</TableHead>
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Designation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missingInMasterList.map(emp => (
                        <TableRow key={`missing-master-${emp.code}`} className="hover:bg-red-50/50">
                          <TableCell className="font-medium text-red-600">{emp.code}</TableCell>
                          <TableCell>{emp.name}</TableCell>
                          <TableCell>{emp.designation}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                    <p className="text-gray-500">All attendance employees are in master list</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Missing in Attendance */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-t-lg border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <UserCheck className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">In Master, NOT in Attendance</CardTitle>
                    <CardDescription>Active employees missing from attendance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {!selectedMonth || !selectedYear || selectedYear === 0 ? (
                  <p className="text-gray-500 text-center py-8">Select month and year to view</p>
                ) : missingInAttendanceList.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50">
                        <TableHead className="font-semibold w-[60px]">Edit</TableHead>
                        <TableHead className="font-semibold">Code</TableHead>
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missingInAttendanceList.map(emp => (
                        <TableRow key={`missing-att-${emp.id}`} className="hover:bg-orange-50/50">
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditEmployeeStatusDialog(emp)} className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium text-orange-600">{emp.code}</TableCell>
                          <TableCell>{emp.name}</TableCell>
                          <TableCell>{emp.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                    <p className="text-gray-500">All active employees have attendance</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOGS ==================== */}

      {/* Clear Data Dialog */}
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
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Clear Attendance Data
            </AlertDialogTitle>
            <AlertDialogDescription>Select month/year to delete. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4 my-4">
            <Select value={dialogClearMonth} onValueChange={setDialogClearMonth}>
              <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={dialogClearYear > 0 ? dialogClearYear.toString() : ""} onValueChange={(value) => setDialogClearYear(parseInt(value))}>
              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>{availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {dialogClearMonth && dialogClearYear > 0 && (
            <p className="text-sm text-gray-500 mb-2">Type <strong>DELETE</strong> to confirm deletion of {dialogClearMonth} {dialogClearYear}</p>
          )}
          <Input value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} placeholder="Type DELETE" disabled={!dialogClearMonth || dialogClearYear === 0} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndDeleteData} disabled={deleteConfirmationText !== "DELETE" || !dialogClearMonth || dialogClearYear === 0} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Attendance Dialog */}
      <Dialog open={isEditAttendanceDialogOpen} onOpenChange={(isOpen) => {
        setIsEditAttendanceDialogOpen(isOpen);
        if (!isOpen) setEditingAttendanceEmployee(null);
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg"><Edit className="h-5 w-5 text-green-600" /></div>
              Edit Attendance - {editingAttendanceEmployee?.name}
            </DialogTitle>
            <DialogDescription>{selectedMonth} {selectedYear}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-1">
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-x-2 gap-y-4 p-2">
              {editableDailyStatuses.map((status, dayIndex) => (
                <div key={dayIndex} className="flex flex-col space-y-1">
                  <Label className="text-xs font-medium text-center">Day {dayIndex + 1}</Label>
                  <Select value={status} onValueChange={(newStatus) => handleDailyStatusChange(dayIndex, newStatus)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdateAttendance} className="bg-green-600 hover:bg-green-700">Update Attendance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Status Dialog */}
      <Dialog open={isEditEmployeeStatusDialogOpen} onOpenChange={(isOpen) => {
        setIsEditEmployeeStatusDialogOpen(isOpen);
        if (!isOpen) setEditingEmployeeForStatus(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Status - {editingEmployeeForStatus?.name}</DialogTitle>
            <DialogDescription>Mark as 'Left' and set DOR</DialogDescription>
          </DialogHeader>
          <Form {...statusEditForm}>
            <form onSubmit={statusEditForm.handleSubmit(handleSaveEmployeeStatus)} className="space-y-4 py-4">
              <FormField control={statusEditForm.control} name="dor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Resignation</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}