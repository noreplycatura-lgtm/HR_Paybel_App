
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
  revisedGrossMonthlySalary?: number;
  salaryEffectiveDate?: string; // YYYY-MM-DD
}

export const sampleEmployees: EmployeeDetail[] = [
  { id: "E001", code: "E001", name: "John Doe", designation: "Software Engineer", doj: "2023-01-15", status: "Active", division: "FMCG", hq: "New York", grossMonthlySalary: 75000, revisedGrossMonthlySalary: 80000, salaryEffectiveDate: "2024-04-01" },
  { id: "E002", code: "E002", name: "Jane Smith", designation: "Project Manager", doj: "2024-03-20", status: "Active", division: "Wellness", hq: "London", grossMonthlySalary: 90000 },
  { id: "E003", code: "E003", name: "Mike Johnson", designation: "UI/UX Designer", doj: "2022-10-01", status: "Active", division: "FMCG", hq: "San Francisco", grossMonthlySalary: 65000 },
  { id: "E004", code: "E004", name: "Alice Brown", designation: "Data Analyst", doj: "2024-06-05", status: "Active", division: "Wellness", hq: "New York", grossMonthlySalary: 70000 },
  { id: "E005", code: "E005", name: "Bob Williams", designation: "QA Engineer", doj: "2023-08-01", dor: "2024-05-15", status: "Left", division: "FMCG", hq: "London", grossMonthlySalary: 60000 },
];

export const sampleLeaveHistory: never[] = [];
