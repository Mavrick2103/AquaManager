import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type TaskType = 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';
export type TaskStatus = 'PENDING' | 'DONE';

export type RepeatMode = 'NONE' | 'DAILY' | 'EVERY_2_DAYS' | 'WEEKLY' | 'EVERY_X_WEEKS';
export type WeekDayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type RepeatPayload = null | {
  mode: RepeatMode;

  // ✅ NOUVEAU : durée max de la routine (anti-infini)
  durationWeeks?: number;

  // existant
  everyWeeks?: number;
  days?: WeekDayKey[];
};

export type FertilizerLine = {
  name: string;
  qty: number;
  unit: 'ml' | 'g';
};

export type Task = {
  id: any; // ton API renvoie parfois string (r:...) -> on laisse souple
  title: string;
  description?: string;
  dueAt: string;
  status: TaskStatus;
  type: TaskType;
  aquarium?: { id: number; name?: string };

  repeat?: RepeatPayload;
  fertilization?: FertilizerLine[] | null;

  // optionnels selon ton API
  createdAt?: string;
  virtual?: boolean;
  parentId?: number | null;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  dueAt: string;
  aquariumId: number;
  type: TaskType;
  repeat?: RepeatPayload;
  fertilization?: FertilizerLine[] | null;
};

export type UpdateTaskPayload = Partial<{
  title: string;
  description?: string;
  dueAt: string;
  aquariumId: number;
  status: TaskStatus;
  type: TaskType;
  repeat: RepeatPayload;
  fertilization: FertilizerLine[] | null;
}>;

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/tasks`;

  list(month?: string) {
    const params = month ? new HttpParams().set('month', month) : undefined;
    return this.http.get<Task[]>(this.base, { params });
  }

  create(payload: CreateTaskPayload) {
    return this.http.post<Task>(this.base, payload);
  }

  update(id: any, payload: UpdateTaskPayload) {
    return this.http.patch<Task>(`${this.base}/${id}`, payload);
  }

  delete(id: any) {
    return this.http.delete<{ ok: true }>(`${this.base}/${id}`);
  }
}
