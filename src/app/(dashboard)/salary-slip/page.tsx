"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, Loader2, Printer, XCircle, Send, CheckCircle, AlertCircle, CloudUpload, FileText } from "lucide-react";
import { getDaysInMonth, parseISO, isValid, format, getMonth, getYear, addMonths, startOfMonth, endOfMonth, isBefore, isEqual, isAfter } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import type { EmployeeDetail } from "@/lib/hr-data";
import { calculateMonthlySalaryComponents } from "@/lib/salary-calculations";
import {
  calculateEmployeeLeaveDetailsForPeriod,
  calculateMonthsOfService,
  MIN_SERVICE_MONTHS_FOR_LEAVE_ACCRUAL,
  CL_ACCRUAL_RATE,
  SL_ACCRUAL_RATE,
  PL_ACCRUAL_RATE,
} from "@/lib/hr-calculations";
import type { OpeningLeaveBalance, LeaveApplication } from "@/lib/hr-types";
import { getCompanyConfig, type CompanyConfig, uploadPDFToDrive, createDriveFolder } from "@/lib/google-sheets";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ⚠️ IMPORTANT: Company Logo Base64 String
const COMPANY_LOGO_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAA3AFwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9QKKT2yAe2elec/Fj44eH/hDBHHqEz3upzqXisYMb3wOp/urnAz15FeBhsNWxkowoxbb6LoRi8bQwNJ1sTLliu56PRXzv8Hv2mtW+KnxC/sdtGstNsfsktwMSvJIChXALcDoT/D+Nd14e+OWlXWpaVoOrNCniu+kZJdN0qX7YltycGSReE+UZwfWvTxGTYzDVPZSjqld+XqeVhOIMvxsFVpVPdbsm9Ltdj06io0mWba0ZDIVDZXkHPQg9OxqHUtSt9Jsprq7uYrS3jUs807BUUepJ6V4yg5S5Fue/KpGK5pOy7lqisLwn440PxxaTXWg6pa6rbQv5byWzblVuT178YrSudQtrJoTcXEcImlEaeY4Xe56KPcntVOlOMnBxd15Gca9KUPaKS5e/T7y3RTSducnjaMY59c/rSKw2jrzxU8kuhve+w+ikpF7/AONRovidieZGL4y8Tw+D/Cusa3OvmR6fbPP5YOPMYDIUe5OAPcivzugt9d+LnjpQWa713WZs7lY7cnknvtRRk4x0wO3H2/8AtJW0918E/E6265dYo5Wx2RJUdz+CqT+FfKn7MGoW+n/Fi1indY3vrGe2tpCORKygrg9jgMPxx3r9R4daweWYrH0Y81SKdj8V4ynLHZtg8vqScaUtz234e/BvwD4M8M6zqF7rN1qEy28um6jqMcrwxjdgMkYQ564+6TyPwpb7w9H4b8Ca/P8ADGLz7S9t00uLS7W023MFw7hZLmSd/wB4SEbHJwMDHSrfhyT+1LHwx4WhtGXUbPUvO1KFoyQEjYklyRyCG/pWtdeVeWHxFvIII10u+VbKKO4uvsSXEoUoFEhxtyxx2zur8cy3izNMxzGlHEPmhJ2as99/uR91PKMJhsHyUYcnKm0+vr/manwjuofC94/gQaxo9zFplrbraWtnOXvCyqTcGdeiZkZSoHY4rmf2nNSim1j4daJqkq2vhvUdUMmpTO2yPbH5ZCO2QApDP144B7VS+CumJovjbTtPj8GX3ga4t7SdryD7ClzBfHcgVvtxG7IJztUkfMPSvWPiNceHV0i2h8RaTHr0VxPstrN7RJy0g6FQwOCOea+4xmKw2VY1Yqs/dS18r6XMsLRqZjlcqCajrbrbSzs76+p418UvH2maX4j0nQ9B1q28OeGP7KuNVnvNEmjge7aMOkUMUq8ZynKj0x2rjpodV8bj4NaZ4h8T38DXsc2oS3bzhMMHZ4HUuc+Zt+UMc8NxXvN/N4St9A0ae58G2ttFDc/YbKxu9PiU2u4HcUGMKpxzj1rW8TaL4YW10ST/AIRWw1lbeWO0sFjtYWWzUEYKAjCqpVeB6D0rPD8UZcqcYQu3Fbu19b6/5nFVyLFV5zcqsVFtaK6VrrS35Hz34j+KOstdeNdN0/xJdRaldeIbXQ9NtftLedCsZIklQDGBJjlgMEt7100PibxNqXiT4meJV8Q6gmh+FH3W+mwv+6uZIIG3q7HO1Sy5YDrkHrivb18J+EX1KW7Oi6ONRuZlneYWsPnySo2Q5OMllbkHqDV2z0rQbH7dZWen6bbfbXeW7s4oo0+1OwAZ5AB8zEYBJzmuipn+WzXNCGrt2NaeQ4y/vYjS7slfqnb7j56+BvirWPEfxR0IN4wvNaim0H+1tWhkufMgE8rEC3WNfljK7kOAOMGvp1Dt3ZB5PTGccDisnR/Beg+Hbr7Rpei6dpsqxeQslpaxxOIy24plQDjdzjpnmtlSVGAcD2rzcfjKeLqqVKPKrdUj6TKcDWwFB060+dt3vr+pQ1jSrfW9KvLC8iFxa3UTQSwt0dXUqVPsQxr89PiX8Ndb+Evi77I5mWBZ9+n38GR5iKcqVYciQYwyjoV44r9GazPEHhnS/FemSadq9hb6hZS/ehuFBU+/1ruyLOZZTUakuaEtGjxeJeHI57SUoy5asfhZ8zfA79onxj4wuLjQZbLTtU1WHT5ri0uC5ieZ4wAqSEZBJ3dQB7jqRe8R+L7j4oXWreC/FYuvC+s3lkgsdFntVaE3qMXWaO5HLKxCrg4HJG416n4T/Z+8JeBfFc2t6PHdWtzLbtbmI3JaIKxBON3zDpxg11nhnwXo/hXR9P0rTrLy7Cx3fZo53aUx5JJwXyR95segJFehisyyyFeVXC0Uuaz03T6/ecGBybNPq6o4ytdrR66NHP8Awr0PUbHRU1bxBLepr+p20AvLK4uQ8MUkSeXmNASFLcMwBPJp3xSkspoLezvrHV57hP39td6bAW8uQdACD1Nd4qhc4GMnJ+tGxf7o656d/Wvg80pvMqUqc3a/9bH3FDCww9NU4/8AD+p4vNp+s643g6312zuLiOFLi7ug8JOVAPlBv9vAGR71T8P6LqCw+DbebTp0jjmutQuF8tsIVJ2DHqSox9a91or5KXDcJO7rO9kvW3T0NvZI8G8M+F7iTUvCVzNpksF7Pd3d7dzGNgYyrHam7spIzjpz71e+Hfh6W88TRTatBNFqdpcSTyzC1kVnc4GHmztIGeEHbJ7V7WeevNA+XpxWtDh6nQqQmqjaXSw1Ts7iR/dIP3wxzjvS0YxnA69aK+vVr67GoUUUUr21B7DdrE5zTqKKdklddTOMuZ6hRRRSNQooooAKKKKACiiigD//2Q==';

// Company Address Lines
const COMPANY_ADDRESS_LINES = [
  "37 B, Mangal Compound,",
  "Pipliya Kumar Dewas Naka,",
  "Indore - 452010, Madhya Pradesh"
];

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "catura_employee_master_data_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "catura_opening_leave_balances_v1";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "catura_performance_deductions_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "catura_attendance_raw_data_v4_";
const LOCAL_STORAGE_SALARY_EDITS_PREFIX = "catura_salary_sheet_edits_v1_";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "catura_leave_applications_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";

