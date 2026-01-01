
// src/lib/google-sheets.ts

// ⚠️ IMPORTANT: Apna latest "Web App URL" yahan check karke update karein
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwxT7kkD_oqfznYz1Atiai4uK4xxJa7S2InO-DzWQm9cDz3zXDST4C_yeibZalcies53Q/exec'; 

export interface AppData {
  employees?: any[];
  attendance?: any[];
  leaves?: any[];
  salarySetup?: any[];
  performanceDeductions?: any[];
  users?: any[];
}

export interface CompanyConfig {
  company_logo: string;
  company_name: string;
}

/**
 * 1. Load Data (GET Request)
 */
export async function loadFromGoogleSheet(): Promise<AppData> {
  try {
    const response = await fetch(`${WEBAPP_URL}?action=load`);
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error('Google Sheet load error:', error);
    return {};
  }
}

/**
 * 2. Save Data (POST Request)
 */
export async function saveToGoogleSheet(data: AppData): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({ action: 'save', data: data }),
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Google Sheet save error:', error);
    return false;
  }
}

/**
 * 3. Get Company Config
 */
export async function getCompanyConfig(): Promise<CompanyConfig> {
  try {
    const response = await fetch(`${WEBAPP_URL}?action=getConfig`);
    const data = await response.json();
    
    // Fix for broken image URL
    const logoUrl = (data.company_logo || '').includes('novitahealthcare.in') 
      ? '' 
      : data.company_logo || '';

    return {
      company_logo: logoUrl,
      company_name: data.company_name || 'Novita Payroll'
    };
  } catch (error) {
    return { company_logo: '', company_name: 'Novita Payroll' };
  }
}

/**
 * 4. Create Folder (Optimized for CORS)
 */
export async function createDriveFolder(folderName: string): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'createFolder',
        folderName: folderName
      }),
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Drive folder creation error:', error);
    return false; 
  }
}

/**
 * 5. Upload PDF (Optimized for CORS)
 */
export async function uploadPDFToDrive(
  folderName: string, 
  fileName: string, 
  pdfBase64: string
): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'uploadPDF',
        folderName: folderName,
        fileName: fileName,
        pdfBase64: pdfBase64
      }),
    });
     const result = await response.json();
    return result.success === true;
  } catch (error) {
     console.error('Upload PDF to Drive error:', error);
    return false;
  }
}
