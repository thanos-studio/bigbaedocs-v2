import 'server-only';

import crypto from 'node:crypto';

const HOST = 'https://paste.sh';
const KEY_SUFFIX = HOST;
const CONTENT_TYPE = 'text/vnd.paste.sh-v2';
const ACCEPT = 'text/plain, text/vnd.paste.sh-v2, text/vnd.paste.sh-v3';
const MAX_CIPHERTEXT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 15_000;

export class PasteShError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasteShError';
  }
}

function randomBase64Url(bytes: number): string {
  return crypto.randomBytes(bytes).toString('base64url').replace(/=+$/, '');
}

/** paste.sh 클라이언트의 writekey()와 바이트 단위로 같아야 복호가 된다. */
function buildPassword(id: string, serverKey: string, clientKey: string): string {
  return `${id}${serverKey}${clientKey}${KEY_SUFFIX}`;
}

function deriveKeyAndIv(password: string, salt: Buffer): { key: Buffer; iv: Buffer } {
  const derived = crypto.pbkdf2Sync(password, salt, 1, 48, 'sha512');
  return { key: derived.subarray(0, 32), iv: derived.subarray(32, 48) };
}

/** ETag에 들어가는 인증 태그. HMAC 키를 "auth key"로 한 번 더 유도한다. */
function authTag(password: string, salted: Buffer): string {
  const inner = crypto.createHmac('sha512', 'auth key').update(password).digest();
  return crypto.createHmac('sha512', inner).update(salted).digest('base64').replace(/=+$/, '');
}

export type PasteLocation = { id: string; key: string };

export async function createPaste(plaintext: string): Promise<PasteLocation> {
  const id = randomBase64Url(6);
  const clientKey = randomBase64Url(18);
  const serverKey = randomBase64Url(6);
  const password = buildPassword(id, serverKey, clientKey);

  const salt = crypto.randomBytes(8);
  const { key, iv } = deriveKeyAndIv(password, salt);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const salted = Buffer.concat([Buffer.from('Salted__', 'ascii'), salt, encrypted]);

  if (salted.length > MAX_CIPHERTEXT_BYTES) {
    throw new PasteShError('공유할 내용이 너무 커요.');
  }

  const response = await fetch(`${HOST}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': CONTENT_TYPE,
      'X-Server-Key': serverKey,
      ETag: `"${authTag(password, salted)}"`,
    },
    body: salted.toString('base64').replace(/\r?\n/g, ''),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new PasteShError(`paste.sh 업로드 실패 (${response.status})`);
  }

  return { id, key: clientKey };
}

export async function readPaste({ id, key }: PasteLocation): Promise<string> {
  const response = await fetch(`${HOST}/${encodeURIComponent(id)}.txt`, {
    headers: { Accept: ACCEPT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new PasteShError(`paste.sh 조회 실패 (${response.status})`);
  }

  const body = await response.text();
  const newline = body.indexOf('\n');
  if (newline === -1) {
    throw new PasteShError('paste.sh 응답 형식이 올바르지 않아요.');
  }

  const serverKey = body.slice(0, newline).trim();
  const salted = Buffer.from(body.slice(newline + 1).replace(/\s/g, ''), 'base64');

  if (salted.length < 32 || salted.subarray(0, 8).toString('ascii') !== 'Salted__') {
    throw new PasteShError('공유 데이터가 손상됐어요.');
  }

  const password = buildPassword(id, serverKey, key);
  const etag = response.headers.get('etag');
  if (etag !== null) {
    const expected = etag.replace(/"/g, '');
    const actual = authTag(password, salted);
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new PasteShError('공유 링크의 키가 올바르지 않아요.');
    }
  }

  const { key: aesKey, iv } = deriveKeyAndIv(password, salted.subarray(8, 16));
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);

  try {
    return Buffer.concat([
      decipher.update(salted.subarray(16)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new PasteShError('공유 링크의 키가 올바르지 않아요.');
  }
}
