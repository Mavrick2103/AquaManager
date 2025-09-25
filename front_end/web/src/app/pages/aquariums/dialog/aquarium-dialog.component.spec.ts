import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AquariumDialogComponent } from './aquarium-dialog.component';

describe('Dialog', () => {
  let component: AquariumDialogComponent;
  let fixture: ComponentFixture<AquariumDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AquariumDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AquariumDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
