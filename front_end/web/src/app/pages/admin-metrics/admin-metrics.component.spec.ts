import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMetrics } from './admin-metrics';

describe('AdminMetrics', () => {
  let component: AdminMetrics;
  let fixture: ComponentFixture<AdminMetrics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMetrics]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminMetrics);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
