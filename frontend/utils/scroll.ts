/**
 * Smoothly scrolls to an element with the given selector
 * @param selector - CSS selector for the target element
 * @param options - Scroll behavior options
 */
export function scrollToElement(
  selector: string,
  options: ScrollIntoViewOptions = { behavior: "smooth", block: "start" }
): void {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView(options);
  } else {
    console.warn(`Element with selector "${selector}" not found`);
  }
}
