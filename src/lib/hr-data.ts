
import type { LeaveType } from './hr-types';

export interface EmployeeDetail {
  id: string;
  code: string;
  name: string;
  designation: string;
  doj: string; // YYYY-MM-DD
}

export interface LeaveHistoryEntry {
  id: string;
  employeeId: string;
  employeeName: string; // For convenience, though ideally looked up
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: number; // Can be 0.5 for half-days
}

export const sampleEmployees: EmployeeDetail[] = [
  { id: "E001", code: "E001", name: "John Doe", designation: "Software Engineer", doj: "2023-01-15" },
  { id: "E002", code: "E002", name: "Jane Smith", designation: "Project Manager", doj: "2024-03-20" },
  { id: "E003", code: "E003", name: "Mike Johnson", designation: "UI/UX Designer", doj: "2022-10-01" },
  { id: "E004", code: "E004", name: "Alice Brown", designation: "Data Analyst", doj: "2024-06-05" },
  { id: "E005", code: "E005", name: "Bob Williams", designation: "QA Engineer", doj: "2023-08-01" },
];

export const sampleLeaveHistory: LeaveHistoryEntry[] = [
  { id: "L001", employeeId: "E001", employeeName: "John Doe", leaveType: "PL", startDate: "2024-07-10", endDate: "2024-07-11", days: 2 },
  { id: "L002", employeeId: "E002", employeeName: "Jane Smith", leaveType: "SL", startDate: "2024-07-15", endDate: "2024-07-15", days: 1 },
  { id: "L003", employeeId: "E003", employeeName: "Mike Johnson", leaveType: "CL", startDate: "2024-07-20", endDate: "2024-07-20", days: 1 },
  { id: "L004", employeeId: "E001", employeeName: "John Doe", leaveType: "CL", startDate: "2024-06-05", endDate: "2024-06-05", days: 1 },
  { id: "L005", employeeId: "E003", employeeName: "Mike Johnson", leaveType: "SL", startDate: "2024-05-10", endDate: "2024-05-10", days: 0.5 },
  { id: "L006", employeeId: "E001", employeeName: "John Doe", leaveType: "SL", startDate: "2024-04-01", endDate: "2024-04-01", days: 1 },
  { id: "L007", employeeId: "E004", employeeName: "Alice Brown", leaveType: "CL", startDate: "2024-08-01", endDate: "2024-08-01", days: 1 },
  // Add more entries to test balances, e.g., for E001 for PL eligibility
  { id: "L008", employeeId: "E001", employeeName: "John Doe", leaveType: "PL", startDate: "2023-08-01", endDate: "2023-08-02", days: 2 }, // John Doe PL after 6 months in 2023
];
