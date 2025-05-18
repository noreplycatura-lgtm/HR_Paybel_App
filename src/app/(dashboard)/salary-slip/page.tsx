
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, Loader2 } from "lucide-react";
import Image from "next/image";

const sampleEmployees = [
  { id: "E001", name: "John Doe" },
  { id: "E002", name: "Jane Smith" },
  { id: "E003", name: "Mike Johnson" },
];

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentYear = new Date().getFullYear();

interface DateWithMonthName extends Date {
  getMonthName(): string;
}

(Date.prototype as DateWithMonthName).getMonthName = function() {
  return months[this.getMonth()];
};

const COMPANY_DETAILS_MAP = {
  FMCG: {
    name: "Novita Healthcare",
    address: "37B, Mangal Compound, Dewas Naka, Lasudia Mori, Indore, Madhya Pradesh 452010.",
    logoText: "Novita",
    dataAiHint: "company logo healthcare"
  },
  Wellness: {
    name: "Catura Shine Pharma LLP.",
    address: "Sco 10, Sector 26, Dhakoli, Zirakpur, Punjab 160104.",
    logoText: "Catura Shine Pharma",
    dataAiHint: "company logo pharma wellness"
  },
  Default: { 
    name: "Novita HR Portal", // Default fallback
    address: "123 Placeholder St, Placeholder City, PC 12345",
    logoText: "Novita",
    dataAiHint: "company logo"
  }
};


