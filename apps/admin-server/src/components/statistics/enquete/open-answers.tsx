export function OpenAnswers({
  answeredCount,
  latest,
}: {
  answeredCount: number;
  latest?: string[];
}) {
  const quotes = latest ?? [];

  return (
    <div className="pdf-open mt-6 grid grid-cols-[42%_1fr] items-center">
      <div className="pdf-open-total flex flex-col items-center text-[#1e1e2e]">
        <span className="pdf-open-number text-4xl leading-none">
          {answeredCount}
        </span>
        <span className="pdf-open-label mt-2 text-sm">Antwoorden</span>
      </div>

      {quotes.length > 0 ? (
        <div className="pdf-open-list mx-auto flex w-full min-w-0 max-w-[95%] flex-col items-center gap-1 text-center">
          <p className="pdf-open-title m-0 mb-2 text-xs text-[#6b6b7b]">
            Meest recente antwoorden
          </p>
          {quotes.map((quote, index) => (
            <p
              key={index}
              className="pdf-open-quote m-0 inline-flex max-w-full text-sm text-[#1e1e2e]">
              <span aria-hidden="true" className="pdf-open-quote-mark shrink-0">
                &quot;
              </span>
              <span className="pdf-open-quote-text min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {quote}
              </span>
              <span aria-hidden="true" className="pdf-open-quote-mark shrink-0">
                &quot;
              </span>
            </p>
          ))}
          <span
            aria-hidden="true"
            className="pdf-open-more text-lg leading-none">
            ⋯
          </span>
        </div>
      ) : null}
    </div>
  );
}
