import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TaskType } from './tasks.service';

export type AiSuggestedTask = {
  type: TaskType;
  title: string;
  description: string;
  suggestedDueAt: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
};

export type AiProductRecommendation = {
  id: string;
  name: string;
  url: string;
  reason: string;
  warning: string | null;
  imageUrl: string | null;
};

export type AiAquariumAnalysisResponse = {
  usageId: number;
  questionText: string;
  feedback: 'HELPFUL' | 'NOT_HELPFUL' | null;
  model: string;
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  analysis: string;
  suggestedTasks: AiSuggestedTask[];
  productRecommendations: AiProductRecommendation[];
};

@Injectable({
  providedIn: 'root',
})
export class AiApi {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  saveFeedback(usageId: number, feedback: 'HELPFUL' | 'NOT_HELPFUL') {
    return this.http.patch<{ feedback: 'HELPFUL' | 'NOT_HELPFUL' }>(
      `${this.baseUrl}/ai/usages/${usageId}/feedback`, { feedback }, { withCredentials: true },
    );
  }

  analyzeAquarium(
    aquariumId: number,
    question?: string,
  ): Observable<AiAquariumAnalysisResponse> {
    return this.http.post<AiAquariumAnalysisResponse>(
      `${this.baseUrl}/ai/aquariums/${aquariumId}/analyze`,
      {
        question: question || 'Analyse mes paramètres et donne-moi des conseils.',
      },
      {
        withCredentials: true,
      },
    );
  }
  analyzeAquariumPhoto(
  aquariumId: number,
  image: File,
  problemType: string,
  question?: string,
): Observable<AiAquariumAnalysisResponse> {
  const formData = new FormData();

  formData.append('image', image);
  formData.append('problemType', problemType);

  if (question?.trim()) {
    formData.append('question', question.trim());
  }

  return this.http.post<AiAquariumAnalysisResponse>(
    `${this.baseUrl}/ai/aquariums/${aquariumId}/photo-analysis`,
    formData,
    {
      withCredentials: true,
    },
  );
}
}
