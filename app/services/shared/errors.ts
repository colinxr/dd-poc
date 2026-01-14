export class ValidationError extends Error {
  public statusCode = 400;

  constructor(
    public errors: Array<{ field: string; message: string }>
  ) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}
