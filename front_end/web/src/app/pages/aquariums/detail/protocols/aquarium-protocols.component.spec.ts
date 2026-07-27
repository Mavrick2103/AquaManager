import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { Aquarium } from '../../../../core/aquariums.service';
import { CreateTaskPayload, TasksService } from '../../../../core/tasks.service';
import { AquariumProtocolsComponent } from './aquarium-protocols.component';

class TasksServiceStub {
  created: CreateTaskPayload[] = [];
  stored: any[] = [];
  updated: Array<{ id: any; payload: any }> = [];

  list() {
    return of(this.stored);
  }

  create(payload: CreateTaskPayload) {
    this.created.push(payload);
    const task = {
      id: this.created.length,
      ...payload,
      status: 'PENDING' as const,
      aquarium: { id: payload.aquariumId, name: 'Bac salon' },
    };
    this.stored.push(task);
    return of(task);
  }

  update(id: any, payload: any) {
    this.updated.push({ id, payload });
    const index = this.stored.findIndex((task) => task.id === id);
    this.stored[index] = { ...this.stored[index], ...payload };
    return of(this.stored[index]);
  }

  delete(id: any) {
    this.stored = this.stored.filter((task) => task.id !== id);
    return of({ ok: true as const });
  }
}

describe('AquariumProtocolsComponent', () => {
  let fixture: ComponentFixture<AquariumProtocolsComponent>;
  let component: AquariumProtocolsComponent;
  let tasks: TasksServiceStub;

  const aquarium: Aquarium = {
    id: 3,
    name: 'Bac salon',
    lengthCm: 100,
    widthCm: 40,
    heightCm: 50,
    volumeL: 200,
    waterType: 'EAU_DOUCE',
    startDate: '2026-07-01',
    createdAt: '2026-07-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AquariumProtocolsComponent, NoopAnimationsModule],
      providers: [{ provide: TasksService, useClass: TasksServiceStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(AquariumProtocolsComponent);
    component = fixture.componentInstance;
    tasks = TestBed.inject(TasksService) as unknown as TasksServiceStub;
    fixture.componentRef.setInput('aquarium', aquarium);
    fixture.componentRef.setInput('plantCount', 2);
    fixture.detectChanges();
  });

  it('adapte la routine à un aquarium planté', () => {
    const routine = component.protocols.find((protocol) => protocol.key === 'ROUTINE');

    expect(routine).toBeTruthy();
    expect(routine?.steps.some((step) => step.id === 'routine-trim')).toBeTrue();
    expect(routine?.reason).toContain('eau douce');
    expect(routine?.reason).toContain('planté');
  });

  it('ne crée que les étapes validées et les rattache au bon aquarium', async () => {
    const vacation = component.protocols.find((protocol) => protocol.key === 'VACATION')!;
    component.selectProtocol(vacation);
    component.toggleStep('vacation-water', false);

    await component.activateProtocol();

    expect(tasks.created.length).toBe(vacation.steps.length - 1);
    expect(tasks.created.every((task) => task.aquariumId === aquarium.id)).toBeTrue();
    expect(tasks.created.every((task) => task.description?.includes('[AquaManager protocol:VACATION]'))).toBeTrue();
    expect(tasks.created.some((task) => task.description?.includes('changement d’eau raisonnable'))).toBeFalse();
  });

  it('adapte le protocole à la durée réelle de l’absence', async () => {
    const vacation = component.protocols.find((protocol) => protocol.key === 'VACATION')!;
    component.selectProtocol(vacation);
    component.absenceDepartureDate = '2026-08-10';
    component.absenceReturnDate = '2026-08-13';
    component.onAbsenceDatesChange();

    expect(component.absenceDurationDays).toBe(3);
    expect(component.previewSteps.some((step) => step.id === 'vacation-midpoint')).toBeFalse();

    await component.activateProtocol();

    expect(tasks.created.length).toBe(4);
    expect(tasks.created[0].dueAt.startsWith('2026-08-07')).toBeTrue();
    expect(tasks.created[3].dueAt.startsWith('2026-08-13')).toBeTrue();
  });

  it('regroupe les étapes actives et permet de modifier une consigne', async () => {
    const routine = component.protocols.find((protocol) => protocol.key === 'ROUTINE')!;
    component.selectProtocol(routine);
    await component.activateProtocol();

    expect(component.activeProtocols.length).toBe(1);
    expect(component.activeProtocols[0].key).toBe('ROUTINE');
    expect(component.activeProtocols[0].tasks.length).toBe(routine.steps.length);

    const task = component.activeProtocols[0].tasks[0];
    component.startTaskEdit(task);
    component.editDescription = 'Nouvelle consigne personnalisée';
    await component.saveTaskEdit(task);

    expect(tasks.updated.length).toBe(1);
    expect(tasks.updated[0].payload.description).toContain('[AquaManager protocol:ROUTINE]');
    expect(tasks.updated[0].payload.description).toContain('Nouvelle consigne personnalisée');
  });
});
