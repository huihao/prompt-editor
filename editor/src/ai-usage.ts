export type AIUsageFeature = 'enhance' | 'orchestration' | 'autocomplete';

export interface AIUsageRecord {
  timestamp: number;
  feature: AIUsageFeature;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  noCacheTokens?: number;
}

export interface AIUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  noCacheTokens: number;
  totalTokens: number;
}

export interface AIUsageGroup extends AIUsageTotals {
  key: string;
  recordCount: number;
}

export interface AIUsageDay extends AIUsageTotals {
  date: string;
  recordCount: number;
}

export interface AIUsageSummary {
  recordCount: number;
  totals: AIUsageTotals;
  cacheHitRate: number | null;
  byFeature: AIUsageGroup[];
  byModel: AIUsageGroup[];
  byDay: AIUsageDay[];
}

const STORAGE_KEY = 'promptEditor:aiUsage';
const RETENTION_MS = 30 * 86_400_000;

function emptyTotals(): AIUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    noCacheTokens: 0,
    totalTokens: 0,
  };
}

function isUsageRecord(value: unknown): value is AIUsageRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<AIUsageRecord>;
  return typeof record.timestamp === 'number'
    && typeof record.feature === 'string'
    && typeof record.provider === 'string'
    && typeof record.model === 'string';
}

function readRecords(): AIUsageRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isUsageRecord) : [];
  } catch {
    return [];
  }
}

function retainedRecords(records: AIUsageRecord[]): AIUsageRecord[] {
  const cutoff = Date.now() - RETENTION_MS;
  return records.filter(record => record.timestamp >= cutoff);
}

function addUsage(totals: AIUsageTotals, record: AIUsageRecord): void {
  totals.inputTokens += record.inputTokens ?? 0;
  totals.outputTokens += record.outputTokens ?? 0;
  totals.cacheReadTokens += record.cacheReadTokens ?? 0;
  totals.cacheWriteTokens += record.cacheWriteTokens ?? 0;
  totals.noCacheTokens += record.noCacheTokens ?? 0;
  totals.totalTokens += (record.inputTokens ?? 0) + (record.outputTokens ?? 0);
}

function createGroup(key: string): AIUsageGroup {
  return { key, recordCount: 0, ...emptyTotals() };
}

function utcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function recordAIUsage(record: AIUsageRecord): void {
  const records = retainedRecords(readRecords());
  records.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function clearAIUsage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAIUsageSummary(): AIUsageSummary {
  const records = retainedRecords(readRecords());
  const totals = emptyTotals();
  const byFeature = new Map<string, AIUsageGroup>();
  const byModel = new Map<string, AIUsageGroup>();
  const byDay = new Map<string, AIUsageDay>();

  for (const record of records) {
    addUsage(totals, record);

    const feature = byFeature.get(record.feature) ?? createGroup(record.feature);
    feature.recordCount += 1;
    addUsage(feature, record);
    byFeature.set(record.feature, feature);

    const modelKey = `${record.provider}/${record.model}`;
    const model = byModel.get(modelKey) ?? createGroup(modelKey);
    model.recordCount += 1;
    addUsage(model, record);
    byModel.set(modelKey, model);

    const date = utcDate(record.timestamp);
    const day = byDay.get(date) ?? { date, recordCount: 0, ...emptyTotals() };
    day.recordCount += 1;
    addUsage(day, record);
    byDay.set(date, day);
  }

  const cacheHitRate = totals.inputTokens > 0 ? totals.cacheReadTokens / totals.inputTokens : null;
  const byTotal = (a: AIUsageGroup, b: AIUsageGroup) => b.totalTokens - a.totalTokens;

  return {
    recordCount: records.length,
    totals,
    cacheHitRate,
    byFeature: [...byFeature.values()].sort(byTotal),
    byModel: [...byModel.values()].sort(byTotal),
    byDay: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: value >= 1000 ? 'compact' : 'standard' }).format(value);
}

export function formatUsageLine(usage: Omit<AIUsageRecord, 'timestamp' | 'feature' | 'provider' | 'model'> | undefined): string | null {
  if (!usage) return null;
  const parts: string[] = [];
  if (usage.inputTokens !== undefined) parts.push(`${formatTokenCount(usage.inputTokens)} input`);
  if (usage.outputTokens !== undefined) parts.push(`${formatTokenCount(usage.outputTokens)} output`);
  if (usage.cacheReadTokens !== undefined) parts.push(`${formatTokenCount(usage.cacheReadTokens)} cache read`);
  if (usage.cacheWriteTokens !== undefined) parts.push(`${formatTokenCount(usage.cacheWriteTokens)} cache write`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
