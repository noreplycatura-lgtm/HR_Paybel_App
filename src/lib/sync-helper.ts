// src/lib/sync-helper.ts

const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxw-u0CqbhNDyhUlQUN1s8Mdh21-o3VeqWLI9IW_6XXCUhz2jNefyyXlmsqy1g7PUw1/exec';

// 1. Static Keys (Jo change nahi hoti)
const STATIC_KEYS = [
  'novita_employee_master_data_v1',
  'novita_opening_leave_balances_v1',
  'novita_leave_applications_v1',
  'novita_performance_deductions_v1',
  'novita_simulated_users_v1',
  'novita_recent_activities_v1',
  'novita_logged_in_status_v1',
  'novita_current_logged_in_user_display_name_v1',
  'novita_statutory_eligibility_v1',
  'novita_pf_rules_v1',
  'novita_ptax_rules_v1',
  'novita_tds_rules_v1',
  'novita_loans_v1',
  'novita_salary_breakup_rules_v1',       // ✅ NEW ADDED
  'novita_employee_rule_mapping_v1'        // ✅ NEW ADDED
];

// 2. Dynamic Keys Prefixes (Jo har mahine change hoti hain)
const DYNAMIC_PREFIXES = [
  'novita_attendance_raw_data_v4_',
  'novita_attendance_filename_v4_',
  'novita_salary_sheet_edits_v1_',
  'novita_last_upload_context_v4'
];

// Saara data ek object me collect karo
export function getAllLocalData(): Record<string, any> {
  const allData: Record<string, any> = {};
  
  if (typeof window === 'undefined') return allData;

  // 1. Static Keys collect karo
  STATIC_KEYS.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        allData[key] = JSON.parse(data);
      } catch {
        allData[key] = data;
      }
    }
  });

  // 2. Dynamic Keys dhundo aur collect karo
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const isDynamic = DYNAMIC_PREFIXES.some(prefix => key.startsWith(prefix));
      if (isDynamic) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            allData[key] = JSON.parse(data);
          } catch {
            allData[key] = data;
          }
        }
      }
    }
  }
  
  return allData;
}

// Saara data localStorage me save karo
export function setAllLocalData(allData: Record<string, any>): void {
  if (typeof window === 'undefined') return;

  Object.keys(allData).forEach(key => {
    if (allData[key]) {
      if (typeof allData[key] === 'string') {
        localStorage.setItem(key, allData[key]);
      } else {
        localStorage.setItem(key, JSON.stringify(allData[key]));
      }
    }
  });
}

// Google Sheet se data download karo
export async function downloadFromCloud(): Promise<boolean> {
  try {
    const response = await fetch(WEBAPP_URL);
    const data = await response.json();
    
    if (data && !data.error && Object.keys(data).length > 0) {
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
    
    if (Object.keys(allData).length === 0) {
      console.warn("No data found to upload");
      return false;
    }

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