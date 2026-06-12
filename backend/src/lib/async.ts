import type { Request, Response, NextFunction, RequestHandler } from "express";

/** Wrap an async route so thrown errors reach the Express error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
