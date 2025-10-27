import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AquariumFish {
  id: number;            // id occupant
  fishId: number;        // id catalogue
  commonName?: string;
  scientificName?: string;
  quantity: number;
}

export interface AquariumPlant {
  id: number;
  plantId: number;
  commonName?: string;
  scientificName?: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class AquariumOccupantsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listFish(aquariumId: number): Observable<AquariumFish[]> {
    return this.http.get<AquariumFish[]>(`${this.base}/aquariums/${aquariumId}/fish`);
  }
  addFish(aquariumId: number, fishId: number, quantity = 1): Observable<AquariumFish> {
    return this.http.post<AquariumFish>(`${this.base}/aquariums/${aquariumId}/fish`, { fishId, quantity });
  }
  updateFish(aquariumId: number, occupantId: number, quantity: number) {
    return this.http.patch<AquariumFish>(`${this.base}/aquariums/${aquariumId}/fish/${occupantId}`, { quantity });
  }
  removeFish(aquariumId: number, occupantId: number) {
    return this.http.delete<void>(`${this.base}/aquariums/${aquariumId}/fish/${occupantId}`);
  }

  listPlants(aquariumId: number): Observable<AquariumPlant[]> {
    return this.http.get<AquariumPlant[]>(`${this.base}/aquariums/${aquariumId}/plants`);
  }
  addPlant(aquariumId: number, plantId: number, quantity = 1): Observable<AquariumPlant> {
    return this.http.post<AquariumPlant>(`${this.base}/aquariums/${aquariumId}/plants`, { plantId, quantity });
  }
  updatePlant(aquariumId: number, occupantId: number, quantity: number) {
    return this.http.patch<AquariumPlant>(`${this.base}/aquariums/${aquariumId}/plants/${occupantId}`, { quantity });
  }
  removePlant(aquariumId: number, occupantId: number) {
    return this.http.delete<void>(`${this.base}/aquariums/${aquariumId}/plants/${occupantId}`);
  }
}
