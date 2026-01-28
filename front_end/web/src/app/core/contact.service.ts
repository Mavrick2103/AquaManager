import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  send(fd: FormData) {
    return this.http.post<{ ok: true }>(`${environment.apiUrl}/contact`, fd);
  }
}
