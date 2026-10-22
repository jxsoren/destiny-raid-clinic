import { describe, expect, it } from 'vitest';
import { SIM_PACKAGE_READY } from '../src/index';

describe('package scaffold', () => {
  it('builds and runs a test', () => {
    expect(SIM_PACKAGE_READY).toBe(true);
  });
});
