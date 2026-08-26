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
