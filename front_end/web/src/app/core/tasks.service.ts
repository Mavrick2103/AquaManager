import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type Task = {
  id: number;
  title: string;
  description?: string;
  dueAt: string;
  status: 'PENDING' | 'DONE';
  type: 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';
  aquarium?: { id: number; name?: string };
};

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/tasks`;

  /** 🔹 Récupère les tâches du mois, ex: "2025-10" */
  list(month?: string) {
    const params = month ? new HttpParams().set('month', month) : undefined;
    return this.http.get<Task[]>(this.base, { params });
  }

  /** 🔹 Crée une tâche */
  create(payload: {
    title: string;
    description?: string;
    dueAt: string;
    aquariumId: number;
    type: 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';
  }) {
    return this.http.post<Task>(this.base, payload);
  }

  /** 🔹 Met à jour une tâche existante */
  update(
    id: number,
    payload: Partial<{
      title: string;
      description?: string;
      dueAt: string;
      aquariumId: number;
      status: 'PENDING' | 'DONE';
      type: 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';
    }>
  ) {
    return this.http.patch<Task>(`${this.base}/${id}`, payload);
  }

  /** 🔹 Supprime une tâche (DELETE /tasks/:id) */
  delete(id: number) {
    return this.http.delete<{ ok: true }>(`${this.base}/${id}`);
  }
}
