/* eslint-disable @typescript-eslint/no-explicit-any */
import { JsonValue } from "type-fest";

export enum ReqMethod {
  GET = "get",
  POST = "post",
  PUT = "put",
  DELETE = "delete",
}

export enum ReqEventType {
  Error = "error",
}

interface ReqEventHandler {
  event: ReqEventType;
  cb: (data: any) => void;
}

export type ReqCode = "NETWORK" | "UNKNOWN";

class ExtendedError<T extends string = string> extends Error {
  public status: number = -1;
  public params: any = null;
  public code: T | ReqCode = "UNKNOWN";
}

export class Req {
  public debug: boolean;
  public headers: Record<string, string>;
  public credentials?: RequestCredentials;
  public handlers: ReqEventHandler[];
  public readonly url: string;
  public readonly suppressErrors: boolean;
  constructor(url: string, suppressErrors = false, debug = false) {
    this.debug = debug;
    this.headers = {};
    this.handlers = [];
    this.credentials = "same-origin";
    this.suppressErrors = suppressErrors;
    this.url = url;
  }
  async [ReqMethod.GET]<T = unknown>(
    url: string,
    query: Record<string, string> = {},
    suppressErrors?: boolean
  ) {
    const keys = Object.keys(query);
    if (keys.length) {
      url += "?";
      url += keys
        .map(
          (key) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
        )
        .join("&");
    }
    return await this.standardRequest<T>(
      url,
      ReqMethod.GET,
      undefined,
      suppressErrors
    );
  }
  async [ReqMethod.PUT]<T = unknown>(
    url: string,
    body: JsonValue,
    suppressErrors?: boolean
  ) {
    return await this.standardRequest<T>(
      url,
      ReqMethod.PUT,
      body,
      suppressErrors
    );
  }
  async [ReqMethod.POST]<T = unknown>(
    url: string,
    body: JsonValue,
    suppressErrors?: boolean
  ) {
    return await this.standardRequest<T>(
      url,
      ReqMethod.POST,
      body,
      suppressErrors
    );
  }
  async [ReqMethod.DELETE]<T = unknown>(
    url: string,
    body: JsonValue,
    suppressErrors?: boolean
  ) {
    return await this.standardRequest<T>(
      url,
      ReqMethod.DELETE,
      body,
      suppressErrors
    );
  }
  async standardRequest<T = unknown>(
    url: string,
    method: ReqMethod,
    body?: JsonValue | FormData,
    suppressErrors?: boolean
  ) {
    const headers = { ...this.headers };
    if (!(body instanceof FormData)) {
      body = JSON.stringify(body);
    } else {
      const contentTypeHeaderKeys = Object.keys(headers).filter(
        (h) => h.toLowerCase() === "content-type"
      );
      for (const h of contentTypeHeaderKeys) {
        delete headers[h];
      }
    }
    return await this.raw<T>(
      `${this.url}${url}`,
      {
        headers,
        credentials: this.credentials,
        method,
        body,
      },
      suppressErrors
    );
  }
  async raw<T = unknown>(
    url: string,
    options: RequestInit,
    suppressErrors?: boolean
  ): Promise<T | undefined> {
    const se =
      suppressErrors === false ? false : suppressErrors || this.suppressErrors;
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("request.raw", `${options.method} ${url}`);
      if (options.body) {
        // eslint-disable-next-line no-console
        console.log("request.raw body", options.body);
      }
    }

    let result = null;
    try {
      result = await fetch(url, options);
    } catch (err) {
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log("request.raw fetch_error", err);
      }
      const error = err as ExtendedError<ReqCode>;
      error.code = "NETWORK";
      error.status = -1;
      this.callHandlers(ReqEventType.Error, error);
      if (se) {
        return;
      }
      throw error;
    }

    const text = await result.text();
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("reqest.raw status", result.status);
      // eslint-disable-next-line no-console
      console.log("request.raw result", text);
    }

    let json = null;
    try {
      json = JSON.parse(text);
    } catch (err) {
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log("request.raw parse_error", err);
      }
      const error = new ExtendedError(text);
      error.status = result.status;
      this.callHandlers(ReqEventType.Error, error);
      if (se) {
        return;
      }
      throw error;
    }

    if (result.status >= 400) {
      let message = text;
      const jsonError = json;
      if (json.message) {
        message = json.message;
      }
      let params = null;
      if (jsonError.params) {
        params = jsonError.params;
      }
      const error = new ExtendedError(message);
      error.status = result.status;
      if (params) {
        error.params = params;
      }
      if (json.code) {
        error.code = json.code;
      }
      this.callHandlers(ReqEventType.Error, error);
      if (se) {
        return;
      }
      throw error;
    }
    return json;
  }
  on(event: ReqEventType, cb: (data: any) => void) {
    this.handlers.push({ event, cb });
  }
  off(event: ReqEventType, cb: () => void) {
    if (cb) {
      this.handlers = this.handlers.filter(
        (h) => h.event !== event && h.cb !== cb
      );
    } else {
      this.handlers = this.handlers.filter((h) => h.event !== event);
    }
  }
  callHandlers(type: ReqEventType, data: any) {
    setTimeout(() => {
      this.handlers.filter((h) => h.event === type).forEach((h) => h.cb(data));
    }, 0);
  }
}
