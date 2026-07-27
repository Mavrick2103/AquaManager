import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AquariumsComponent } from './aquariums.component';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AquariumsService, Aquarium, AquariumOverview } from '../../core/aquariums.service';
import { of } from 'rxjs';
import { UserService } from '../../core/user.service';

describe('AquariumsComponent', () => {
  let component: AquariumsComponent;
  let fixture: ComponentFixture<AquariumsComponent>;
  let aquariumsServiceSpy: jasmine.SpyObj<AquariumsService>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let userServiceSpy: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    aquariumsServiceSpy = jasmine.createSpyObj<AquariumsService>('AquariumsService', ['overview']);
    dialogSpy = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    userServiceSpy = jasmine.createSpyObj<UserService>('UserService', ['getMe']);
    aquariumsServiceSpy.overview.and.returnValue(of([]));
    userServiceSpy.getMe.and.resolveTo({
      id: 1,
      email: 'user@example.com',
      fullName: 'Utilisateur',
      subscriptionPlan: 'CLASSIC',
      subscriptionStatus: 'none',
    });

    await TestBed.configureTestingModule({
      imports: [
        AquariumsComponent,
        RouterTestingModule,
      ],
      providers: [
        { provide: AquariumsService, useValue: aquariumsServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: UserService, useValue: userServiceSpy },
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
    const mockAquariums: AquariumOverview[] = [
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

    aquariumsServiceSpy.overview.and.returnValue(of(mockAquariums));

    const promise = component.load();

    expect(component.loading).toBeTrue();

    await promise;

    expect(aquariumsServiceSpy.overview).toHaveBeenCalled();
    expect(component.items).toEqual(mockAquariums);
    expect(component.loading).toBeFalse();
  });

  it('applique les limites 2 Classic, 5 Premium et illimité Pro', () => {
    component.items = [{}, {}] as AquariumOverview[];
    component.effectivePlan = 'CLASSIC';
    expect(component.aquariumLimit).toBe(2);
    expect(component.isAtLimit).toBeTrue();

    component.items = [{}, {}, {}, {}, {}] as AquariumOverview[];
    component.effectivePlan = 'PREMIUM';
    expect(component.aquariumLimit).toBe(5);
    expect(component.isAtLimit).toBeTrue();

    component.effectivePlan = 'PRO';
    expect(component.aquariumLimit).toBeNull();
    expect(component.isAtLimit).toBeFalse();
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
