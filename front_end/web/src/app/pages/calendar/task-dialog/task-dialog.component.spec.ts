import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { TasksService } from '../../../core/tasks.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AquariumsService } from '../../../core/aquariums.service';
import { TaskDialogComponent } from './task-dialog.component';

describe('Task dialog conditional controls', () => {
  let component: TaskDialogComponent;
  let close: jasmine.Spy;
  let create: jasmine.Spy;
  beforeEach(async () => {
    close = jasmine.createSpy('close');
    create = jasmine.createSpy('create').and.callFake(payload=>of({id:50,...payload}));
    await TestBed.configureTestingModule({ imports:[TaskDialogComponent], providers:[
      provideRouter([]), {provide:MAT_DIALOG_DATA,useValue:{}},
      {provide:MatDialogRef,useValue:{close}},
      {provide:AquariumsService,useValue:{listMine:()=>of([{id:1,name:'Bac'}])}},
      {provide:TasksService,useValue:{create}},
    ] }).compileComponents();
    const fixture=TestBed.createComponent(TaskDialogComponent);
    component=fixture.componentInstance;fixture.detectChanges();
  });
  it('allows saving after switching away from an unfinished fertilizer line', () => {
    component.form.controls.type.setValue('FERTILIZATION');
    expect(component.form.invalid).toBeTrue();
    component.form.controls.type.setValue('WATER_CHANGE');
    expect(component.fertilizers.disabled).toBeTrue();
    expect(component.form.valid).toBeTrue();
    component.save();
    expect(close).toHaveBeenCalledWith(jasmine.objectContaining({type:'WATER_CHANGE',fertilization:null}));
  });
  it('preserves fertilizer entries and revalidates when returning to fertilization', () => {
    component.form.controls.type.setValue('FERTILIZATION');
    component.fertilizers.at(0).patchValue({name:'Engrais',qty:2});
    component.form.controls.type.setValue('WATER_CHANGE');
    component.form.controls.type.setValue('FERTILIZATION');
    expect(component.fertilizers.enabled).toBeTrue();
    expect(component.fertilizers.at(0).value.name).toBe('Engrais');
    expect(component.form.valid).toBeTrue();
    component.fertilizers.at(0).patchValue({name:''});
    expect(component.form.invalid).toBeTrue();
  });
  it('disables every hidden repetition validator when None is selected', () => {
    component.form.controls.type.setValue('WATER_CHANGE');
    component.form.controls.isRepeat.setValue(true);
    component.form.controls.repeatHasEnd.setValue(true);
    component.form.controls.repeatDurationWeeks.setValue(0);
    expect(component.form.invalid).toBeTrue();
    component.form.controls.repeatMode.setValue('NONE');
    expect(component.form.controls.isRepeat.value).toBeFalse();
    expect(component.form.controls.repeatDurationWeeks.disabled).toBeTrue();
    expect(component.form.controls.repeatHasEnd.disabled).toBeTrue();
    expect(component.form.controls.repeatEveryWeeks.disabled).toBeTrue();
    expect(component.form.valid).toBeTrue();
    component.save();
    expect(close).toHaveBeenCalledWith(jasmine.objectContaining({repeat:null}));
  });
  it('re-enables the relevant interval and duration checks when selected again', () => {
    component.form.controls.type.setValue('WATER_CHANGE');
    component.form.controls.isRepeat.setValue(true);
    component.form.controls.repeatMode.setValue('EVERY_X_WEEKS');
    component.form.controls.repeatEveryWeeks.setValue(1);
    expect(component.form.invalid).toBeTrue();
    component.form.controls.isRepeat.setValue(false);
    expect(component.form.valid).toBeTrue();
    component.form.controls.isRepeat.setValue(true);
    expect(component.form.controls.repeatMode.value).toBe('WEEKLY');
    expect(component.form.controls.repeatEveryWeeks.disabled).toBeTrue();
    component.form.controls.repeatMode.setValue('EVERY_X_WEEKS');
    expect(component.form.invalid).toBeTrue();
  });
  it('keeps the draft on failure, prevents duplicate saves and allows retry', () => {
    const response = new Subject<any>();
    create.and.returnValue(response);
    component.form.controls.type.setValue('WATER_CHANGE');
    component.save();component.save();
    expect(create).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    response.error(new Error('offline'));
    expect(component.saving).toBeFalse();
    expect(component.saveError).toContain('saisie est conservée');
    create.and.callFake(payload=>of({id:50,...payload}));
    component.save();
    expect(close).toHaveBeenCalledWith(jasmine.objectContaining({id:50,type:'WATER_CHANGE'}));
  });
});
