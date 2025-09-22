declare module "heic2any" {
  const convert: (opts: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob>;
  export = convert;
}
