import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ReceivingItem } from '../entities/receiving-item.entity';
import { CycleCountTask } from '../cycle-count/cycle-count-task.entity';
import { CycleCountLine } from '../cycle-count/cycle-count-line.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { User } from '../entities/user.entity';
import { Team } from '../entities/team.entity';
import { TeamMember } from '../entities/team-member.entity';
import { SkartDocument } from '../skart/entities/skart-document.entity';
import { SkartItem } from '../skart/entities/skart-item.entity';
import { PovracajDocument } from '../povracaj/entities/povracaj-document.entity';
import { PovracajItem } from '../povracaj/entities/povracaj-item.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { ShippingOrderLine } from '../entities/shipping-order-line.entity';
import { Item } from '../entities/item.entity';

interface ReportFilters {
  from?: string;
  to?: string;
  workerId?: number;
  teamId?: number;
  taskType?: string;
  sku?: string;
  location?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReceivingDocument)
    private receivingDocRepo: Repository<ReceivingDocument>,
    @InjectRepository(ReceivingItem)
    private receivingItemRepo: Repository<ReceivingItem>,
    @InjectRepository(CycleCountTask)
    private cycleCountRepo: Repository<CycleCountTask>,
    @InjectRepository(CycleCountLine)
    private cycleCountLineRepo: Repository<CycleCountLine>,
    @InjectRepository(InventoryMovement)
    private movementRepo: Repository<InventoryMovement>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(SkartDocument)
    private skartDocRepo: Repository<SkartDocument>,
    @InjectRepository(SkartItem)
    private skartItemRepo: Repository<SkartItem>,
    @InjectRepository(PovracajDocument)
    private povracajDocRepo: Repository<PovracajDocument>,
    @InjectRepository(PovracajItem)
    private povracajItemRepo: Repository<PovracajItem>,
    @InjectRepository(ShippingOrder)
    private shippingOrderRepo: Repository<ShippingOrder>,
    @InjectRepository(ShippingOrderLine)
    private shippingLineRepo: Repository<ShippingOrderLine>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
  ) {}

  async getTaskHistory(filters: ReportFilters) {
    const tasks = [];

    // Build date filter
    const dateFilter: any = {};
    if (filters.from || filters.to) {
      const start = filters.from ? new Date(filters.from) : new Date('2020-01-01');
      const end = filters.to ? new Date(filters.to) : new Date();
      dateFilter.created_at = Between(start, end);
    }

    // Get receiving tasks
    const receivingDocs = await this.receivingDocRepo.find({
      where: {
        ...dateFilter,
        status: In(['completed']),
        ...(filters.workerId && { assigned_to: filters.workerId }),
      },
      relations: ['items', 'items.item', 'assignedUser', 'supplier'],
    });

    for (const doc of receivingDocs) {
      const items = await this.receivingItemRepo.find({
        where: { receiving_document_id: doc.id },
      });
      
      tasks.push({
        id: doc.id,
        date: doc.completed_at || doc.created_at,
        worker: doc.assignedUser?.full_name || doc.assignedUser?.username || 'N/A',
        worker_id: doc.assigned_to,
        team: null,
        task_type: 'RECEIVING',
        document_id: doc.document_number,
        items_count: items.length,
        quantity: items.reduce((sum, item) => sum + (item.received_quantity || 0), 0),
        duration: doc.completed_at && doc.started_at 
          ? Math.round((new Date(doc.completed_at).getTime() - new Date(doc.started_at).getTime()) / 60000)
          : null,
        details: {
          supplier: doc.supplier?.name || 'N/A',
          items: items.map(i => ({
            sku: i.item?.sku || 'N/A',
            name: i.item?.name || 'N/A',
            expected: i.expected_quantity,
            received: i.received_quantity,
            difference: (i.received_quantity || 0) - (i.expected_quantity || 0),
          })),
        },
      });
    }

    // Get cycle count tasks
    const cycleCounts = await this.cycleCountRepo.find({
      where: {
        ...dateFilter,
        status: 'COMPLETED',
        ...(filters.workerId && { assigned_to_user_id: filters.workerId }),
      },
      relations: [],
    });

    for (const task of cycleCounts) {
      const lines = await this.cycleCountLineRepo.find({
        where: { task_id: task.id },
      });

      const user = await this.userRepo.findOne({ where: { id: task.assigned_to_user_id } });
      
      tasks.push({
        id: task.id,
        date: task.updated_at || task.created_at,
        worker: user?.full_name || user?.username || 'N/A',
        worker_id: task.assigned_to_user_id,
        team: null,
        task_type: 'CYCLE_COUNT',
        document_id: `CC-${task.id}`,
        items_count: lines.length,
        quantity: lines.reduce((sum, line) => sum + parseFloat(line.counted_qty || '0'), 0),
        duration: null,
        details: {
          location: task.target_code,
          lines: lines.map(l => ({
            sku: 'N/A',
            expected: parseFloat(l.system_qty),
            counted: parseFloat(l.counted_qty || '0'),
            difference: parseFloat(l.counted_qty || '0') - parseFloat(l.system_qty),
          })),
        },
      });
    }

    // Get SKART tasks
    const skartDocs = await this.skartDocRepo.find({
      where: {
        ...dateFilter,
        status: In(['RECEIVED']),
        ...(filters.workerId && { created_by: filters.workerId }),
      },
      relations: ['store'],
    });

    for (const doc of skartDocs) {
      const user = await this.userRepo.findOne({ where: { id: doc.created_by } });
      const items = await this.skartItemRepo.find({
        where: { document_id: doc.id },
      });

      tasks.push({
        id: doc.id,
        date: doc.received_at || doc.created_at,
        worker: user?.full_name || user?.username || 'N/A',
        worker_id: doc.created_by,
        team: null,
        task_type: 'SKART',
        document_id: doc.uid,
        items_count: items.length,
        quantity: items.reduce((sum, item) => sum + parseFloat(item.qty || '0'), 0),
        duration: null,
        details: {
          store: doc.store?.name || 'N/A',
          items: items.map(i => ({
            sku: i.code,
            name: i.name,
            quantity: parseFloat(i.qty),
            reason: i.reason,
          })),
        },
      });
    }

    // Get Povracaj tasks
    const povracajDocs = await this.povracajDocRepo.find({
      where: {
        ...dateFilter,
        status: In(['RECEIVED']),
        ...(filters.workerId && { created_by: filters.workerId }),
      },
      relations: ['store'],
    });

    for (const doc of povracajDocs) {
      const user = await this.userRepo.findOne({ where: { id: doc.created_by } });
      const items = await this.povracajItemRepo.find({
        where: { document_id: doc.id },
      });

      tasks.push({
        id: doc.id,
        date: doc.received_at || doc.created_at,
        worker: user?.full_name || user?.username || 'N/A',
        worker_id: doc.created_by,
        team: null,
        task_type: 'POVRACAJ',
        document_id: doc.uid,
        items_count: items.length,
        quantity: items.reduce((sum, item) => sum + parseFloat(item.qty || '0'), 0),
        duration: null,
        details: {
          store: doc.store?.name || 'N/A',
          items: items.map(i => ({
            sku: i.code,
            name: i.name,
            quantity: parseFloat(i.qty),
          })),
        },
      });
    }

    // Get Shipping tasks
    const shippingDateFilter: any = {};
    if (filters.from || filters.to) {
      const start = filters.from ? new Date(filters.from) : new Date('2020-01-01');
      const end = filters.to ? new Date(filters.to) : new Date();
      // For shipping, filter by completion date, not creation date
      shippingDateFilter.completed_at = Between(start, end);
    }

    const shippingOrders = await this.shippingOrderRepo.find({
      where: {
        ...shippingDateFilter,
        status: In(['COMPLETED', 'CLOSED']),
        ...(filters.workerId && { assigned_user_id: filters.workerId }),
      },
      relations: ['assigned_user', 'assigned_team', 'lines', 'lines.item'],
    });

    for (const order of shippingOrders) {
      tasks.push({
        id: order.id,
        date: order.completed_at || order.loaded_at || order.created_at,
        worker: order.assigned_user?.full_name || order.assigned_user?.username || 'N/A',
        worker_id: order.assigned_user_id,
        team: order.assigned_team?.name || null,
        task_type: 'SHIPPING',
        document_id: order.order_number,
        items_count: order.lines.length,
        quantity: order.lines.reduce((sum, line) => sum + parseFloat(line.picked_qty || '0'), 0),
        duration: order.completed_at && order.started_at 
          ? Math.round((new Date(order.completed_at).getTime() - new Date(order.started_at).getTime()) / 60000)
          : null,
        details: {
          customer: order.customer_name,
          store: order.store_name || 'N/A',
          status: order.status,
          items: order.lines.map(l => ({
            sku: l.item?.sku || 'N/A',
            name: l.item?.name || 'N/A',
            requested: parseFloat(l.requested_qty),
            picked: parseFloat(l.picked_qty || '0'),
            difference: parseFloat(l.picked_qty || '0') - parseFloat(l.requested_qty),
          })),
        },
      });
    }

    // Sort by date descending
    tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply additional filters
    let filtered = tasks;
    if (filters.taskType && filters.taskType !== 'ALL') {
      filtered = filtered.filter(t => t.task_type === filters.taskType);
    }
    if (filters.sku) {
      filtered = filtered.filter(t => 
        JSON.stringify(t.details).toLowerCase().includes(filters.sku.toLowerCase())
      );
    }
    if (filters.location) {
      filtered = filtered.filter(t =>
        JSON.stringify(t.details).toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    return filtered;
  }

  async getWorkersSummary(filters: Pick<ReportFilters, 'from' | 'to'>) {
    const tasks = await this.getTaskHistory(filters);
    const workerMap = new Map<number, any>();

    for (const task of tasks) {
      if (!task.worker_id) continue;

      if (!workerMap.has(task.worker_id)) {
        workerMap.set(task.worker_id, {
          worker_id: task.worker_id,
          worker_name: task.worker,
          tasks_completed: 0,
          lines_processed: 0,
          total_quantity: 0,
          total_active_time: 0,
        });
      }

      const summary = workerMap.get(task.worker_id);
      summary.tasks_completed++;
      summary.lines_processed += task.items_count || 0;
      summary.total_quantity += task.quantity || 0;
      summary.total_active_time += task.duration || 0;
    }

    return Array.from(workerMap.values()).sort((a, b) => b.tasks_completed - a.tasks_completed);
  }

  async getTeamsSummary(filters: Pick<ReportFilters, 'from' | 'to'>) {
    const tasks = await this.getTaskHistory(filters);
    const teams = await this.teamRepo.find();
    const teamMembers = await this.teamMemberRepo.find();

    const teamMap = new Map<number, any>();

    // Initialize teams
    for (const team of teams) {
      teamMap.set(team.id, {
        team_id: team.id,
        team_name: team.name,
        tasks_completed: 0,
        lines_processed: 0,
        total_quantity: 0,
        time_spent: 0,
        members: teamMembers.filter(m => m.team_id === team.id).map(m => m.user_id),
      });
    }

    // Aggregate tasks by team
    for (const task of tasks) {
      if (!task.worker_id) continue;

      for (const [teamId, summary] of teamMap.entries()) {
        if (summary.members.includes(task.worker_id)) {
          summary.tasks_completed++;
          summary.lines_processed += task.items_count || 0;
          summary.total_quantity += task.quantity || 0;
          summary.time_spent += task.duration || 0;
        }
      }
    }

    return Array.from(teamMap.values())
      .filter(t => t.tasks_completed > 0)
      .sort((a, b) => b.tasks_completed - a.tasks_completed);
  }

  async generateExcelReport(filters: Pick<ReportFilters, 'from' | 'to'>) {
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'Alta WMS';
    workbook.created = new Date();

    // Sheet 1: Tasks
    const tasksSheet = workbook.addWorksheet('Tasks');
    tasksSheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Worker', key: 'worker', width: 25 },
      { header: 'Task Type', key: 'task_type', width: 15 },
      { header: 'Document ID', key: 'document_id', width: 20 },
      { header: 'Items Count', key: 'items_count', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Duration (min)', key: 'duration', width: 15 },
    ];

    const tasks = await this.getTaskHistory(filters);
    tasks.forEach(task => {
      tasksSheet.addRow({
        date: task.date,
        worker: task.worker,
        task_type: task.task_type,
        document_id: task.document_id,
        items_count: task.items_count,
        quantity: task.quantity,
        duration: task.duration,
      });
    });

    // Style header
    tasksSheet.getRow(1).font = { bold: true };
    tasksSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E9F7' },
    };

    // Sheet 2: Workers Summary
    const workersSheet = workbook.addWorksheet('Workers Summary');
    workersSheet.columns = [
      { header: 'Worker', key: 'worker_name', width: 25 },
      { header: 'Tasks Completed', key: 'tasks_completed', width: 15 },
      { header: 'Lines Processed', key: 'lines_processed', width: 15 },
      { header: 'Total Quantity', key: 'total_quantity', width: 15 },
      { header: 'Total Active Time (min)', key: 'total_active_time', width: 20 },
    ];

    const workers = await this.getWorkersSummary(filters);
    workers.forEach(worker => {
      workersSheet.addRow(worker);
    });

    workersSheet.getRow(1).font = { bold: true };
    workersSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E9F7' },
    };

    // Sheet 3: Teams Summary
    const teamsSheet = workbook.addWorksheet('Teams Summary');
    teamsSheet.columns = [
      { header: 'Team', key: 'team_name', width: 25 },
      { header: 'Tasks Completed', key: 'tasks_completed', width: 15 },
      { header: 'Lines Processed', key: 'lines_processed', width: 15 },
      { header: 'Total Quantity', key: 'total_quantity', width: 15 },
      { header: 'Time Spent (min)', key: 'time_spent', width: 20 },
    ];

    const teamsData = await this.getTeamsSummary(filters);
    teamsData.forEach(team => {
      teamsSheet.addRow(team);
    });

    teamsSheet.getRow(1).font = { bold: true };
    teamsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E9F7' },
    };

    // Sheet 4: Inventory Movements
    const movementsSheet = workbook.addWorksheet('Inventory Movements');
    movementsSheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'From Location', key: 'from_location', width: 15 },
      { header: 'To Location', key: 'to_location', width: 15 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'User', key: 'user', width: 25 },
    ];

    const dateFilter: any = {};
    if (filters.from || filters.to) {
      const start = filters.from ? new Date(filters.from) : new Date('2020-01-01');
      const end = filters.to ? new Date(filters.to) : new Date();
      dateFilter.created_at = Between(start, end);
    }

    const movements = await this.movementRepo.find({
      where: dateFilter,
      relations: [],
      order: { created_at: 'DESC' },
      take: 10000,
    });

    for (const mov of movements) {
      const user = await this.userRepo.findOne({ where: { id: mov.created_by } });
      movementsSheet.addRow({
        date: mov.created_at,
        sku: 'N/A',
        from_location: mov.from_location_id,
        to_location: mov.to_location_id,
        quantity: parseFloat(mov.quantity_change.toString()),
        type: mov.reason,
        user: user?.full_name || user?.username || 'System',
      });
    }

    movementsSheet.getRow(1).font = { bold: true };
    movementsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E9F7' },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}
