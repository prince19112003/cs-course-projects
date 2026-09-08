import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Hashes a plaintext password using bcrypt with salt work factor 12.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Validates password strength according to SECURITY_RULES.md:
 * - Minimum 8 characters
 * - At least one uppercase or lowercase letter
 * - At least one numeric digit
 * - At least one special character
 */
export function validatePasswordRequirements(password: string): PasswordValidationResult {
  if (!password || password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters in length.',
    };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one letter.',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number.',
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one special character (!@#$%^&*...).',
    };
  }

  return { valid: true };
}
