
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
import { UserPlus, LogOut, Trash2, Lock, Unlock, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

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

const SIMULATED_USERS_STORAGE_KEY = "novita_simulated_users_v1";
const MAIN_ADMIN_USERNAME = "asingh0402";

export default function UserManagementPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = React.useState(false);
  const [simulatedUsers, setSimulatedUsers] = React.useState<SimulatedUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userToDelete, setUserToDelete] = React.useState<SimulatedUser | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      let usersToSet: SimulatedUser[] = [];
      try {
        const storedUsers = localStorage.getItem(SIMULATED_USERS_STORAGE_KEY);
        if (storedUsers) {
          const parsedUsers: SimulatedUser[] = JSON.parse(storedUsers);
          // Filter out "Novita" if it exists from previous logic, or any other specific cleanup if needed
          const filteredUsers = parsedUsers.filter(user => user.username !== "Novita"); // Example: if 'Novita' was a temporary admin
          usersToSet = filteredUsers;
          
          if (filteredUsers.length < parsedUsers.length) {
            // If any user was filtered out, save the cleaned list back.
            localStorage.setItem(SIMULATED_USERS_STORAGE_KEY, JSON.stringify(filteredUsers));
          }
        }
      } catch (error) {
        console.error("Error loading/processing simulated users from localStorage:", error);
        toast({ 
            title: "Data Load Error", 
            description: "Could not load user list. Stored data might be corrupted.", 
            variant: "destructive",
            duration: 7000,
        });
        // Do not delete the key, just fall back to empty if parsing fails.
      }
      setSimulatedUsers(usersToSet);
    }
    setIsLoading(false);
  }, [toast]);

  const saveSimulatedUsersToLocalStorage = (users: SimulatedUser[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SIMULATED_USERS_STORAGE_KEY, JSON.stringify(users));
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
        description: `A user with the username '${values.username}' already exists.`,
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

    toast({
      title: "Simulated Co-Admin User Added",
      description: `User '${values.username}' has been added to the list. This user can now 'log in' via the main login page if not locked.`,
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

  const handleToggleLock = (userId: string) => {
    const updatedUsers = simulatedUsers.map(user =>
      user.id === userId ? { ...user, isLocked: !user.isLocked } : user
    );
    setSimulatedUsers(updatedUsers);
    saveSimulatedUsersToLocalStorage(updatedUsers);
    const user = updatedUsers.find(u => u.id === userId);
    toast({
      title: "User Status Changed",
      description: `User '${user?.username}' has been ${user?.isLocked ? 'locked' : 'unlocked'}.`,
    });
  };

  const handleDeleteUserClick = (user: SimulatedUser) => {
    setUserToDelete(user);
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    const updatedUsers = simulatedUsers.filter(user => user.id !== userToDelete.id);
    setSimulatedUsers(updatedUsers);
    saveSimulatedUsersToLocalStorage(updatedUsers);
    toast({
      title: "User Deleted",
      description: `Simulated user '${userToDelete.username}' has been deleted.`,
      variant: "destructive",
    });
    setUserToDelete(null);
  };

  const handleResetPassword = (username: string) => {
    toast({
      title: "Prototype Action",
      description: `Password reset for user '${username}' is a simulated action. In a real system, this would trigger a reset flow. Passwords for simulated users are not stored.`,
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
        description={`Manage simulated co-admin accounts. Main Admin: ${MAIN_ADMIN_USERNAME} (Not manageable here).`}
      />
      <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Account Controls</CardTitle>
          <CardDescription>
            Create new simulated co-admin users or log out.
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
                <DialogTitle>Create New Simulated Co-Admin</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new co-admin user. This user will be able to 'log in' if not locked.
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

          <Button onClick={handleLogout} variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-md hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Simulated Co-Admin Accounts</CardTitle>
          <CardDescription>
            List of simulated co-admin users. The Main Admin ({MAIN_ADMIN_USERNAME}) is not listed here and cannot be modified.
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
                        disabled={user.username === MAIN_ADMIN_USERNAME} // Should not be necessary as main admin not listed
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleToggleLock(user.id)} 
                        title={user.isLocked ? `Unlock ${user.username}` : `Lock ${user.username}`}
                        disabled={user.username === MAIN_ADMIN_USERNAME}
                    >
                      {user.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteUserClick(user)} 
                        title={`Delete ${user.username}`} 
                        className="text-destructive hover:text-destructive/80"
                        disabled={user.username === MAIN_ADMIN_USERNAME}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {simulatedUsers.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No simulated co-admin users created yet.
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
              This will permanently delete the simulated user account for '{userToDelete?.username}'. This action cannot be undone.
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

