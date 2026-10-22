import type { RequestHandler } from 'express';
import { assertResponse, findEndpoint } from '@tobu/contracts/endpoints';

export const contractResponses: RequestHandler = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (findEndpoint(req.method, req.path)) {
      // Match Express/Mongoose JSON serialization, including ObjectId and Date.toJSON.
      assertResponse(req.method, req.path, res.statusCode, JSON.parse(JSON.stringify(body)));
    }
    return json(body);
  };
  next();
};
