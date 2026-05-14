import { NextResponse } from "next/server";
import { AuthError } from "./auth";

/**
 * Wrap a route handler so AuthError → proper HTTP status,
 * other errors → 500 with logged detail.
 */
export function withAuthErrors<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "internal", detail },
        { status: 500 }
      );
    }
  };
}
