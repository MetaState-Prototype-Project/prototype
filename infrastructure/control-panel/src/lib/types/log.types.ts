export interface UploadEvent {
	timestamp: Date;
	action: 'upload';
	message: string;
	to: string;
}

export interface FetchEvent {
	timestamp: Date;
	action: 'fetch';
	message: string;
	from: string;
}

export interface WebhookEvent {
	timestamp: Date;
	action: 'webhook';
	from: string;
	to: string;
}

export type LogEvent = UploadEvent | FetchEvent | WebhookEvent;
