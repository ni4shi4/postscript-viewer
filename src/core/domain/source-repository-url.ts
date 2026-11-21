export const SOURCE_REPOSITORY_URL = "https://github.com/ni4shi4/postscript-viewer";

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export function isValidCommitSha(sha: string): boolean {
  return COMMIT_SHA_PATTERN.test(sha);
}

export function sourceRepositoryUrl(commitSha?: string): string {
  if (commitSha === undefined || !isValidCommitSha(commitSha)) {
    return SOURCE_REPOSITORY_URL;
  }
  return `${SOURCE_REPOSITORY_URL}/tree/${commitSha}`;
}
