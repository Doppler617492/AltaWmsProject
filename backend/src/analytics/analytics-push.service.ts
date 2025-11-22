import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TaskAssignee } from '../entities/task-assignee.entity';
import { TaskAssignmentInfo } from '../entities/task-assignment-info.entity';
import { ReceivingDocument } from '../entities/receiving-document.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';
import { PutawayTask } from '../entities/putaway-task.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AnalyticsPushService {
  private url = process.env.ANALYTICS_PUSH_URL || '';
  private lastPushAt: Date | null = null;
  private lastError: string | null = null;
  constructor(
    @InjectRepository(TaskAssignee) private readonly assignRepo: Repository<TaskAssignee>,
    @InjectRepository(TaskAssignmentInfo) private readonly infoRepo: Repository<TaskAssignmentInfo>,
    @InjectRepository(ReceivingDocument) private readonly docRepo: Repository<ReceivingDocument>,
    @InjectRepository(ShippingOrder) private readonly shipRepo: Repository<ShippingOrder>,
    @InjectRepository(PutawayTask) private readonly putRepo: Repository<PutawayTask>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async pushAssigneeRow(assigneeId: number) {
    if (!this.url) return; // disabled
    try {
      const a = await this.assignRepo.findOne({ where: { id: assigneeId } as any });
      if (!a) return;
      const info = await this.infoRepo.findOne({ where: { task_type: a.task_type as any, task_id: a.task_id } as any });
      const user = await this.userRepo.findOne({ where: { id: a.user_id } });
      // Prepare dataset row matching a sensible Power BI schema
      const now = new Date();
      const row: any = {
        assignee_id: a.id,
        task_type: a.task_type,
        task_id: a.task_id,
        user_id: a.user_id,
        user_name: (user as any)?.name || (user as any)?.username || String(a.user_id),
        status: (a as any).status,
        started_at: a.started_at,
        completed_at: a.completed_at,
        duration_seconds: a.started_at && a.completed_at ? Math.max(0, Math.floor((new Date(a.completed_at).getTime() - new Date(a.started_at).getTime())/1000)) : null,
        policy: info?.policy || null,
        team_id: info?.team_id || null,
        document_number: null,
        order_number: null,
        pallet_id: null,
        pushed_at: now,
      };
      if (a.task_type === 'RECEIVING') {
        const d = await this.docRepo.findOne({ where: { id: a.task_id } });
        row.document_number = d?.document_number || null;
      } else if (a.task_type === 'SHIPPING') {
        const so = await this.shipRepo.findOne({ where: { id: a.task_id } });
        row.order_number = so?.order_number || null;
      } else if (a.task_type === 'PUTAWAY') {
        const pt = await this.putRepo.findOne({ where: { id: a.task_id } });
        row.pallet_id = pt?.pallet_id || null;
      }
      // Optional mapping of field names for streaming dataset
      const mapped = applyFieldMap(row);
      // Push to Power BI streaming dataset (Push URL) or any webhook
      await (global as any).fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([mapped]),
      });
      this.lastPushAt = now;
      this.lastError = null;
    } catch (e) {
      // swallow errors; do not break business flow
      const msg = (e)?.message || String(e);
      this.lastError = msg;
      console.warn('Analytics push failed:', msg);
    }
  }

  status() {
    return {
      push_url_configured: !!this.url,
      last_push_at: this.lastPushAt,
      last_error: this.lastError,
    };
  }
}

// Map field names to external schema if ANALYTICS_PUSH_MAP is provided
function parseMap(): Record<string,string> | null {
  try {
    const raw = process.env.ANALYTICS_PUSH_MAP;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

const FIELD_MAP = parseMap();

function applyFieldMap(row: any) {
  if (!FIELD_MAP) return row;
  const out: any = {};
  for (const [k,v] of Object.entries(row)) {
    const key = (FIELD_MAP as any)[k] || k;
    out[key] = v;
  }
  return out;
}
