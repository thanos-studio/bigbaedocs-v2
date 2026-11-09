'use client';

/**
 * 보고서 첨부 사진 저장소(IndexedDB).
 * 사진은 한 장에 수백 KB 라서 localStorage(도메인당 5MB 안팎)에 넣으면 금방 가득 차고,
 * 그러면 글까지 저장되지 않는다. 그래서 사진 데이터만 여기에 두고 초안에는 참조(id)만 남긴다.
 */

const DB_NAME = 'bigbaedocs-photos';
const STORE = 'photos';

let opened: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (opened) return opened;

  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저에서는 사진을 저장할 수 없어요.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('사진 저장소를 열지 못했어요.'));
  });

  // 실패하면 다음 호출에서 다시 시도할 수 있도록 캐시를 비운다.
  opened = attempt.catch((error: unknown) => {
    opened = null;
    throw error;
  });
  return opened;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('사진을 저장하지 못했어요.'));
  });
}

export async function putPhoto(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(dataUrl, id);
  await done(transaction);
}

/** 있는 것만 돌려준다. 저장소를 못 열면 빈 결과다(글은 그대로 쓸 수 있어야 한다). */
export async function getPhotos(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  try {
    const db = await openDb();
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const entries = await Promise.all(ids.map(async (id) => [id, await wrap(store.get(id))] as const));
    return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

export async function deletePhotos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await openDb();
    const transaction = db.transaction(STORE, 'readwrite');
    ids.forEach((id) => transaction.objectStore(STORE).delete(id));
    await done(transaction);
  } catch {
    // 지우지 못해도 앱 동작에는 영향이 없다. 다음에 다시 지워진다.
  }
}

export async function clearPhotos(): Promise<void> {
  try {
    const db = await openDb();
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).clear();
    await done(transaction);
  } catch {
    // 위와 같다.
  }
}
