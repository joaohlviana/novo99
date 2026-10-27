import { test } from 'node:test'; import assert from 'node:assert/strict';
import { supabaseConfig } from '../lib/config.mjs';
test('only the new Supabase project and a publishable key are accepted',()=>{
 const valid={NEXT_PUBLIC_SUPABASE_URL:'https://rycaxboqkkiopjdecgld.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'};
 assert.deepEqual(supabaseConfig(valid),{url:valid.NEXT_PUBLIC_SUPABASE_URL,key:valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});
 for(const env of [{},{...valid,NEXT_PUBLIC_SUPABASE_URL:'https://old.supabase.co'},{...valid,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_synthetic'}])assert.equal(supabaseConfig(env),null);
});
