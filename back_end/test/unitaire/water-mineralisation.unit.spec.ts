import { validate } from 'class-validator';
import { CreateWaterMeasurementDto } from '../../src/water-measurement/dto/create-water-measurement.dto';
describe('Optional mineralisation inputs',()=>{
  it.each([{}, {tds:0,conductivity:0},{tds:160.5,conductivity:324.5}])('accepts missing, zero or decimal readings: %j',async values=>{
    const dto=Object.assign(new CreateWaterMeasurementDto(),{measuredAt:'2026-10-30T10:00:00Z'},values);
    expect(await validate(dto)).toHaveLength(0);
  });
  it.each([{tds:-1},{conductivity:-1},{tds:Infinity},{tds:'160'},{conductivity:200001}])('rejects invalid values: %j',async values=>{
    const dto=Object.assign(new CreateWaterMeasurementDto(),{measuredAt:'2026-10-30T10:00:00Z'},values);
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
