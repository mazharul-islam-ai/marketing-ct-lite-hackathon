import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ImageIcon,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Shield,
  Clock,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SafetyAppealQueue } from "@/components/image-ai/admin/SafetyAppealQueue";

interface DailyStats {
  date: string;
  total_generations: number;
  successful_generations: number;
  failed_generations: number;
  blocked_generations: number;
  total_cost_cents: number;
  unique_users: number;
}

interface TopUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  total_generations: number;
  successful_generations: number;
  total_cost_cents: number;
}

interface StatCard {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: number;
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];

export default function ImageAnalyticsDashboard() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalGenerations: 0,
    successRate: 0,
    totalCost: 0,
    uniqueUsers: 0,
    pendingAppeals: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch daily stats from view
      const { data: statsData } = await supabase
        .from("image_stats_summary")
        .select("*")
        .order("date", { ascending: false })
        .limit(30);

      if (statsData) {
        setDailyStats(statsData.reverse() as DailyStats[]);

        // Calculate summary
        const totals = statsData.reduce(
          (acc, day) => ({
            generations: acc.generations + (day.total_generations || 0),
            successful: acc.successful + (day.successful_generations || 0),
            cost: acc.cost + parseFloat(String(day.total_cost_cents || 0)),
            users: acc.users + (day.unique_users || 0),
          }),
          { generations: 0, successful: 0, cost: 0, users: 0 }
        );

        setSummaryStats((prev) => ({
          ...prev,
          totalGenerations: totals.generations,
          successRate: totals.generations > 0 ? (totals.successful / totals.generations) * 100 : 0,
          totalCost: totals.cost / 100, // Convert cents to dollars
        }));
      }

      // Fetch top users
      const { data: usersData } = await supabase
        .from("image_top_users")
        .select("*")
        .limit(10);

      if (usersData) {
        setTopUsers(usersData as TopUser[]);
        // Count unique users
        setSummaryStats((prev) => ({
          ...prev,
          uniqueUsers: usersData.length,
        }));
      }

      // Fetch pending appeals count
      const { count: appealsCount } = await supabase
        .from("image_safety_blocks")
        .select("*", { count: "exact", head: true })
        .eq("admin_status", "pending");

      setSummaryStats((prev) => ({
        ...prev,
        pendingAppeals: appealsCount || 0,
      }));
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards: StatCard[] = [
    {
      title: "Total Generations",
      value: summaryStats.totalGenerations.toLocaleString(),
      description: "Last 30 days",
      icon: <ImageIcon className="w-5 h-5" />,
    },
    {
      title: "Success Rate",
      value: `${summaryStats.successRate.toFixed(1)}%`,
      description: "Completed / Total",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      title: "Total Cost",
      value: `$${summaryStats.totalCost.toFixed(2)}`,
      description: "Last 30 days",
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      title: "Active Users",
      value: summaryStats.uniqueUsers,
      description: "Using image generation",
      icon: <Users className="w-5 h-5" />,
    },
    {
      title: "Pending Appeals",
      value: summaryStats.pendingAppeals,
      description: "Awaiting review",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
  ];

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ImageIcon className="w-8 h-8" />
            Image Generation Analytics
          </h1>
          <p className="text-muted-foreground">
            Monitor usage, costs, and safety compliance
          </p>
        </div>
        <Button onClick={fetchAnalytics} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {statCards.map((card, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className="text-muted-foreground">{card.icon}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Top Users</TabsTrigger>
          <TabsTrigger value="safety">
            Safety & Appeals
            {summaryStats.pendingAppeals > 0 && (
              <Badge variant="destructive" className="ml-2">
                {summaryStats.pendingAppeals}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Generations Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Generations</CardTitle>
                <CardDescription>Success vs Failed over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="successful_generations" name="Successful" fill="#10b981" stackId="a" />
                      <Bar dataKey="failed_generations" name="Failed" fill="#ef4444" stackId="a" />
                      <Bar dataKey="blocked_generations" name="Blocked" fill="#f59e0b" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cost Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Cost</CardTitle>
                <CardDescription>Cost in dollars per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      />
                      <YAxis tickFormatter={(value) => `$${(value / 100).toFixed(2)}`} />
                      <Tooltip formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, "Cost"]} />
                      <Line
                        type="monotone"
                        dataKey="total_cost_cents"
                        name="Cost"
                        stroke="#6366f1"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Generation Status Distribution</CardTitle>
                <CardDescription>Breakdown of outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Successful", value: dailyStats.reduce((a, b) => a + (b.successful_generations || 0), 0) },
                          { name: "Failed", value: dailyStats.reduce((a, b) => a + (b.failed_generations || 0), 0) },
                          { name: "Blocked", value: dailyStats.reduce((a, b) => a + (b.blocked_generations || 0), 0) },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Daily Stats</CardTitle>
                <CardDescription>Last 7 days breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Success</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyStats.slice(-7).reverse().map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>
                          {new Date(day.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {day.total_generations}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600">
                            {day.successful_generations}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          ${(parseFloat(String(day.total_cost_cents || 0)) / 100).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Top Users by Generation Count</CardTitle>
              <CardDescription>Most active users in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Successful</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers.map((user) => {
                    const successRate = user.total_generations > 0
                      ? ((user.successful_generations / user.total_generations) * 100).toFixed(1)
                      : "0.0";
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.full_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{user.total_generations}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {user.successful_generations}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={parseFloat(successRate) >= 80 ? "default" : "secondary"}>
                            {successRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ${(parseFloat(String(user.total_cost_cents || 0)) / 100).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Safety Tab */}
        <TabsContent value="safety">
          <SafetyAppealQueue />
        </TabsContent>
      </Tabs>
    </div>
  );
}
