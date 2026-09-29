type DatabaseError = { message: string; code?: string }

type PageResult = {
  data: unknown[] | null
  error: DatabaseError | null
  count?: number | null
}

export class DatabaseReadError extends Error {
  readonly code: string | undefined

  constructor(error: DatabaseError) {
    super(error.message)
    this.name = "DatabaseReadError"
    this.code = error.code
  }
}

export function isSchemaCompatibilityError(error: unknown) {
  return (
    error instanceof DatabaseReadError &&
    ["42703", "PGRST200", "PGRST204"].includes(error.code ?? "")
  )
}

/** Callers must provide a stable, unique ordering and an exact row count. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult>,
  pageSize = 500
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("Page size must be a positive integer.")
  }

  const rows: T[] = []
  let expectedCount: number | null = null

  while (true) {
    const result = await fetchPage(rows.length, rows.length + pageSize - 1)

    if (result.error) {
      throw new DatabaseReadError(result.error)
    }

    expectedCount ??= result.count ?? null
    const page = result.data ?? []

    if (!page.length) {
      if (expectedCount !== null && rows.length < expectedCount) {
        throw new Error("The dataset changed while loading. Refresh and try again.")
      }

      return rows
    }

    rows.push(...(page as T[]))

    if (expectedCount !== null && rows.length >= expectedCount) {
      return rows
    }

    // Advance by the actual response length: the API may cap pages below pageSize.
    // Without a count, only an empty page establishes that all rows were read.
  }
}
