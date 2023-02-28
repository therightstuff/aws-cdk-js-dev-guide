export class WrappedError extends Error {
    cause: any;
    constructor(message: string, cause: any) {
        super(message);
        this.cause = cause;
        this.name = 'WrappedError';
    }
}
