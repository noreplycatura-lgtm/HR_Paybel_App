// src/lib/google-sheets.ts

// ⚠️ IMPORTANT: New Deployment URL paste karo yahan
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxw-u0CqbhNDyhUlQUN1s8Mdh21-o3VeqWLI9IW_6XXCUhz2jNefyyXlmsqy1g7PUw1/exec'; 

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

export interface SalaryBreakupConfig {
  basic_percentage: number;
  hra_percentage: number;
  ca_percentage: number;
  medical_percentage: number;
}


/**
 * 1. Google Sheet se saara data load karne ke liye
 */
export async function loadFromGoogleSheet(): Promise<AppData> {
  try {
    const response = await fetch(`${WEBAPP_URL}?action=load`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error('Google Sheet load error:', error);
    return {};
  }
}

/**
 * 2. Data save karne ke liye
 */
export async function saveToGoogleSheet(data: AppData): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'save', data: data }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Google Sheet save error:', error);
    return false;
  }
}

/**
 * 3. Company Logo aur Name fetch karne ke liye
 */
export async function getCompanyConfig(): Promise<CompanyConfig> {
  try {
    const response = await fetch(`${WEBAPP_URL}?action=getConfig`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Check if the logo URL is from the old domain and ignore it if so
    const logoUrl = data.company_logo || '';
    if (logoUrl.includes('novitahealthcare.in')) {
      return {
        company_logo: '',
        company_name: data.company_name || 'Catura Payroll'
      };
    }

    return {
      company_logo: logoUrl,
      company_name: data.company_name || 'Catura Payroll'
    };
  } catch (error) {
    console.error('Config fetch error:', error);
    return { company_logo: '', company_name: 'Catura Payroll' };
  }
}

/**
 * 4. Google Drive me Month folder banane ke liye
 */
export async function createDriveFolder(folderName: string): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'createFolder',
        folderName: folderName
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.success === true;

  } catch (error) {
    console.error('Drive folder creation error:', error);
    return false;
  }
}

/**
 * 5. PDF upload karne ke liye Google Drive mein
 */
export async function uploadPDFToDrive(
  folderName: string, 
  fileName: string, 
  pdfBase64: string
): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadPDF',
        folderName: folderName,
        fileName: fileName,
        pdfBase64: pdfBase64
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.success === true;

  } catch (error) {
    console.error('PDF upload error:', error);
    return false;
  }
}

/**
 * 6. Salary Breakup Config fetch karne ke liye
 */
export async function getSalaryBreakupConfig(): Promise<SalaryBreakupConfig | null> {
  try {
    const response = await fetch(`${WEBAPP_URL}?action=getBreakupConfig`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if(data && typeof data.basic_percentage === 'number') {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Salary Breakup Config fetch error:', error);
    return null;
  }
}

/**
 * 7. Salary Breakup Config save karne ke liye
 */
export async function saveSalaryBreakupConfig(config: SalaryBreakupConfig): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveBreakupConfig', data: config }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Salary Breakup Config save error:', error);
    return false;
  }
}
