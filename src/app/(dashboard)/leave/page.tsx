
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Edit, PlusCircle, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, getYear, getMonth, isValid, startOfMonth, addDays as dateFnsAddDays, differenceInCalendarDays, endOfMonth, isBefore, isEqual, addMonths, isAfter, getDaysInMonth } from "date-fns";
import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateEmployeeLeaveDetailsForPeriod, CL_ACCRUAL_RATE, SL_ACCRUAL_RATE, PL_ACCRUAL_RATE, MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL, calculateMonthsOfService } from "@/lib/hr-calculations";
import type { LeaveApplication, OpeningLeaveBalance } from "@/lib/hr-types";
import { FileUploadButton } from "@/components/shared/file-upload-button";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1"; // Though not fully used for applying, calculations consider it if data exists.
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";
const ONE_TIME_CLEAR_FLAG_KEY = "novita_leave_data_cleared_once_v1";


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

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface LeaveDisplayData extends EmployeeDetail {
  usedCLLastMonth: number;
  usedSLLastMonth: number;
  usedPLLastMonth: number;
  usedCLInMonth: number; // From selected month's attendance
  usedSLInMonth: number; // From selected month's attendance
  usedPLInMonth: number; // From selected month's attendance
  openingCLNextMonth: number;
  openingSLNextMonth: number;
  openingPLNextMonth: number;
}

interface MonthlyEmployeeAttendance {
  code: string;
  attendance: string[];
}

const getDynamicAttendanceStorageKeys = (month: string, year: number) => {
  if (!month || year === 0) return { rawDataKey: null };
  return {
    rawDataKey: `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${month}_${year}`,
  };
};


