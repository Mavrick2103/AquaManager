import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AiAquariumAnalysisResponse = {
  model: string;
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  analysis: string;
};

@Injectable({
  providedIn: 'root',
})
export class AiApi {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

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