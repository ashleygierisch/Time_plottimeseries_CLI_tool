declare module 'postject' {
  export interface InjectOptions {
    machoSegmentName?: string;
    overwrite?: boolean;
    sentinelFuse?: string;
  }

  export function inject(
    filename: string,
    resourceName: string,
    resourceData: Buffer,
    options?: InjectOptions
  ): Promise<void>;
}
