import rfs from "../src/index.js";

console.log('Retrospective Data:');
console.log(await rfs.v2.retrospective({riverId: 710431167, resolution: 'hourly'}));
console.log(await rfs.v2.retrospective({riverId: 710431167, resolution: 'daily'}));
console.log(await rfs.v2.retrospective({riverId: 710431167, resolution: 'monthly'}));
console.log(await rfs.v2.retrospective({riverId: 710431167, resolution: 'yearly'}));

console.log('\nReturn Periods Data:');
console.log(await rfs.v2.returnPeriods({riverId: 710431167}));

console.log('\nForecast Data:');
console.log(await rfs.v2.forecast({riverId: 710431167, date: '20251015'}));

console.log('\n=== v2 metadata ===');
console.log('River -> VPU:', await rfs.v2.riverToVpu({riverId: 710431167}));
const v2coords = await rfs.v2.riverToLatlon({riverId: 710431167});
console.log('River -> Lat/Lon:', v2coords);
console.log('Lat/Lon -> River (round-trip, should return 710431167):', await rfs.v2.latlonToRiver({lat: v2coords.lat, lon: v2coords.lon}));
console.log('Metadata (subset):', await rfs.v2.metadataTable({riverId: 710431167, columns: ['VPUCode', 'strmOrder', 'TDXHydroRegion']}));

console.log('\n=== v2 precomputed products ===');
const v2fdc = await rfs.v2.fdc({riverId: 710431167, resolution: 'daily', fdcType: 'annual'});
console.log('FDC annual:', {points: v2fdc.p_exceed.length, p0: v2fdc.Q[0], p50: v2fdc.Q[50], p100: v2fdc.Q[100], monotonic: v2fdc.Q.every((q, i) => i === 0 || q <= v2fdc.Q[i - 1])});
const v2fdcM = await rfs.v2.fdc({riverId: 710431167, fdcType: 'monthly'});
console.log('FDC monthly:', {months: v2fdcM.Q.length, pPerMonth: v2fdcM.Q[0].length});
const v2sfdc = await rfs.v2.sfdc({riverId: 710431167});
console.log('SFDC:', {pExceed: v2sfdc.p_exceed.length, months: v2sfdc.month.length});
const v2poly = await rfs.v2.polyfits({riverId: 710431167});
console.log('Polyfits:', {months: v2poly.month.length, ptoqDegrees: v2poly.PtoQ[0].length, qrangeMonth0: v2poly.Qrange[0]});
try {
  const v2wse = await rfs.v2.hydrowebWse({riverId: 710431167});
  console.log('Hydroweb WSE:', {months: v2wse.month.length, pExceed: v2wse.p_exceed.length});
} catch (e) {
  console.log('Hydroweb WSE:', e.message);
}

console.log('\n=== v2 forecast listing ===');
const v2dates = await rfs.v2.dates();
console.log('Dates:', {count: v2dates.length, first: v2dates[0], last: v2dates[v2dates.length - 1], sorted: v2dates.every((d, i) => i === 0 || d >= v2dates[i - 1])});
const v2rec = await rfs.v2.forecastRecords({riverId: 710431167, startDate: v2dates[0], endDate: v2dates[2]});
const t = v2rec.time;
console.log('Forecast record:', {
  points: t.length,
  span: t.length ? `${t[0].toISOString()} -> ${t[t.length - 1].toISOString()}` : 'empty',
  ascending: t.every((d, i) => i === 0 || d > t[i - 1]),
  envelopeOk: v2rec.flow_median.every((med, i) => v2rec.flow_uncertainty_lower[i] <= med && med <= v2rec.flow_uncertainty_upper[i]),
  allFinite: v2rec.flow_median.every(v => Number.isFinite(v) && v >= 0),
});
