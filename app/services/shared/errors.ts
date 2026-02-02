export class ValidationError extends Error {
  public statusCode = 422;

  constructor(
    public errors: Array<{ field: string; message: string }>
  ) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}