interface SalarySlipDataType {
  employeeId: string;
  name: string;
  designation: string;
  joinDate: string;
  division: string;
  totalDaysInMonth: number;
  actualPayDays: number;
  earnings: Array<{ component: string; amount: number }>;
  deductions: Array<{ component: string; amount: number }>;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  leaveUsedThisMonth: { cl: number; sl: number; pl: number };
  leaveBalanceNextMonth: { cl: number; sl: number; pl: number };
  absentDays: number;
  weekOffs: number;
  paidHolidays: number;
  workingDays: number;
  totalLeavesTakenThisMonth: number;
  period: string;
}

interface MonthlyEmployeeAttendance {
  code: string;
  attendance: string[];
}

interface EditableSalaryFields {
  arrears?: number;
  tds?: number;
  loan?: number;
  salaryAdvance?: number;
  manualOtherDeduction?: number;
  professionalTax?: number;
  providentFund?: number;
}

interface PerformanceDeductionEntry {
  id: string;
  employeeCode: string;
  month: string;
  year: number;
  amount: number;
}

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

// Helper function to get next month name from period string
const getNextMonthName = (period: string): string => {
  const parts = period.split(' ');
  const monthStr = parts[0];
  const yearStr = parts[1];
  const parsedYear = parseInt(yearStr, 10);
  const monthIndex = months.indexOf(monthStr);
  if (!isNaN(parsedYear) && monthIndex !== -1) {
    const nextMonthDate = addMonths(new Date(parsedYear, monthIndex, 1), 1);
    return `${format(nextMonthDate, "MMMM")} ${getYear(nextMonthDate)}`;
  }
  return "Next Month";
};

// Number to Words Converter
function convertToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return "Zero Rupees Only";
  if (num < 0) return "Minus " + convertToWords(Math.abs(num));

  const convertTwoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
  };

  const convertThreeDigits = (n: number): string => {
    if (n === 0) return '';
    if (n < 100) return convertTwoDigits(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertTwoDigits(n % 100) : '');
  };

  const roundedNum = parseFloat(num.toFixed(2));
  const wholePart = Math.floor(roundedNum);
  const decimalPart = Math.round((roundedNum - wholePart) * 100);

  let words = '';

  if (wholePart === 0) {
    words = '';
  } else if (wholePart < 1000) {
    words = convertThreeDigits(wholePart);
  } else if (wholePart < 100000) {
    const thousands = Math.floor(wholePart / 1000);
    const remainder = wholePart % 1000;
    words = convertTwoDigits(thousands) + ' Thousand';
    if (remainder > 0) words += ' ' + convertThreeDigits(remainder);
  } else if (wholePart < 10000000) {
    const lakhs = Math.floor(wholePart / 100000);
    const remainder = wholePart % 100000;
    words = convertTwoDigits(lakhs) + ' Lakh';
    if (remainder > 0) {
      const thousands = Math.floor(remainder / 1000);
      const rest = remainder % 1000;
      if (thousands > 0) words += ' ' + convertTwoDigits(thousands) + ' Thousand';
      if (rest > 0) words += ' ' + convertThreeDigits(rest);
    }
  } else {
    const crores = Math.floor(wholePart / 10000000);
    const remainder = wholePart % 10000000;
    words = convertTwoDigits(crores) + ' Crore';
    if (remainder > 0) {
      const lakhs = Math.floor(remainder / 100000);
      const restAfterLakh = remainder % 100000;
      if (lakhs > 0) words += ' ' + convertTwoDigits(lakhs) + ' Lakh';
      const thousands = Math.floor(restAfterLakh / 1000);
      const rest = restAfterLakh % 1000;
      if (thousands > 0) words += ' ' + convertTwoDigits(thousands) + ' Thousand';
      if (rest > 0) words += ' ' + convertThreeDigits(rest);
    }
  }

  if (wholePart > 0 && decimalPart > 0) {
    words += ' Rupees and ' + convertTwoDigits(decimalPart) + ' Paise Only';
  } else if (wholePart > 0) {
    words += ' Rupees Only';
  } else if (decimalPart > 0) {
    words = convertTwoDigits(decimalPart) + ' Paise Only';
  } else {
    words = 'Zero Rupees Only';
  }

  return words.trim();
}

