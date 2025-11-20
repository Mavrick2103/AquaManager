import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AquariumDialogComponent } from './aquarium-dialog.component';
import { AquariumsService, Aquarium } from '../../../core/aquariums.service';

describe('AquariumDialogComponent', () => {
  let component: AquariumDialogComponent;
  let fixture: ComponentFixture<AquariumDialogComponent>;
  let apiSpy: jasmine.SpyObj<AquariumsService>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<AquariumDialogComponent>>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('AquariumsService', ['create']);
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<AquariumDialogComponent>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [
        AquariumDialogComponent,
        HttpClientTestingModule,
      ],
      providers: [
        { provide: AquariumsService, useValue: apiSpy },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AquariumDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait être créé', () => {
    expect(component).toBeTruthy();
  });

 it('liters devrait retourner le bon litrage en fonction des dimensions', () => {
  component.form.patchValue({
    lengthCm: 60,
    widthCm: 40,
    heightCm: 35,
  });

  const liters = component.liters();
  expect(liters).toBe(84);
});


  it('submit() devrait appeler api.create() et fermer le dialog si succès', () => {
    component.form.patchValue({
      name: 'Mon Bac',
      lengthCm: 60,
      widthCm: 30,
      heightCm: 30,
      waterType: 'EAU_DOUCE',
      startDate: new Date('2025-01-01'),
    });

    const mockAquarium: Aquarium = {
      id: 1,
      name: 'Mon Bac',
      lengthCm: 60,
      widthCm: 30,
      heightCm: 30,
      waterType: 'EAU_DOUCE',
      startDate: '2025-01-01',
      volumeL: 54,
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    apiSpy.create.and.returnValue(of(mockAquarium));

    component.submit();

    expect(apiSpy.create).toHaveBeenCalled();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('submit() ne devrait pas appeler api.create() si formulaire invalide', () => {
    component.form.patchValue({
      name: '',
    });

    component.submit();

    expect(apiSpy.create).not.toHaveBeenCalled();
  });
});
