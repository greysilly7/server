/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import bodyParser, { OptionsJson } from "body-parser";
import { NextFunction, Request, Response } from "express";
import { HTTPError } from "lambert-server";

export function BodyParser(opts?: OptionsJson) {
	const jsonParser = bodyParser.json(opts);

	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.headers["content-type"])
			req.headers["content-type"] = "application/json";

		jsonParser(req, res, (err) => {
			if (err) {
				switch (err.type) {
					case "entity.too.large":
						return next(
							new HTTPError("Request body too large", 413),
						);
					case "entity.parse.failed":
						return next(new HTTPError("Invalid JSON body", 400));
					case "entity.verify.failed":
						return next(
							new HTTPError("Entity verification failed", 403),
						);
					case "request.aborted":
						return next(new HTTPError("Request aborted", 400));
					case "request.size.invalid":
						return next(
							new HTTPError(
								"Request size did not match content length",
								400,
							),
						);
					case "stream.encoding.set":
						return next(
							new HTTPError(
								"Stream encoding should not be set",
								500,
							),
						);
					case "stream.not.readable":
						return next(
							new HTTPError("Stream is not readable", 500),
						);
					case "parameters.too.many":
						return next(new HTTPError("Too many parameters", 413));
					case "charset.unsupported":
						return next(
							new HTTPError(
								`Unsupported charset "${err.charset}"`,
								415,
							),
						);
					case "encoding.unsupported":
						return next(
							new HTTPError(
								`Unsupported content encoding "${err.encoding}"`,
								415,
							),
						);
					default:
						return next(new HTTPError("Invalid Body", 400));
				}
			}
			next();
		});
	};
}
