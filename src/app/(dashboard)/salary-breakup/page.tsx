"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Percent, Settings, AlertTriangle } from "lucide-react";
import { getSalaryBreakupConfig, saveSalaryBreakupConfig, type SalaryBreakupConfig } from "@/lib/google-sheets";

const breakupSchema = z.object({
  basic_percentage: z.coerce.number().min(0).max(100),
  hra_percentage: z.coerce.number().min(0).max(100),
  ca_percentage: z.coerce.number().min(0).max(100),
  medical_percentage: z.coerce.number().min(0).max(100),
}).refine(data => {
  const total = data.basic_percentage + data.hra_percentage + data.ca_percentage + data.medical_percentage;
  return total <= 100;
}, {
  message: "Total of Basic, HRA, CA, and Medical percentages cannot exceed 100%.",
  path: ["basic_percentage"], // You can attach the error to any field
});

type BreakupFormValues = z.infer<typeof breakupSchema>;

export default function SalaryBreakupPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<BreakupFormValues>({
    resolver: zodResolver(breakupSchema),
    defaultValues: {
      basic_percentage: 0,
      hra_percentage: 0,
      ca_percentage: 0,
      medical_percentage: 0,
    },
  });

  React.useEffect(() => {
    async function loadConfig() {
      setIsLoading(true);
      const config = await getSalaryBreakupConfig();
      if (config) {
        form.reset(config);
      } else {
        // You might want to set some sensible defaults if no config is found
        form.reset({
          basic_percentage: 40,
          hra_percentage: 20,
          ca_percentage: 10,
          medical_percentage: 5,
        });
      }
      setIsLoading(false);
    }
    loadConfig();
  }, [form]);

  const watchedValues = form.watch();
  const totalPercentage = React.useMemo(() => {
    return (
      parseFloat(String(watchedValues.basic_percentage || 0)) +
      parseFloat(String(watchedValues.hra_percentage || 0)) +
      parseFloat(String(watchedValues.ca_percentage || 0)) +
      parseFloat(String(watchedValues.medical_percentage || 0))
    );
  }, [watchedValues]);

  const otherAllowancePercentage = 100 - totalPercentage;

  async function onSubmit(values: BreakupFormValues) {
    setIsSaving(true);
    const success = await saveSalaryBreakupConfig(values);
    if (success) {
      toast({
        title: "✅ Settings Saved",
        description: "Your salary breakup percentages have been saved.",
      });
    } else {
      toast({
        title: "❌ Save Failed",
        description: "Could not save settings to Google Sheet.",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-700 via-gray-800 to-black p-6 text-white shadow-xl">
         <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white/10" />
         <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <Settings className="h-7 w-7" />
              Salary Breakup Configuration
            </h1>
            <p className="text-gray-300 text-sm">Define how gross salary is distributed into components.</p>
          </div>
        </div>
      </div>
      
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Component Percentages</CardTitle>
          <CardDescription>
            Set the percentage of the gross salary for each component. The 'Other Allowance' will be the remaining percentage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="basic_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Basic Salary (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 40" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hra_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HRA (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ca_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conveyance Allowance (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="medical_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical Allowance (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card className="bg-muted/50 mt-6">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-muted-foreground">Other Allowance (%):</div>
                    <div className="text-lg font-bold flex items-center gap-1">
                      <Percent className="h-4 w-4" />
                      <span>{otherAllowancePercentage.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                     This is the remaining percentage of the gross salary. (100% - {totalPercentage.toFixed(2)}%)
                  </div>
                </CardContent>
              </Card>

              {form.formState.errors.basic_percentage && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertTriangle className="h-4 w-4"/>
                    <span>{form.formState.errors.basic_percentage.message}</span>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
