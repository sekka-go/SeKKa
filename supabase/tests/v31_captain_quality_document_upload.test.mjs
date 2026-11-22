import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../migrations/20261117183000_v31_captain_quality_document_upload.sql',import.meta.url),'utf8');
test('private Storage path and document registration both accept literal extension dots',()=>{
 assert.match(migration,/DROP POLICY IF EXISTS "v31 captain private document upload"/);
 assert.match(migration,/FOR INSERT TO authenticated/);
 assert.match(migration,/storage\.foldername\(name\)/);
 assert.match(migration,/v31_register_captain_document/);
 assert.equal(migration.split('[0-9a-f-]{36}[.](jpg|png|pdf)$').length-1,2);
 assert.match(migration,/a\.status IN \('draft','rejected'\)/);
});
test('server requires three names, meaningful background and 0–30 experience at save/submit/Admin review',()=>{
 assert.equal(migration.split("regexp_split_to_array(trim(").length>=4,true);
 assert.match(migration,/p_experience>30/);
 assert.equal(migration.split('NOT BETWEEN 0 AND 30').length-1,2);
 assert.match(migration,/char_length\(trim\(coalesce\(app\.professional_notes/);
});
test('server normalizes plate digits and checks common Egyptian plate formats at three gates',()=>{
 assert.match(migration,/٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹/);
 assert.equal(migration.split("[ء-ي]{3}[0-9]{3}").length-1,3);
 assert.match(migration,/DUPLICATE_LICENSE_PLATE/);
});
