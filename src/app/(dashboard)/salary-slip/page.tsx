"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, Loader2, Printer, XCircle, Send, CheckCircle, AlertCircle, CloudUpload } from "lucide-react";
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
const COMPANY_LOGO_BASE64 = 'data:image/png;base64,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';

// Company Address Lines
const COMPANY_ADDRESS_LINES = [
  "37 B, Mangal Compound,",
  "Pipliya Kumar Dewas Naka,",
  "Indore - 452010, Madhya Pradesh"
];

const LOCAL_STORAGE_EMPLOYEE_MASTER_KEY = "novita_employee_master_data_v1";
const LOCAL_STORAGE_OPENING_BALANCES_KEY = "novita_opening_leave_balances_v1";
const LOCAL_STORAGE_PERFORMANCE_DEDUCTIONS_KEY = "novita_performance_deductions_v1";
const LOCAL_STORAGE_ATTENDANCE_RAW_DATA_PREFIX = "novita_attendance_raw_data_v4_";
const LOCAL_STORAGE_SALARY_EDITS_PREFIX = "novita_salary_sheet_edits_v1_";
const LOCAL_STORAGE_LEAVE_APPLICATIONS_KEY = "novita_leave_applications_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";

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
              <h1 style="margin: 0; font-size: 16px; font-weight: 700; color: white; letter-spacing: 0.3px;">${companyConfig.company_name || 'Novita Healthcare Pvt. Ltd.'}</h1>
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
                {companyConfig.company_name || 'Novita Healthcare Pvt. Ltd.'}
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
    company_name: 'Novita Healthcare Pvt. Ltd.'
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
            company_name: config.company_name || 'Novita Healthcare Pvt. Ltd.'
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
      <PageHeader title="Salary Slip Generator" description="Generate and download monthly salary slips.">
        <Button onClick={handleDownloadAllSummaries} disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading} variant="outline">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download Summaries (CSV)
        </Button>
        <Button onClick={handlePrintAllSlips} disabled={!selectedMonth || !selectedYear || !selectedDivision || isLoading} variant="outline">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          Print All Slips
        </Button>
        <Button
          onClick={handleSendAllToDrive}
          disabled={!selectedMonth || !selectedYear || !selectedDivision || isSendingToDrive}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isSendingToDrive ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending {sendProgress.current}/{sendProgress.total}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send All to Drive
            </>
          )}
        </Button>
      </PageHeader>

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