// ==================== UNIFIED HTML TEMPLATE FOR PDF ====================
const getUnifiedSlipHTML = (sData: SalarySlipDataType, companyConfig: CompanyConfig): string => {
  const logoHtml = COMPANY_LOGO_BASE64 && COMPANY_LOGO_BASE64.length > 100
    ? `<img src="${COMPANY_LOGO_BASE64}" style="height: 40px; width: auto; object-fit: contain;" />`
    : `<div style="height: 40px; width: 40px; background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; border-radius: 8px; border: 2px solid #1e3a8a;">${companyConfig.company_name ? companyConfig.company_name.charAt(0).toUpperCase() : 'N'}</div>`;

  // Division row - only show if NOT Office-Staff
  const divisionRow = sData.division !== 'Office-Staff'
    ? `<tr>
         <td style="padding: 4px 8px; color: #64748b; font-size: 10px; border-bottom: 1px solid #e2e8f0;">Department</td>
         <td style="padding: 4px 8px; color: #1e293b; font-size: 10px; font-weight: 500; border-bottom: 1px solid #e2e8f0;">${sData.division}</td>
       </tr>`
    : '';

  const nextMonthForBalance = getNextMonthName(sData.period);

  const earningsHtml = sData.earnings.map(item => `
    <tr>
      <td style="padding: 5px 10px; border-bottom: 1px solid #d1d5db; color: #374151; font-size: 10px;">${item.component}</td>
      <td style="padding: 5px 10px; border-bottom: 1px solid #d1d5db; color: #1f2937; font-size: 10px; text-align: right; font-weight: 500;">₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const deductionsHtml = sData.deductions.map(item => `
    <tr>
      <td style="padding: 5px 10px; border-bottom: 1px solid #d1d5db; color: #374151; font-size: 10px;">${item.component}</td>
      <td style="padding: 5px 10px; border-bottom: 1px solid #d1d5db; color: #1f2937; font-size: 10px; text-align: right; font-weight: 500;">₹${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return `
    <div style="width: 794px; padding: 0; background: white; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      
      <!-- Header Section -->
<div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 28px 28px 16px 28px; border-bottom: 3px solid #1e3a8a;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: white; padding: 6px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 1px solid #e2e8f0;">
              ${logoHtml}
            </div>
            <div>
              <h1 style="margin: 0; font-size: 16px; font-weight: 700; color: white; letter-spacing: 0.3px;">${companyConfig.company_name || 'catura Healthcare Pvt. Ltd.'}</h1>
              <p style="margin: 3px 0 0; font-size: 9px; color: rgba(255,255,255,0.9); line-height: 1.4;">
                ${COMPANY_ADDRESS_LINES.join(' | ')}
              </p>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);">
              <p style="margin: 0; font-size: 9px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Salary Slip</p>
              <p style="margin: 2px 0 0; font-size: 13px; font-weight: 700; color: white;">${sData.period}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div style="padding: 16px 28px;">
        
        <!-- Employee & Attendance Cards -->
        <div style="display: flex; gap: 16px; margin-bottom: 14px;">
          
          <!-- Employee Details Card -->
          <div style="flex: 1; background: #f8fafc; border-radius: 10px; padding: 12px; border: 1px solid #d1d5db;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #3b82f6;">
              <div style="width: 6px; height: 6px; background: #3b82f6; border-radius: 50%;"></div>
              <h3 style="margin: 0; font-size: 10px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Employee Details</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 8px; color: #64748b; font-size: 10px; border-bottom: 1px solid #e2e8f0; width: 40%;">Employee Name</td>
                <td style="padding: 4px 8px; color: #1e293b; font-size: 10px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${sData.name}</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; color: #64748b; font-size: 10px; border-bottom: 1px solid #e2e8f0;">Employee ID</td>
                <td style="padding: 4px 8px; color: #1e293b; font-size: 10px; font-weight: 500; border-bottom: 1px solid #e2e8f0;">${sData.employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; color: #64748b; font-size: 10px; border-bottom: 1px solid #e2e8f0;">Designation</td>
                <td style="padding: 4px 8px; color: #1e293b; font-size: 10px; font-weight: 500; border-bottom: 1px solid #e2e8f0;">${sData.designation}</td>
              </tr>
              <tr>
                <td style="padding: 4px 8px; color: #64748b; font-size: 10px; border-bottom: 1px solid #e2e8f0;">Date of Joining</td>
                <td style="padding: 4px 8px; color: #1e293b; font-size: 10px; font-weight: 500; border-bottom: 1px solid #e2e8f0;">${sData.joinDate}</td>
              </tr>
              ${divisionRow}
            </table>
          </div>

          <!-- Attendance Summary Card -->
          <div style="flex: 1; background: #f8fafc; border-radius: 10px; padding: 12px; border: 1px solid #d1d5db;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #10b981;">
              <div style="width: 6px; height: 6px; background: #10b981; border-radius: 50%;"></div>
              <h3 style="margin: 0; font-size: 10px; font-weight: 600; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">Attendance Summary</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <div style="background: white; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid #d1d5db;">
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">${sData.totalDaysInMonth}</p>
                <p style="margin: 2px 0 0; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">Total Days</p>
              </div>
              <div style="background: white; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid #d1d5db;">
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: #10b981;">${sData.actualPayDays}</p>
                <p style="margin: 2px 0 0; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">Pay Days</p>
              </div>
              <div style="background: white; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid #d1d5db;">
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: #f59e0b;">${sData.workingDays}</p>
                <p style="margin: 2px 0 0; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">Working Days</p>
              </div>
              <div style="background: white; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid #d1d5db;">
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: #ef4444;">${sData.absentDays}</p>
                <p style="margin: 2px 0 0; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">Absent</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Leave Information Strip -->
        <div style="background: #fef9c3; border-radius: 8px; padding: 10px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #ca8a04;">
          <div>
            <p style="margin: 0; font-size: 8px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Leave Used (${sData.period})</p>
            <p style="margin: 2px 0 0; font-size: 11px; font-weight: 600; color: #78350f;">CL: ${sData.leaveUsedThisMonth.cl} | SL: ${sData.leaveUsedThisMonth.sl} | PL: ${sData.leaveUsedThisMonth.pl}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 8px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Leave Balance (${nextMonthForBalance})</p>
            <p style="margin: 2px 0 0; font-size: 11px; font-weight: 600; color: #78350f;">CL: ${sData.leaveBalanceNextMonth.cl.toFixed(1)} | SL: ${sData.leaveBalanceNextMonth.sl.toFixed(1)} | PL: ${sData.leaveBalanceNextMonth.pl.toFixed(1)}</p>
          </div>
        </div>

        <!-- Earnings & Deductions Section -->
        <div style="display: flex; gap: 16px; margin-bottom: 14px;">
          
          <!-- Earnings Table -->
          <div style="flex: 1; border-radius: 10px; overflow: hidden; border: 1px solid #86efac;">
            <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 8px 12px; border-bottom: 1px solid #15803d;">
              <h3 style="margin: 0; font-size: 11px; font-weight: 600; color: white;">💰 Earnings</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #f0fdf4;">
              ${earningsHtml}
              <tr style="background: #dcfce7; border-top: 2px solid #86efac;">
                <td style="padding: 8px 12px; font-weight: 700; color: #15803d; font-size: 11px; border-top: 1px solid #86efac;">Total Earnings</td>
                <td style="padding: 8px 12px; font-weight: 700; color: #15803d; font-size: 12px; text-align: right; border-top: 1px solid #86efac;">₹${sData.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>

          <!-- Deductions Table -->
          <div style="flex: 1; border-radius: 10px; overflow: hidden; border: 1px solid #fca5a5;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 8px 12px; border-bottom: 1px solid #b91c1c;">
              <h3 style="margin: 0; font-size: 11px; font-weight: 600; color: white;">📉 Deductions</h3>
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #fef2f2;">
              ${deductionsHtml}
              <tr style="background: #fee2e2; border-top: 2px solid #fca5a5;">
                <td style="padding: 8px 12px; font-weight: 700; color: #b91c1c; font-size: 11px; border-top: 1px solid #fca5a5;">Total Deductions</td>
                <td style="padding: 8px 12px; font-weight: 700; color: #b91c1c; font-size: 12px; text-align: right; border-top: 1px solid #fca5a5;">₹${sData.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Net Salary Box -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border: 2px solid #1e3a8a;">
          <div>
            <p style="margin: 0; font-size: 10px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Net Salary Payable</p>
            <p style="margin: 3px 0 0; font-size: 9px; color: rgba(255,255,255,0.8);">${convertToWords(sData.netSalary)}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 22px; font-weight: 800; color: white;">₹${sData.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div style="background: #f1f5f9; padding: 12px 28px; border-top: 1px solid #cbd5e1; margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <p style="margin: 0; font-size: 9px; color: #64748b; font-style: italic;">This is a computer-generated document and does not require a signature.</p>
          <p style="margin: 0; font-size: 9px; color: #64748b; font-weight: 500;">Generated on: ${generatedDate}</p>
        </div>
      </div>

    </div>
  `;
};

// ==================== UNIFIED FUNCTION TO GENERATE PDF ====================
const generatePDFFromSlipData = async (sData: SalarySlipDataType, companyConfig: CompanyConfig): Promise<jsPDF | null> => {
  try {
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '794px';
    tempDiv.innerHTML = getUnifiedSlipHTML(sData, companyConfig);
    document.body.appendChild(tempDiv);

    await new Promise(resolve => setTimeout(resolve, 150));

    const canvas = await html2canvas(tempDiv, {
      scale: 2.5,  // Increased for better quality
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
      windowWidth: 794,
      windowHeight: 1123
    });

    document.body.removeChild(tempDiv);

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);  // Higher quality
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'MEDIUM');

    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
};

// ==================== SALARY SLIP CARD FOR SCREEN DISPLAY ====================
interface SalarySlipCardProps {
  sData: SalarySlipDataType;
  companyConfig: CompanyConfig;
  showPageBreak?: boolean;
}

function SalarySlipCard({ sData, companyConfig, showPageBreak }: SalarySlipCardProps) {
  const nextMonthForBalance = getNextMonthName(sData.period);
  const logoSrc = COMPANY_LOGO_BASE64 && COMPANY_LOGO_BASE64.length > 100 ? COMPANY_LOGO_BASE64 : null;
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div
      className={`salary-slip-page ${showPageBreak ? 'print-page-break-before' : ''}`}
      style={{
        width: '794px',
        margin: '0 auto 20px auto',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        pageBreakAfter: 'always',
        pageBreakInside: 'avoid',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* Header */}
<div style={{
  background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
  padding: '28px 28px 16px 28px',
  borderBottom: '3px solid #1e3a8a',
}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'white',
              padding: '6px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
            }}>
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
              ) : (
                <div style={{
                  height: '40px',
                  width: '40px',
                  background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  borderRadius: '8px',
                  border: '2px solid #1e3a8a',
                }}>
                  {companyConfig.company_name?.charAt(0) || 'N'}
                </div>
              )}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'white', letterSpacing: '0.3px' }}>
                {companyConfig.company_name || 'catura Healthcare Pvt. Ltd.'}
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '9px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>
                {COMPANY_ADDRESS_LINES.join(' | ')}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.3)',
            }}>
              <p style={{ margin: 0, fontSize: '9px', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 500 }}>Salary Slip</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 700, color: 'white' }}>{sData.period}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 28px' }}>
        {/* Employee & Attendance */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
          {/* Employee Details */}
          <div style={{
            flex: 1,
            background: '#f8fafc',
            borderRadius: '10px',
            padding: '12px',
            border: '1px solid #d1d5db',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #3b82f6' }}>
              <div style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%' }}></div>
              <h3 style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee Details</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ padding: '4px 8px', color: '#64748b', fontSize: '10px', borderBottom: '1px solid #e2e8f0', width: '40%' }}>Employee Name</td><td style={{ padding: '4px 8px', color: '#1e293b', fontSize: '10px', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{sData.name}</td></tr>
                <tr><td style={{ padding: '4px 8px', color: '#64748b', fontSize: '10px', borderBottom: '1px solid #e2e8f0' }}>Employee ID</td><td style={{ padding: '4px 8px', color: '#1e293b', fontSize: '10px', fontWeight: 500, borderBottom: '1px solid #e2e8f0' }}>{sData.employeeId}</td></tr>
                <tr><td style={{ padding: '4px 8px', color: '#64748b', fontSize: '10px', borderBottom: '1px solid #e2e8f0' }}>Designation</td><td style={{ padding: '4px 8px', color: '#1e293b', fontSize: '10px', fontWeight: 500, borderBottom: '1px solid #e2e8f0' }}>{sData.designation}</td></tr>
                <tr><td style={{ padding: '4px 8px', color: '#64748b', fontSize: '10px', borderBottom: '1px solid #e2e8f0' }}>Date of Joining</td><td style={{ padding: '4px 8px', color: '#1e293b', fontSize: '10px', fontWeight: 500, borderBottom: '1px solid #e2e8f0' }}>{sData.joinDate}</td></tr>
                {sData.division !== 'Office-Staff' && (
                  <tr><td style={{ padding: '4px 8px', color: '#64748b', fontSize: '10px', borderBottom: '1px solid #e2e8f0' }}>Department</td><td style={{ padding: '4px 8px', color: '#1e293b', fontSize: '10px', fontWeight: 500, borderBottom: '1px solid #e2e8f0' }}>{sData.division}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Attendance Summary */}
          <div style={{
            flex: 1,
            background: '#f8fafc',
            borderRadius: '10px',
            padding: '12px',
            border: '1px solid #d1d5db',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #10b981' }}>
              <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></div>
              <h3 style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendance Summary</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div style={{ background: 'white', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{sData.totalDaysInMonth}</p>
                <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Days</p>
              </div>
              <div style={{ background: 'white', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#10b981' }}>{sData.actualPayDays}</p>
                <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Pay Days</p>
              </div>
              <div style={{ background: 'white', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>{sData.workingDays}</p>
                <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Working Days</p>
              </div>
              <div style={{ background: 'white', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>{sData.absentDays}</p>
                <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Absent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leave Info Strip */}
        <div style={{
          background: '#fef9c3',
          borderRadius: '8px',
          padding: '10px 16px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid #ca8a04',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '8px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Leave Used ({sData.period})</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 600, color: '#78350f' }}>CL: {sData.leaveUsedThisMonth.cl} | SL: {sData.leaveUsedThisMonth.sl} | PL: {sData.leaveUsedThisMonth.pl}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '8px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Leave Balance ({nextMonthForBalance})</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: 600, color: '#78350f' }}>CL: {sData.leaveBalanceNextMonth.cl.toFixed(1)} | SL: {sData.leaveBalanceNextMonth.sl.toFixed(1)} | PL: {sData.leaveBalanceNextMonth.pl.toFixed(1)}</p>
          </div>
        </div>

        {/* Earnings & Deductions */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
          {/* Earnings */}
          <div style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #86efac' }}>
            <div style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', padding: '8px 12px', borderBottom: '1px solid #15803d' }}>
              <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'white' }}>💰 Earnings</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f0fdf4' }}>
              <tbody>
                {sData.earnings.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #d1d5db', color: '#374151', fontSize: '10px' }}>{item.component}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #d1d5db', color: '#1f2937', fontSize: '10px', textAlign: 'right', fontWeight: 500 }}>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr style={{ background: '#dcfce7' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#15803d', fontSize: '11px', borderTop: '2px solid #86efac' }}>Total Earnings</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#15803d', fontSize: '12px', textAlign: 'right', borderTop: '2px solid #86efac' }}>₹{sData.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deductions */}
          <div style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', border: '1px solid #fca5a5' }}>
            <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '8px 12px', borderBottom: '1px solid #b91c1c' }}>
              <h3 style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: 'white' }}>📉 Deductions</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fef2f2' }}>
              <tbody>
                {sData.deductions.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #d1d5db', color: '#374151', fontSize: '10px' }}>{item.component}</td>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #d1d5db', color: '#1f2937', fontSize: '10px', textAlign: 'right', fontWeight: 500 }}>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr style={{ background: '#fee2e2' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#b91c1c', fontSize: '11px', borderTop: '2px solid #fca5a5' }}>Total Deductions</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#b91c1c', fontSize: '12px', textAlign: 'right', borderTop: '2px solid #fca5a5' }}>₹{sData.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Net Salary */}
        <div style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          borderRadius: '10px',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '2px solid #1e3a8a',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Net Salary Payable</p>
            <p style={{ margin: '3px 0 0', fontSize: '9px', color: 'rgba(255,255,255,0.8)' }}>{convertToWords(sData.netSalary)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'white' }}>₹{sData.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#f1f5f9', padding: '12px 28px', borderTop: '1px solid #cbd5e1', marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '9px', color: '#64748b', fontStyle: 'italic' }}>This is a computer-generated document and does not require a signature.</p>
          <p style={{ margin: 0, fontSize: '9px', color: '#64748b', fontWeight: 500 }}>Generated on: {generatedDate}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function SalarySlipPage() {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = React.useState(0);
  const [availableYears, setAvailableYears] = React.useState<number[]>([]);

  const [selectedMonth, setSelectedMonth] = React.useState<string>('');
  const [selectedYear, setSelectedYear] = React.useState<number>(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | undefined>();
  const [selectedDivision, setSelectedDivision] = React.useState<string | undefined>();

  const [allEmployees, setAllEmployees] = React.useState<EmployeeDetail[]>([]);
  const [filteredEmployeesForSlip, setFilteredEmployeesForSlip] = React.useState<EmployeeDetail[]>([]);
  const [openingBalances, setOpeningBalances] = React.useState<OpeningLeaveBalance[]>([]);
  const [allPerformanceDeductions, setAllPerformanceDeductions] = React.useState<PerformanceDeductionEntry[]>([]);
  const [allLeaveApplications, setAllLeaveApplications] = React.useState<LeaveApplication[]>([]);

  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: 'catura Healthcare Pvt. Ltd.'
  });
  const [isConfigLoading, setIsConfigLoading] = React.useState(true);

  const [slipData, setSlipData] = React.useState<SalarySlipDataType | null>(null);
  const [bulkSlipsData, setBulkSlipsData] = React.useState<SalarySlipDataType[]>([]);
  const [isBulkPrintingView, setIsBulkPrintingView] = React.useState(false);
  const [showSlip, setShowSlip] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);

  const [selectedDivisionForMultiMonth, setSelectedDivisionForMultiMonth] = React.useState<string | undefined>();
  const [filteredEmployeesForMultiMonth, setFilteredEmployeesForMultiMonth] = React.useState<EmployeeDetail[]>([]);
  const [selectedEmployeeForMultiMonth, setSelectedEmployeeForMultiMonth] = React.useState<string | undefined>();
  const [fromMonthMulti, setFromMonthMulti] = React.useState<string>('');
  const [fromYearMulti, setFromYearMulti] = React.useState<number>(0);
  const [toMonthMulti, setToMonthMulti] = React.useState<string>('');
  const [toYearMulti, setToYearMulti] = React.useState<number>(0);
  const [isLoadingMultiMonth, setIsLoadingMultiMonth] = React.useState(false);

  // Drive Sending State
  const [isSendingToDrive, setIsSendingToDrive] = React.useState(false);
  const [isSendingSingleToDrive, setIsSendingSingleToDrive] = React.useState(false);
  const [sendProgress, setSendProgress] = React.useState({ current: 0, total: 0, currentEmployee: '' });

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        if (config) {
          setCompanyConfig({
            company_logo: config.company_logo || '',
            company_name: config.company_name || 'catura Healthcare Pvt. Ltd.'
          });
        }
      } catch (error) {
        console.error('Error fetching company config:', error);
      } finally {
        setIsConfigLoading(false);
      }
    }
    fetchConfig();
  }, []);

  React.useEffect(() => {
    const year = new Date().getFullYear();
    const month = months[new Date().getMonth()];
    setCurrentYear(year);
    setAvailableYears(Array.from({ length: 5 }, (_, i) => year - i));
    setSelectedMonth(month);
    setSelectedYear(year);
    setFromMonthMulti(month);
    setFromYearMulti(year);
    setToMonthMulti(month);
    setToYearMulti(year);
  }, []);

  React.useEffect(() => {
    setIsLoadingEmployees(true);
    if (typeof window !== 'undefined') {
      try {
        const storedEmployees = localStorage.getItem(LOCAL_STORAGE_EMPLOYEE_MASTER_KEY);
        setAllEmployees(storedEmployees ? JSON.parse(storedEmployees) : []);

        const storedOB = localStorage.getItem(LOCAL_STORAGE_OPENING_BALANCES_KEY);
        setOpeningBalances(storedOB ? JSON.parse(storedOB) : []);

        const storedPerfDeductions = localStorage.getItem(LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY);
        setAllPerformanceDeductions(storedPerfDeductions ? JSON.parse(storedPerfDeductions) : []);

        const storedLeaveApps = localStorage.getItem(LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY);
        setAllLeaveApplications(storedLeaveApps ? JSON.parse(storedLeaveApps) : []);

      } catch (error) {
        console.error("Error loading initial data:", error);
        toast({ title: "Data Load Error", variant: "destructive" });
        setAllEmployees([]);
        setOpeningBalances([]);
        setAllPerformanceDeductions([]);
        setAllLeaveApplications([]);
      }
    }
    setIsLoadingEmployees(false);
  }, [toast]);

  React.useEffect(() => {
    if (selectedDivision && allEmployees.length > 0) {
      const filtered = allEmployees
        .filter(emp => emp.division === selectedDivision)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFilteredEmployeesForSlip(filtered);
      if (selectedEmployeeId && !filtered.some(emp => emp.id === selectedEmployeeId)) {
        setSelectedEmployeeId(undefined);
      }
    } else {
      setFilteredEmployeesForSlip([]);
      setSelectedEmployeeId(undefined);
    }
  }, [selectedDivision, allEmployees, selectedEmployeeId]);

  React.useEffect(() => {
    if (selectedDivisionForMultiMonth && allEmployees.length > 0) {
      const filtered = allEmployees
        .filter(emp => emp.division === selectedDivisionForMultiMonth)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFilteredEmployeesForMultiMonth(filtered);
      if (selectedEmployeeForMultiMonth && !filtered.some(emp => emp.id === selectedEmployeeForMultiMonth)) {
        setSelectedEmployeeForMultiMonth(undefined);
      }
    } else {
      setFilteredEmployeesForMultiMonth([]);
      setSelectedEmployeeForMultiMonth(undefined);
    }
  }, [selectedDivisionForMultiMonth, allEmployees, selectedEmployeeForMultiMonth]);

  const generateSlipDataForEmployee = (
    employee: EmployeeDetail,
    month: string,
    year: number,
    localOpeningBalances: OpeningLeaveBalance[],
    localAllPerformanceDeductions: PerformanceDeductionEntry[],
    localAllLeaveApplications: LeaveApplication[]
  ): SalarySlipDataType | null => {
    const monthIndex = months.indexOf(month);
    if (monthIndex === -1) return null;

    let parsedEmployeeDOJ: Date | null = null;
    if (employee && typeof employee.doj === 'string' && employee.doj.trim() !== '') {
      const tempDOJ = parseISO(employee.doj);
      if (isValid(tempDOJ)) {
        parsedEmployeeDOJ = tempDOJ;
      } else {
        return null;
      }
    } else {
      return null;
    }

    const selectedPeriodStartDate = startOfMonth(new Date(year, monthIndex, 1));
    const selectedPeriodEndDate = endOfMonth(selectedPeriodStartDate);

    if (isAfter(parsedEmployeeDOJ, selectedPeriodEndDate)) {
      return null;
    }
    if (employee.dor) {
      const employeeDOR = parseISO(employee.dor);
      if (isValid(employeeDOR) && isBefore(employeeDOR, selectedPeriodStartDate)) {
        return null;
      }
    }

    let attendanceForMonthEmployee: MonthlyEmployeeAttendance | undefined;
    let salaryEditsForEmployee: EditableSalaryFields | undefined;

    if (typeof window !== 'undefined') {
      const attendanceStorageKey = `${LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX}${month}_${year}`;
      const storedAttendanceForMonth = localStorage.getItem(attendanceStorageKey);
      if (storedAttendanceForMonth) {
        try {
          const allMonthAttendance: MonthlyEmployeeAttendance[] = JSON.parse(storedAttendanceForMonth);
          attendanceForMonthEmployee = allMonthAttendance.find(att => att.code === employee.code);
        } catch (e) {
          console.warn(`Error parsing attendance:`, e);
        }
      }

      if (!attendanceForMonthEmployee || !attendanceForMonthEmployee.attendance || attendanceForMonthEmployee.attendance.length === 0) {
        return null;
      }

      const salaryEditsStorageKey = `${LOCAL_STORAGE_SALARY_EDITS_PREFIX}${month}_${year}`;
      const storedSalaryEditsForMonth = localStorage.getItem(salaryEditsStorageKey);
      if (storedSalaryEditsForMonth) {
        try {
          const allMonthEdits: Record<string, EditableSalaryFields> = JSON.parse(storedSalaryEditsForMonth);
          salaryEditsForEmployee = allMonthEdits[employee.id];
        } catch (e) {
          console.warn(`Error parsing salary edits:`, e);
        }
      }
    } else {
      return null;
    }

    const attendanceStatuses: string[] = attendanceForMonthEmployee.attendance;
    const salaryEdits = salaryEditsForEmployee || {};
    const performanceDeductionEntry = localAllPerformanceDeductions.find(
      pd => pd.employeeCode === employee.code && pd.month === month && pd.year === year
    );
    const performanceDeductionAmount = performanceDeductionEntry?.amount || 0;

    const totalDaysInMonthValue = getDaysInMonth(selectedPeriodStartDate);
    const dailyStatuses = attendanceStatuses.slice(0, totalDaysInMonthValue);

    let actualPayDaysValue = 0;
    let usedCLInMonth = 0, usedSLInMonth = 0, usedPLInMonth = 0;
    let absentDaysCount = 0;
    let weekOffsCount = 0;
    let paidHolidaysCount = 0;
    let workingDaysCount = 0;

    dailyStatuses.forEach(status => {
      const s = status.toUpperCase();
      if (s === 'P') { actualPayDaysValue++; workingDaysCount++; }
      else if (s === 'W') { actualPayDaysValue++; weekOffsCount++; }
      else if (s === 'PH') { actualPayDaysValue++; paidHolidaysCount++; }
      else if (s === 'CL') { actualPayDaysValue++; usedCLInMonth++; }
      else if (s === 'SL') { actualPayDaysValue++; usedSLInMonth++; }
      else if (s === 'PL') { actualPayDaysValue++; usedPLInMonth++; }
      else if (s === 'HCL') { actualPayDaysValue++; usedCLInMonth += 0.5; workingDaysCount += 0.5; }
      else if (s === 'HSL') { actualPayDaysValue++; usedSLInMonth += 0.5; workingDaysCount += 0.5; }
      else if (s === 'HPL') { actualPayDaysValue++; usedPLInMonth += 0.5; workingDaysCount += 0.5; }
      else if (s === 'HD') { actualPayDaysValue += 0.5; absentDaysCount += 0.5; workingDaysCount += 0.5; }
      else if (s === 'A') absentDaysCount += 1;
    });
    actualPayDaysValue = Math.min(actualPayDaysValue, totalDaysInMonthValue);
    const totalLeavesTakenThisMonth = usedCLInMonth + usedSLInMonth + usedPLInMonth;

    const monthlyComp = calculateMonthlySalaryComponents(employee, year, monthIndex);
    const payFactor = totalDaysInMonthValue > 0 ? actualPayDaysValue / totalDaysInMonthValue : 0;

    const actualBasic = (monthlyComp.basic || 0) * payFactor;
    const actualHRA = (monthlyComp.hra || 0) * payFactor;
    const actualCA = (monthlyComp.ca || 0) * payFactor;
    const actualMedical = (monthlyComp.medical || 0) * payFactor;
    const actualOtherAllowance = (monthlyComp.otherAllowance || 0) * payFactor;

    const arrears = salaryEdits.arrears ?? 0;
    const totalEarningsValue = actualBasic + actualHRA + actualCA + actualMedical + actualOtherAllowance + arrears;

    const earningsList = [
      { component: "Basic Salary", amount: actualBasic },
      { component: "House Rent Allowance (HRA)", amount: actualHRA },
      { component: "Conveyance Allowance (CA)", amount: actualCA },
      { component: "Medical Allowance", amount: actualMedical },
      { component: "Other Allowance", amount: actualOtherAllowance },
      { component: "Arrears", amount: arrears },
    ];
    const calculatedTotalEarnings = earningsList.reduce((sum, item) => sum + item.amount, 0);

    const manualOtherDeductionVal = salaryEdits.manualOtherDeduction ?? 0;
    const totalOtherDeductionOnSlip = manualOtherDeductionVal + performanceDeductionAmount;

    const esicDeduction = monthlyComp.totalGross <= 21010 ? totalEarningsValue * 0.0075 : 0;
    const pfDeduction = salaryEdits.providentFund ?? 0;
    const ptDeduction = salaryEdits.professionalTax ?? 0;
    const tdsDeduction = salaryEdits.tds ?? 0;
    const loanDeduction = salaryEdits.loan ?? 0;
    const salaryAdvanceDeduction = salaryEdits.salaryAdvance ?? 0;

    const deductionsList = [
      { component: "Provident Fund (PF)", amount: pfDeduction },
      { component: "Professional Tax (PT)", amount: ptDeduction },
      { component: "ESIC", amount: esicDeduction },
      { component: "Income Tax (TDS)", amount: tdsDeduction },
      { component: "Loan", amount: loanDeduction },
      { component: "Salary Advance", amount: salaryAdvanceDeduction },
      { component: "Other Deduction", amount: totalOtherDeductionOnSlip },
    ];
    const calculatedTotalDeductions = deductionsList.reduce((sum, item) => sum + item.amount, 0);
    const calculatedNetSalary = calculatedTotalEarnings - calculatedTotalDeductions;

    const nextMonthDateObject = addMonths(selectedPeriodStartDate, 1);

    const isSeededMonth = getYear(nextMonthDateObject) === 2026 && getMonth(nextMonthDateObject) === 0;
    let nextMonthCL = 0, nextMonthSL = 0, nextMonthPL = 0;

    if (isSeededMonth) {
      const seededBalance = localOpeningBalances.find(ob => ob.employeeCode === employee.code && ob.financialYearStart === 2026 && ob.monthIndex === 0);
      if (seededBalance) {
        nextMonthCL = seededBalance.openingCL;
        nextMonthSL = seededBalance.openingSL;
        nextMonthPL = seededBalance.openingPL;
      }
    } else {
      const nextMonthDetails = calculateEmployeeLeaveDetailsForPeriod(
        employee, getYear(nextMonthDateObject), getMonth(nextMonthDateObject), localAllLeaveApplications, localOpeningBalances
      );
      nextMonthCL = nextMonthDetails.balanceCLAtMonthEnd;
      nextMonthSL = nextMonthDetails.balanceSLAtMonthEnd;
      nextMonthPL = nextMonthDetails.balancePLAtMonthEnd;
    }

    let formattedDOJ = "N/A";
    if (parsedEmployeeDOJ && isValid(parsedEmployeeDOJ)) {
      formattedDOJ = format(parsedEmployeeDOJ, "dd MMM yyyy");
    }

    return {
      employeeId: employee.code, name: employee.name, designation: employee.designation,
      joinDate: formattedDOJ,
      division: employee.division || "N/A", totalDaysInMonth: totalDaysInMonthValue, actualPayDays: actualPayDaysValue,
      earnings: earningsList, deductions: deductionsList,
      totalEarnings: calculatedTotalEarnings, totalDeductions: calculatedTotalDeductions, netSalary: calculatedNetSalary,
      leaveUsedThisMonth: { cl: usedCLInMonth, sl: usedSLInMonth, pl: usedPLInMonth },
      leaveBalanceNextMonth: {
        cl: nextMonthCL,
        sl: nextMonthSL,
        pl: nextMonthPL
      },
      absentDays: absentDaysCount, weekOffs: weekOffsCount, paidHolidays: paidHolidaysCount,
      workingDays: workingDaysCount,
      totalLeavesTakenThisMonth: totalLeavesTakenThisMonth,
      period: `${format(selectedPeriodStartDate, "MMMM")} ${year}`,
    };
  };

  const handleGenerateSlip = () => {
    if (!selectedMonth || !selectedYear || !selectedEmployeeId || !selectedDivision) {
      toast({ title: "Selection Missing", description: "Please select all fields.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSlip(false);

    const employee = allEmployees.find(e => e.id === selectedEmployeeId);
    if (!employee) {
      toast({ title: "Employee Not Found", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const generatedData = generateSlipDataForEmployee(
      employee, selectedMonth, selectedYear,
      openingBalances, allPerformanceDeductions, allLeaveApplications
    );

    if (generatedData) {
      setSlipData(generatedData);
      setShowSlip(true);
      addActivityLog(`Salary slip generated for ${employee.name} (${selectedMonth} ${selectedYear}).`);
    } else {
      toast({ title: "Cannot Generate Slip", description: `Attendance data missing for ${selectedMonth} ${selectedYear}.`, variant: "destructive" });
      setSlipData(null);
      setShowSlip(false);
    }
    setIsLoading(false);
  };

  // ==================== SEND SINGLE SLIP TO DRIVE ====================
  const handleSendSingleToDrive = async () => {
    if (!slipData) {
      toast({ title: "No Slip Generated", description: "Please generate a slip first.", variant: "destructive" });
      return;
    }

    setIsSendingSingleToDrive(true);

    try {
      const monthShort = selectedMonth.substring(0, 3);
      const yearShort = String(selectedYear).slice(-2);
      const folderName = `${monthShort}-${yearShort}`;

      toast({ title: "Creating Folder...", description: `Folder: ${folderName}` });

      const folderCreated = await createDriveFolder(folderName);
      if (!folderCreated) {
        throw new Error('Failed to create/access folder in Google Drive');
      }

      const pdf = await generatePDFFromSlipData(slipData, companyConfig);
      if (!pdf) {
        throw new Error('Failed to generate PDF');
      }

      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const fileName = `${slipData.employeeId}.pdf`;

      const uploadSuccess = await uploadPDFToDrive(folderName, fileName, pdfBase64);

      if (uploadSuccess) {
        toast({
          title: "✅ Upload Successful!",
          description: `${fileName} uploaded to "${folderName}" folder.`,
        });
        addActivityLog(`Salary slip for ${slipData.name} uploaded to Drive folder "${folderName}".`);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error sending to Drive:', error);
      toast({
        title: "❌ Error",
        description: error instanceof Error ? error.message : "Failed to send salary slip to Drive.",
        variant: "destructive"
      });
    } finally {
      setIsSendingSingleToDrive(false);
    }
  };
  // ==================== SEND ALL TO DRIVE ====================
  const handleSendAllToDrive = async () => {
    if (!selectedMonth || !selectedYear || !selectedDivision) {
      toast({
        title: "Selection Missing",
        description: "Please select Month, Year, and Division first.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingToDrive(true);

    try {
      const employeesToProcess = allEmployees
        .filter(emp => emp.division === selectedDivision)
        .sort((a, b) => a.code.localeCompare(b.code));

      if (employeesToProcess.length === 0) {
        toast({
          title: "No Employees Found",
          description: `No employees in ${selectedDivision} division.`,
          variant: "destructive"
        });
        setIsSendingToDrive(false);
        return;
      }

      const monthShort = selectedMonth.substring(0, 3);
      const yearShort = String(selectedYear).slice(-2);
      const folderName = `${monthShort}-${yearShort}`;

      toast({ title: "Creating Folder...", description: `Folder: ${folderName}` });

      const folderCreated = await createDriveFolder(folderName);
      if (!folderCreated) {
        throw new Error('Failed to create/access folder in Google Drive');
      }

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      const totalEmployees = employeesToProcess.length;

      setSendProgress({ current: 0, total: totalEmployees, currentEmployee: '' });

      for (let i = 0; i < employeesToProcess.length; i++) {
        const emp = employeesToProcess[i];
        setSendProgress({
          current: i + 1,
          total: totalEmployees,
          currentEmployee: `${emp.code} - ${emp.name}`
        });

        const empSlipData = generateSlipDataForEmployee(
          emp,
          selectedMonth,
          selectedYear,
          openingBalances,
          allPerformanceDeductions,
          allLeaveApplications
        );

        if (!empSlipData) {
          skippedCount++;
          continue;
        }

        try {
          const pdf = await generatePDFFromSlipData(empSlipData, companyConfig);
          if (!pdf) {
            failCount++;
            continue;
          }

          const pdfBase64 = pdf.output('datauristring').split(',')[1];
          const fileName = `${emp.code}.pdf`;
          const uploadSuccess = await uploadPDFToDrive(folderName, fileName, pdfBase64);

          if (uploadSuccess) {
            successCount++;
          } else {
            failCount++;
          }

        } catch (err) {
          failCount++;
          console.error(`Error processing ${emp.code}:`, err);
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (successCount > 0) {
        toast({
          title: "✅ Upload Complete!",
          description: `${successCount} slips uploaded to "${folderName}" folder.${skippedCount > 0 ? ` (${skippedCount} skipped - no attendance)` : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}`,
        });
      } else {
        toast({
          title: "⚠️ No Slips Uploaded",
          description: `${skippedCount} employees skipped (no attendance data).`,
          variant: "destructive"
        });
      }

      addActivityLog(`Sent ${successCount} salary slips to Google Drive folder "${folderName}" for ${selectedDivision} division.`);
    } catch (error) {
      console.error('Error sending to Drive:', error);
      toast({
        title: "❌ Error",
        description: error instanceof Error ? error.message : "Failed to send salary slips to Drive.",
        variant: "destructive"
      });
    } finally {
      setIsSendingToDrive(false);
      setSendProgress({ current: 0, total: 0, currentEmployee: '' });
    }
  };

  // ==================== DOWNLOAD CSV SUMMARIES ====================
  const handleDownloadAllSummaries = () => {
    if (!selectedMonth || !selectedYear || !selectedDivision) {
      toast({ title: "Selection Missing", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const employeesForSummary = allEmployees
      .filter(emp => emp.division === selectedDivision)
      .sort((a, b) => a.code.localeCompare(b.code));

    if (employeesForSummary.length === 0) {
      toast({ title: "No Employees", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const csvRows: string[][] = [];
    csvRows.push(["Employee (Code-Name-Designation)", "Gross Salary", "Total Earnings", "Total Deductions", "Net Salary"]);

    let processedCount = 0;
    for (const emp of employeesForSummary) {
      const salaryComponents = calculateMonthlySalaryComponents(emp, selectedYear, months.indexOf(selectedMonth));
      const slipSummaryData = generateSlipDataForEmployee(
        emp, selectedMonth, selectedYear,
        openingBalances, allPerformanceDeductions, allLeaveApplications
      );
      if (slipSummaryData) {
        csvRows.push([
          `"${emp.code}-${emp.name}-${emp.designation}"`,
          salaryComponents.totalGross.toFixed(2),
          slipSummaryData.totalEarnings.toFixed(2),
          slipSummaryData.totalDeductions.toFixed(2),
          slipSummaryData.netSalary.toFixed(2)
        ]);
        processedCount++;
      }
    }

    if (processedCount === 0) {
      toast({ title: "No Data for CSV", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `salary_summaries_${selectedDivision}_${selectedMonth}_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addActivityLog(`Salary summaries CSV downloaded for ${selectedDivision}.`);
    toast({ title: "Summaries Downloaded" });
    setIsLoading(false);
  };

  // ==================== PRINT ALL SLIPS ====================
  const handlePrintAllSlips = () => {
    if (!selectedMonth || !selectedYear || !selectedDivision) {
      toast({ title: "Selection Missing", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setShowSlip(false);
    setSlipData(null);

    const employeesToPrint = allEmployees
      .filter(emp => emp.division === selectedDivision)
      .sort((a, b) => a.code.localeCompare(b.code));

    if (employeesToPrint.length === 0) {
      toast({ title: "No Employees", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const generatedSlips: SalarySlipDataType[] = [];
    let countSkipped = 0;

    for (const emp of employeesToPrint) {
      const sData = generateSlipDataForEmployee(
        emp, selectedMonth, selectedYear,
        openingBalances, allPerformanceDeductions, allLeaveApplications
      );
      if (sData) {
        generatedSlips.push(sData);
      } else {
        countSkipped++;
      }
    }

    if (generatedSlips.length === 0) {
      toast({ title: "No Slips Generated", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setBulkSlipsData(generatedSlips);
    setIsBulkPrintingView(true);
    setIsLoading(false);

    addActivityLog(`Bulk slips generated for ${selectedDivision}.`);
    if (countSkipped > 0) {
      toast({ title: "Note", description: `${countSkipped} employee(s) skipped.` });
    }
  };

  // ==================== MULTI-MONTH SLIPS ====================
  const handleGenerateMultiMonthSlips = () => {
    if (!selectedDivisionForMultiMonth || !selectedEmployeeForMultiMonth || !fromMonthMulti || fromYearMulti === 0 || !toMonthMulti || toYearMulti === 0) {
      toast({ title: "Selection Missing", variant: "destructive" });
      return;
    }

    const fromDate = startOfMonth(new Date(fromYearMulti, months.indexOf(fromMonthMulti)));
    const toDate = endOfMonth(new Date(toYearMulti, months.indexOf(toMonthMulti)));

    if (isBefore(toDate, fromDate)) {
      toast({ title: "Invalid Date Range", variant: "destructive" });
      return;
    }

    setIsLoadingMultiMonth(true);
    setShowSlip(false);
    setSlipData(null);

    const employee = allEmployees.find(e => e.id === selectedEmployeeForMultiMonth);
    if (!employee) {
      toast({ title: "Employee Not Found", variant: "destructive" });
      setIsLoadingMultiMonth(false);
      return;
    }

    const generatedSlips: SalarySlipDataType[] = [];
    let currentLoopDate = fromDate;
    let countSkipped = 0;

    while (isBefore(currentLoopDate, toDate) || isEqual(currentLoopDate, toDate)) {
      const currentMonthName = months[getMonth(currentLoopDate)];
      const currentYearValue = getYear(currentLoopDate);

      const sData = generateSlipDataForEmployee(
        employee, currentMonthName, currentYearValue,
        openingBalances, allPerformanceDeductions, allLeaveApplications
      );
      if (sData) {
        generatedSlips.push(sData);
      } else {
        countSkipped++;
      }
      if (getMonth(currentLoopDate) === getMonth(toDate) && getYear(currentLoopDate) === getYear(toDate)) {
        break;
      }
      currentLoopDate = addMonths(currentLoopDate, 1);
    }

    if (generatedSlips.length === 0) {
      toast({ title: "No Slips Generated", variant: "destructive" });
      setIsLoadingMultiMonth(false);
      return;
    }

    document.body.classList.add("printing-active");
    setBulkSlipsData(generatedSlips);
    setIsBulkPrintingView(true);
    addActivityLog(`Multi-month slips generated for ${employee.name}.`);
    if (countSkipped > 0) {
      toast({ title: "Note", description: `${countSkipped} month(s) skipped.` });
    }
    setIsLoadingMultiMonth(false);
  };

  // ==================== PRINT TRIGGER FOR BULK ====================
  React.useEffect(() => {
    if (isBulkPrintingView && bulkSlipsData.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isBulkPrintingView, bulkSlipsData]);

  // ==================== DOWNLOAD SINGLE SLIP AS PDF ====================
  const handleDownloadSinglePDF = async () => {
    if (!slipData) {
      toast({ title: "No Slip Generated", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const pdf = await generatePDFFromSlipData(slipData, companyConfig);
      if (pdf) {
        pdf.save(`${slipData.employeeId}-${slipData.name}-Slip-${selectedMonth}-${selectedYear}.pdf`);
        toast({ title: "PDF Downloaded Successfully" });
        addActivityLog(`PDF downloaded for ${slipData.name} (${selectedMonth} ${selectedYear}).`);
      } else {
        toast({ title: "Failed to generate PDF", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({ title: "Error downloading PDF", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== LOADING STATE ====================
  if ((isLoadingEmployees || isConfigLoading) && !selectedMonth && !selectedYear) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // ==================== BULK PRINTING VIEW ====================
  if (isBulkPrintingView) {
    return (
      <div id="salary-slip-printable-area">
        <Button
          onClick={() => {
            document.body.classList.remove("printing-active");
            setIsBulkPrintingView(false);
            setBulkSlipsData([]);
          }}
          variant="outline"
          className="fixed top-4 right-4 no-print z-[101]"
        >
          <XCircle className="mr-2 h-4 w-4" /> Close Bulk View
        </Button>
        {bulkSlipsData.map((sData, index) => (
          <SalarySlipCard
            key={`bulk-slip-${sData.employeeId}-${index}`}
            sData={sData}
            companyConfig={companyConfig}
            showPageBreak={index > 0}
          />
        ))}
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <>
      {/* Header */}
<div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-800 p-6 text-white shadow-xl mb-6">
  <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
  <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
  <div className="relative">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <FileText className="h-7 w-7" />
          Salary Slip Generator
        </h1>
        <p className="text-cyan-100 text-sm">Generate and download monthly salary slips</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={handleDownloadAllSummaries} 
          disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading} 
          variant="secondary" 
          className="bg-white/20 text-white border-white/30 hover:bg-white/30"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Summaries (CSV)
        </Button>
        <Button 
          onClick={handlePrintAllSlips} 
          disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading} 
          variant="secondary" 
          className="bg-white/20 text-white border-white/30 hover:bg-white/30"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          Print All
        </Button>
        <Button
          onClick={handleSendAllToDrive}
          disabled={!selectedMonth || !selectedYear || !selectedDivision || isSendingToDrive}
          className="bg-white text-cyan-700 hover:bg-cyan-50"
        >
          {isSendingToDrive ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {sendProgress.current}/{sendProgress.total}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send to Drive
            </>
          )}
        </Button>
      </div>
    </div>
  </div>
</div>

      {/* Progress indicator when sending to drive */}
      {isSendingToDrive && sendProgress.currentEmployee && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  Uploading: {sendProgress.currentEmployee}
                </p>
                <p className="text-xs text-green-600">
                  Progress: {sendProgress.current} of {sendProgress.total} employees
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-green-700">
                  {Math.round((sendProgress.current / sendProgress.total) * 100)}%
                </span>
              </div>
            </div>
            <div className="mt-2 h-2 bg-green-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection Card */}
      <Card className="mb-6 shadow-md print:hidden">
        <CardHeader><CardTitle>Select Criteria</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedYear > 0 ? selectedYear.toString() : ""} onValueChange={v => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedDivision} onValueChange={v => { setSelectedDivision(v); setSelectedEmployeeId(undefined); setShowSlip(false); }}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Division" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FMCG">FMCG</SelectItem>
              <SelectItem value="Wellness">Wellness</SelectItem>
              <SelectItem value="Office-Staff">Office-Staff</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={!selectedDivision || filteredEmployeesForSlip.length === 0}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              {filteredEmployeesForSlip.length > 0 ?
                filteredEmployeesForSlip.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code})</SelectItem>) :
                <SelectItem value="none" disabled>No employees</SelectItem>
              }
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateSlip} disabled={!selectedMonth || !selectedEmployeeId || selectedYear === 0 || !selectedDivision || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Generate Slip
          </Button>
        </CardContent>
      </Card>

      {/* Multi-Month Card */}
      <Card className="mb-6 shadow-md print:hidden">
        <CardHeader>
          <CardTitle>Multi-Month Slips</CardTitle>
          <CardDescription>Generate slips for one employee over a date range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Select value={selectedDivisionForMultiMonth} onValueChange={v => { setSelectedDivisionForMultiMonth(v); setSelectedEmployeeForMultiMonth(undefined); }}>
              <SelectTrigger><SelectValue placeholder="Division" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FMCG">FMCG</SelectItem>
                <SelectItem value="Wellness">Wellness</SelectItem>
                <SelectItem value="Office-Staff">Office-Staff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedEmployeeForMultiMonth} onValueChange={setSelectedEmployeeForMultiMonth} disabled={!selectedDivisionForMultiMonth || filteredEmployeesForMultiMonth.length === 0}>
              <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
              <SelectContent>
                {filteredEmployeesForMultiMonth.length > 0 ?
                  filteredEmployeesForMultiMonth.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.code})</SelectItem>) :
                  <SelectItem value="none" disabled>No employees</SelectItem>
                }
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Select value={fromMonthMulti} onValueChange={setFromMonthMulti}>
              <SelectTrigger><SelectValue placeholder="From Month" /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={fromYearMulti > 0 ? fromYearMulti.toString() : ""} onValueChange={v => setFromYearMulti(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="From Year" /></SelectTrigger>
              <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Select value={toMonthMulti} onValueChange={setToMonthMulti}>
              <SelectTrigger><SelectValue placeholder="To Month" /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={toYearMulti > 0 ? toYearMulti.toString() : ""} onValueChange={v => setToYearMulti(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="To Year" /></SelectTrigger>
              <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={handleGenerateMultiMonthSlips} disabled={!selectedDivisionForMultiMonth || !selectedEmployeeForMultiMonth || !fromMonthMulti || fromYearMulti === 0 || !toMonthMulti || toYearMulti === 0 || isLoadingMultiMonth}>
              {isLoadingMultiMonth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Generate Multi-Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Single Slip Display */}
      {showSlip && slipData && !isBulkPrintingView && (
        <>
          <div id="salary-slip-printable-area-single">
            <SalarySlipCard
              sData={slipData}
              companyConfig={companyConfig}
            />
          </div>
          <Card className="shadow-md print:hidden">
            <CardFooter className="p-6 border-t flex flex-wrap gap-3">
              <p className="text-xs text-muted-foreground mr-auto">Download or send this slip to Google Drive.</p>
              
              {/* Download PDF Button */}
              <Button
                onClick={handleDownloadSinglePDF}
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download PDF
              </Button>

              {/* Print Button */}
              <Button
                onClick={() => {
                  if (slipData) {
                    const originalTitle = document.title;
                    document.title = `${slipData.employeeId}-${slipData.name}-Slip-${selectedMonth}-${selectedYear}`;
                    setTimeout(() => {
                      window.print();
                      document.title = originalTitle;
                    }, 300);
                  }
                }}
                variant="outline"
              >
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>

              {/* Send Single to Drive Button */}
              <Button
                onClick={handleSendSingleToDrive}
                disabled={isSendingSingleToDrive}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSendingSingleToDrive ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CloudUpload className="mr-2 h-4 w-4" />
                    Send to Drive
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!showSlip && !isLoading && !isLoadingEmployees && !isBulkPrintingView && (
        <Card className="shadow-md flex justify-center py-12">
          <CardContent className="text-center text-muted-foreground">
            <p>Select criteria to generate a salary slip.</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {(isLoading || isLoadingEmployees || isLoadingMultiMonth) && !isBulkPrintingView && !showSlip && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}
    </>
  );
}