declare module 'postject' {
  export interface InjectOptions {
    // Explicitly `| undefined`: the caller passes `undefined` off-macOS rather
    // than branching, and `exactOptionalPropertyTypes` tells the two apart.
    machoSegmentName?: string | undefined;
    overwrite?: boolean | undefined;
    sentinelFuse?: string | undefined;
  }

  export function inject(
    filename: string,
    resourceName: string,
    resourceData: Buffer,
    options?: InjectOptions,
  ): Promise<void>;
}
