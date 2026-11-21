import { sourceRepositoryUrl } from "../../../core/domain/source-repository-url";

export function queryFooterSourceLink(): HTMLAnchorElement {
  const link = document.querySelector<HTMLAnchorElement>(".app-footer a");
  if (link === null) {
    throw new Error("Footer source link is missing");
  }
  return link;
}

export function applyFooterSourceRepositoryLink(commitSha?: string): void {
  queryFooterSourceLink().href = sourceRepositoryUrl(commitSha);
}
