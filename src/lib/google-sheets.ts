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

/**
 * 1. Google Sheet se saara data load karne ke liye
 */
export async function loadFromGoogleSheet(): Promise<AppData> {
  try {
    const response = await fetch(WEBAPP_URL);
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
      body: JSON.stringify(data),
    });
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
    const data = await response.json();
    return {
      company_logo: data.company_logo || '',
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
    console.log('Creating folder:', folderName);
    
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'createFolder',
        folderName: folderName
      }),
      redirect: 'follow'
    });

    // Get response text first
    const responseText = await response.text();
    console.log('Folder creation response:', responseText);
    
    // Try to parse as JSON
    try {
      const result = JSON.parse(responseText);
      if (result.success) {
        console.log('Folder created/found:', result.folderName || folderName);
        return true;
      } else {
        console.error('Folder creation failed:', result.error);
        return false;
      }
    } catch (parseError) {
      console.error('Response parse error:', parseError, 'Response was:', responseText);
      return false;
    }
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
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadPDF',
        folderName: folderName,
        fileName: fileName,
        pdfBase64: pdfBase64
      }),
      redirect: 'follow'
    });

    const responseText = await response.text();
    
    try {
      const result = JSON.parse(responseText);
      if (result.success) {
        return true;
      } else {
        console.error('PDF upload failed:', result.error);
        return false;
      }
    } catch (parseError) {
      console.error('Upload response parse error:', parseError);
      return false;
    }
  } catch (error) {
    console.error('PDF upload error:', error);
    return false;
  }
}