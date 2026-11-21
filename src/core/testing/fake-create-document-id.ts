export function createSequentialDocumentIdFactory(prefix = "doc"): () => string {
  let sequence = 0;

  return () => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };
}
