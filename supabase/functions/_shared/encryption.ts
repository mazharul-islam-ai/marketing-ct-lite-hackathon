/**
 * Encryption utilities for securing sensitive data in edge functions
 * Uses AES-GCM encryption with Web Crypto API
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Gets the encryption key from environment
 * In production, this should be a secure, randomly generated key stored in environment variables
 */
function getEncryptionKey(): string {
  const key = Deno.env.get('ENCRYPTION_KEY');

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  return key;
}

/**
 * Derives a crypto key from the encryption key string
 */
async function deriveKey(keyString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);

  // Hash the key to ensure it's the right length
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string value
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted data with IV prepended
 */
export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) {
    return '';
  }

  try {
    const keyString = getEncryptionKey();
    const key = await deriveKey(keyString);

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encode the plaintext
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv, 0);
    combined.set(encryptedArray, iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
      throw error;
    }
    throw new Error('Failed to encrypt value');
  }
}

/**
 * Decrypts an encrypted string value
 * @param encryptedText - Base64-encoded encrypted data with IV prepended
 * @returns Decrypted plaintext string
 */
export async function decryptValue(encryptedText: string): Promise<string> {
  if (!encryptedText) {
    return '';
  }

  try {
    const keyString = getEncryptionKey();
    const key = await deriveKey(keyString);

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encryptedData
    );

    // Decode the plaintext
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt value');
  }
}

/**
 * Checks if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    return !!Deno.env.get('ENCRYPTION_KEY');
  } catch {
    return false;
  }
}
