import { Injectable } from '@nestjs/common';

export interface SyncProgress {
  id: string;
  type: 'stores' | 'inventory' | 'all_stores';
  status: 'running' | 'completed' | 'cancelled' | 'error';
  current: number;
  total: number;
  message: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

@Injectable()
export class SyncProgressService {
  private progressMap = new Map<string, SyncProgress>();
  private cancelFlags = new Map<string, boolean>();

  startSync(id: string, type: 'stores' | 'inventory' | 'all_stores', total: number): void {
    this.progressMap.set(id, {
      id,
      type,
      status: 'running',
      current: 0,
      total,
      message: 'Započinjem sinhronizaciju...',
      startedAt: new Date(),
    });
    this.cancelFlags.set(id, false);
  }

  updateProgress(id: string, current: number, message: string): void {
    const progress = this.progressMap.get(id);
    if (progress) {
      progress.current = current;
      progress.message = message;
      progress.status = 'running';
    }
  }

  completeSync(id: string, result: any): void {
    const progress = this.progressMap.get(id);
    if (progress) {
      progress.status = 'completed';
      progress.current = progress.total;
      progress.message = 'Sinhronizacija završena';
      progress.completedAt = new Date();
      progress.result = result;
    }
    this.cancelFlags.delete(id);
  }

  cancelSync(id: string): void {
    const progress = this.progressMap.get(id);
    if (progress && progress.status === 'running') {
      progress.status = 'cancelled';
      progress.message = 'Sinhronizacija otkazana';
      progress.completedAt = new Date();
    }
    this.cancelFlags.set(id, true);
  }

  errorSync(id: string, error: string): void {
    const progress = this.progressMap.get(id);
    if (progress) {
      progress.status = 'error';
      progress.message = 'Greška pri sinhronizaciji';
      progress.completedAt = new Date();
      progress.error = error;
    }
    this.cancelFlags.delete(id);
  }

  isCancelled(id: string): boolean {
    return this.cancelFlags.get(id) || false;
  }

  getProgress(id: string): SyncProgress | undefined {
    return this.progressMap.get(id);
  }

  cleanupOldProgress(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    for (const [id, progress] of this.progressMap.entries()) {
      if (progress.completedAt && progress.completedAt.getTime() < oneHourAgo) {
        this.progressMap.delete(id);
        this.cancelFlags.delete(id);
      }
    }
  }
}
