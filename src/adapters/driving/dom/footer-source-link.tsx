import { sourceRepositoryUrl } from "../../../core/domain/source-repository-url";

export type AppFooterProps = {
  commitSha?: string;
};

export function AppFooter({ commitSha }: AppFooterProps) {
  return (
    <>
      <a href={sourceRepositoryUrl(commitSha)} rel="noopener noreferrer">
        ソースコード
      </a>
      <span class="app-footer__sep" aria-hidden="true">
        ·
      </span>
      <span>AGPL-3.0</span>
    </>
  );
}
