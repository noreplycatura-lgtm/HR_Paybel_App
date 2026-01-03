"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Loader2, Lock, User, Sparkles, CheckCircle, Cloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getCompanyConfig, type CompanyConfig } from "@/lib/google-sheets";
import { downloadFromCloud } from "@/lib/sync-helper";

const loginFormSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

interface SimulatedUser {
  id: string;
  username: string;
  isLocked: boolean;
}

const SIMULATED_USERS_STORAGE_KEY = "catura_simulated_users_v1";
const MAIN_ADMIN_USERNAME = "asingh0402";
const MAIN_ADMIN_PASSWORD = "123456";
const MAIN_ADMIN_DISPLAY_NAME = "Ajay Singh";
const LOGGED_IN_STATUS_KEY = "catura_logged_in_status_v1";

// Circular Progress Component
function CircularProgress({ progress, size = 120 }: { progress: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Background Circle */}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Percentage Text */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {progress >= 100 ? (
          <CheckCircle style={{ width: '40px', height: '40px', color: '#22c55e' }} />
        ) : (
          <>
            <span style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>
              {Math.round(progress)}%
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Syncing Overlay Component
function SyncingOverlay({ 
  progress, 
  statusText, 
  companyName 
}: { 
  progress: number; 
  statusText: string;
  companyName: string;
}) {
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      {/* Background Pattern */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233b82f6' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div 
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        {/* Cloud Icon Animation */}
        <div 
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)',
            animation: 'pulse 2s infinite',
          }}
        >
          <Cloud style={{ width: '30px', height: '30px', color: 'white' }} />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
            {progress >= 100 ? 'All Set!' : 'Syncing Data'}
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            {companyName}
          </p>
        </div>

        {/* Circular Progress */}
        <CircularProgress progress={progress} size={140} />

        {/* Status Text */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: '#f1f5f9',
            borderRadius: '12px',
          }}
        >
          {progress < 100 && (
            <Loader2 
              style={{ width: '16px', height: '16px', color: '#3b82f6' }} 
              className="animate-spin" 
            />
          )}
          <span style={{ fontSize: '14px', color: '#475569', fontWeight: '500' }}>
            {statusText}
          </span>
        </div>

        {/* Progress Bar (Alternative) */}
        <div 
          style={{
            width: '280px',
            height: '6px',
            backgroundColor: '#e2e8f0',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div 
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Pulse Animation Style */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState(0);
  const [syncStatusText, setSyncStatusText] = React.useState('Initializing...');
  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: 'catura Payroll'
  });
  const [isConfigLoading, setIsConfigLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        if (config) {
          setCompanyConfig({
            company_logo: config.company_logo || '',
            company_name: config.company_name || 'Catura Payroll'
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

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Sync data with progress animation
  const performDataSync = React.useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatusText('Connecting to server...');

    try {
      // Stage 1: Connecting (0-20%)
      await new Promise(resolve => setTimeout(resolve, 300));
      setSyncProgress(10);
      setSyncStatusText('Connecting to server...');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      setSyncProgress(20);
      setSyncStatusText('Fetching data from cloud...');

      // Stage 2: Downloading (20-70%)
      setSyncProgress(30);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setSyncProgress(40);
      setSyncStatusText('Downloading employee data...');
      await new Promise(resolve => setTimeout(resolve, 200));

      setSyncProgress(50);
      
      // Actually download data
      const downloadSuccess = await downloadFromCloud();
      
      setSyncProgress(70);
      setSyncStatusText('Processing data...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Stage 3: Processing (70-90%)
      setSyncProgress(80);
      setSyncStatusText('Setting up your workspace...');
      await new Promise(resolve => setTimeout(resolve, 300));

      setSyncProgress(90);
      setSyncStatusText('Almost ready...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Stage 4: Complete (100%)
      setSyncProgress(100);
      setSyncStatusText(downloadSuccess ? 'Sync complete!' : 'Ready to go!');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Redirect to dashboard
      router.replace("/dashboard");
      
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatusText('Continuing to dashboard...');
      setSyncProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace("/dashboard");
    }
  }, [router]);

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    let loginSuccess = false;
    let welcomeMessage = "";

    if (values.username === MAIN_ADMIN_USERNAME && values.password === MAIN_ADMIN_PASSWORD) {
      loginSuccess = true;
      welcomeMessage = `Welcome, ${MAIN_ADMIN_DISPLAY_NAME}!`;
    } else {
      if (typeof window !== 'undefined') {
        try {
          const storedUsersStr = localStorage.getItem(SIMULATED_USERS_STORAGE_KEY);
          if (storedUsersStr) {
            const simulatedUsers: SimulatedUser[] = JSON.parse(storedUsersStr);
            const coAdminUser = simulatedUsers.find(user => user.username === values.username);
            if (coAdminUser && !coAdminUser.isLocked) {
              loginSuccess = true;
              welcomeMessage = `Welcome, ${coAdminUser.username}!`;
            }
          }
        } catch (error) {
          console.error("Error reading co-admin users:", error);
        }
      }
    }

    setIsLoading(false);

    if (loginSuccess) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOGGED_IN_STATUS_KEY, 'true');
      }
      
      toast({
        title: "Login Successful",
        description: welcomeMessage,
      });

      // Start syncing process with progress
      performDataSync();
      
    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid username or password, or account is locked.",
      });
      form.setError("username", { type: "manual", message: "Invalid credentials or account locked." });
    }
  }

  // Show syncing overlay when syncing
  if (isSyncing) {
    return (
      <SyncingOverlay 
        progress={syncProgress} 
        statusText={syncStatusText}
        companyName={companyConfig.company_name || 'Catura Payroll'}
      />
    );
  }

  return (
    <div 
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)',
        padding: '20px',
      }}
    >
      {/* Background Pattern */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          opacity: 0.5,
        }}
      />

      <Card 
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'white',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Gradient Bar */}
        <div 
          style={{
            height: '6px',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
          }}
        />

        <CardHeader style={{ textAlign: 'center', paddingTop: '32px', paddingBottom: '16px' }}>
          {/* Logo */}
          {isConfigLoading ? (
            <div 
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '20px',
                backgroundColor: '#f1f5f9',
                margin: '0 auto 16px',
                animation: 'pulse 2s infinite',
              }}
            />
          ) : companyConfig.company_logo ? (
            <div style={{ margin: '0 auto 16px' }}>
              <img
                src={companyConfig.company_logo}
                alt={`${companyConfig.company_name} Logo`}
                style={{
                  width: '100px',
                  height: '100px',
                  objectFit: 'contain',
                  borderRadius: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                }}
              />
            </div>
          ) : (
            <div 
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Sparkles style={{ width: '40px', height: '40px', color: 'white' }} />
            </div>
          )}

          {/* Company Name */}
          <CardTitle 
            style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#1e293b',
              marginBottom: '8px',
            }}
          >
            {companyConfig.company_name || 'Catura Payroll'}
          </CardTitle>
          
          <CardDescription style={{ fontSize: '14px', color: '#64748b' }}>
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>

        <CardContent style={{ padding: '24px 32px 32px' }}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Username Field */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Username
                    </FormLabel>
                    <FormControl>
                      <div style={{ position: 'relative' }}>
                        <User 
                          style={{ 
                            position: 'absolute', 
                            left: '14px', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            width: '18px',
                            height: '18px',
                            color: '#9ca3af',
                          }} 
                        />
                        <Input 
                          placeholder="Enter your username" 
                          {...field}
                          style={{
                            paddingLeft: '44px',
                            height: '48px',
                            fontSize: '15px',
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            backgroundColor: '#f9fafb',
                            transition: 'all 0.2s',
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage style={{ fontSize: '12px', color: '#ef4444' }} />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      Password
                    </FormLabel>
                    <FormControl>
                      <div style={{ position: 'relative' }}>
                        <Lock 
                          style={{ 
                            position: 'absolute', 
                            left: '14px', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            width: '18px',
                            height: '18px',
                            color: '#9ca3af',
                          }} 
                        />
                        <Input 
                          type="password" 
                          placeholder="Enter your password" 
                          {...field}
                          style={{
                            paddingLeft: '44px',
                            height: '48px',
                            fontSize: '15px',
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            backgroundColor: '#f9fafb',
                            transition: 'all 0.2s',
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage style={{ fontSize: '12px', color: '#ef4444' }} />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: '50px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  border: 'none',
                  color: 'white',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.2s',
                  marginTop: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 style={{ marginRight: '8px', height: '20px', width: '20px' }} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </Form>

          {/* Footer */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              © 2024 Catura Healthcare Pvt. Ltd.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}