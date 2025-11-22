import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { SlaEvent } from '../entities/sla-event.entity';
import { SlaComplianceCache } from '../entities/sla-compliance-cache.entity';
import { OrchestrationActionLog } from '../entities/orchestration-action-log.entity';
import { SLA_MATRIX } from '../orchestration/orchestration.service';
import { ReceivingDocument, ReceivingStatus } from '../entities/receiving-document.entity';
import { ShippingOrder } from '../entities/shipping-order.entity';

@Injectable()
export class SlaService {
  constructor(
    @InjectRepository(SlaEvent)
    private slaEventRepo: Repository<SlaEvent>,
    @InjectRepository(SlaComplianceCache)
    private cacheRepo: Repository<SlaComplianceCache>,
    @InjectRepository(OrchestrationActionLog)
    private actionLogRepo: Repository<OrchestrationActionLog>,
    @InjectRepository(ReceivingDocument)
    private receivingRepo: Repository<ReceivingDocument>,
    @InjectRepository(ShippingOrder)
    private shippingRepo: Repository<ShippingOrder>,
  ) {}

  private async syncOperationalSlaData() {
    const managedTypes = ['RECEIVING_DELAY', 'LATE_SHIPMENT'];
    const expectedIds = new Set<string>();
    const now = new Date();

    const receivings = await this.receivingRepo.find({
      relations: ['assignedUser'],
      where: [{ status: ReceivingStatus.IN_PROGRESS }, { status: ReceivingStatus.COMPLETED }, { status: ReceivingStatus.ON_HOLD }] as any,
    });

    for (const doc of receivings) {
      const startedAt = doc.started_at || doc.created_at;
      if (!startedAt) continue;
      const eventId = `REC-${doc.id}`;
      expectedIds.add(eventId);
      const slaLimit = SLA_MATRIX.RECEIVING_DELAY || 30;
      const endPoint = doc.completed_at || now;
      const durationMin = Math.max(0, Math.floor((endPoint.getTime() - startedAt.getTime()) / 60000));
      const ratio = durationMin / slaLimit;
      const severity = ratio >= 1 ? 'HIGH' : ratio >= 0.8 ? 'MEDIUM' : 'LOW';
      const workerName =
        doc.assignedUser?.full_name ||
        doc.assignedUser?.name ||
        doc.assignedUser?.username ||
        null;

      let event = await this.slaEventRepo.findOne({ where: { exception_id: eventId } as any });
      if (!event) {
        event = this.slaEventRepo.create({
          exception_id: eventId,
          type: 'RECEIVING_DELAY',
          severity,
          started_at: startedAt,
          sla_limit_min: slaLimit,
        });
      }

      event.type = 'RECEIVING_DELAY';
      event.severity = severity;
      event.started_at = startedAt;
      event.sla_limit_min = slaLimit;
      event.worker = workerName;
      event.location_code = event.location_code || null;
      event.zone = event.zone || null;
      event.item_sku = event.item_sku || null;

      if (doc.status === ReceivingStatus.COMPLETED && doc.completed_at) {
        event.resolved_at = doc.completed_at;
        event.duration_min = durationMin;
        event.resolved_by_user_id = doc.received_by || doc.assigned_to || doc.created_by || 1;
        event.executed_action = 'RECEIVING_COMPLETED';
        event.breached_at = durationMin > slaLimit ? (event.breached_at || doc.completed_at) : null;
      } else {
        event.resolved_at = null;
        event.duration_min = null;
        event.resolved_by_user_id = null;
        event.executed_action = null;
        const elapsedMin = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60000));
        event.breached_at = elapsedMin > slaLimit ? (event.breached_at || now) : null;
      }

