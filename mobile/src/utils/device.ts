import {getMeta, setMeta} from '@/db/database';

/** Cheap RFC4122-ish uuid v4 (no native dependency required). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Returns a stable per-install device id, generating one on first use. */
export async function getDeviceId(): Promise<string> {
  let id = await getMeta('device_id');
  if (!id) {
    id = uuid();
    await setMeta('device_id', id);
  }
  return id;
}
