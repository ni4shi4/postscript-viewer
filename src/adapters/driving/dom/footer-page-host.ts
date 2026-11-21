const PAGE_HOST_LABEL = "このページのアドレス: ";

export function queryFooterPageHostElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-page-host]");
  if (element === null) {
    throw new Error("Footer page host element is missing");
  }
  return element;
}

export function applyFooterPageHost(currentHost: string = location.host): void {
  queryFooterPageHostElement().textContent = `${PAGE_HOST_LABEL}${currentHost}`;
}
