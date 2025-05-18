
import type { LeaveType } from './hr-types';

export interface EmployeeDetail {
  id: string;
  code: string;
  name: string;
  designation: string;
  doj: string; // YYYY-MM-DD
  dor?: string; // Date of Resignation YYYY-MM-DD, optional
  status: "Active" | "Left";
  division: string;
  hq: string; 
  grossMonthlySalary: number;
}

// SampleLeaveHistory is removed as per the new requirement to fetch from localStorage or calculate dynamically.
// We will assume leave applications will be stored in localStorage under a new key if applying for leave is implemented.

export const sampleEmployees: EmployeeDetail[] = [
  { id: "E001", code: "E001", name: "John Doe", designation: "Software Engineer", doj: "2023-01-15", status: "Active", division: "FMCG", hq: "New York", grossMonthlySalary: 75000 },
  { id: "E002", code: "E002", name: "Jane Smith", designation: "Project Manager", doj: "2024-03-20", status: "Active", division: "Wellness", hq: "London", grossMonthlySalary: 90000 },
  { id: "E003", code: "E003", name: "Mike Johnson", designation: "UI/UX Designer", doj: "2022-10-01", status: "Active", division: "FMCG", hq: "San Francisco", grossMonthlySalary: 65000 },
  { id: "E004", code: "E004", name: "Alice Brown", designation: "Data Analyst", doj: "2024-06-05", status: "Active", division: "Wellness", hq: "New York", grossMonthlySalary: 70000 },
  { id: "E005", code: "E005", name: "Bob Williams", designation: "QA Engineer", doj: "2023-08-01", dor: "2024-05-15", status: "Left", division: "FMCG", hq: "London", grossMonthlySalary: 60000 },
];

// sampleLeaveHistory has been removed. Leave applications will be managed via localStorage or a future input system.
export const sampleLeaveHistory: never[] = []; // Explicitly empty
