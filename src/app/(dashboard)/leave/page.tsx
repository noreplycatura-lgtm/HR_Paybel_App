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
import { calculateEmployeeLeaveDetailsForPeriod } from "@/lib/hr-calculations";
import type { LeaveApplication, OpeningLeaveBalance } from "@/lib/hr-types";
import { FileUploadButton } from "@/components/shared/file-upload-button";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";
const LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY = "novita_current_logged_in_user_display_name_v1";


interface ActivityLogEntry {
  timestamp: string;
  message: string;
  user: string;
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = [];

    const loggedInUser = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY) || "System";

    activities.unshift({ timestamp: new Date().toISOString(), message, user: loggedInUser });
    activities = activities.slice(0, 10); 
    localStorage.setItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error adding to activity log:", error);
  }
};

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface LeaveDisplayData extends EmployeeDetail {
  usedCLInMonth: number; 
  usedSLInMonth: number; 
  usedPLInMonth: number; 
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

const SEED_BALANCES_2025: Omit<OpeningLeaveBalance, 'monthIndex'>[] = [
    { employeeCode: "17358", openingCL: 1.5, openingSL: 1.5, openingPL: 16, financialYearStart: 2025 },
    { employeeCode: "17357", openingCL: 1.5, openingSL: 1.5, openingPL: 51, financialYearStart: 2025 },
    { employeeCode: "17084", openingCL: 0, openingSL: 0, openingPL: 0.75, financialYearStart: 2025 },
    { employeeCode: "17098", openingCL: 4.5, openingSL: 4.5, openingPL: 33, financialYearStart: 2025 },
    { employeeCode: "17835", openingCL: 2.5, openingSL: 0.5, openingPL: 5, financialYearStart: 2025 },
    { employeeCode: "13268", openingCL: 3.5, openingSL: 2, openingPL: 3, financialYearStart: 2025 },
    { employeeCode: "17208", openingCL: 0, openingSL: 0, openingPL: 0, financialYearStart: 2025 },
    { employeeCode: "14717", openingCL: 4, openingSL: 3, openingPL: 63, financialYearStart: 2025 },
    { employeeCode: "17784", openingCL: 2, openingSL: 0, openingPL: 7, financialYearStart: 2025 },
    { employeeCode: "10036", openingCL: 4.5, openingSL: 4.5, openingPL: 97, financialYearStart: 2025 },
    { employeeCode: "10051", openingCL: 1.5, openingSL: 1, openingPL: 3, financialYearStart: 2025 },
    { employeeCode: "14103", openingCL: 4.5, openingSL: 3, openingPL: 37, financialYearStart: 2025 },
    { employeeCode: "17362", openingCL: 2, openingSL: 2, openingPL: 2, financialYearStart: 2025 },
    { employeeCode: "13042", openingCL: 2.5, openingSL: 1.5, openingPL: 56, financialYearStart: 2025 },
    { employeeCode: "19210", openingCL: 1.5, openingSL: 1.5, openingPL: 8.75, financialYearStart: 2025 },
    { employeeCode: "17012", openingCL: 2, openingSL: 2, openingPL: 0, financialYearStart: 2025 },
    { employeeCode: "18679", openingCL: 4.5, openingSL: 3, openingPL: 7, financialYearStart: 2025 },
    { employeeCode: "18894", openingCL: 3.5, openingSL: 1.5, openingPL: 10, financialYearStart: 2025 },
    { employeeCode: "19131", openingCL: 1, openingSL: 1, openingPL: -0.5, financialYearStart: 2025 },
    { employeeCode: "14766", openingCL: 3.5, openingSL: 3.5, openingPL: 87.5, financialYearStart: 2025 },
    { employeeCode: "17834", openingCL: 0, openingSL: 0, openingPL: 0, financialYearStart: 2025 },
    { employeeCode: "17054", openingCL: 0, openingSL: 0, openingPL: 0, financialYearStart: 2025 },
    { employeeCode: "17863", openingCL: 3, openingSL: 3, openingPL: 4, financialYearStart: 2025 },
    { employeeCode: "17402", openingCL: 1.5, openingSL: 1.5, openingPL: 0, financialYearStart: 2025 },
    { employeeCode: "13413", openingCL: 2, openingSL: 2, openingPL: 13, financialYearStart: 2025 },
    { employeeCode: "17785", openingCL: 3, openingSL: 3, openingPL: 66, financialYearStart: 2025 },
];


export default function LeavePage() {
  const { toast } = useToast();
  const [employees, setEmployees] = React.useState<EmployeeDetail[]>([]);
  const [openingBalances, setOpeningBalances] = React.useState<OpeningLeaveBalance[]>([]);
  const [leaveApplications, setLeaveApplications] = React.useState<LeaveApplication[]>([]); 

  const [currentYearState, setCurrentYearState] = React.useState(0);
  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);

  const [displayData, setDisplayData] = React.useState<LeaveDisplayData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<Set<string>>(new Set());

  const [isEditOpeningBalanceDialogOpen, setIsEditOpeningBalanceDialogOpen] = React.useState(false);
  const [editingEmployeeForOB, setEditingEmployeeForOB] = React.useState<EmployeeDetail | null>(null);
  const [editingOBYear, setEditingOBYear] = React.useState<number>(0);
  const [editingOBMonthIndex, setEditingOBMonthIndex] = React.useState<number | undefined>(undefined);
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
        let currentOBs: OpeningLeaveBalance[] = [];
        if (storedOBStr) {
            try {
                const parsedOB = JSON.parse(storedOBStr);
                currentOBs = Array.isArray(parsedOB) ? parsedOB : [];
            } catch (e) {
                console.error("Error parsing opening balances from localStorage:", e);
                toast({ title: "Data Error", description: "Could not parse opening balances. Calculations may be inaccurate.", variant: "destructive", duration: 7000 });
            }
        }
        
        // Seed Dec 2025 balances if not already present
        const seededBalancesMap = new Map(currentOBs.map(b => [`${b.employeeCode}-${b.financialYearStart}-${b.monthIndex}`, b]));
        let didSeed = false;
        SEED_BALANCES_2025.forEach(seed => {
            const key = `${seed.employeeCode}-${seed.financialYearStart}-11`; // 11 for December
            if (!seededBalancesMap.has(key)) {
                seededBalancesMap.set(key, { ...seed, monthIndex: 11 });
                didSeed = true;
            }
        });
        
        if (didSeed) {
            const updatedBalances = Array.from(seededBalancesMap.values());
            setOpeningBalances(updatedBalances);
            localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedBalances));
            toast({ title: "Data Seeded", description: "Initial leave balances for Dec 2025 have been set." });
        } else {
            setOpeningBalances(currentOBs);
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
    setIsLoading(false);
  }, []); 

  React.useEffect(() => {
    if (!selectedMonth || !selectedYear || selectedYear === 0 || employees.length === 0) {
      setDisplayData([]);
      setIsLoading(employees.length > 0 ? false : true); 
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
      .filter(emp => emp.status === "Active")
      .map(emp => {
        let usedCLInMonthFromAttendance = 0, usedSLInMonthFromAttendance = 0, usedPLInMonthFromAttendance = 0;
        const empAttSelectedMonth = attendanceForSelectedMonth.find(att => att.code === emp.code);
        if (empAttSelectedMonth && empAttSelectedMonth.attendance) {
            const daysInSelected = getDaysInMonth(selectedMonthStartDate);
            empAttSelectedMonth.attendance.slice(0, daysInSelected).forEach(status => {
                const s = status.toUpperCase();
                switch(s) {
                  case 'CL': usedCLInMonthFromAttendance += 1; break;
                  case 'SL': usedSLInMonthFromAttendance += 1; break;
                  case 'PL': usedPLInMonthFromAttendance += 1; break;
                  case 'HCL': usedCLInMonthFromAttendance += 0.5; break;
                  case 'HSL': usedSLInMonthFromAttendance += 0.5; break;
                  case 'HPL': usedPLInMonthFromAttendance += 0.5; break;
                }
            });
        }

        const accruedDetailsEOMSelectedMonth = calculateEmployeeLeaveDetailsForPeriod(
          emp, selectedYear, monthIndex, leaveApplications, openingBalances
        );
        
        const closingBalanceCLSelectedMonth = accruedDetailsEOMSelectedMonth.balanceCLAtMonthEnd - usedCLInMonthFromAttendance;
        const closingBalanceSLSelectedMonth = accruedDetailsEOMSelectedMonth.balanceSLAtMonthEnd - usedSLInMonthFromAttendance;
        const closingBalancePLSelectedMonth = accruedDetailsEOMSelectedMonth.balancePLAtMonthEnd - usedPLInMonthFromAttendance;

        const nextMonthDateObject = addMonths(selectedMonthStartDate, 1);

        const nextMonthDetails = calculateEmployeeLeaveDetailsForPeriod(
            emp, getYear(nextMonthDateObject), getMonth(nextMonthDateObject), leaveApplications, openingBalances
        );

        return {
          ...emp,
          usedCLInMonth: usedCLInMonthFromAttendance,
          usedSLInMonth: usedSLInMonthFromAttendance,
          usedPLInMonth: usedPLInMonthFromAttendance,
          openingCLNextMonth: nextMonthDetails.balanceCLAtMonthEnd,
          openingSLNextMonth: nextMonthDetails.balanceSLAtMonthEnd,
          openingPLNextMonth: nextMonthDetails.balancePLAtMonthEnd,
        };
    });

    setDisplayData(newDisplayData.filter(d => d !== null) as LeaveDisplayData[]);
    setSelectedEmployeeIds(new Set());
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
    const monthIndex = months.indexOf(selectedMonth);

    setEditingOBYear(selectedYear);
    setEditingOBMonthIndex(monthIndex);

    const existingOB = openingBalances.find(
      (ob) => ob.employeeCode === employee.code && ob.financialYearStart === selectedYear && ob.monthIndex === monthIndex
    );
    
    if (existingOB) {
      setEditableOB_CL(existingOB.openingCL);
      setEditableOB_SL(existingOB.openingSL);
      setEditableOB_PL(existingOB.openingPL);
    } else {
      // If no manual override exists, calculate and show the balance at the START of the selected month.
      const prevMonthDate = addMonths(new Date(selectedYear, monthIndex, 1), -1);
      const balancesAtPrevMonthEnd = calculateEmployeeLeaveDetailsForPeriod(employee, getYear(prevMonthDate), getMonth(prevMonthDate), leaveApplications, openingBalances);
      setEditableOB_CL(balancesAtPrevMonthEnd.balanceCLAtMonthEnd);
      setEditableOB_SL(balancesAtPrevMonthEnd.balanceSLAtMonthEnd);
      setEditableOB_PL(balancesAtPrevMonthEnd.balancePLAtMonthEnd);
    }
    setIsEditOpeningBalanceDialogOpen(true);
  };

  const handleSaveOpeningBalances = () => {
    if (!editingEmployeeForOB || editingOBYear <= 0 || editingOBMonthIndex === undefined) {
      toast({ title: "Error", description: "No employee or invalid period selected.", variant: "destructive"});
      return;
    }

    const updatedOpeningBalances = [...openingBalances];
    const existingOBIndex = updatedOpeningBalances.findIndex(
      (ob) => ob.employeeCode === editingEmployeeForOB.code && ob.financialYearStart === editingOBYear && ob.monthIndex === editingOBMonthIndex
    );

    const newBalanceRecord: OpeningLeaveBalance = {
      employeeCode: editingEmployeeForOB.code,
      openingCL: editableOB_CL,
      openingSL: editableOB_SL,
      openingPL: editableOB_PL,
      financialYearStart: editingOBYear,
      monthIndex: editingOBMonthIndex,
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
        addActivityLog(`Manual leave balance for ${editingEmployeeForOB.name} (${months[editingOBMonthIndex]} ${editingOBYear}) updated.`);
        toast({ title: "Opening Balances Saved", description: `Manual opening balance for ${editingEmployeeForOB.name} for ${months[editingOBMonthIndex]} ${editingOBYear} has been saved.`});
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
    
    let csvSelectedMonthDisplay = "Sel Mth";
    let csvNextMonthDisplay = "Next Mth";

    if (selectedMonth && selectedYear > 0) {
        const monthIndex = months.indexOf(selectedMonth);
        if (monthIndex !== -1) {
            const currentDateObject = new Date(selectedYear, monthIndex, 1);
            csvSelectedMonthDisplay = `${selectedMonth.substring(0,3)} ${selectedYear}`;
            const nextMonthDateObject = addMonths(currentDateObject, 1);
            csvNextMonthDisplay = `${months[getMonth(nextMonthDateObject)].substring(0,3)} ${getYear(nextMonthDateObject)}`;
        }
    }

    const csvRows: string[][] = [];
    const headers = [
      "Division", "Code", "Name", "Designation", "HQ", "DOJ",
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

    addActivityLog(`Leave report for ${selectedMonth} ${selectedYear} (selected employees) downloaded.`);
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
            const employeeCodesInFile = new Set<string>(); 
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

                const existingRecordsMap = new Map(openingBalances.map(b => [`${b.employeeCode}-${b.financialYearStart}-${b.monthIndex ?? 'fy'}`, b]));
                newUploadedOpeningBalances.forEach(nb => {
                    existingRecordsMap.set(`${nb.employeeCode}-${nb.financialYearStart}-fy`, nb);
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

  let currentSelectedMonthDisplay = "Sel Mth";
  let nextMonthDisplay = "Next Mth";

  if (selectedMonth && selectedYear > 0) {
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex !== -1) {
      const currentDateObject = new Date(selectedYear, monthIndex, 1);
      currentSelectedMonthDisplay = `${selectedMonth.substring(0,3)} ${selectedYear}`;
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
        description={`View employee leave summaries. Used leaves for ${currentSelectedMonthDisplay} sourced from attendance. Balances can be manually set for any month. (Data in local storage).`}
      >
        <Button variant="destructive" onClick={handleDeleteSelectedOpeningBalances} disabled={selectedEmployeeIds.size === 0}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear Selected OB ({selectedEmployeeIds.size})
        </Button>
        <FileUploadButton
            onFileUpload={handleOpeningBalanceUpload}
            buttonText="Upload FY Balances (CSV)"
            acceptedFileTypes=".csv"
            icon={<Upload className="mr-2 h-4 w-4" />}
            title="Upload CSV with opening leave balances for employees for a Financial Year"
        />
        <Button onClick={handleDownloadOpeningBalanceTemplate} variant="link" className="p-0 h-auto">
            <Download className="mr-2 h-4 w-4" />
            Download FY Balance Template (CSV)
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
          }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Opening Balance for {editingEmployeeForOB?.name}</DialogTitle>
            <DialogDescription>
              Manually set the opening leave balances for <strong>{months[editingOBMonthIndex || 0]} {editingOBYear > 0 ? editingOBYear : ''}</strong>. Future months will calculate from these values.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
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
            Only 'Active' employees are shown. Balances can be negative. Click Edit to manually set opening balance for the selected month.
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
                  <TableCell colSpan={14} className="text-center py-8">
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
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditOpeningBalanceDialog(emp)} title={`Edit opening balances for ${emp.name} for ${selectedMonth} ${selectedYear}`}>
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
                                if (part3 > 1000) { 
                                   if (part2 <=12 && isValid(new Date(part3, part2 - 1, part1))) reparsedDate = new Date(part3, part2 - 1, part1); 
                                   else if (part1 <=12 && isValid(new Date(part3, part1 - 1, part2))) reparsedDate = new Date(part3, part1 - 1, part2); 
                                } else if (part1 > 1000) { 
                                    if (part3 <=12 && isValid(new Date(part1, part3 - 1, part2))) reparsedDate = new Date(part1, part3 - 1, part2); 
                                    else if (part2 <=12 && isValid(new Date(part1, part2 - 1, part3))) reparsedDate = new Date(part1, part2 - 1, part3); 
                                } else { 
                                   const yearShort = part3 + 2000; 
                                   if (part2 <=12 && isValid(new Date(yearShort, part2 -1, part1))) reparsedDate = new Date(yearShort, part2-1, part1); 
                                   else if (part1 <=12 && isValid(new Date(yearShort, part1 -1, part2))) reparsedDate = new Date(yearShort, part1-1, part2); 
                                }
                            }
                            if(reparsedDate && isValid(reparsedDate)) return format(reparsedDate, "dd MMM yyyy");
                            return emp.doj; 
                          }
                          return format(parsedDate, "dd MMM yyyy");
                        } catch (e) {
                          return emp.doj; 
                        }
                      }
                      return 'N/A';
                    })()}
                  </TableCell>
                  <TableCell className="text-center">{emp.usedCLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedSLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{emp.usedPLInMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.openingCLNextMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.openingSLNextMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-center font-semibold">{emp.openingPLNextMonth.toFixed(1)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
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
