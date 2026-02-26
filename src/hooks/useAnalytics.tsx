import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';
import { subWeeks, format, startOfWeek, endOfWeek } from 'date-fns';

export interface AnalyticsDataPoint {
  date: string;
  effort: number;
  results: number;
  ratio: number;
}

export interface AnalyticsStats {
  avgEffort: number;
  avgResults: number;
  efficiencyRatio: number;
}

export const useAnalytics = (weeksBack: number = 8) => {
  const [chartData, setChartData] = useState<AnalyticsDataPoint[]>([]);
  const [stats, setStats] = useState<AnalyticsStats>({
    avgEffort: 0,
    avgResults: 0,
    efficiencyRatio: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = startOfWeek(subWeeks(new Date(), weeksBack));
      const endDate = endOfWeek(new Date());

      // Fetch project tasks data for effort tracking
      const { data: tasksData, error: tasksError } = await (supabase as any)
        .from('project_tasks')
        .select(`
          actual_hours,
          completed_at,
          created_at,
          status,
          projects (
            name,
            client_id,
            clients (
              name
            )
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (tasksError) throw tasksError;

      // Fetch AI agent runs for results tracking
      const { data: agentRuns, error: agentError } = await supabase
        .from('ai_agent_runs')
        .select(`
          created_at,
          status,
          ai_summary,
          generated_tasks
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (agentError) throw agentError;

      // Process data by week
      const weeklyData: { [key: string]: { effort: number; results: number; taskCount: number; agentRuns: number } } = {};

      // Initialize weeks
      for (let i = weeksBack - 1; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(new Date(), i));
        const weekKey = format(weekStart, 'MMM d');
        weeklyData[weekKey] = { effort: 0, results: 0, taskCount: 0, agentRuns: 0 };
      }

      // Aggregate task data
      tasksData?.forEach(task => {
        const taskDate = new Date(task.created_at);
        const weekStart = startOfWeek(taskDate);
        const weekKey = format(weekStart, 'MMM d');
        
        if (weeklyData[weekKey]) {
          weeklyData[weekKey].effort += task.actual_hours || 0;
          weeklyData[weekKey].taskCount += 1;
          
          // Add points for completed tasks
          if (task.status === 'completed') {
            weeklyData[weekKey].results += 20;
          } else if (task.status === 'in_progress') {
            weeklyData[weekKey].results += 10;
          }
        }
      });

      // Aggregate AI agent run data
      agentRuns?.forEach(run => {
        const runDate = new Date(run.created_at);
        const weekStart = startOfWeek(runDate);
        const weekKey = format(weekStart, 'MMM d');
        
        if (weeklyData[weekKey]) {
          weeklyData[weekKey].agentRuns += 1;
          
          // Add points for successful AI runs
          if (run.status === 'completed') {
            weeklyData[weekKey].results += 15;
            
            // Bonus points for generated tasks
            const tasksGenerated = Array.isArray(run.generated_tasks) ? run.generated_tasks.length : 0;
            weeklyData[weekKey].results += tasksGenerated * 5;
          }
        }
      });

      // Convert to chart format
      const chartPoints: AnalyticsDataPoint[] = Object.entries(weeklyData).map(([date, data]) => {
        const ratio = data.effort > 0 ? data.results / data.effort : 0;
        return {
          date,
          effort: Math.round(data.effort),
          results: Math.round(data.results),
          ratio: Math.round(ratio * 10) / 10
        };
      });

      setChartData(chartPoints);

      // Calculate overall statistics
      const totalEffort = chartPoints.reduce((sum, point) => sum + point.effort, 0);
      const totalResults = chartPoints.reduce((sum, point) => sum + point.results, 0);
      const avgEffort = totalEffort / chartPoints.length || 0;
      const avgResults = totalResults / chartPoints.length || 0;
      const efficiencyRatio = avgEffort > 0 ? avgResults / avgEffort : 0;

      setStats({
        avgEffort: Math.round(avgEffort),
        avgResults: Math.round(avgResults),
        efficiencyRatio: Math.round(efficiencyRatio * 10) / 10
      });

    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error fetching analytics",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchAnalyticsData();
  };

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user, weeksBack]);

  // Set up real-time subscriptions for task updates
  useEffect(() => {
    const tasksChannel = supabase
      .channel('tasks_analytics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_tasks'
        },
        () => {
          fetchAnalyticsData();
        }
      )
      .subscribe();

    const agentRunsChannel = supabase
      .channel('agent_runs_analytics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_agent_runs'
        },
        () => {
          fetchAnalyticsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(agentRunsChannel);
    };
  }, []);

  return {
    chartData,
    stats,
    loading,
    error,
    refreshData
  };
};