export default function LeavePage() {
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<EmployeeDetail[]>([]);
  const [openingBalances, setOpeningBalances] = React.useState<OpeningLeaveBalance[]>([]);
  const [leaveApplications, setLeaveApplications] = React.useState<LeaveApplication[]>([]); // Conceptual, for future full application system

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
  const [isDeleteSelectedOBDialogOpen, setIsDeleteSelectedOBDialogOpen] = React.useState(false);


  React.useEffect(() => {
    const now = new Date();
    setCurrentYearState(now.getFullYear());
    setSelectedMonth(months[now.getMonth()]);
    setSelectedYear(now.getFullYear());
  }, []);

  React.useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      // One-time data clearing logic - remove after first successful run if instructed
      // const alreadyCleared = sessionStorage.getItem(ONE_TIME_CLEAR_FLAG_KEY);
      // if (!alreadyCleared) {
      //   localStorage.removeItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
      //   localStorage.removeItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
      //   setOpeningBalances([]);
      //   setLeaveApplications([]);
      //   sessionStorage.setItem(ONE_TIME_CLEAR_FLAG_KEY, 'true');
      //   toast({ title: "Leave Data Reset", description: "Opening balances and leave application history have been cleared. Please upload new opening balances if needed.", duration: 7000 });
      //   addActivityLog("Leave data (opening balances, application history) reset.");
      // }

      try {
        const storedEmployeesStr = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        if (storedEmployeesStr) {
            try {
                const parsed = JSON.parse(storedEmployeesStr);
                setEmployees(Array.isArray(parsed) ? parsed : []);
            } catch (e) {
                console.error("Error parsing employee master from localStorage:", e);
                setEmployees([]);
                toast({ title: "Data Error", description: "Could not parse employee master data. List may be empty or show defaults.", variant: "destructive", duration: 7000 });
            }
        } else {
            setEmployees([]);
        }

        const storedOBStr = localStorage.getItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
        if (storedOBStr) {
            try {
                const parsedOB = JSON.parse(storedOBStr);
                setOpeningBalances(Array.isArray(parsedOB) ? parsedOB : []);
            } catch (e) {
                console.error("Error parsing opening balances from localStorage:", e);
                setOpeningBalances([]);
                toast({ title: "Data Error", description: "Could not parse opening balances. Calculations may be inaccurate.", variant: "destructive", duration: 7000 });
            }
        } else {
             setOpeningBalances([]);
        }

        const storedAppsStr = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        if (storedAppsStr) {
           try {
                const parsedApps = JSON.parse(storedAppsStr);
                setLeaveApplications(Array.isArray(parsedApps) ? parsedApps : []);
            } catch (e) {
                console.error("Error parsing leave applications from localStorage:", e);
                setLeaveApplications([]);
                 toast({ title: "Data Error", description: "Could not load leave applications. Leave history might be incomplete.", variant: "destructive", duration: 7000 });
            }
        } else {
            setLeaveApplications([]);
        }

      } catch (error) {
        console.error("Error loading initial data for Leave page:", error);
        toast({ title: "Storage Error", description: "Could not load some persisted leave data.", variant: "destructive", duration: 7000 });
        setEmployees([]);
        setOpeningBalances([]);
        setLeaveApplications([]);
      }
    }
    // Initial load might still be happening, data for specific month/year will trigger separate loading.
    // setIsLoading(false) will be handled in the main data processing useEffect.
  }, []); 

  React.useEffect(() => {
    if (!selectedMonth || !selectedYear || selectedYear === 0 || employees.length === 0) {
      setDisplayData([]);
      setIsLoading(employees.length > 0 ? false : true); // Stop loading if employees are loaded but no month/year selected
      return;
    }

    setIsLoading(true);
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex === -1) {
      setDisplayData([]);
      setIsLoading(false);
      return;
    }

    const selectedMonthStartDate = startOfMonth(new Date(selectedYear, monthIndex, 1));
    
    // Previous month for "Last Month Used"
    const prevMonthDateObject = addMonths(selectedMonthStartDate, -1);
    const prevMonthName = months[getMonth(prevMonthDateObject)];
    const prevMonthYearValue = getYear(prevMonthDateObject);
    let attendanceForPrevMonth: MonthlyEmployeeAttendance[] = [];
    if (typeof window !== 'undefined') {
        const prevMonthKeys = getDynamicAttendanceStorageKeys(prevMonthName, prevMonthYearValue);
        if (prevMonthKeys.rawDataKey) {
            const storedAttPrev = localStorage.getItem(prevMonthKeys.rawDataKey);
            if (storedAttPrev) {
                try {
                  const parsed = JSON.parse(storedAttPrev);
                  if(Array.isArray(parsed)) attendanceForPrevMonth = parsed;
                }
                catch (e) { console.warn(`Error parsing attendance for ${prevMonthName} ${prevMonthYearValue}: ${e}`); }
            }
        }
    }

    // Selected month for "Selected Month Used"
    let attendanceForSelectedMonth: MonthlyEmployeeAttendance[] = [];
     if (typeof window !== 'undefined') {
        const currentMonthKeys = getDynamicAttendanceStorageKeys(selectedMonth, selectedYear);
        if (currentMonthKeys.rawDataKey) {
            const storedAtt = localStorage.getItem(currentMonthKeys.rawDataKey);
            if (storedAtt) {
                try {
                  const parsed = JSON.parse(storedAtt);
                  if(Array.isArray(parsed)) attendanceForSelectedMonth = parsed;
                }
                catch (e) { console.warn(`Error parsing attendance for ${selectedMonth} ${selectedYear}: ${e}`); }
            }
        }
    }

    const newDisplayData = employees
      .filter(emp => emp.status === "Active") // Only show active employees
      .map(emp => {
        // Used Leaves from Previous Month's Attendance
        let usedCLLastMonth = 0, usedSLLastMonth = 0, usedPLLastMonth = 0;
        const empAttPrevMonth = attendanceForPrevMonth.find(att => att.code === emp.code);
        if (empAttPrevMonth && empAttPrevMonth.attendance) {
            const daysInPrev = getDaysInMonth(prevMonthDateObject);
            empAttPrevMonth.attendance.slice(0, daysInPrev).forEach(status => {
                if (status === 'CL') usedCLLastMonth++;
                if (status === 'SL') usedSLLastMonth++;
                if (status === 'PL') usedPLLastMonth++;
            });
        }

        // Used Leaves from Selected Month's Attendance
        let usedCLInMonthFromAttendance = 0, usedSLInMonthFromAttendance = 0, usedPLInMonthFromAttendance = 0;
        const empAttSelectedMonth = attendanceForSelectedMonth.find(att => att.code === emp.code);
        if (empAttSelectedMonth && empAttSelectedMonth.attendance) {
            const daysInSelected = getDaysInMonth(selectedMonthStartDate);
            empAttSelectedMonth.attendance.slice(0, daysInSelected).forEach(status => {
                if (status === 'CL') usedCLInMonthFromAttendance++;
                if (status === 'SL') usedSLInMonthFromAttendance++;
                if (status === 'PL') usedPLInMonthFromAttendance++;
            });
        }

        // Calculate accrued balances UP TO THE END of the selected month
        // Pass [] for leaveApplications as we derive "used" from attendance on this page
        const accruedDetails = calculateEmployeeLeaveDetailsForPeriod(
          emp, selectedYear, monthIndex, [], openingBalances
        );
        
        // True closing balance for the selected month
        const closingBalanceCLSelectedMonth = accruedDetails.balanceCLAtMonthEnd - usedCLInMonthFromAttendance;
        const closingBalanceSLSelectedMonth = accruedDetails.balanceSLAtMonthEnd - usedSLInMonthFromAttendance;
        const closingBalancePLSelectedMonth = accruedDetails.balancePLAtMonthEnd - usedPLInMonthFromAttendance;


        // Calculate Opening Balance for Next Month
        const nextMonthDateObject = addMonths(selectedMonthStartDate, 1);
        const nextMonthIndexVal = getMonth(nextMonthDateObject);
        const nextMonthYearVal = getYear(nextMonthDateObject);

        const serviceMonthsAtNextMonthStart = calculateMonthsOfService(emp.doj, startOfMonth(nextMonthDateObject));
        const isEligibleForAccrualNextMonth = serviceMonthsAtNextMonthStart >= MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL;

        let openingCLForNextMonthCalc = 0;
        let openingSLForNextMonthCalc = 0;
        let openingPLForNextMonthCalc = 0;

        if (nextMonthIndexVal === 3) { // April - Financial Year Rollover for CL/SL
            const obForNextFY = openingBalances.find(
              (ob) => ob.employeeCode === emp.code && ob.financialYearStart === nextMonthYearVal
            );
            openingCLForNextMonthCalc = (obForNextFY?.openingCL || 0);
            openingSLForNextMonthCalc = (obForNextFY?.openingSL || 0);
            openingPLForNextMonthCalc = (obForNextFY?.openingPL !== undefined) ? obForNextFY.openingPL : closingBalancePLSelectedMonth;
        } else {
            openingCLForNextMonthCalc = closingBalanceCLSelectedMonth;
            openingSLForNextMonthCalc = closingBalanceSLSelectedMonth;
            openingPLForNextMonthCalc = closingBalancePLSelectedMonth;
        }

        if (isEligibleForAccrualNextMonth) {
            openingCLForNextMonthCalc += CL_ACCRUAL_RATE;
            openingSLForNextMonthCalc += SL_ACCRUAL_RATE;
            openingPLForNextMonthCalc += PL_ACCRUAL_RATE;
        }

        return {
          ...emp,
          usedCLLastMonth, usedSLLastMonth, usedPLLastMonth,
          usedCLInMonth: usedCLInMonthFromAttendance,
          usedSLInMonth: usedSLInMonthFromAttendance,
          usedPLInMonth: usedPLInMonthFromAttendance,
          openingCLNextMonth: openingCLForNextMonthCalc,
          openingSLNextMonth: openingSLForNextMonthCalc,
          openingPLNextMonth: openingPLForNextMonthCalc,
        };
    });

    setDisplayData(newDisplayData.filter(d => d !== null) as LeaveDisplayData[]);
    setSelectedEmployeeIds(new Set()); // Reset selection when data changes
    setIsLoading(false);

  }, [employees, openingBalances, leaveApplications, selectedMonth, selectedYear]);

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
    // Determine the financial year for which OB should be edited
    // If selected month is Jan-Mar, current FY started last year. Otherwise, current year.
    const currentFinancialYearStart = selectedMonth && months.indexOf(selectedMonth) >=3 ? selectedYear : (selectedYear > 0 ? selectedYear -1 : 0);
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
    if (!editingEmployeeForOB || editingOBYear <= 0) {
      toast({ title: "Error", description: "No employee or invalid financial year selected for editing opening balances.", variant: "destructive"});
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedOpeningBalances));
        addActivityLog(`Opening balances for ${editingEmployeeForOB.name} (FY ${editingOBYear}) updated.`);
        toast({ title: "Opening Balances Saved", description: `Opening balances for ${editingEmployeeForOB.name} for FY starting April ${editingOBYear} have been saved to local storage.`});
      } catch (error) {
         console.error("Error saving opening balances to localStorage:", error);
         toast({ title: "Storage Error", description: "Could not save opening balances locally.", variant: "destructive" });
      }
    }
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
    
    let csvPrevMonthDisplay = "Prev Mth";
    let csvSelectedMonthDisplay = "Sel Mth";
    let csvNextMonthDisplay = "Next Mth";

    if (selectedMonth && selectedYear > 0) {
        const monthIndex = months.indexOf(selectedMonth);
        if (monthIndex !== -1) {
        const currentDateObject = new Date(selectedYear, monthIndex, 1);
        
        csvSelectedMonthDisplay = `${selectedMonth.substring(0,3)} ${selectedYear}`;

        const prevMonthDateObject = addMonths(currentDateObject, -1);
        csvPrevMonthDisplay = `${months[getMonth(prevMonthDateObject)].substring(0,3)} ${getYear(prevMonthDateObject)}`;

        const nextMonthDateObject = addMonths(currentDateObject, 1);
        csvNextMonthDisplay = `${months[getMonth(nextMonthDateObject)].substring(0,3)} ${getYear(nextMonthDateObject)}`;
        }
    }

    const csvRows: string[][] = [];
    const headers = [
      "Division", "Code", "Name", "Designation", "HQ", "DOJ",
      `Used CL (${csvPrevMonthDisplay})`, `Used SL (${csvPrevMonthDisplay})`, `Used PL (${csvPrevMonthDisplay})`,
      `Used CL (${csvSelectedMonthDisplay})`, `Used SL (${csvSelectedMonthDisplay})`, `Used PL (${csvSelectedMonthDisplay})`,
      `Opening CL (${csvNextMonthDisplay})`, `Opening SL (${csvNextMonthDisplay})`, `Opening PL (${csvNextMonthDisplay})`
    ];
    csvRows.push(headers);

    selectedEmployeesData.forEach(emp => {
      let formattedDoj = 'N/A';
      if (emp.doj) {
        try {
          const parsed = parseISO(emp.doj);
          if (isValid(parsed)) formattedDoj = format(parsed, 'dd-MMM-yyyy');
          else formattedDoj = emp.doj;
        } catch { formattedDoj = emp.doj; }
      }

      const row = [
        emp.division || "N/A", emp.code, emp.name, emp.designation, emp.hq || "N/A", formattedDoj,
        emp.usedCLLastMonth.toFixed(1), emp.usedSLLastMonth.toFixed(1), emp.usedPLLastMonth.toFixed(1),
        emp.usedCLInMonth.toFixed(1), emp.usedSLInMonth.toFixed(1), emp.usedPLInMonth.toFixed(1),
        emp.openingCLNextMonth.toFixed(1), emp.openingSLNextMonth.toFixed(1), emp.openingPLNextMonth.toFixed(1)
      ];
      csvRows.push(row);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const formattedDate = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute("download", `selected_leave_report_${selectedMonth}_${selectedYear}_${formattedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: `Leave report for selected employees (${selectedMonth} ${selectedYear}) is being downloaded.`,
    });
  };

  const handleOpeningBalanceUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
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
            const headersFromFile = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
            const expectedHeaders = ["employeecode", "openingcl", "openingsl", "openingpl", "financialyearstart"];
            const missingHeaders = expectedHeaders.filter(eh => !headersFromFile.includes(eh));
            if (missingHeaders.length > 0) {
                toast({ title: "File Header Error", description: `Missing headers: ${missingHeaders.join(', ')}. Expected: ${expectedHeaders.join(', ')}`, variant: "destructive", duration: 7000 });
                return;
            }

            const dataRows = lines.slice(1);
            const newUploadedOpeningBalances: OpeningLeaveBalance[] = [];
            const employeeCodesInFile = new Set<string>(); // Tracks EmployeeCode-FinancialYearStart
            let skippedDuplicatesInFile = 0;
            let malformedRows = 0;

            dataRows.forEach((row, index) => {
                const values = row.split(',');
                if (values.length < expectedHeaders.length) {
                     console.warn(`Skipping row ${index + 1} in opening balance CSV: insufficient columns.`);
                     malformedRows++;
                     return;
                }
                const employeeCode = values[headersFromFile.indexOf("employeecode")]?.trim();
                const openingCLStr = values[headersFromFile.indexOf("openingcl")]?.trim();
                const openingSLStr = values[headersFromFile.indexOf("openingsl")]?.trim();
                const openingPLStr = values[headersFromFile.indexOf("openingpl")]?.trim();
                const financialYearStartStr = values[headersFromFile.indexOf("financialyearstart")]?.trim();

                const openingCL = parseFloat(openingCLStr);
                const openingSL = parseFloat(openingSLStr);
                const openingPL = parseFloat(openingPLStr);
                const financialYearStart = parseInt(financialYearStartStr);

                if (!employeeCode || isNaN(openingCL) || isNaN(openingSL) || isNaN(openingPL) || isNaN(financialYearStart) || financialYearStart < 1900 || financialYearStart > 2200) {
                    console.warn(`Skipping row ${index + 1} in opening balance CSV: invalid data for ${employeeCode}. Values: CL=${openingCLStr}, SL=${openingSLStr}, PL=${openingPLStr}, FY=${financialYearStartStr}`);
                    malformedRows++;
                    return;
                }
                const uniqueKeyInFile = `${employeeCode}-${financialYearStart}`;
                if (employeeCodesInFile.has(uniqueKeyInFile)) {
                    skippedDuplicatesInFile++;
                    console.warn(`Skipping row ${index + 1} (Code: ${employeeCode}, FY: ${financialYearStart}) due to duplicate entry within this CSV file.`);
                    return;
                }
                employeeCodesInFile.add(uniqueKeyInFile);
                newUploadedOpeningBalances.push({ employeeCode, openingCL, openingSL, openingPL, financialYearStart });
            });

            let message = "";
            if (newUploadedOpeningBalances.length > 0) {
                message += `${newUploadedOpeningBalances.length} records processed from ${file.name}. `;

                const existingRecordsMap = new Map(openingBalances.map(b => [`${b.employeeCode}-${b.financialYearStart}`, b]));
                newUploadedOpeningBalances.forEach(nb => {
                    existingRecordsMap.set(`${nb.employeeCode}-${nb.financialYearStart}`, nb);
                });
                const updatedBalances = Array.from(existingRecordsMap.values());
                setOpeningBalances(updatedBalances);
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedBalances));
                        addActivityLog(`Opening leave balances uploaded from ${file.name}.`);
                    } catch (error) {
                        console.error("Error saving opening balances to localStorage:", error);
                        message += "Error saving to local storage. ";
                    }
                }
            } else {
                 message += `No new valid opening balance records found in ${file.name}. `;
            }

            if (skippedDuplicatesInFile > 0) message += `${skippedDuplicatesInFile} duplicate row(s) (same employee/year) within the file were skipped. `;
            if (malformedRows > 0) message += `${malformedRows} row(s) skipped due to invalid/missing data. `;

            toast({
                title: newUploadedOpeningBalances.length > 0 ? "Opening Balances Processed" : "Upload Issue",
                description: message.trim() + (newUploadedOpeningBalances.length > 0 ? " Data saved to local storage." : ""),
                duration: 9000,
                variant: newUploadedOpeningBalances.length > 0 ? "default" : "destructive",
            });

        } catch (error) {
            console.error("Error parsing opening balance CSV:", error);
            toast({ title: "Parsing Error", description: "Could not parse opening balance CSV. Check format.", variant: "destructive", duration: 7000 });
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

  const handleDeleteSelectedOpeningBalances = () => {
    if (selectedEmployeeIds.size === 0) {
      toast({ title: "No Selection", description: "Please select employees to clear their opening balances.", variant: "destructive" });
      return;
    }
    setIsDeleteSelectedOBDialogOpen(true);
  };

  const confirmDeleteSelectedOpeningBalances = () => {
    if (!selectedMonth || selectedYear === 0) {
        toast({ title: "Error", description: "Cannot determine financial year. Please select a valid month/year.", variant: "destructive" });
        setIsDeleteSelectedOBDialogOpen(false);
        return;
    }
    // Determine the financial year for which to clear opening balances
    const financialYearToClear = selectedMonth && months.indexOf(selectedMonth) >=3 ? selectedYear : (selectedYear > 0 ? selectedYear -1 : 0);

    const updatedOpeningBalances = openingBalances.filter(ob =>
        !(selectedEmployeeIds.has(ob.employeeCode) && ob.financialYearStart === financialYearToClear)
    );

    setOpeningBalances(updatedOpeningBalances);
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedOpeningBalances));
            addActivityLog(`Opening balances for ${selectedEmployeeIds.size} selected employees (FY ${financialYearToClear}) cleared.`);
            toast({ title: "Opening Balances Cleared", description: `Opening balances for ${selectedEmployeeIds.size} selected employee(s) for FY ${financialYearToClear} have been cleared from local storage.` });
        } catch (error) {
            console.error("Error saving cleared opening balances to localStorage:", error);
            toast({ title: "Storage Error", description: "Could not save cleared opening balances locally.", variant: "destructive" });
        }
    }
    setSelectedEmployeeIds(new Set());
    setIsDeleteSelectedOBDialogOpen(false);
  };


  const availableYears = currentYearState > 0 ? Array.from({ length: 5 }, (_, i) => currentYearState - i) : [];
  const activeEmployeesInDisplay = displayData.filter(emp => emp.status === "Active");
  const isAllSelected = activeEmployeesInDisplay.length > 0 && selectedEmployeeIds.size === activeEmployeesInDisplay.length;
  const isIndeterminate = selectedEmployeeIds.size > 0 && selectedEmployeeIds.size < activeEmployeesInDisplay.length;

  let prevMonthDisplay = "Prev Mth";
  let currentSelectedMonthDisplay = "Sel Mth";
  let nextMonthDisplay = "Next Mth";

  if (selectedMonth && selectedYear > 0) {
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex !== -1) {
      const currentDateObject = new Date(selectedYear, monthIndex, 1);
      
      currentSelectedMonthDisplay = `${selectedMonth.substring(0,3)} ${selectedYear}`;

      const prevMonthDateObject = addMonths(currentDateObject, -1);
      prevMonthDisplay = `${months[getMonth(prevMonthDateObject)].substring(0,3)} ${getYear(prevMonthDateObject)}`;

      const nextMonthDateObject = addMonths(currentDateObject, 1);
      nextMonthDisplay = `${months[getMonth(nextMonthDateObject)].substring(0,3)} ${getYear(nextMonthDateObject)}`;
    }
  }


  if (isLoading && employees.length === 0 && !selectedMonth && !selectedYear && currentYearState === 0) {
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
        description={`View employee leave summaries. CL/SL (0.6/month) and PL (1.2/month) accrue after ${MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL} months service. CL/SL reset Apr-Mar; PL carries forward. Opening balances can be uploaded/edited. "Used" leaves for ${currentSelectedMonthDisplay} sourced from attendance data; balances can go negative. (Data in local storage).`}
      >
        <Button variant="destructive" onClick={handleDeleteSelectedOpeningBalances} disabled={selectedEmployeeIds.size === 0}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear Selected OB ({selectedEmployeeIds.size})
        </Button>
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

      <AlertDialog open={isDeleteSelectedOBDialogOpen} onOpenChange={setIsDeleteSelectedOBDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Clearing Opening Balances</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear the opening balances for {selectedEmployeeIds.size} selected employee(s) for the financial year corresponding to {selectedMonth} {selectedYear > 0 ? selectedYear : ''}? This action cannot be undone (from local storage).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelectedOpeningBalances} variant="destructive">
              Clear Opening Balances
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Dialog open={isEditOpeningBalanceDialogOpen} onOpenChange={(isOpen) => {
          setIsEditOpeningBalanceDialogOpen(isOpen);
          if (!isOpen) {
            setEditingEmployeeForOB(null);
            setEditableOB_CL(0);
            setEditableOB_SL(0);
            setEditableOB_PL(0);
            setEditingOBYear(0);
          }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Opening Balances for {editingEmployeeForOB?.name}</DialogTitle>
            <DialogDescription>
              Set opening leave balances for the financial year starting April {editingOBYear > 0 ? editingOBYear : '(Select Year)'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
                <Label htmlFor="ob-fy-year">Financial Year Start (e.g., 2024 for Apr 2024 - Mar 2025)</Label>
                <Input id="ob-fy-year" type="number" value={editingOBYear > 0 ? editingOBYear : ""} onChange={(e) => setEditingOBYear(parseInt(e.target.value) || 0)} placeholder="Enter year" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="ob-cl">Opening CL</Label>
                <Input id="ob-cl" type="number" value={editableOB_CL} onChange={(e) => setEditableOB_CL(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
            <div className="space-y-1">
                <Label htmlFor="ob-sl">Opening SL</Label>
                <Input id="ob-sl" type="number" value={editableOB_SL} onChange={(e) => setEditableOB_SL(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
             <div className="space-y-1">
                <Label htmlFor="ob-pl">Opening PL</Label>
                <Input id="ob-pl" type="number" value={editableOB_PL} onChange={(e) => setEditableOB_PL(parseFloat(e.target.value) || 0)} step="0.1" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveOpeningBalances} disabled={editingOBYear === 0}>Save Balances</Button>
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
            <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => setSelectedYear(parseInt(value) || 0)}>
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
          <CardTitle>Employee Leave Summary</CardTitle>
          <CardDescription>
            Only 'Active' employees are shown. Leave accrual starts after {MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL} months. Balances can go negative.
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
                    aria-label="Select all visible rows"
                    disabled={activeEmployeesInDisplay.length === 0}
                  />
                </TableHead>
                <TableHead className="min-w-[60px]">Edit OB</TableHead>
                <TableHead className="min-w-[120px]">Division</TableHead>
                <TableHead className="min-w-[80px]">Code</TableHead>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[150px]">Designation</TableHead>
                <TableHead className="min-w-[100px]">HQ</TableHead>
                <TableHead className="min-w-[100px]">DOJ</TableHead>

                <TableHead className="text-center min-w-[140px]">{`Used CL (${prevMonthDisplay})`}</TableHead>
                <TableHead className="text-center min-w-[140px]">{`Used SL (${prevMonthDisplay})`}</TableHead>
                <TableHead className="text-center min-w-[140px]">{`Used PL (${prevMonthDisplay})`}</TableHead>

                <TableHead className="text-center min-w-[140px]">{`Used CL (${currentSelectedMonthDisplay})`}</TableHead>
                <TableHead className="text-center min-w-[140px]">{`Used SL (${currentSelectedMonthDisplay})`}</TableHead>
                <TableHead className="text-center min-w-[140px]">{`Used PL (${currentSelectedMonthDisplay})`}</TableHead>

                <TableHead className="text-center min-w-[150px] font-semibold">{`Opening CL (${nextMonthDisplay})`}</TableHead>
                <TableHead className="text-center min-w-[150px] font-semibold">{`Opening SL (${nextMonthDisplay})`}</TableHead>
                <TableHead className="text-center min-w-[150px] font-semibold">{`Opening PL (${nextMonthDisplay})`}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && displayData.length === 0 && employees.length > 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center py-8">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    Calculating leave balances...
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
                            const parts = emp.doj.split(/[-/.]/);
                            let reparsedDate = null;
                            if (parts.length === 3) {
                                const part1 = parseInt(parts[0]);
                                const part2 = parseInt(parts[1]);
                                const part3 = parseInt(parts[2]);
                                if (part3 > 1000) { // YYYY
                                   if (part2 <=12 && isValid(new Date(part3, part2 - 1, part1))) reparsedDate = new Date(part3, part2 - 1, part1); // DD-MM-YYYY
                                   else if (part1 <=12 && isValid(new Date(part3, part1 - 1, part2))) reparsedDate = new Date(part3, part1 - 1, part2); // MM-DD-YYYY
                                } else if (part1 > 1000) { // Assuming YYYY-MM-DD or YYYY-DD-MM
                                    if (part3 <=12 && isValid(new Date(part1, part3 - 1, part2))) reparsedDate = new Date(part1, part3 - 1, part2); // YYYY-DD-MM
                                    else if (part2 <=12 && isValid(new Date(part1, part2 - 1, part3))) reparsedDate = new Date(part1, part2 - 1, part3); // YYYY-MM-DD
                                } else { // Assuming YY
                                   const yearShort = part3 + 2000; // Convert YY to YYYY
                                   if (part2 <=12 && isValid(new Date(yearShort, part2 -1, part1))) reparsedDate = new Date(yearShort, part2-1, part1); // DD-MM-YY
                                   else if (part1 <=12 && isValid(new Date(yearShort, part1 -1, part2))) reparsedDate = new Date(yearShort, part1-1, part2); // MM-DD-YY
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd MMM yyyy");
                            return emp.doj; // Fallback to original if custom parsing fails
                          }
                          return format(parsedDate, "dd MMM yyyy");
                        } catch (e) {
                          return emp.doj; // Fallback to original on any error
                        }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell className="text-center">{emp.usedCLLastMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedSLLastMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedPLLastMonth.toFixed(1)}</TableCell>

                  <TableCell className="text-center">{emp.usedCLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedSLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedPLInMonth.toFixed(1)}</TableCell>

                  <TableCell className="text-center font-semibold">{emp.openingCLNextMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.openingSLNextMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.openingPLNextMonth.toFixed(1)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={17} className="text-center text-muted-foreground py-8">
                    {employees.length === 0 && !isLoading ? "No employee data. Please add employees in Employee Master." :
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
