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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, Loader2, PlusCircle, Trash2, Settings, AlertTriangle, IndianRupee } from "lucide-react";
import { getSalaryBreakupRules, saveSalaryBreakupRules, type SalaryBreakupRule } from "@/lib/google-sheets";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const breakupRuleSchema = z.object({
  from_gross: z.coerce.number().min(0, "From Gross must be non-negative"),
  to_gross: z.coerce.number().positive("To Gross must be positive"),
  basic_calculation_method: z.enum(['percentage', 'fixed'], {
    required_error: "You must select a Basic calculation method."
  }),
  basic_percentage: z.coerce.number().optional(),
  basic_fixed_amount: z.coerce.number().optional(),
  hra_percentage: z.coerce.number().min(0).max(100),
  ca_percentage: z.coerce.number().min(0).max(100),
  medical_percentage: z.coerce.number().min(0).max(100),
}).refine(data => data.to_gross > data.from_gross, {
  message: "'To Gross' must be greater than 'From Gross'",
  path: ["to_gross"],
}).refine(data => {
  if (data.basic_calculation_method === 'percentage') {
    return data.basic_percentage !== undefined && data.basic_percentage >= 0 && data.basic_percentage <= 100;
  }
  return true;
}, {
  message: "Basic percentage must be between 0 and 100.",
  path: ["basic_percentage"],
}).refine(data => {
  if (data.basic_calculation_method === 'fixed') {
    return data.basic_fixed_amount !== undefined && data.basic_fixed_amount > 0;
  }
  return true;
}, {
  message: "Fixed amount must be positive.",
  path: ["basic_fixed_amount"],
}).refine(data => {
  if (data.basic_calculation_method === 'percentage') {
    const total = (data.basic_percentage || 0) + (data.hra_percentage || 0) + (data.ca_percentage || 0) + (data.medical_percentage || 0);
    return total <= 100;
  }
  return true;
}, {
  message: "Total of Basic, HRA, CA, and Medical percentages cannot exceed 100%.",
  path: ["basic_percentage"],
});

type BreakupRuleFormValues = z.infer<typeof breakupRuleSchema>;

