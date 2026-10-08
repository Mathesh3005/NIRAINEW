import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const storePath = process.env.NIRAI_CASES_FILE ||
  join(process.env.LOCALAPPDATA || homedir(), 'NIRAI', 'backend-cases.json');

export function loadCases(seedCases) {
  let storedCases;
  try {
    storedCases = JSON.parse(readFileSync(storePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return seedCases;
    throw new Error(`Unable to load saved NIRAI cases from ${storePath}: ${error.message}`);
  }

  if (!Array.isArray(storedCases) || storedCases.some(item =>
    !item || typeof item.id !== 'string' || typeof item.status !== 'string')) {
    throw new Error(`Saved NIRAI cases at ${storePath} have an invalid format.`);
  }

  return storedCases;
}

export function saveCases(cases) {
  mkdirSync(dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(cases, null, 2), 'utf8');
  renameSync(temporaryPath, storePath);
}
