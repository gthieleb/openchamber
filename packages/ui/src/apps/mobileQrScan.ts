// Connection payload parsing + native QR scanning for the dedicated mobile app.
//
// The pairing link format is produced by `openchamber connect-url --qr`:
//   openchamber://connect?v=1&server=<url>&token=<token>&label=<label>
// We also accept a bare http(s) URL so a QR encoding only the server address works.
//
// QR scanning is delegated to a Capacitor barcode-scanner plugin if the native
// shell registered one (`window.Capacitor.Plugins.BarcodeScanner`). We resolve it
// at runtime instead of importing the package so the web build stays dependency-free
// and the browser-hosted mobile UI degrades to `unsupported` cleanly.

export type MobileConnectionPayload = {
  url: string;
  clientToken?: string;
  label?: string;
};

export type QrScanResult =
  | ({ status: 'ok' } & MobileConnectionPayload)
  | { status: 'cancelled' }
  | { status: 'unsupported' }
  | { status: 'permission-denied' }
  | { status: 'invalid' }
  | { status: 'failed' };

type ScannedBarcode = { rawValue?: string; displayValue?: string };

type BarcodeScannerPlugin = {
  requestPermissions?: () => Promise<{ camera?: string } | undefined>;
  scan?: (options?: { formats?: string[] }) => Promise<{ barcodes?: ScannedBarcode[] } | undefined>;
};

const getScannerPlugin = (): BarcodeScannerPlugin | null => {
  if (typeof window === 'undefined') return null;
  const capacitor = (window as typeof window & {
    Capacitor?: { Plugins?: Record<string, unknown> };
  }).Capacitor;
  const plugin = capacitor?.Plugins?.BarcodeScanner as BarcodeScannerPlugin | undefined;
  return plugin && typeof plugin.scan === 'function' ? plugin : null;
};

export const parseConnectionPayload = (raw: string): MobileConnectionPayload | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^openchamber:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const server = parsed.searchParams.get('server')?.trim();
      if (!server) return null;
      const clientToken = parsed.searchParams.get('token')?.trim();
      const label = parsed.searchParams.get('label')?.trim();
      return {
        url: server,
        clientToken: clientToken || undefined,
        label: label || undefined,
      };
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) return { url: trimmed };
  return null;
};

export const isQrScanSupported = (): boolean => getScannerPlugin() !== null;

export const scanConnectionQr = async (): Promise<QrScanResult> => {
  const plugin = getScannerPlugin();
  if (!plugin?.scan) return { status: 'unsupported' };

  try {
    if (plugin.requestPermissions) {
      const permission = await plugin.requestPermissions();
      const camera = permission?.camera;
      if (camera && camera !== 'granted' && camera !== 'limited') {
        return { status: 'permission-denied' };
      }
    }

    const result = await plugin.scan({ formats: ['QR_CODE'] });
    const barcode = result?.barcodes?.[0];
    const raw = (barcode?.rawValue ?? barcode?.displayValue ?? '').trim();
    if (!raw) return { status: 'cancelled' };

    const payload = parseConnectionPayload(raw);
    if (!payload) return { status: 'invalid' };
    return { status: 'ok', ...payload };
  } catch {
    return { status: 'failed' };
  }
};
