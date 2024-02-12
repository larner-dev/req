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

class ExtendedError extends Error {
  public network: boolean = false;
  public status: number = -1;
  public params: any = null;
}

export class Req {
  public debug: boolean;
  public headers: Record<string, string>;
  public credentials?: RequestCredentials;
  public handlers: ReqEventHandler[];
  public readonly url: string;
  constructor(url: string, debug = false) {
    this.debug = debug;
    this.headers = {};
    this.handlers = [];
    this.credentials = "same-origin";
    this.url = url;
  }
  async [ReqMethod.GET](url: string, query: Record<string, string> = {}) {
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
    return await this.standardRequest(url, ReqMethod.GET);
  }
  async [ReqMethod.PUT](url: string, body: JsonValue) {
    return await this.standardRequest(url, ReqMethod.PUT, body);
  }
  async [ReqMethod.POST](url: string, body: JsonValue) {
    return await this.standardRequest(url, ReqMethod.POST, body);
  }
  async [ReqMethod.DELETE](url: string, body: JsonValue) {
    return await this.standardRequest(url, ReqMethod.DELETE, body);
  }
  async standardRequest(url: string, method: ReqMethod, body?: JsonValue) {
    return await this.raw(`${this.url}${url}`, {
      headers: this.headers,
      credentials: this.credentials,
      method,
      body: JSON.stringify(body),
    });
  }
  async raw(url: string, options: RequestInit) {
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
      const error = err as ExtendedError;
      error.network = true;
      error.status = -1;
      this.callHandlers(ReqEventType.Error, error);
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
      this.callHandlers(ReqEventType.Error, error);
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
