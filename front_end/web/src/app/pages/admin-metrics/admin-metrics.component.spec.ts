import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminMetricsComponent } from './admin-metrics.component';

describe('AdminMetricsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMetricsComponent],
      providers: [
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AdminMetricsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
