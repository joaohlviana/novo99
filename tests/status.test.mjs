import { test } from 'node:test'; import assert from 'node:assert/strict';
import { capabilityStatus } from '../lib/status.mjs';
test('unfinished integrations remain unavailable',()=>{assert.deepEqual(capabilityStatus(),{version:'1',auth:{email:false,google:false},search:{enabled:false},storage:{enabled:false},billing:{enabled:false}})});
