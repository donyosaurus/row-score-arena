import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, Trophy, Shield, Download, Settings } from "lucide-react";
import { toast } from "sonner";

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);
  const [complianceLogs, setComplianceLogs] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<any>({});

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        navigate("/login");
        return;
      }

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) {
        toast.error("Access denied - Admin privileges required");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      loadDashboardData();
    };

    checkAdminStatus();
  }, [user, navigate]);

  const loadDashboardData = async () => {
    try {
      // Load feature flags
      const { data: flagsData } = await supabase
        .from("feature_flags")
        .select("key, value");
      
      const flags = (flagsData || []).reduce((acc: any, flag: any) => {
        acc[flag.key] = flag.value;
        return acc;
      }, {});
      setFeatureFlags(flags);

      // Load users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, username, email, state, date_of_birth, age_confirmed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      // Load user wallets for balance info
      const { data: walletsData } = await supabase
        .from("wallets")
        .select("user_id, available_balance");

      const usersWithBalance = usersData?.map(u => ({
        ...u,
        balance: walletsData?.find(w => w.user_id === u.id)?.available_balance || 0
      })) || [];

      setUsers(usersWithBalance);

      // Load recent transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*, profiles!inner(username)")
        .order("created_at", { ascending: false })
        .limit(100);

      setTransactions(txData || []);

      // Load contest pools
      const { data: poolsData } = await supabase
        .from("contest_pools")
        .select("*, contest_templates!inner(regatta_name)")
        .order("created_at", { ascending: false })
        .limit(50);

      setContests(poolsData || []);

      // Load compliance logs
      const { data: logsData } = await supabase
        .from("compliance_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      setComplianceLogs(logsData || []);

      setLoading(false);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
      setLoading(false);
    }
  };

  const exportComplianceLogs = async () => {
    try {
      const { data } = await supabase
        .from("compliance_audit_logs")
        .select("*")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-logs-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Compliance logs exported successfully");
    } catch (error) {
      console.error("Error exporting logs:", error);
      toast.error("Failed to export logs");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading admin dashboard...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 gradient-subtle py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage users, transactions, contests, and compliance</p>
          </div>

          {/* Feature Flags Badge */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>System Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Real Money:</span>
                  <Badge variant={featureFlags.real_money_enabled?.enabled ? "default" : "secondary"}>
                    {featureFlags.real_money_enabled?.enabled ? "ON" : "OFF"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Regulated Mode:</span>
                  <Badge variant={featureFlags.regulated_mode?.enabled ? "default" : "secondary"}>
                    {featureFlags.regulated_mode?.enabled ? "ON" : "OFF"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">IP Verification:</span>
                  <Badge variant={featureFlags.ipbase_enabled?.enabled ? "default" : "secondary"}>
                    {featureFlags.ipbase_enabled?.enabled ? "ON" : "OFF"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Payment Provider:</span>
                  <Badge variant="outline">
                    {featureFlags.payments_provider?.name || "mock"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transactions.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Contests</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {contests.filter(c => c.status === "open" || c.status === "locked").length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Compliance Events</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{complianceLogs.length}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="contests">Contests</TabsTrigger>
              <TabsTrigger value="compliance">Compliance Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View and manage user accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Username</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">State</th>
                          <th className="text-left p-2">Age Verified</th>
                          <th className="text-right p-2">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">{user.username || "N/A"}</td>
                            <td className="p-2">{user.email}</td>
                            <td className="p-2">{user.state || "Unknown"}</td>
                            <td className="p-2">
                              {user.age_confirmed_at ? (
                                <span className="text-green-600">✓ Verified</span>
                              ) : (
                                <span className="text-yellow-600">Pending</span>
                              )}
                            </td>
                            <td className="text-right p-2">${Number(user.balance).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>View all platform transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">User</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-right p-2">Amount</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-2">{tx.profiles?.username || "N/A"}</td>
                            <td className="p-2 capitalize">{tx.type.replace("_", " ")}</td>
                            <td className="text-right p-2">
                              ${Math.abs(Number(tx.amount)).toFixed(2)}
                            </td>
                            <td className="p-2 capitalize">{tx.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contests" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Contest Management</CardTitle>
                  <CardDescription>Manage contest pools and entries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Regatta</th>
                          <th className="text-left p-2">Entry Fee</th>
                          <th className="text-left p-2">Entries</th>
                          <th className="text-left p-2">Prize Pool</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contests.map((contest) => (
                          <tr key={contest.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">{contest.contest_templates?.regatta_name}</td>
                            <td className="p-2">${(contest.entry_fee_cents / 100).toFixed(2)}</td>
                            <td className="p-2">
                              {contest.current_entries} / {contest.max_entries}
                            </td>
                            <td className="p-2">${(contest.prize_pool_cents / 100).toFixed(2)}</td>
                            <td className="p-2 capitalize">{contest.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Compliance Audit Logs</CardTitle>
                    <CardDescription>Monitor compliance events and violations</CardDescription>
                  </div>
                  <Button onClick={exportComplianceLogs} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export Logs
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Timestamp</th>
                          <th className="text-left p-2">Event Type</th>
                          <th className="text-left p-2">Severity</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-left p-2">State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {complianceLogs.map((log) => (
                          <tr key={log.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="p-2 capitalize">{log.event_type.replace("_", " ")}</td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  log.severity === "error"
                                    ? "bg-red-100 text-red-800"
                                    : log.severity === "warn"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {log.severity}
                              </span>
                            </td>
                            <td className="p-2 text-sm">{log.description}</td>
                            <td className="p-2">{log.state_code || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Admin;
