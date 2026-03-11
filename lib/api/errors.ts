import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error: unknown) {
  const isProduction = process.env.NODE_ENV === "production";

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.flatten(),
      },
      { status: 400 }
    );
  }

  if (error instanceof ApiError) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const exposeError = !isProduction || status < 500;
    if (!exposeError) {
      console.error(error);
    }

    return NextResponse.json(
      {
        error: exposeError ? error.message : "SYSTEM_FAULT",
        details: exposeError ? (error.details ?? null) : null,
      },
      { status }
    );
  }

  console.error(error);

  if (isProduction) {
    return NextResponse.json({ error: "SYSTEM_FAULT" }, { status: 500 });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
