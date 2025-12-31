"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";

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
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

const loginFormSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
  rememberMe: z.boolean().default(false).optional(),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

interface SimulatedUser {
  id: string;
  username: string;
  isLocked: boolean;
}
const SIMULATED_USERS_STORAGE_KEY = "novita_simulated_users_v1";
const MAIN_ADMIN_USERNAME = "asingh0402";
const MAIN_ADMIN_PASSWORD = "123456";
const MAIN_ADMIN_DISPLAY_NAME = "Ajay Singh";
const LOGGED_IN_STATUS_KEY = "novita_logged_in_status_v1";
const REMEMBERED_USERNAME_KEY = "novita_remembered_username_v1";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: 'Novita Payroll App'
  });
  const [isConfigLoading, setIsConfigLoading] = React.useState(true);

  // Fetch company config on mount
  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        setCompanyConfig(config);
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
      rememberMe: false,
    },
  });

  // Load remembered username on component mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY);
      if (rememberedUsername) {
        form.setValue('username', rememberedUsername);
        form.setValue('rememberMe', true);
      }
    }
  }, [form]);

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300)); 

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
          console.error("Error reading co-admin users from localStorage:", error);
        }
      }
    }

    setIsLoading(false);

    if (loginSuccess) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOGGED_IN_STATUS_KEY, 'true');
        if (values.rememberMe) {
          localStorage.setItem(REMEMBERED_USERNAME_KEY, values.username);
        } else {
          localStorage.removeItem(REMEMBERED_USERNAME_KEY);
        }
      }
      router.replace("/dashboard");
      toast({
        title: "Login Successful",
        description: welcomeMessage,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid username or password, or account is locked.",
      });
      form.setError("username", { type: "manual", message: "Invalid credentials or account locked." });
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="items-center text-center">
        {/* Company Logo */}
        {isConfigLoading ? (
          <div className="h-20 w-20 mb-4 rounded-full bg-muted animate-pulse" />
        ) : companyConfig.company_logo ? (
          <Image
            src={companyConfig.company_logo}
            alt={`${companyConfig.company_name} Logo`}
            width={200}
            height={200}
            className="h-45 w-45 mb-4 rounded-full object-contain"
            unoptimized
          />
        ) : (
          <div className="h-20 w-20 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">
              {companyConfig.company_name.charAt(0)}
            </span>
          </div>
        )}
        
        {/* Company Name */}
        <h1 className="text-3xl font-bold mb-2 text-primary uppercase">
          {companyConfig.company_name || 'Novita Payroll App'}
        </h1>
        <CardTitle className="text-2xl font-bold">Login</CardTitle>
        <CardDescription>Enter your credentials to access the portal.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="your_username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Remember Me
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
