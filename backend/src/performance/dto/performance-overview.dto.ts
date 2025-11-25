export interface WorkerSplitDto {
  box_assigned: number;
  box_completed: number;
  items_assigned: number;
  items_completed: number;
}

export interface PerformanceWorkerDto {
  name: string;
  team: string;
  shift?: string | null;
  user_id?: number;
  active_team_task_id?: number | null;
  team_members?: string[];
  receiving: WorkerSplitDto;
  shipping: WorkerSplitDto;
}

export interface PerformanceTeamDto {
  team: string; // e.g., CD, ForkLift
  team_id?: number;
  members_names?: string[];
  receiving?: WorkerSplitDto;
  shipping?: WorkerSplitDto;
  box_assigned?: number;
  box_completed?: number;
  invoices_completed?: number;
  sku_completed?: number;
  putaway?: number;
  replenishment?: number;
  full_palets?: number;
  total_palets?: number;
}

export interface PerformanceOverviewDto {
  workers: PerformanceWorkerDto[];
  teams: PerformanceTeamDto[];
  refresh_interval: number; // seconds
  server_time: string; // ISO
}
