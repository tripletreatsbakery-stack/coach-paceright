import test from 'node:test';
import assert from 'node:assert/strict';
import {time,sortRows,delimited} from '../src/format.js';
test('time formatting rounds across minute boundary and preserves missing values',()=>{assert.equal(time(959.96),'16:00.0');assert.equal(time(null),'Unavailable');assert.equal(time(0),'00:00.0');assert.equal(time(1001.23),'16:41.2');});
test('numeric sorting keeps nulls last in both directions without mutating data',()=>{const rows=[{v:null},{v:1000},{v:900}];assert.deepEqual(sortRows(rows,'v').map(r=>r.v),[900,1000,null]);assert.deepEqual(sortRows(rows,'v',-1).map(r=>r.v),[1000,900,null]);assert.equal(rows[0].v,null);});
test('CSV quotes embedded commas, quotes, newlines and neutralizes formulas',()=>{const text=delimited([{key:'v',label:'Athlete'}],[{v:'A, "B"\nC'},{v:'=HYPERLINK("bad")'},{v:null}]);assert.ok(text.includes('"A, ""B""\nC"'));assert.ok(text.includes('"\'=HYPERLINK'));assert.ok(text.endsWith('"Unavailable"'));});
