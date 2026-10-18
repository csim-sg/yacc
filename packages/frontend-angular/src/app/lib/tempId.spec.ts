import { generateTempId, isTempId } from './tempId';

/** tempId port spec (React `lib/generateTempId.ts`, T2 §3.1). */
describe('tempId', () => {
  it('generates temp-prefixed ids with timestamp and random part', () => {
    const id = generateTempId();

    expect(id).toMatch(/^temp-\d+-[a-z0-9]+$/);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateTempId()));

    expect(ids.size).toBe(50);
  });

  it('recognizes temp ids and rejects server ids', () => {
    expect(isTempId(generateTempId())).toBe(true);
    expect(isTempId('8f1d2b34-5678-4abc-9def-0123456789ab')).toBe(false);
    expect(isTempId('')).toBe(false);
  });
});
