import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalBytes, CanonicalizationError } from '../../src/attestation/canonical.js';

describe('canonical serialization (JCS subset)', () => {
  it('is independent of key insertion order', () => {
    const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
    const b = { c: { y: 2, z: 1 }, a: 2, b: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(a)).toBe('{"a":2,"b":1,"c":{"y":2,"z":1}}');
  });

  it('sorts keys ascending by UTF-16 code unit', () => {
    expect(canonicalize({ B: 1, a: 2, A: 3, b: 4 })).toBe('{"A":3,"B":1,"a":2,"b":4}');
  });

  it('preserves array order (ordering is semantic)', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalize([3, 1, 2])).not.toBe(canonicalize([1, 2, 3]));
  });

  it('omits undefined fields — one representation per value', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
  });

  it('distinguishes omitted from explicit null', () => {
    expect(canonicalize({ a: null })).toBe('{"a":null}');
    expect(canonicalize({ a: null })).not.toBe(canonicalize({}));
  });

  it('emits compact output with no whitespace or trailing newline', () => {
    const out = canonicalize({ a: [1, 2], b: 'x' });
    expect(out).toBe('{"a":[1,2],"b":"x"}');
    expect(out).not.toMatch(/\s/);
    expect(out.endsWith('\n')).toBe(false);
  });

  it('round-trips: parsing canonical output yields an equal value', () => {
    const value = { z: [1, { b: true, a: null }], a: 'text with "quotes" and \\ backslash' };
    expect(JSON.parse(canonicalize(value))).toEqual(JSON.parse(JSON.stringify(value)));
  });

  it('rejects non-integer numbers', () => {
    expect(() => canonicalize({ confidence: 0.87 })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ confidence: 0.87 })).toThrow(/non-integer/);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => canonicalize({ n: NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ n: Infinity })).toThrow(/non-finite/);
  });

  it('rejects unsafe integers', () => {
    expect(() => canonicalize({ n: Number.MAX_SAFE_INTEGER + 2 })).toThrow(/safe range/);
  });

  it('normalizes -0 to 0 so two spellings cannot differ in bytes', () => {
    expect(canonicalize({ n: -0 })).toBe(canonicalize({ n: 0 }));
  });

  it('escapes strings per JSON, including unicode and control characters', () => {
    expect(canonicalize({ s: 'a\nb\t"c"' })).toBe(JSON.stringify({ s: 'a\nb\t"c"' }));
    expect(canonicalize({ s: '§164.312(b)' })).toContain('§164.312(b)');
  });

  it('canonicalBytes produces UTF-8 bytes matching canonicalize()', () => {
    const value = { control: '§164.312(b)', n: 1 };
    expect(canonicalBytes(value).toString('utf-8')).toBe(canonicalize(value));
    expect(canonicalBytes(value)).toBeInstanceOf(Buffer);
  });

  it('handles deep nesting deterministically', () => {
    const deep = { a: { b: { c: { d: [{ f: 2, e: 1 }] } } } };
    expect(canonicalize(deep)).toBe('{"a":{"b":{"c":{"d":[{"e":1,"f":2}]}}}}');
  });

  it('throws on undefined at the root', () => {
    expect(() => canonicalize(undefined as never)).toThrow(/undefined at root/);
  });
});
