
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Lock, Unlock, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const newUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type NewUserFormValues = z.infer<typeof newUserFormSchema>;

interface SimulatedUser {
  id: string;
  username: string;
  isLocked: boolean;
}

const LOCAL_STORAGE_SIMULATED_USERS_KEY = "novita_simulated_users_v1";
const MAIN_ADMIN_USERNAME = "asingh0402";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";

interface ActivityLogEntry {
  timestamp: string;
  message: string;
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = []; 

    activities.unshift({ timestamp: new Date().toISOString(), message });
    activities = activities.slice(0, 10); 
    localStorage.setItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error adding to activity log:", error);
  }
};

export default function UserManagementPage() {
  const { toast } = useToast();
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = React.useState(false);
  const [simulatedUsers, setSimulatedUsers] = React.useState<SimulatedUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userToDelete, setUserToDelete] = React.useState<SimulatedUser | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      let usersToSet: SimulatedUser[] = [];
      try {
        const storedUsers = localStorage.getItem(LOCAL_STORAGE_SIMULATED_USERS_KEY);
        if (storedUsers) {
          const parsedUsers: SimulatedUser[] = JSON.parse(storedUsers);
          usersToSet = parsedUsers.filter(user => user.username !== "Novita");
          if (usersToSet.length !== parsedUsers.length) {
            localStorage.setItem(LOCAL_STORAGE_SIMULATED_USERS_KEY, JSON.stringify(usersToSet));
          }
        }
      } catch (error) {
        console.error("Error loading/processing simulated users from localStorage:", error);
        toast({
            title: "Data Load Error",
            description: "Could not load user list. Stored data might be corrupted. Please add users again if needed. Data is saved locally in your browser.",
            variant: "destructive",
            duration: 7000,
        });
      }
      setSimulatedUsers(usersToSet);
    }
    setIsLoading(false);
  }, []); 

  const saveSimulatedUsersToLocalStorage = (users: SimulatedUser[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_SIMULATED_USERS_KEY, JSON.stringify(users));
      } catch (error) {
        console.error("Error saving simulated users to localStorage:", error);
        toast({ title: "Storage Error", description: "Could not save user list locally.", variant: "destructive" });
      }
    }
  };

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleCreateUserSubmit = (values: NewUserFormValues) => {
    if (values.username === MAIN_ADMIN_USERNAME) {
      toast({
        title: "Cannot Create User",
        description: `Username '${MAIN_ADMIN_USERNAME}' is reserved for the Main Admin.`,
        variant: "destructive",
      });
      return;
    }
    if (simulatedUsers.find(user => user.username === values.username)) {
      toast({
        title: "Duplicate Username",
        description: `A co-admin user with the username '${values.username}' already exists.`,
        variant: "destructive",
      });
      return;
    }

    const newUser: SimulatedUser = {
      id: Date.now().toString(),
      username: values.username,
      isLocked: false,
    };
    const updatedUsers = [...simulatedUsers, newUser];
    setSimulatedUsers(updatedUsers);
    saveSimulatedUsersToLocalStorage(updatedUsers);
    addActivityLog(`Co-admin user '${values.username}' created.`);
    toast({
      title: "Co-Admin User Added",
      description: `User '${values.username}' has been added to the list.`,
    });
    setIsCreateUserDialogOpen(false);
    form.reset();
  };

  const handleToggleLock = (userId: string) => {
    const updatedUsers = simulatedUsers.map(user =>
      user.id === userId ? { ...user, isLocked: !user.isLocked } : user
    );
    setSimulatedUsers(updatedUsers);
    saveSimulatedUsersToLocalStorage(updatedUsers);
    const user = updatedUsers.find(u => u.id === userId);
    if (user) {
      addActivityLog(`Co-admin user '${user.username}' status changed to ${user.isLocked ? 'Locked' : 'Active'}.`);
      toast({
        title: "User Status Changed",
        description: `User '${user.username}' has been ${user.isLocked ? 'locked' : 'unlocked'}.`,
      });
    }
  };

  const handleDeleteUserClick = (user: SimulatedUser) => {
    setUserToDelete(user);
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    const updatedUsers = simulatedUsers.filter(user => user.id !== userToDelete.id);
    setSimulatedUsers(updatedUsers);
    saveSimulatedUsersToLocalStorage(updatedUsers);
    addActivityLog(`Co-admin user '${userToDelete.username}' deleted.`);
    toast({
      title: "User Deleted",
      description: `Simulated user '${userToDelete.username}' has been deleted.`,
      variant: "destructive",
    });
    setUserToDelete(null);
  };

  const handleResetPassword = (username: string) => {
    addActivityLog(`Password reset attempted for co-admin '${username}'.`);
    toast({
      title: "Prototype Action",
      description: `Password reset for user '${username}' is a simulated action. In a real system, this would trigger a reset flow.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="User Management"
        description={`Manage co-admin accounts. Main Admin: ${MAIN_ADMIN_USERNAME} (Not manageable here).`}
      />
      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Account Controls</CardTitle>
          <CardDescription>
            Create new co-admin users.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 pt-6">
          <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Create New Co-Admin User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Co-Admin</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new co-admin user.
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
                          <Input placeholder="New co-admin username" {...field} />
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
                        <FormLabel>Password (for simulation)</FormLabel>
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
          {/* Logout button removed */}
        </CardContent>
      </Card>

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Co-Admin Accounts</CardTitle>
          <CardDescription>
            List of co-admin users. The Main Admin ({MAIN_ADMIN_USERNAME}) is not listed here and cannot be modified.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Username</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="text-center min-w-[250px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simulatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={user.isLocked ? "destructive" : "default"}>
                      {user.isLocked ? "Locked" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center space-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResetPassword(user.username)}
                        title={`Simulate Reset Password for ${user.username}`}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleLock(user.id)}
                        title={user.isLocked ? `Unlock ${user.username}` : `Lock ${user.username}`}
                    >
                      {user.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUserClick(user)}
                        title={`Delete ${user.username}`}
                        className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {simulatedUsers.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No co-admin users created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={(isOpen) => { if(!isOpen) setUserToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the co-admin user account for '{userToDelete?.username}'. This action cannot be undone from local storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} variant="destructive">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
