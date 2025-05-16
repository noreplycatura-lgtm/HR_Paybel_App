
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UserPlus, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const newUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type NewUserFormValues = z.infer<typeof newUserFormSchema>;

export default function UserManagementPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = React.useState(false);

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleCreateUserSubmit = (values: NewUserFormValues) => {
    toast({
      title: "User Creation Simulated",
      description: `User '${values.username}' has been 'created'. Note: The main login form is still configured with specific credentials for prototype purposes.`,
      duration: 7000,
    });
    setIsCreateUserDialogOpen(false);
    form.reset();
  };

  const handleLogout = () => {
    toast({
      title: "Logout Initiated",
      description: "Redirecting to login page.",
    });
    router.push("/login");
  };

  return (
    <>
      <PageHeader
        title="User Management"
        description="Create and manage user accounts. Logout from the system."
      />
      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Account Controls</CardTitle>
          <CardDescription>
            Use the options below to manage users or log out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Create New User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New User (Prototype)</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new user. This is a simulation;
                  the main login uses pre-set credentials.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateUserSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="New username" {...field} />
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
                          <Input type="password" placeholder="New password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit">Create User</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={handleLogout} variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
