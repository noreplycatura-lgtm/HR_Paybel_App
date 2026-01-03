"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Edit, Trash2, Upload, Calendar, Users, FileText, Search, CalendarDays, CalendarCheck, CalendarX, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, getYear, getMonth, isValid, startOfMonth, addMonths, getDaysInMonth } from "date-fns";
import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateEmployeeLeaveDetailsForPeriod } from "@/lib/hr-calculations";
import type { LeaveApplication, OpeningLeaveBalance } from "@/lib/hr-types";
import { FileUploadButton } from "@/components/shared/file-upload-button";
import { SEED_BALANCES_JAN_2026 } from "@/lib/leave-seed-data";

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "catura_employee_master_data_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "catura_opening_leave_balances_v1";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "catura_leave_applications_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "catura_attendance_raw_data_v4_";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";
const LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY = "catura_current_logged_in_user_display_name_v1";

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
  const [searchTerm, setSearchTerm] = React.useState('');

  const [isEditOpeningBalanceDialogOpen, setIsEditOpeningBalanceDialogOpen] = React.useState(false);
  const [editingEmployeeForOB, setEditingEmployeeForOB] = React.useState<EmployeeDetail | null>(null);
  const [editingOBYear, setEditingOBYear] = React.useState<number>(0);
  const [editingOBMonthIndex, setEditingOBMonthIndex] = React.useState<number | undefined>(undefined);
  const [editableOB_CL, setEditableOB_CL] = React.useState<number>(0);
  const [editableOB_SL, setEditableOB_SL] = React.useState<number>(0);
  const [editableOB_PL, setEditableOB_PL] = React.useState<number>(0);
  const [isDeleteSelectedOBDialogOpen, setIsDeleteSelectedOBDialogOpen] = React.useState(false);

  // Initialize default values
  React.useEffect(() => {
    const now = new Date();
    setCurrentYearState(now.getFullYear());
    setSelectedMonth(months[now.getMonth()]);
    setSelectedYear(now.getFullYear());
  }, []);

  // Load data from localStorage
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
            toast({ title: "Data Error", description: "Could not parse employee master data.", variant: "destructive", duration: 7000 });
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
            toast({ title: "Data Error", description: "Could not parse opening balances.", variant: "destructive", duration: 7000 });
          }
        }

        // Seed Jan 2026 balances if not already present
        const seededBalancesMap = new Map(currentOBs.map(b => [`${b.employeeCode}-${b.financialYearStart}-${b.monthIndex}`, b]));
        let didSeed = false;
        SEED_BALANCES_JAN_2026.forEach(seed => {
          const key = `${seed.employeeCode}-${seed.financialYearStart}-${seed.monthIndex}`;
          if (!seededBalancesMap.has(key)) {
            seededBalancesMap.set(key, { ...seed });
            didSeed = true;
          }
        });

        if (didSeed) {
          const updatedBalances = Array.from(seededBalancesMap.values());
          setOpeningBalances(updatedBalances);
          localStorage.setItem(LOCAL_STORAGE_OPENING_BALANCES_KEY, JSON.stringify(updatedBalances));
          toast({ title: "Data Seeded", description: "Initial leave balances for Jan 2026 have been set." });
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
            toast({ title: "Data Error", description: "Could not load leave applications.", variant: "destructive", duration: 7000 });
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

  // Calculate display data when dependencies change
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
            if (Array.isArray(parsed)) attendanceForSelectedMonth = parsed;
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
            switch (s) {
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

  // Filter display data based on search
  const filteredDisplayData = React.useMemo(() => {
    if (!searchTerm) return displayData;
    const lowercasedFilter = searchTerm.toLowerCase();
    return displayData.filter(emp =>
      emp.name.toLowerCase().includes(lowercasedFilter) ||
      emp.code.toLowerCase().includes(lowercasedFilter)
    );
  }, [displayData, searchTerm]);

  // Calculate stats
  const leaveStats = React.useMemo(() => {
    const totalCLUsed = displayData.reduce((sum, emp) => sum + emp.usedCLInMonth, 0);
    const totalSLUsed = displayData.reduce((sum, emp) => sum + emp.usedSLInMonth, 0);
    const totalPLUsed = displayData.reduce((sum, emp) => sum + emp.usedPLInMonth, 0);
    return {
      totalEmployees: displayData.length,
      totalCLUsed,
      totalSLUsed,
      totalPLUsed,
    };
  }, [displayData]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const allActiveEmployeeIds = filteredDisplayData.map(emp => emp.id);
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
      toast({ title: "Error", description: "No employee or invalid period selected.", variant: "destructive" });
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
        toast({ title: "Opening Balances Saved", description: `Manual opening balance for ${editingEmployeeForOB.name} for ${months[editingOBMonthIndex]} ${editingOBYear} has been saved.` });
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
        csvSelectedMonthDisplay = `${selectedMonth.substring(0, 3)} ${selectedYear}`;
        const nextMonthDateObject = addMonths(currentDateObject, 1);
        csvNextMonthDisplay = `${months[getMonth(nextMonthDateObject)].substring(0, 3)} ${getYear(nextMonthDateObject)}`;
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
            console.warn(`Skipping row ${index + 1} in opening balance CSV: invalid data for ${employeeCode}.`);
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
    const financialYearToClear = selectedMonth && months.indexOf(selectedMonth) >= 3 ? selectedYear : (selectedYear > 0 ? selectedYear - 1 : 0);

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
  const isAllSelected = filteredDisplayData.length > 0 && selectedEmployeeIds.size === filteredDisplayData.length;
  const isIndeterminate = selectedEmployeeIds.size > 0 && selectedEmployeeIds.size < filteredDisplayData.length;

  let currentSelectedMonthDisplay = "Sel Mth";
  let nextMonthDisplay = "Next Mth";

  if (selectedMonth && selectedYear > 0) {
    const monthIndex = months.indexOf(selectedMonth);
    if (monthIndex !== -1) {
      const currentDateObject = new Date(selectedYear, monthIndex, 1);
      currentSelectedMonthDisplay = `${selectedMonth.substring(0, 3)} ${selectedYear}`;
      const nextMonthDateObject = addMonths(currentDateObject, 1);
      nextMonthDisplay = `${months[getMonth(nextMonthDateObject)].substring(0, 3)} ${getYear(nextMonthDateObject)}`;
    }
  }

  // Loading State
  if (isLoading && employees.length === 0 && !selectedMonth && !selectedYear && currentYearState === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading Leave Data...</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN JSX RETURN ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <CalendarDays className="h-7 w-7" />
                Leave Management Dashboard
              </h1>
              <p className="text-purple-100 text-sm">Track and manage employee leave balances</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadReport} disabled={selectedEmployeeIds.size === 0} className="bg-white text-purple-700 hover:bg-purple-50">
                <Download className="mr-2 h-4 w-4" /> Download Report ({selectedEmployeeIds.size})
              </Button>
              <Button onClick={handleDeleteSelectedOpeningBalances} disabled={selectedEmployeeIds.size === 0} variant="destructive" className="bg-red-500 hover:bg-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Clear OB ({selectedEmployeeIds.size})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Employees" value={leaveStats.totalEmployees} icon={Users} color="blue" subtitle={`${selectedMonth} ${selectedYear}`} />
        <StatCard title="Total CL Used" value={leaveStats.totalCLUsed.toFixed(1)} icon={CalendarCheck} color="green" subtitle="Casual Leave" />
        <StatCard title="Total SL Used" value={leaveStats.totalSLUsed.toFixed(1)} icon={CalendarX} color="red" subtitle="Sick Leave" />
        <StatCard title="Total PL Used" value={leaveStats.totalPLUsed.toFixed(1)} icon={CalendarClock} color="purple" subtitle="Privilege Leave" />
      </div>

      {/* Filters & Upload Card */}
      <Card className="shadow-md border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-600" /> Filters & Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left Side - Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={(value) => setSelectedYear(parseInt(value) || 0)}>
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
            </div>

            {/* Right Side - Upload Buttons */}
            <div className="flex flex-wrap gap-2">
              <FileUploadButton
                onFileUpload={handleOpeningBalanceUpload}
                buttonText="Upload FY Balances"
                acceptedFileTypes=".csv"
                icon={<Upload className="mr-2 h-4 w-4" />}
                title="Upload CSV with opening leave balances for employees for a Financial Year"
                variant="outline"
              />
              <Button onClick={handleDownloadOpeningBalanceTemplate} variant="ghost" size="sm">
                <Download className="mr-2 h-4 w-4" /> Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Summary Table */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-purple-600" />
            Employee Leave Summary - {selectedMonth} {selectedYear > 0 ? selectedYear : ''}
          </CardTitle>
          <CardDescription>
            Only 'Active' employees shown. Click Edit to manually set opening balance for the selected month.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected ? true : (isIndeterminate ? 'indeterminate' : false)}
                      onCheckedChange={(checkedState) => handleSelectAll(checkedState as boolean)}
                      aria-label="Select all visible rows"
                      disabled={filteredDisplayData.length === 0}
                    />
                  </TableHead>
                  <TableHead className="w-[60px] font-semibold">Edit</TableHead>
                  <TableHead className="font-semibold">Division</TableHead>
                  <TableHead className="font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Designation</TableHead>
                  <TableHead className="font-semibold">HQ</TableHead>
                  <TableHead className="font-semibold">DOJ</TableHead>
                  <TableHead className="text-center font-semibold bg-green-50">{`CL Used`}</TableHead>
                  <TableHead className="text-center font-semibold bg-red-50">{`SL Used`}</TableHead>
                  <TableHead className="text-center font-semibold bg-purple-50">{`PL Used`}</TableHead>
                  <TableHead className="text-center font-semibold bg-green-100">{`Opening CL`}</TableHead>
                  <TableHead className="text-center font-semibold bg-red-100">{`Opening SL`}</TableHead>
                  <TableHead className="text-center font-semibold bg-purple-100">{`Opening PL`}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && displayData.length === 0 && employees.length > 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-600" />
                      <p className="mt-2 text-gray-500">Calculating leave balances...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredDisplayData.length > 0 ? (
                  filteredDisplayData.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-purple-50/50" data-state={selectedEmployeeIds.has(emp.id) ? "selected" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployeeIds.has(emp.id)}
                          onCheckedChange={(checked) => handleSelectEmployee(emp.id, !!checked)}
                          aria-label={`Select row for ${emp.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditOpeningBalanceDialog(emp)} className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" title={`Edit opening balances for ${emp.name}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>{emp.division || "N/A"}</TableCell>
                      <TableCell className="font-medium text-purple-600">{emp.code}</TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.designation}</TableCell>
                      <TableCell>{emp.hq || "N/A"}</TableCell>
                      <TableCell>
                        {(() => {
                          if (emp.doj && typeof emp.doj === 'string' && emp.doj.trim() !== '') {
                            try {
                              const parsedDate = parseISO(emp.doj);
                              if (isValid(parsedDate)) return format(parsedDate, "dd MMM yyyy");
                              return emp.doj;
                            } catch (e) {
                              return emp.doj;
                            }
                          }
                          return 'N/A';
                        })()}
                      </TableCell>
                      <TableCell className="text-center bg-green-50 font-medium">{emp.usedCLInMonth.toFixed(1)}</TableCell>
                      <TableCell className="text-center bg-red-50 font-medium">{emp.usedSLInMonth.toFixed(1)}</TableCell>
                      <TableCell className="text-center bg-purple-50 font-medium">{emp.usedPLInMonth.toFixed(1)}</TableCell>
                      <TableCell className="text-center bg-green-100 font-bold text-green-700">{emp.openingCLNextMonth.toFixed(1)}</TableCell>
                      <TableCell className="text-center bg-red-100 font-bold text-red-700">{emp.openingSLNextMonth.toFixed(1)}</TableCell>
                      <TableCell className="text-center bg-purple-100 font-bold text-purple-700">{emp.openingPLNextMonth.toFixed(1)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarDays className="h-12 w-12 text-gray-300" />
                        <p className="text-gray-500 font-medium">
                          {employees.length === 0 ? "No employee data found" :
                            selectedMonth && selectedYear > 0 ? "No active employees for the selected period" :
                              "Please select month and year to view leave summary"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ==================== DIALOGS ==================== */}

      {/* Delete Selected Opening Balances Dialog */}
      <AlertDialog open={isDeleteSelectedOBDialogOpen} onOpenChange={setIsDeleteSelectedOBDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Clearing Opening Balances
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear the opening balances for <span className="font-semibold">{selectedEmployeeIds.size}</span> selected employee(s) for the financial year corresponding to {selectedMonth} {selectedYear > 0 ? selectedYear : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelectedOpeningBalances} className="bg-red-600 hover:bg-red-700">
              Clear Opening Balances
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Opening Balance Dialog */}
      <Dialog open={isEditOpeningBalanceDialogOpen} onOpenChange={(isOpen) => {
        setIsEditOpeningBalanceDialogOpen(isOpen);
        if (!isOpen) {
          setEditingEmployeeForOB(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Edit className="h-5 w-5 text-purple-600" />
              </div>
              Edit Opening Balance - {editingEmployeeForOB?.name}
            </DialogTitle>
            <DialogDescription>
              Set opening leave balances for <strong>{months[editingOBMonthIndex || 0]} {editingOBYear > 0 ? editingOBYear : ''}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ob-cl" className="text-sm font-medium">Opening CL (Casual Leave)</Label>
              <Input id="ob-cl" type="number" value={editableOB_CL} onChange={(e) => setEditableOB_CL(parseFloat(e.target.value) || 0)} step="0.5" className="border-gray-300" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-sl" className="text-sm font-medium">Opening SL (Sick Leave)</Label>
              <Input id="ob-sl" type="number" value={editableOB_SL} onChange={(e) => setEditableOB_SL(parseFloat(e.target.value) || 0)} step="0.5" className="border-gray-300" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-pl" className="text-sm font-medium">Opening PL (Privilege Leave)</Label>
              <Input id="ob-pl" type="number" value={editableOB_PL} onChange={(e) => setEditableOB_PL(parseFloat(e.target.value) || 0)} step="0.5" className="border-gray-300" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveOpeningBalances} disabled={editingOBYear === 0} className="bg-purple-600 hover:bg-purple-700">
              Save Balances
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}