
"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function UserManagementPage() {
  const { toast } = useToast();
  const router = useRouter();

  const handleCreateUser = () => {
    toast({
      title: "Prototype Action",
      description: "User creation functionality is not yet implemented.",
    });
  };

  const handleLogout = () => {
    toast({
      title: "Logout Initiated (Prototype)",
      description: "Redirecting to login page.",
    });
    router.push("/login"); // Redirect to login page
  };

  return (
    <>
      <PageHeader title="User Management" description="Create and manage user accounts. Logout from the system." />
      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Account Controls</CardTitle>
          <CardDescription>Use the options below to manage users or log out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Button onClick={handleCreateUser} variant="outline">
            <UserPlus className="mr-2 h-4 w-4" />
            Create New User
          </Button>
          <Button onClick={handleLogout} variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
