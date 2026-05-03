/**
 * Next.js instrumentation hook — runs once on server startup before any request.
 * Used here to apply runtime polyfills needed by server-side dependencies.
 */
export function register() {
  // Promise.try was added to Node.js in v24. unpdf bundles PDF.js which calls
  // Promise.try at runtime inside getDocumentProxy. Without this polyfill,
  // PDF text extraction fails with "Promise.try is not a function" on Node < 24,
  // causing the enhance/prepare endpoint to hang (unhandled rejection, no response sent).
  if (!Object.hasOwn(Promise, 'try')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Promise as any).try = function <T>(
      fn: (...args: unknown[]) => T | PromiseLike<T>,
      ...args: unknown[]
    ): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        try {
          resolve(fn(...args))
        } catch (e) {
          reject(e)
        }
      })
    }
  }
}
