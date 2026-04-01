export function createAuthGuard() {
	return (req: any, res: any, next: any): void => {
		if (!req.user) {
			return res.status(401).json({ error: "Authentication required" });
		}
		next();
	};
}
