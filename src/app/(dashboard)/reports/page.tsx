import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Access various HR reports." />
      <Card className="shadow-md">
        <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[300px]">
          <Construction className="w-16 h-16 text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">Under Construction</h2>
          <p className="text-muted-foreground text-center">
            The reports section is currently under development. <br/>
            Please check back later for updates.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
