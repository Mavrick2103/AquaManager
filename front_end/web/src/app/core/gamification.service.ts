import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type AquariumScoreMode = 'TRACKING' | 'HEALTH';
export type AquariumHealthStatus = 'STABLE' | 'WATCH' | 'CRITICAL' | 'UNKNOWN';
export type WeeklyMissionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export type GamificationSummary = {
  globalScore: number;

  profile: {
    xp: number;
    level: number;
    currentStreak: number;
    bestStreak: number;
    recentBadgeKey: string | null;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
  };

  aquariums: Array<{
    id: number;
    name: string;
    waterType: 'EAU_DOUCE' | 'EAU_DE_MER';
    volumeL: number;
    score: number;
    status: AquariumHealthStatus;
    mode: AquariumScoreMode;
    details: any | null;
  }>;

  missions: Array<{
    id: number;
    missionKey: string;
    title: string;
    description: string | null;
    target: number;
    progress: number;
    xpReward: number;
    status: WeeklyMissionStatus;
    weekStart: string;
    weekEnd: string;
  }>;

  achievements: Array<{
    id: number;
    achievementKey: string;
    title: string;
    description: string | null;
    unlockedAt: string;
  }>;
};

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly baseUrl = `${environment.apiUrl}/gamification`;

  constructor(private readonly http: HttpClient) {}

  getSummary(): Promise<GamificationSummary> {
    return firstValueFrom(
      this.http.get<GamificationSummary>(`${this.baseUrl}/summary`)
    );
  }

  recompute(): Promise<{ ok: boolean; scores: any[] }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; scores: any[] }>(`${this.baseUrl}/recompute`, {})
    );
  }

  getAquariumScore(aquariumId: number): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}/aquariums/${aquariumId}/score`)
    );
  }
}