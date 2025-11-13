import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AquariumsComponent } from './aquariums.component';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AquariumsService, Aquarium } from '../../core/aquariums.service';
import { of } from 'rxjs';

describe('AquariumsComponent', () => {
  let component: AquariumsComponent;
  let fixture: ComponentFixture<AquariumsComponent>;
  let aquariumsServiceSpy: jasmine.SpyObj<AquariumsService>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    aquariumsServiceSpy = jasmine.createSpyObj<AquariumsService>('AquariumsService', ['list']);
    dialogSpy = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [
        AquariumsComponent,
        RouterTestingModule,
      ],
      providers: [
        { provide: AquariumsService, useValue: aquariumsServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map() } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AquariumsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait être créé', () => {
    expect(component).toBeTruthy();
  });

  it('load() devrait appeler le service et remplir items + gérer loading', async () => {
    const mockAquariums: Aquarium[] = [
      {
        id: 1,
        name: 'Bac 1',
        lengthCm: 60,
        widthCm: 30,
        heightCm: 30,
        waterType: 'EAU_DOUCE',
        startDate: '2025-01-01',
        volumeL: 54,
        createdAt: '2025-01-01T00:00:00Z',
      } as any,
    ];

    aquariumsServiceSpy.list.and.returnValue(of(mockAquariums));

    const promise = component.load();

    expect(component.loading).toBeTrue();

    await promise;

    expect(aquariumsServiceSpy.list).toHaveBeenCalled();
    expect(component.items).toEqual(mockAquariums);
    expect(component.loading).toBeFalse();
  });

  it('litersOf() devrait calculer le volume à partir des dimensions', () => {
    const a = {
      lengthCm: 100,
      widthCm: 30,
      heightCm: 40,
    } as Aquarium;

    const liters = component.litersOf(a);

    expect(liters).toBe(Math.round((100 * 30 * 40) / 1000));
  });
});
