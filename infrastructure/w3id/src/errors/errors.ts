export class MalformedIndexChainError extends Error {
	constructor(message: string = "Malformed index chain detected") {
		super(message);
		this.name = "MalformedIndexChainError";
	}
}

export class MalformedHashChainError extends Error {
	constructor(message: string = "Malformed hash chain detected") {
		super(message);
		this.name = "MalformedHashChainError";
	}
}

export class BadSignatureError extends Error {
	constructor(message: string = "Bad signature detected") {
		super(message);
		this.name = "BadSignatureError";
	}
}

export class BadNextKeySpecifiedError extends Error {
	constructor(message: string = "Bad next key specified") {
		super(message);
		this.name = "BadNextKeySpecifiedError";
	}
}

export class BadOptionsSpecifiedError extends Error {
	constructor(message: string = "Bad options specified") {
		super(message);
		this.name = "BadOptionsSpecifiedError";
	}
}
