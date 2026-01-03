"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
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
import { 
  UserPlus, 
  Trash2, 
  Lock, 
  Unlock, 
  KeyRound, 
  Loader2, 
  LogOut,
  Users,
  Shield,
  Sparkles,
  UserCog
} from "lucide-react";
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

const LOCAL_STORAGE_SIMULATED_USERS_KEY = "catura_simulated_users_v1";
const MAIN_ADMIN_USERNAME = "asingh0402";
const MAIN_ADMIN_DISPLAY_NAME = "Ajay Singh";
const LOGGED_IN_STATUS_KEY = "catura_logged_in_status_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "catura_recent_activities_v1";

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
        const storedUsers = localStorage.getItem(LOCAL_STORAGE_SIMULATED_USERS_KEY);
        if (storedUsers) {
          const parsedUsers: SimulatedUser[] = JSON.parse(storedUsers);
          if (Array.isArray(parsedUsers)) {
            usersToSet = parsedUsers;
          } else {
            console.warn("Simulated users data in localStorage is corrupted. Initializing empty.");
            toast({ title: "Data Error", description: "Stored user list is corrupted. Using empty list.", variant: "destructive", duration: 7000 });
          }
        }
      } catch (error) {
        console.error("Error loading/processing simulated users from localStorage:", error);
        toast({
          title: "Data Load Error",
          description: "Could not load user list. Stored data might be corrupted. Using empty list. Data is saved locally in your browser.",
          variant: "destructive",
          duration: 7000,
        });
      }
      setSimulatedUsers(usersToSet);
    }
    setIsLoading(false);
  }, [toast]);

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
        description: `Username '${MAIN_ADMIN_USERNAME}' is reserved for the Main Admin (${MAIN_ADMIN_DISPLAY_NAME}).`,
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
      description: `User '${values.username}' has been added.`,
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
      description: `Password reset for user '${username}' is a simulated action.`,
    });
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOGGED_IN_STATUS_KEY);
    }
    addActivityLog('User logged out.');
    router.replace('/login');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)] bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-xl opacity-30 animate-pulse"></div>
            <Loader2 className="h-16 w-16 animate-spin text-violet-600 relative" />
          </div>
          <p className="text-lg font-medium bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Loading Users...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-fuchsia-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-200/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 p-6 space-y-8">
        {/* Enhanced Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-violet-500/5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-500" />
                Main Admin: <span className="font-semibold text-violet-600">{MAIN_ADMIN_DISPLAY_NAME}</span> 
                <span className="text-slate-400">({MAIN_ADMIN_USERNAME})</span>
              </p>
            </div>
          </div>
          <Button 
            onClick={handleLogout} 
            className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-500/25 border-0 transition-all duration-300 hover:scale-105"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-xl shadow-violet-500/25">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold mt-1">{simulatedUsers.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/25">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Active Users</p>
                <p className="text-3xl font-bold mt-1">{simulatedUsers.filter(u => !u.isLocked).length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Unlock className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-500/25">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Locked Users</p>
                <p className="text-3xl font-bold mt-1">{simulatedUsers.filter(u => u.isLocked).length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Lock className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account Controls Card */}
          <div className="lg:col-span-1">
            <Card className="overflow-hidden border-0 shadow-2xl shadow-violet-500/10 bg-white/80 backdrop-blur-xl">
              <div className="h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"></div>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100">
                    <UserCog className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-slate-800">Account Controls</CardTitle>
                    <CardDescription className="text-slate-500">
                      Create and manage co-admin users
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <Dialog open={isCreateUserDialogOpen} onOpenChange={(isOpen) => {
                  setIsCreateUserDialogOpen(isOpen);
                  if (!isOpen) form.reset();
                }}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/30 border-0 h-12 text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
                      <UserPlus className="mr-2 h-5 w-5" />
                      Create New Co-Admin
                      <Sparkles className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[450px] border-0 shadow-2xl bg-white/95 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-lg"></div>
                    <DialogHeader className="pt-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
                          <UserPlus className="h-5 w-5 text-white" />
                        </div>
                        <DialogTitle className="text-xl bg-gradient-to-r from-violet-700 to-fuchsia-700 bg-clip-text text-transparent">
                          Create New Co-Admin
                        </DialogTitle>
                      </div>
                      <DialogDescription className="text-slate-500">
                        Fill in the details for the new co-admin user account.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleCreateUserSubmit)} className="space-y-5 py-4">
                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">Username</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter username" 
                                  className="h-11 border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage className="text-rose-500" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-medium">Password</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="Enter password" 
                                  className="h-11 border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage className="text-rose-500" />
                            </FormItem>
                          )}
                        />
                        <DialogFooter className="gap-2 pt-4">
                          <DialogClose asChild>
                            <Button type="button" variant="outline" className="border-slate-200 hover:bg-slate-50">
                              Cancel
                            </Button>
                          </DialogClose>
                          <Button 
                            type="submit"
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/25"
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Create User
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                {/* Quick Info */}
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100">
                  <h4 className="font-semibold text-violet-700 text-sm mb-2">Quick Tips</h4>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-violet-500 mt-0.5">•</span>
                      Usernames must be unique
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-fuchsia-500 mt-0.5">•</span>
                      Password minimum 6 characters
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5">•</span>
                      Lock users to restrict access
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table Card */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden border-0 shadow-2xl shadow-violet-500/10 bg-white/80 backdrop-blur-xl">
              <div className="h-2 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-violet-500"></div>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-fuchsia-100 to-violet-100">
                      <Users className="h-5 w-5 text-fuchsia-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-slate-800">Co-Admin Accounts</CardTitle>
                      <CardDescription className="text-slate-500">
                        Manage user access and permissions
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-0 px-3 py-1">
                    {simulatedUsers.length} Users
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-50 to-violet-50/50 border-y border-slate-100">
                        <TableHead className="font-semibold text-slate-700 min-w-[180px]">Username</TableHead>
                        <TableHead className="font-semibold text-slate-700 min-w-[120px]">Status</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center min-w-[200px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulatedUsers.map((user, index) => (
                        <TableRow 
                          key={user.id}
                          className="hover:bg-violet-50/50 transition-colors border-b border-slate-100"
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${
                                index % 4 === 0 ? 'bg-gradient-to-br from-violet-500 to-purple-600' :
                                index % 4 === 1 ? 'bg-gradient-to-br from-fuchsia-500 to-pink-600' :
                                index % 4 === 2 ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
                                'bg-gradient-to-br from-emerald-500 to-teal-600'
                              }`}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{user.username}</p>
                                <p className="text-xs text-slate-400">Co-Admin</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={`font-medium px-3 py-1 border-0 ${
                                user.isLocked 
                                  ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30' 
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                              }`}
                            >
                              {user.isLocked ? (
                                <><Lock className="mr-1 h-3 w-3" /> Locked</>
                              ) : (
                                <><Unlock className="mr-1 h-3 w-3" /> Active</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResetPassword(user.username)}
                                title={`Reset Password for ${user.username}`}
                                className="h-9 w-9 rounded-xl hover:bg-amber-100 text-amber-600 hover:text-amber-700 transition-all hover:scale-110"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleLock(user.id)}
                                title={user.isLocked ? `Unlock ${user.username}` : `Lock ${user.username}`}
                                className={`h-9 w-9 rounded-xl transition-all hover:scale-110 ${
                                  user.isLocked 
                                    ? 'hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700' 
                                    : 'hover:bg-violet-100 text-violet-600 hover:text-violet-700'
                                }`}
                              >
                                {user.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUserClick(user)}
                                title={`Delete ${user.username}`}
                                className="h-9 w-9 rounded-xl hover:bg-rose-100 text-rose-500 hover:text-rose-600 transition-all hover:scale-110"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {simulatedUsers.length === 0 && !isLoading && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-16">
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 mb-4">
                                <Users className="h-10 w-10 text-violet-400" />
                              </div>
                              <p className="text-slate-600 font-medium">No co-admin users yet</p>
                              <p className="text-sm text-slate-400 mt-1">Create your first user to get started</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(isOpen) => { if(!isOpen) setUserToDelete(null); }}>
        <AlertDialogContent className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 rounded-t-lg"></div>
          <AlertDialogHeader className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-lg">
                <Trash2 className="h-5 w-5 text-white" />
              </div>
              <AlertDialogTitle className="text-xl text-slate-800">Delete User Account?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-500 leading-relaxed">
              This will permanently delete the co-admin account for{' '}
              <span className="font-semibold text-rose-600">'{userToDelete?.username}'</span>. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-4">
            <AlertDialogCancel 
              onClick={() => setUserToDelete(null)}
              className="border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteUser}
              className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-500/25 border-0"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}