      await this.slaEventRepo.save(event);
    }

    const shippingOrders = await this.shippingRepo.find({
      where: [] as any,
      relations: ['assigned_user'],
    });

    for (const order of shippingOrders) {
      if (order.status === 'DRAFT') continue;
      const startedAt = order.started_at || order.created_at;
      if (!startedAt) continue;
      const eventId = `SHIP-${order.id}`;
      expectedIds.add(eventId);
      const slaLimit = SLA_MATRIX.LATE_SHIPMENT || 30;
      const completionTimestamp = order.closed_at || order.loaded_at || order.staged_at || null;
      const endPoint = completionTimestamp || now;
      const durationMin = Math.max(0, Math.floor((endPoint.getTime() - startedAt.getTime()) / 60000));
      const ratio = durationMin / slaLimit;
      const severity = ratio >= 1 ? 'HIGH' : ratio >= 0.8 ? 'MEDIUM' : 'LOW';
      const workerName =
        order.assigned_user?.full_name ||
        (order.assigned_user as any)?.name ||
        order.assigned_user?.username ||
        null;

      let event = await this.slaEventRepo.findOne({ where: { exception_id: eventId } as any });
      if (!event) {
        event = this.slaEventRepo.create({
          exception_id: eventId,
          type: 'LATE_SHIPMENT',
          severity,
          started_at: startedAt,
          sla_limit_min: slaLimit,
        });
      }

      event.type = 'LATE_SHIPMENT';
      event.severity = severity;
      event.started_at = startedAt;
      event.sla_limit_min = slaLimit;
      event.worker = workerName;
      event.zone = event.zone || null;
      event.location_code = event.location_code || null;

      if (completionTimestamp) {
        event.resolved_at = completionTimestamp;
        event.duration_min = durationMin;
        event.resolved_by_user_id = order.assigned_user_id || order.assigned_user?.id || 1;
        event.executed_action = order.closed_at
          ? 'SHIPMENT_CLOSED'
          : order.loaded_at
            ? 'SHIPMENT_LOADED'
            : 'SHIPMENT_STAGED';
        event.breached_at = durationMin > slaLimit ? (event.breached_at || completionTimestamp) : null;
      } else {
        event.resolved_at = null;
        event.duration_min = null;
        event.resolved_by_user_id = null;
        event.executed_action = null;
        const elapsedMin = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60000));
        event.breached_at = elapsedMin > slaLimit ? (event.breached_at || now) : null;
      }

      await this.slaEventRepo.save(event);
    }

    if (expectedIds.size) {
      const staleEvents = await this.slaEventRepo.find({
        where: {
          type: In(managedTypes),
        },
      });
      const toRemove = staleEvents.filter(e => !expectedIds.has(e.exception_id));
      if (toRemove.length) {
        await this.slaEventRepo.remove(toRemove);
      }
    }
  }

  async recordEvent(exceptionId: string, type: string, severity: string, startedAt: Date, metadata?: any) {
    const slaLimit = SLA_MATRIX[type] || 30;
    
    let event = await this.slaEventRepo.findOne({
      where: { exception_id: exceptionId } as any,
    });

    if (!event) {
      event = this.slaEventRepo.create({
        exception_id: exceptionId,
        type,
        severity,
        started_at: startedAt,
        sla_limit_min: slaLimit,
        location_code: metadata?.location_code || null,
        zone: metadata?.zone || null,
        item_sku: metadata?.item_sku || null,
        worker: metadata?.worker || null,
      });
    } else {
      // Update existing event
      if (metadata?.location_code) event.location_code = metadata.location_code;
      if (metadata?.zone) event.zone = metadata.zone;
      if (metadata?.item_sku) event.item_sku = metadata.item_sku;
      if (metadata?.worker) event.worker = metadata.worker;
    }

    // Check if breached
    const ageMin = Math.floor((Date.now() - startedAt.getTime()) / 60000);
    if (ageMin > slaLimit && !event.breached_at) {
      event.breached_at = new Date();
    }

    await this.slaEventRepo.save(event);
    return event;
  }

  async resolveEvent(exceptionId: string, resolvedByUserId: number, executedAction: string, resolvedAt: Date) {
    const event = await this.slaEventRepo.findOne({
      where: { exception_id: exceptionId } as any,
    });

    if (event && !event.resolved_at) {
      event.resolved_at = resolvedAt;
      event.resolved_by_user_id = resolvedByUserId;
      event.executed_action = executedAction;
      event.duration_min = Math.floor((resolvedAt.getTime() - event.started_at.getTime()) / 60000);
      
      if (!event.breached_at && event.duration_min > event.sla_limit_min) {
        event.breached_at = resolvedAt;
      }

      await this.slaEventRepo.save(event);
    }

    return event;
  }

  async getHistory(params: {
    from?: string;
    to?: string;
    type?: string;
    worker_id?: number;
    zone?: string;
  }) {
    await this.syncOperationalSlaData();
    const query = this.slaEventRepo.createQueryBuilder('e');

    if (params.from) {
      query.andWhere('e.started_at >= :from', { from: params.from });
    }
    if (params.to) {
      query.andWhere('e.started_at <= :to', { to: params.to });
    }
    if (params.type) {
      query.andWhere('e.type = :type', { type: params.type });
    }
    if (params.zone) {
      query.andWhere('e.zone = :zone', { zone: params.zone });
    }
    if (params.worker_id) {
      query.andWhere('e.resolved_by_user_id = :worker_id', { worker_id: params.worker_id });
    }

    const events = await query.orderBy('e.started_at', 'DESC').getMany();

    return events.map(e => ({
      exception_id: e.exception_id,
      type: e.type,
      severity: e.severity,
      sla_limit_min: e.sla_limit_min !== null ? Number(e.sla_limit_min) : null,
      duration_min: e.duration_min !== null ? Number(e.duration_min) : null,
      breached: !!e.breached_at,
      started_at: e.started_at,
      resolved_at: e.resolved_at,
      resolved_by: e.resolved_by_user_id ? e.resolved_by_user_id : null, // Will be enriched with name in frontend
      executed_action: e.executed_action,
      zone: e.zone,
      location_code: e.location_code,
      item_sku: e.item_sku,
      worker: e.worker,
      comments: e.comments,
    }));
  }

  async getStats(params?: { worker_id?: number }) {
    await this.syncOperationalSlaData();
    const query = this.slaEventRepo.createQueryBuilder('e');
    
    if (params?.worker_id) {
      query.andWhere('e.resolved_by_user_id = :worker_id', { worker_id: params.worker_id });
    }

    const events = await query.getMany();
    const total = events.length;
    const breaches = events.filter(e => e.breached_at).length;
    const complianceScore = total > 0 ? ((total - breaches) / total) * 100 : 100;
    
    const resolvedEvents = events.filter(e => e.resolved_at && e.duration_min);
    const avgResolution = resolvedEvents.length > 0
      ? resolvedEvents.reduce((sum, e) => sum + Number(e.duration_min || 0), 0) / resolvedEvents.length
      : 0;

    // Top issue types
    const typeCounts = new Map<string, number>();
    events.forEach(e => {
      const count = typeCounts.get(e.type) || 0;
      typeCounts.set(e.type, count + 1);
    });
    const topIssueTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top zones by breaches
    const zoneBreaches = new Map<string, number>();
    events.filter(e => e.breached_at && e.zone).forEach(e => {
      const count = zoneBreaches.get(e.zone) || 0;
      zoneBreaches.set(e.zone, count + 1);
    });
    const topZones = Array.from(zoneBreaches.entries())
      .map(([zone, breaches]) => ({ zone, breaches }))
      .sort((a, b) => b.breaches - a.breaches)
      .slice(0, 5);

    // Best/Worst workers (only if not filtering by worker_id)
    let bestWorkers: any[] = [];
    let worstWorkers: any[] = [];

    if (!params?.worker_id) {
      const workerStats = new Map<number, { resolved: number; totalTime: number; breaches: number }>();
      
      resolvedEvents.forEach(e => {
        if (e.resolved_by_user_id) {
          const stats = workerStats.get(e.resolved_by_user_id) || { resolved: 0, totalTime: 0, breaches: 0 };
          stats.resolved++;
          stats.totalTime += Number(e.duration_min || 0);
          if (e.breached_at) stats.breaches++;
          workerStats.set(e.resolved_by_user_id, stats);
        }
      });

      const workerList = Array.from(workerStats.entries()).map(([userId, stats]) => ({
        user_id: userId,
        resolved: stats.resolved,
        avg_time: stats.resolved > 0 ? Math.round(stats.totalTime / stats.resolved) : 0,
        breaches: stats.breaches,
      }));

      bestWorkers = workerList
        .sort((a, b) => b.resolved - a.resolved || a.avg_time - b.avg_time)
        .slice(0, 3);

      worstWorkers = workerList
        .sort((a, b) => b.breaches - a.breaches || b.avg_time - a.avg_time)
        .slice(0, 3);
    }

    return {
      total_issues: total,
      total_breaches: breaches,
      compliance_score: Math.round(complianceScore * 10) / 10,
      avg_resolution_min: Math.round(avgResolution * 10) / 10,
      top_issue_types: topIssueTypes,
      top_zones: topZones,
      best_workers: bestWorkers,
      worst_workers: worstWorkers,
    };
  }

  async getTrends(period: '7d' | '30d' | '90d' = '30d') {
    await this.syncOperationalSlaData();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.slaEventRepo.find({
      where: {
        started_at: MoreThanOrEqual(startDate),
      } as any,
    });

    // Group by date
    const byDate = new Map<string, { total: number; breaches: number; resolutions: number; totalTime: number }>();

    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      byDate.set(dateStr, { total: 0, breaches: 0, resolutions: 0, totalTime: 0 });
    }

    events.forEach(e => {
      const dateStr = e.started_at.toISOString().split('T')[0];
      const stats = byDate.get(dateStr);
      if (stats) {
        stats.total++;
        if (e.breached_at) stats.breaches++;
        if (e.resolved_at && e.duration_min) {
          stats.resolutions++;
          stats.totalTime += Number(e.duration_min);
        }
      }
    });

    const dates = Array.from(byDate.keys()).sort();
    const complianceScores = dates.map(date => {
      const stats = byDate.get(date);
      const score = stats.total > 0 ? ((stats.total - stats.breaches) / stats.total) * 100 : 100;
      return Math.round(score * 10) / 10;
    });

    const avgResolutionTimes = dates.map(date => {
      const stats = byDate.get(date);
      return stats.resolutions > 0 ? Math.round((stats.totalTime / stats.resolutions) * 10) / 10 : 0;
    });

    const breachCounts = dates.map(date => byDate.get(date).breaches);

    return {
      dates,
      compliance_scores: complianceScores,
      avg_resolution_times: avgResolutionTimes,
      breach_counts: breachCounts,
    };
  }

  async addComment(exceptionId: string, comment: string) {
    const event = await this.slaEventRepo.findOne({
      where: { exception_id: exceptionId } as any,
    });

    if (!event) {
      throw new Error('SLA event not found');
    }

    event.comments = comment;
    await this.slaEventRepo.save(event);
    return { ok: true };
  }
}

