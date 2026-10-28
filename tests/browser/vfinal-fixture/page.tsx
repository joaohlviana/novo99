'use client';
// Test-only fixture: never imported by the application or deployed as a route.
import { useEffect, useState } from 'react';
import { TrainerOnboarding } from '../../../components/onboarding/TrainerOnboarding';
const cities = [
  { id: '4127700', name: 'Toledo', uf: 'PR' },
  { id: '3169303', name: 'Toledo', uf: 'MG' },
  { id: '4104808', name: 'Cascavel', uf: 'PR' },
];
async function lookupCities(query: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error('aborted');
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return cities.filter(city => city.name.toLowerCase().includes(normalized));
}
async function searchSports(query: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error('aborted');
  return query.toLowerCase().startsWith('nat') ? ['natacao'] : [];
}
async function saveDraft() { throw new Error('synthetic save failure'); }
export default function Fixture() {
  const [scope, setScope] = useState('synthetic-session-A');
  const [, forceRender] = useState(0);
  useEffect(() => {
    Object.assign(window, { __fixtureSetScope: setScope, __fixtureRerender: () => forceRender(value => value + 1) });
    return () => { Reflect.deleteProperty(window, '__fixtureSetScope'); Reflect.deleteProperty(window, '__fixtureRerender'); };
  }, []);
  return <TrainerOnboarding sessionScope={scope} lookupCities={lookupCities} searchSports={searchSports} saveDraft={saveDraft} />;
}
