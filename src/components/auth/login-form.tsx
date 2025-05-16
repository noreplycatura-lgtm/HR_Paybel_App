
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Image from "next/image";
import Link from "next/link";
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
import { COMPANY_NAME } from "@/lib/constants";
import { useEditorAuth } from "@/hooks/useEditorAuth"; // Import the hook

const loginFormSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { loginAsEditor } = useEditorAuth(); // Get the login function
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
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    setIsLoading(false);

    // Credentials for editor mode
    if (values.username === "asingh0402" && values.password === "123456") {
      loginAsEditor(); // Set editor mode
      toast({
        title: "Editor Login Successful",
        description: "Editing capabilities enabled.",
      });
      router.push("/dashboard"); 
    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid username or password for editor mode.",
      });
      form.setError("password", { type: "manual", message: "Invalid username or password."})
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="items-center text-center">
        <Image 
          src="https://placehold.co/150x50.png?text=Novita+Healthcare" 
          alt={`${COMPANY_NAME} Logo`}
          width={150}
          height={50}
          className="mb-4"
          data-ai-hint="company logo"
        />
        <CardTitle className="text-2xl font-bold">Editor Login</CardTitle>
        <CardDescription>Enter editor credentials to enable changes.</CardDescription>
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
                    <Input placeholder="editor_username" {...field} />
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
            <div className="flex items-center justify-between">
              <Link href="#" className="text-sm text-primary hover:underline invisible">
                Forgot Password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login as Editor
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
