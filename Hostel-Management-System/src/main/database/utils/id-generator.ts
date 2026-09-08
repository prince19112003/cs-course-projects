import crypto from 'crypto';

export type EntityPrefix = 
  | 'INST'
  | 'HST'
  | 'BLK'
  | 'FLR'
  | 'RM'
  | 'BED'
  | 'STU'
  | 'GRD'
  | 'ALC'
  | 'ATT'
  | 'GP'
  | 'CMP'
  | 'NOT'
  | 'INV'
  | 'TXN'
  | 'STF'
  | 'VIS'
  | 'AST'
  | 'DOC'
  | 'USR'
  | 'AUD';

/**
 * Standardized entity identifier generator matching DATABASE_SCHEMA.md.
 * Format: PREFIX-XXXX (monotonic timestamp hex + cryptographically secure random bytes)
 */
export function generateEntityId(prefix: EntityPrefix, length: number = 8): string {
  const randomHex = crypto.randomBytes(Math.ceil(length / 2)).toString('hex').toUpperCase().slice(0, length);
  return `${prefix}-${randomHex}`;
}

export function generateInvoiceId(billingCycle: string, sequence: number): string {
  const cleanCycle = billingCycle.replace('-', '');
  const seqStr = String(sequence).padStart(4, '0');
  return `INV-${cleanCycle}-${seqStr}`;
}
