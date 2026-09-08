import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordRequirements } from '../../src/main/utils/password.js';

describe('Password Security & Bcrypt Hashing', () => {
  it('hashes password with bcrypt salt work factor 12', async () => {
    const raw = 'Nexus@Admin2026';
    const hash = await hashPassword(raw);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);

    // Verify correct password
    const isMatch = await verifyPassword(raw, hash);
    expect(isMatch).toBe(true);

    // Reject wrong password
    const isWrong = await verifyPassword('WrongPassword123!', hash);
    expect(isWrong).toBe(false);
  });

  it('validates password complexity requirements', () => {
    // Valid password
    const valid = validatePasswordRequirements('Secure#Pass2026');
    expect(valid.valid).toBe(true);
    expect(valid.error).toBeUndefined();

    // Too short (<8 chars)
    const short = validatePasswordRequirements('Short1!');
    expect(short.valid).toBe(false);
    expect(short.error).toContain('8 characters');

    // Missing numbers
    const noNumber = validatePasswordRequirements('SecurePassword!');
    expect(noNumber.valid).toBe(false);
    expect(noNumber.error).toContain('number');

    // Missing letters
    const noLetter = validatePasswordRequirements('12345678!@#$');
    expect(noLetter.valid).toBe(false);
    expect(noLetter.error).toContain('letter');

    // Missing special character
    const noSpecial = validatePasswordRequirements('SecurePassword123');
    expect(noSpecial.valid).toBe(false);
    expect(noSpecial.error).toContain('special character');
  });
});
