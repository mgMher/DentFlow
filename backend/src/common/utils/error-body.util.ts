/**
 * Body for an HttpException that the client can translate.
 *
 * `message` is English for logs and API users; `code` is a stable key the
 * frontend maps to `errors.<code>` in the active language. The global
 * exception filter passes both through.
 */
export const errorBody = (code: string, message: string) => ({ code, message });