export default function SalarySlipPage() {
  const [selectedMonth, setSelectedMonth] = React.useState<string | undefined>( (new Date() as DateWithMonthName).getMonthName());
  const [selectedYear, setSelectedYear] = React.useState<string | undefined>(currentYear.toString());
  const [selectedEmployee, setSelectedEmployee] = React.useState<string | undefined>();
  const [selectedDivision, setSelectedDivision] = React.useState<string | undefined>();
  const [showSlip, setShowSlip] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false); 

  const handleGenerateSlip = () => {
    setIsLoading(true);
    if (selectedMonth && selectedYear && selectedEmployee && selectedDivision) {
      setTimeout(() => {
        setShowSlip(true);
        setIsLoading(false);
      }, 500);
    } else {
      alert("Please select month, year, employee, and division.");
      setIsLoading(false);
    }
  };

  const employeeDetails = sampleEmployees.find(e => e.id === selectedEmployee);
  const currentCompanyDetails = selectedDivision 
    ? COMPANY_DETAILS_MAP[selectedDivision as keyof typeof COMPANY_DETAILS_MAP] || COMPANY_DETAILS_MAP.Default 
    : COMPANY_DETAILS_MAP.Default;


  const salaryDetails = {
    employeeId: employeeDetails?.id || "N/A",
    name: employeeDetails?.name || "N/A",
    designation: "Software Engineer", 
    department: "Technology", 
    joinDate: "15 Jan 2022", 
    bankAccount: "XXXXXX1234", 
    pan: "ABCDE1234F", 
    payDays: 30, 
    lopDays: 0, 
    earnings: [
      { component: "Basic Salary", amount: 15010 },
      { component: "House Rent Allowance (HRA)", amount: 22495 },
      { component: "Conveyance Allowance (CA)", amount: 8998 },
      { component: "Medical Allowance", amount: 6748.50 },
      { component: "Other Allowance", amount: 6748.50 },
    ],
    deductions: [
      { component: "Provident Fund (PF)", amount: 1800 },
      { component: "Professional Tax (PT)", amount: 200 },
      { component: "Income Tax (TDS)", amount: 3500 },
    ],
  };
  const totalEarnings = salaryDetails.earnings.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = salaryDetails.deductions.reduce((sum, item) => sum + item.amount, 0);
  const netSalary = totalEarnings - totalDeductions;

  const attendanceSummary = { present: 22, absent: 0, leaves: 2, weekOffs: 6 };
  const leaveBalance = { cl: 5, sl: 3, pl: 10 };


  return (
    <>
      <PageHeader title="Salary Slip Generator" description="Generate and download monthly salary slips for employees." />

      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow print:hidden">
        <CardHeader>
          <CardTitle>Select Criteria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth} >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear} >
             <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
                {[currentYear, currentYear-1, currentYear-2].map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
           <Select value={selectedDivision} onValueChange={setSelectedDivision}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FMCG">FMCG Division</SelectItem>
              <SelectItem value="Wellness">Wellness Division</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee} >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select Employee" />
            </SelectTrigger>
            <SelectContent>
              {sampleEmployees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.id})</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            onClick={handleGenerateSlip}
            disabled={!selectedMonth || !selectedEmployee || !selectedYear || !selectedDivision || isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
             Generate Slip
          </Button>
        </CardContent>
      </Card>

      {showSlip && employeeDetails && (
        <Card className="shadow-xl" id="salary-slip-preview">
          <CardHeader className="bg-muted/30 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <Image
                  src={`https://placehold.co/150x50.png?text=${encodeURIComponent(currentCompanyDetails.logoText)}`}
                  alt={`${currentCompanyDetails.name} Logo`}
                  width={150}
                  height={50}
                  className="mb-2"
                  data-ai-hint={currentCompanyDetails.dataAiHint}
                />
                <p className="text-sm font-semibold">{currentCompanyDetails.name}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{currentCompanyDetails.address}</p>
              </div>
              <div className="text-right mt-4 sm:mt-0">
                <CardTitle className="text-2xl">Salary Slip</CardTitle>
                <CardDescription>For {selectedMonth} {selectedYear}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Employee Details</h3>
                <p><strong>Name:</strong> {salaryDetails.name}</p>
                <p><strong>Employee ID:</strong> {salaryDetails.employeeId}</p>
                <p><strong>Designation:</strong> {salaryDetails.designation}</p>
                <p><strong>Department:</strong> {salaryDetails.department}</p>
                <p><strong>Date of Joining:</strong> {salaryDetails.joinDate}</p>
                <p><strong>PAN:</strong> {salaryDetails.pan}</p>
                <p><strong>Bank Account:</strong> {salaryDetails.bankAccount}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Pay Details</h3>
                <p><strong>Pay Days:</strong> {salaryDetails.payDays}</p>
                <p><strong>Loss of Pay Days (LOP):</strong> {salaryDetails.lopDays}</p>
                 <Separator className="my-2" />
                <h3 className="font-semibold mb-1 mt-2">Attendance Summary</h3>
                <p>Present: {attendanceSummary.present} | Absent: {attendanceSummary.absent} | Leaves: {attendanceSummary.leaves} | W/Os: {attendanceSummary.weekOffs}</p>
                <h3 className="font-semibold mb-1 mt-2">Leave Balance</h3>
                <p>CL: {leaveBalance.cl} | SL: {leaveBalance.sl} | PL: {leaveBalance.pl}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-lg mb-2">Earnings</h3>
                {salaryDetails.earnings.map(item => (
                  <div key={item.component} className="flex justify-between py-1 border-b border-dashed">
                    <span>{item.component}</span>
                    <span>₹{item.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold mt-2 pt-1">
                  <span>Total Earnings</span>
                  <span>₹{totalEarnings.toFixed(2)}</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Deductions</h3>
                {salaryDetails.deductions.map(item => (
                  <div key={item.component} className="flex justify-between py-1 border-b border-dashed">
                    <span>{item.component}</span>
                    <span>₹{item.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold mt-2 pt-1">
                  <span>Total Deductions</span>
                  <span>₹{totalDeductions.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="text-right">
              <p className="text-lg font-bold">Net Salary: ₹{netSalary.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Amount in words: {convertToWords(netSalary)} Rupees Only</p>
            </div>

            <p className="text-xs text-muted-foreground mt-8 text-center">This is a computer-generated salary slip and does not require a signature.</p>
          </CardContent>
          <CardFooter className="p-6 border-t print:hidden">
            <Button onClick={() => window.print()} className="ml-auto">
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </CardFooter>
        </Card>
      )}
       {!showSlip && (
        <Card className="shadow-md hover:shadow-lg transition-shadow items-center flex justify-center py-12">
          <CardContent className="text-center text-muted-foreground">
            <p>Please select month, year, division, and employee to generate the salary slip.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function convertToWords(num: number): string {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
  
  const inWords = (numToConvert: number): string => {
    let numStr = numToConvert.toString();
    if (numStr.length > 9) return 'overflow'; 
    
    const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (parseInt(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]).trim() + ' Crore ' : '';
    str += (parseInt(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]).trim() + ' Lakh ' : '';
    str += (parseInt(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]).trim() + ' Thousand ' : '';
    str += (parseInt(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]).trim() + ' Hundred ' : '';
    str += (parseInt(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]).trim() : '';
    return str.replace(/\s+/g, ' ').trim(); 
  };

  if (num === 0) return "Zero";

  const [wholePartStr, decimalPartStr] = num.toFixed(2).split('.');
  const wholePart = parseInt(wholePartStr);
  const decimalPart = parseInt(decimalPartStr);

  let words = inWords(wholePart);
  if (decimalPart > 0) {
    words += (words ? ' ' : '') + 'and ' + inWords(decimalPart) + ' Paise';
  }
  return words.trim() ? words.trim() : 'Zero';
}

