// The green Slóði mark lives in app/icon.svg, not under public/, so HeaderLab imports it.
// Storybook's Next image plugin returns image imports as `{ src, width, height }`.
declare module "@/app/icon.svg" {
  const image: string | { src: string };
  export default image;
}
