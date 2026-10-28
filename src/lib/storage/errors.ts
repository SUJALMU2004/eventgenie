export class StorageFailure extends Error {
  constructor(
    public code:
      | "UNAVAILABLE"
      | "CORRUPT"
      | "INCOMPATIBLE"
      | "WRITE_FAILED"
      | "NOT_FOUND"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "StorageFailure";
  }
}
