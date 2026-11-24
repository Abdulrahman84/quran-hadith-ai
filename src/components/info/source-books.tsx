import type { CSSProperties } from "react";

export type SourceBook = {
  id: string;
  title: string;
  /** Compiler, author or publisher, only where the source data names one. */
  author?: string;
  /** Extra line under the author, such as a death year. */
  note?: string;
  /** Shown at the foot of the cover, e.g. "7,277 hadith". */
  count?: string;
  /** 0–1, drawn as a gold bar so sizes compare at a glance. */
  share?: number;
  badge?: string;
};

type SourceBookShelfProps = {
  books: SourceBook[];
  tone: "green" | "gold" | "paper";
  size?: "regular" | "small";
  label: string;
};

// A row of book covers: a coloured spine edge, the title, the author and an
// optional count with a bar scaled to the largest book in the row.
export function SourceBookShelf({ books, tone, size = "regular", label }: SourceBookShelfProps) {
  return (
    <ul aria-label={label} className="book-shelf" data-size={size}>
      {books.map((book) => (
        <li className="book-cover" data-tone={tone} key={book.id}>
          <span aria-hidden="true" className="book-spine" />
          <span className="book-body">
            {book.badge ? <span className="book-badge">{book.badge}</span> : null}
            <span className="book-title">{book.title}</span>
            {book.author ? <span className="book-author">{book.author}</span> : null}
            {book.note ? <span className="book-note">{book.note}</span> : null}
            {book.count ? (
              <span className="book-count">
                {book.count}
                {book.share !== undefined ? (
                  <span aria-hidden="true" className="book-bar">
                    <span style={{ "--book-share": book.share } as CSSProperties} />
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
