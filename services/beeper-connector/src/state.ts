import fs from 'node:fs';
import path from 'node:path';

export type ThreadState = {
  lastTimestampMs?: number;
};

export type ConnectorState = {
  threads: Record<string, ThreadState>; // key: threadID
};

const defaultState: ConnectorState = { threads: {} };

export class StateStore {
  private filePath: string;

  constructor(filePath?: string) {
    const resolved = filePath && filePath.trim().length > 0
      ? filePath
      : path.resolve(process.cwd(), '.beeper-connector-state.json');
    this.filePath = resolved;
  }

  public load(): ConnectorState {
    try {
      if (!fs.existsSync(this.filePath)) return { ...defaultState };
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { ...defaultState };
      return { threads: parsed.threads ?? {} };
    } catch {
      return { ...defaultState };
    }
  }

  public save(state: ConnectorState): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
  }
}


