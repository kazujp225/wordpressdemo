import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 600000; // NIST SP 800-132 推奨（2024年以降）

// PBKDF2で安全に鍵導出（ランダムsalt版・新規暗号化用）
function deriveKey(key: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(key, salt, PBKDF2_ITERATIONS, 32, 'sha256');
}

function getEncryptionKeyRaw(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }

  return key;
}

// 旧方式: 固定salt PBKDF2鍵導出（既存データの復号用、移行後に削除）
function getLegacyPBKDF2Key(): Buffer {
  const key = getEncryptionKeyRaw();
  const salt = 'lpnavix-encryption-salt';
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
}

// 旧方式の鍵導出（既存データの復号用、移行後に削除）
function getLegacySHA256Key(): Buffer {
  const key = getEncryptionKeyRaw();
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(text: string): string {
  const rawKey = getEncryptionKeyRaw();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(rawKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Format: v2:salt:iv:tag:encrypted （v2でランダムsalt版を識別）
  return `v2:${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decryptWithKey(key: Buffer, iv: Buffer, tag: Buffer, encrypted: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');

  // v2形式: v2:salt:iv:tag:encrypted（ランダムsalt）
  if (parts[0] === 'v2' && parts.length === 5) {
    const rawKey = getEncryptionKeyRaw();
    const salt = Buffer.from(parts[1], 'hex');
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encrypted = parts[4];
    const key = deriveKey(rawKey, salt);
    return decryptWithKey(key, iv, tag, encrypted);
  }

  // v1形式: iv:tag:encrypted（固定salt PBKDF2 または 旧SHA256）
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  // まず固定salt PBKDF2鍵で復号を試みる
  try {
    const key = getLegacyPBKDF2Key();
    return decryptWithKey(key, iv, tag, encrypted);
  } catch (e) {
    console.warn('[ENCRYPTION] PBKDF2 decryption failed, trying legacy SHA256 fallback');
    // 旧SHA256鍵で復号を試みる（移行期間中のみ）
    try {
      const legacyKey = getLegacySHA256Key();
      return decryptWithKey(legacyKey, iv, tag, encrypted);
    } catch (e2) {
      console.error('[ENCRYPTION] All decryption methods failed');
      throw new Error('Decryption failed: unable to decrypt with any known key format');
    }
  }
}
