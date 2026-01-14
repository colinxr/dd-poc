export class GraphQLError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public originalError?: unknown,
    public graphqlErrors?: Array<unknown>,
  ) {
    super(message);
    this.name = "GraphQLError";
  }
}

export class CustomerCreationError extends Error {
  public statusCode = 422;

  constructor(
    public errors: Array<{ field: string; message: string }>,
  ) {
    super("Customer creation failed");
    this.name = "CustomerCreationError";
  }
}

export class CustomerAlreadyExistsError extends Error {
  public statusCode = 409;

  constructor(public existingCustomerId: string) {
    super("Customer already exists");
    this.name = "CustomerAlreadyExistsError";
  }
}