export default function SalaryBreakupPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [rules, setRules] = React.useState<SalaryBreakupRule[]>([]);
  const [ruleToDelete, setRuleToDelete] = React.useState<SalaryBreakupRule | null>(null);

  const form = useForm<BreakupRuleFormValues>({
    resolver: zodResolver(breakupRuleSchema),
    defaultValues: {
      from_gross: 0,
      to_gross: 0,
      basic_calculation_method: 'percentage',
      hra_percentage: 0,
      ca_percentage: 0,
      medical_percentage: 0,
    },
  });

  const basicCalcMethod = form.watch("basic_calculation_method");

  React.useEffect(() => {
    async function loadRules() {
      setIsLoading(true);
      const loadedRules = await getSalaryBreakupRules();
      if (loadedRules) {
        setRules(loadedRules.sort((a, b) => a.from_gross - b.from_gross));
      }
      setIsLoading(false);
    }
    loadRules();
  }, []);

  async function onSubmit(values: BreakupRuleFormValues) {
    setIsSaving(true);
    const newRule: SalaryBreakupRule = {
      id: `rule_${Date.now()}`,
      ...values,
      basic_percentage: values.basic_calculation_method === 'percentage' ? values.basic_percentage : undefined,
      basic_fixed_amount: values.basic_calculation_method === 'fixed' ? values.basic_fixed_amount : undefined,
    };

    const updatedRules = [...rules, newRule].sort((a, b) => a.from_gross - b.from_gross);
    const success = await saveSalaryBreakupRules(updatedRules);

    if (success) {
      setRules(updatedRules);
      toast({
        title: "✅ Rule Added",
        description: "Your new salary breakup rule has been saved.",
      });
      form.reset({
        from_gross: 0,
        to_gross: 0,
        basic_calculation_method: 'percentage',
        hra_percentage: 0,
        ca_percentage: 0,
        medical_percentage: 0,
        basic_percentage: undefined,
        basic_fixed_amount: undefined,
      });
    } else {
      toast({
        title: "❌ Save Failed",
        description: "Could not save the new rule to your Google Sheet.",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  }

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;
    setIsSaving(true);
    const updatedRules = rules.filter(rule => rule.id !== ruleToDelete.id);
    const success = await saveSalaryBreakupRules(updatedRules);

    if (success) {
      setRules(updatedRules);
      toast({
        title: "✅ Rule Deleted",
        description: "The salary breakup rule has been deleted.",
      });
    } else {
      toast({
        title: "❌ Delete Failed",
        description: "Could not delete the rule from your Google Sheet.",
        variant: "destructive",
      });
    }
    setRuleToDelete(null);
    setIsSaving(false);
  };


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
              Dynamic Salary Breakup Rules
            </h1>
            <p className="text-gray-300 text-sm">Define how gross salary is distributed based on different salary brackets.</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PlusCircle className="text-primary"/> Add New Rule</CardTitle>
              <CardDescription>
                Create a new rule for a specific gross salary range.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="from_gross" render={({ field }) => (
                        <FormItem><FormLabel>From Gross (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="to_gross" render={({ field }) => (
                        <FormItem><FormLabel>To Gross (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>

                  <FormField control={form.control} name="basic_calculation_method" render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Basic Salary Calculation</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                          <FormItem className="flex items-center space-x-2">
                            <FormControl><RadioGroupItem value="percentage" id="r1" /></FormControl>
                            <FormLabel htmlFor="r1" className="font-normal">Percentage (%)</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2">
                            <FormControl><RadioGroupItem value="fixed" id="r2" /></FormControl>
                            <FormLabel htmlFor="r2" className="font-normal">Fixed Amount (₹)</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>

                  <div className="grid grid-cols-2 gap-4">
                    {basicCalcMethod === 'percentage' && (
                      <FormField control={form.control} name="basic_percentage" render={({ field }) => (
                          <FormItem><FormLabel>Basic (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                    )}
                    {basicCalcMethod === 'fixed' && (
                      <FormField control={form.control} name="basic_fixed_amount" render={({ field }) => (
                          <FormItem><FormLabel>Basic Fixed (₹)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="hra_percentage" render={({ field }) => (
                        <FormItem><FormLabel>HRA (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="ca_percentage" render={({ field }) => (
                        <FormItem><FormLabel>CA (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    <FormField control={form.control} name="medical_percentage" render={({ field }) => (
                        <FormItem><FormLabel>Medical (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>

                  {form.formState.errors.basic_percentage && basicCalcMethod === 'percentage' && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                        <AlertTriangle className="h-4 w-4"/>
                        <span>{form.formState.errors.basic_percentage.message}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save New Rule
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><IndianRupee className="text-primary"/> Saved Rules</CardTitle>
              <CardDescription>These rules will be applied to calculate salary components.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gross Range (₹)</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>HRA %</TableHead>
                    <TableHead>CA %</TableHead>
                    <TableHead>Medical %</TableHead>
                    <TableHead>Other %</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length > 0 ? rules.map(rule => {
                    const basicDisplay = rule.basic_calculation_method === 'fixed'
                        ? `₹${rule.basic_fixed_amount?.toLocaleString()}`
                        : `${rule.basic_percentage}%`;
                    
                    const other = rule.basic_calculation_method === 'percentage' 
                        ? 100 - ((rule.basic_percentage || 0) + rule.hra_percentage + rule.ca_percentage + rule.medical_percentage)
                        : 'N/A';

                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.from_gross.toLocaleString()} - {rule.to_gross.toLocaleString()}</TableCell>
                        <TableCell>{basicDisplay}</TableCell>
                        <TableCell>{rule.hra_percentage}%</TableCell>
                        <TableCell>{rule.ca_percentage}%</TableCell>
                        <TableCell>{rule.medical_percentage}%</TableCell>
                        <TableCell>{typeof other === 'number' ? `${other.toFixed(2)}%` : other}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setRuleToDelete(rule)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  }) : (
                     <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No rules created yet. Add a rule to get started.
                        </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <AlertDialog open={!!ruleToDelete} onOpenChange={(isOpen) => !isOpen && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the rule for the gross range
              of <span className="font-semibold">{ruleToDelete?.from_gross.toLocaleString()} to {ruleToDelete?.to_gross.toLocaleString()}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive hover:bg-destructive/90">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
