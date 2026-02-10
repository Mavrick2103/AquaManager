import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ✅ Source de vérité pour les rôles
export type UserRole = 'USER' | 'EDITOR' | 'ADMIN';

export type AdminUser = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;

  createdAt: string;
  emailVerifiedAt: string | null;

  lastActivityAt: string | null;
};

export type UpdateAdminUserDto = Partial<Pick<AdminUser, 'fullName' | 'email' | 'role'>>;

export type AdminUserAquarium = {
  id: number;
  name: string;
  waterType: 'EAU_DOUCE' | 'EAU_DE_MER';
  createdAt?: string;
  startDate?: string;
  volumeL?: number;
};

export type AdminUserMeasurement = {
  id: number;
  aquariumId: number;
  measuredAt: string;
  ph?: number | null;
  temp?: number | null;
  no2?: number | null;
  no3?: number | null;
  kh?: number | null;
  gh?: number | null;
  po4?: number | null;
  fe?: number | null;
  k?: number | null;
  sio2?: number | null;
  nh3?: number | null;
  dkh?: number | null;
  salinity?: number | null;
  ca?: number | null;
  mg?: number | null;
};

export type AdminUserTask = {
  id: number;
  title: string;
  status: string;
  dueAt: string;
  aquariumId?: number | null;
  aquarium?: { id: number; name?: string } | null;
};

export type AdminUserFishRow = {
  id: number;
  aquariumId: number;
  count: number;
  fishCard: {
    id: number;
    commonName: string;
    scientificName?: string | null;
    imageUrl?: string | null;
  };
};

export type AdminUserPlantRow = {
  id: number;
  aquariumId: number;
  count: number;
  plantCard: {
    id: number;
    commonName: string;
    scientificName?: string | null;
    imageUrl?: string | null;
  };
};

// ✅ EDITOR payload (retourné par /admin/users/:id/full)
export type EditorArticleLite = {
  id: number;
  title: string;
  createdAt: string;
  status: string;
};

export type EditorFishCardLite = {
  id: number;
  commonName: string;
  createdAt: string;
  status: string;
};

export type EditorPlantCardLite = {
  id: number;
  commonName: string;
  createdAt: string;
  status: string;
};

export type AdminUserEditorPayload = {
  articles: EditorArticleLite[];
  fishCards: EditorFishCardLite[];
  plantCards: EditorPlantCardLite[];
};

export type AdminUserFull = {
  user: AdminUser;
  aquariums: AdminUserAquarium[];
  measurements: AdminUserMeasurement[];
  fish: AdminUserFishRow[];
  plants: AdminUserPlantRow[];
  tasks: AdminUserTask[];

  // ✅ AJOUT IMPORTANT : sinon ton onglet Publications ne peut pas marcher proprement
  editor?: AdminUserEditorPayload;
};

@Injectable({ providedIn: 'root' })
export class AdminUsersApi {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  list(search?: string): Observable<AdminUser[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());

    return this.http.get<AdminUser[]>(`${this.baseUrl}/admin/users`, {
      params,
      withCredentials: true,
    });
  }

  update(id: number, dto: UpdateAdminUserDto): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/admin/users/${id}`, dto, {
      withCredentials: true,
    });
  }

  remove(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/admin/users/${id}`, {
      withCredentials: true,
    });
  }

  getFull(id: number): Observable<AdminUserFull> {
    return this.http.get<AdminUserFull>(`${this.baseUrl}/admin/users/${id}/full`, {
      withCredentials: true,
    });
  }
}
