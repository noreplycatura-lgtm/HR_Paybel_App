
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function EmployeeMasterPage() {
  return (
    <>
      <PageHeader title="Employee Master" description="Manage employee details, status, and salary information." />
      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[300px]">
          <Construction className="w-16 h-16 text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">Under Construction</h2>
          <p className="text-muted-foreground text-center">
            The Employee Master section is currently under development. <br/>
            Features will include direct entry and Excel upload for managing employee data.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
