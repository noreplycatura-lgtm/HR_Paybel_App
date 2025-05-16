
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function SalarySheetPage() {
  return (
    <>
      <PageHeader title="Salary Sheet" description="Download month-wise salary sheets for employees." />
      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[300px]">
          <Construction className="w-16 h-16 text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">Under Construction</h2>
          <p className="text-muted-foreground text-center">
            The Salary Sheet download section is currently under development. <br/>
            You will be able to select a month and year to download the consolidated salary sheet.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
