export type ErrorCallback = (err: Error) => void;

export type PendingCallback = (line: string, next: (err?: Error) => void) => void;