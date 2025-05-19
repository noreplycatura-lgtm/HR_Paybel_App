
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
const SIMULATED_USERS_STORAGE_KEY = "novita_simulated_users_v1";
const MAIN_ADMIN_USERNAME = "asingh0402";
const MAIN_ADMIN_PASSWORD = "123456";
const LOGGED_IN_STATUS_KEY = "novita_logged_in_status_v1";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay for testing

    let loginSuccess = false;
    let welcomeMessage = "";

    if (values.username === MAIN_ADMIN_USERNAME && values.password === MAIN_ADMIN_PASSWORD) {
      loginSuccess = true;
      welcomeMessage = "Welcome, Main Admin!";
    } else {
      if (typeof window !== 'undefined') {
        try {
          const storedUsersStr = localStorage.getItem(SIMULATED_USERS_STORAGE_KEY);
          if (storedUsersStr) {
            const simulatedUsers: SimulatedUser[] = JSON.parse(storedUsersStr);
            const coAdminUser = simulatedUsers.find(user => user.username === values.username);
            // For co-admin, password check is not implemented in this prototype
            // We only check if the user exists and is not locked.
            if (coAdminUser && !coAdminUser.isLocked) {
              loginSuccess = true;
              welcomeMessage = `Welcome, ${values.username}!`;
            }
          }
        } catch (error) {
          console.error("Error reading co-admin users from localStorage:", error);
          // Fall through to login failed
        }
      }
    }

    setIsLoading(false);

    if (loginSuccess) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOGGED_IN_STATUS_KEY, 'true');
      }
      // It's important that router.replace is called *before* any other async operations
      // or state updates that might delay or interfere with navigation.
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
         <h1 className="text-3xl font-bold mb-2 text-primary uppercase">HR PAYROLL APP</h1>
        <CardTitle className="text-2xl font-bold">Login</CardTitle>
        <CardDescription>Enter your credentials to access the portal.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
