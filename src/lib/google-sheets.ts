const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxw-u0CqbhNDyhUlQUN1s8Mdh21-o3VeqWLI9IW_6XXCUhz2jNefyyXlmsqy1g7PUw1/exec';

export interface AppData {
  employees?: any[];
  attendance?: any[];
  leaves?: any[];
  salarySetup?: any[];
  performanceDeductions?: any[];
  users?: any[];
}

// Google Sheet se data load karo
export async function loadFromGoogleSheet(): Promise<AppData> {
  try {
    const response = await fetch(WEBAPP_URL);
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error('Google Sheet se load nahi ho paya:', error);
    return {};
  }
}

// Google Sheet me data save karo
export async function saveToGoogleSheet(data: AppData): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Google Sheet me save nahi ho paya:', error);
    return false;
  }
}