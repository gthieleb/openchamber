import { requestJson } from './cli-http.js';
import { discoverLifecycleInstances, discoverDesktopInstance } from './cli-lifecycle.js';
import { EXIT_CODE, TunnelCliError } from './cli-errors.js';

/**
 * Error raised when an OpenChamber API request fails. Extends TunnelCliError so
 * the top-level handler honors its exit code, and carries the HTTP status so
 * callers can branch on it when needed. Failures are deterministic across all
 * output modes (--json/--quiet/non-TTY).
 */
class ApiError extends TunnelCliError {
  constructor(message, { status, exitCode } = {}) {
    super(message, Number.isFinite(exitCode) ? exitCode : EXIT_CODE.GENERAL_ERROR);
    this.name = 'ApiError';
    this.status = Number.isFinite(status) ? status : null;
  }
}

/**
 * Resolve the port of the running OpenChamber instance the command should talk
 * to. Policy (enforced in every output mode):
 *  - `--port` explicit: use it as-is (caller verifies reachability on request).
 *  - otherwise discover running CLI/desktop instances:
 *      - exactly one  -> use it
 *      - more than one -> fail and require `--port`
 *      - none          -> fail with guidance to start the server
 */
async function resolveTargetPort(options = {}) {
  if (options.explicitPort && Number.isFinite(options.port)) {
    return options.port;
  }

  const [cliInstances, desktopInstance] = await Promise.all([
    discoverLifecycleInstances(options),
    discoverDesktopInstance(),
  ]);

  const ports = [];
  const seen = new Set();
  const pushPort = (port) => {
    if (!Number.isFinite(port) || seen.has(port)) return;
    seen.add(port);
    ports.push(port);
  };

  for (const instance of cliInstances) {
    pushPort(instance.port);
  }
  if (desktopInstance) {
    pushPort(desktopInstance.port);
  }

  if (ports.length === 0) {
    throw new TunnelCliError(
      'No running OpenChamber server found. Start one with `openchamber serve`, or pass --port <port>.',
      EXIT_CODE.GENERAL_ERROR,
    );
  }

  if (ports.length > 1) {
    throw new TunnelCliError(
      `Multiple OpenChamber servers are running (ports: ${ports.join(', ')}). Choose one with --port <port>.`,
      EXIT_CODE.USAGE_ERROR,
    );
  }

  return ports[0];
}

function buildEndpoint(endpoint, query) {
  if (!query || typeof query !== 'object') {
    return endpoint;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  if (!qs) return endpoint;
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${qs}`;
}

function extractErrorMessage(body, response) {
  if (body && typeof body === 'object') {
    if (typeof body.error === 'string' && body.error.trim().length > 0) return body.error;
    if (typeof body.message === 'string' && body.message.trim().length > 0) return body.message;
  }
  const status = response?.status;
  const statusText = response?.statusText;
  if (status) {
    return `Request failed with status ${status}${statusText ? ` (${statusText})` : ''}`;
  }
  return 'Request failed';
}

/**
 * Perform a JSON API request against a running instance and return the parsed
 * body. Throws {@link ApiError} on any non-2xx response so callers fail
 * deterministically regardless of --json/--quiet mode.
 */
async function apiRequest(port, method, endpoint, { query, body, options = {}, timeoutMs } = {}) {
  const requestOptions = {
    method,
    uiPassword: options.uiPassword,
  };
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    requestOptions.timeoutMs = timeoutMs;
  }
  if (body !== undefined && body !== null) {
    requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const { response, body: payload } = await requestJson(port, buildEndpoint(endpoint, query), requestOptions);

  if (!response.ok) {
    const status = response.status;
    const exitCode = status === 404
      ? EXIT_CODE.GENERAL_ERROR
      : (status === 401 || status === 403 ? EXIT_CODE.AUTH_CONFIG_ERROR : EXIT_CODE.GENERAL_ERROR);
    throw new ApiError(extractErrorMessage(payload, response), { status, exitCode });
  }

  return payload;
}

/**
 * Directory used to scope project-aware API calls (sessions, config entities).
 * Prefers an explicit --directory/--cwd flag, falling back to the directory the
 * CLI is invoked from so terminal usage is contextual by default.
 */
function resolveScopeDirectory(options = {}) {
  if (typeof options.directory === 'string' && options.directory.trim().length > 0) {
    return options.directory.trim();
  }
  try {
    return process.cwd();
  } catch {
    return undefined;
  }
}

export {
  resolveTargetPort,
  apiRequest,
  resolveScopeDirectory,
};
