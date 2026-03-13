declare global {
	namespace Express {
		interface Request {
			user?: {
				id: string;
				ename: string;
				[key: string]: unknown;
			};
		}
	}
}

export {};
