// Vite's `?raw` suffix imports a file as a string. Used by the Tokens docs page
// to read app/slodi-tokens.css at build time.
declare module "*.css?raw" {
  const content: string;
  export default content;
}
