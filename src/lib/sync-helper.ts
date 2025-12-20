const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxw-u0CqbhNDyhUlQUN1s8Mdh21-o3VeqWLI9IW_6XXCUhz2jNefyyXlmsqy1g7PUw1/exec';

// Saare localStorage keys
const STORAGE_KEYS = [
  'novita_employee_master_data_v1',
  'novita_attendance_data_v1',
  'novita_leave_data_v1',
  'novita_salary_setup_data_v1',
  'novita_performance_deduction_data_v1',
  'novita_recent_activities_v1',
  'novita_users_data_v1'
];

// Saara data ek object me collect karo
export function getAllLocalData(): Record<string, any> {
  const allData: Record<string, any> = {};
  
  STORAGE_KEYS.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        allData[key] = JSON.parse(data);
      } catch {
        allData[key] = data;
      }
    }
  });
  
  return allData;
}

// Saara data localStorage me save karo
export function setAllLocalData(allData: Record<string, any>): void {
  Object.keys(allData).forEach(key => {
    if (allData[key]) {
      localStorage.setItem(key, JSON.stringify(allData[key]));
    }
  });
}

// Google Sheet se data download karo
export async function downloadFromCloud(): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL);
    const data = await response.json();
    
    if (data && Object.keys(data).length > 0 && !data.error) {
      setAllLocalData(data);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Cloud se download fail:', error);
    return false;
  }
}

// Google Sheet me data upload karo
export async function uploadToCloud(): Promise<boolean> {
  try {
    const allData = getAllLocalData();
    
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify(allData),
    });
    
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Cloud me upload fail:', error);
    return false;
  }
}