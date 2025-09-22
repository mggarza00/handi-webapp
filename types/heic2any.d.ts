declare module "heic2any" {
  const convert: (opts: any) => Promise<Blob>;
  export default convert;
}
