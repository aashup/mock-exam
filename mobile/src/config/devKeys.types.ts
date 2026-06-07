import type {AIProvider} from '@/types/models';

/** Optional dev seed keys, one per AI provider. Empty = skip seeding. */
export type DevKeys = Partial<Record<AIProvider, string>>;
