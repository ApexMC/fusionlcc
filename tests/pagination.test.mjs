import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModule } from "./load-typescript.mjs"

const {
  DatabaseReadError,
  fetchAllRows,
  isSchemaCompatibilityError,
} = await loadTypeScriptModule("../lib/account/pagination.ts")

test("pagination reads every row when the API caps pages below the requested size", async () => {
  const dataset = Array.from({ length: 1251 }, (_, id) => ({ id }))
  const starts = []
  const rows = await fetchAllRows(async (from, to) => {
    starts.push(from)
    return {
      data: dataset.slice(from, Math.min(to + 1, from + 17)),
      count: dataset.length,
      error: null,
    }
  })

  assert.deepEqual(rows, dataset)
  assert.deepEqual(starts.slice(0, 3), [0, 17, 34])
  assert.equal(new Set(rows.map((row) => row.id)).size, dataset.length)
})

test("a short page without a count does not prematurely end an export", async () => {
  const dataset = [1, 2, 3, 4, 5]
  let requests = 0
  const rows = await fetchAllRows(async (from) => {
    requests += 1
    return { data: dataset.slice(from, from + 2), error: null, count: null }
  })

  assert.deepEqual(rows, dataset)
  assert.equal(requests, 4)
})

test("an empty dataset returns no rows", async () => {
  assert.deepEqual(await fetchAllRows(async () => ({
    data: [], count: 0, error: null,
  })), [])
})

test("an incomplete dataset fails rather than exporting a partial result", async () => {
  await assert.rejects(fetchAllRows(async (from) => ({
    data: from === 0 ? [1, 2] : [],
    count: 5,
    error: null,
  })), /dataset changed/)
})

test("a failed later page preserves its database error and rejects the export", async () => {
  await assert.rejects(fetchAllRows(async (from) => from === 0
    ? { data: [1], count: 2, error: null }
    : { data: null, error: { code: "42501", message: "Permission denied" } }
  ), (error) => {
    assert.ok(error instanceof DatabaseReadError)
    assert.equal(error.code, "42501")
    assert.equal(isSchemaCompatibilityError(error), false)
    return true
  })
})

test("compatibility fallbacks apply only to missing columns or relationships", () => {
  for (const code of ["42703", "PGRST200", "PGRST204"]) {
    assert.equal(isSchemaCompatibilityError(new DatabaseReadError({ code, message: "schema" })), true)
  }
  for (const code of ["42501", "08006", "PGRST301"]) {
    assert.equal(isSchemaCompatibilityError(new DatabaseReadError({ code, message: "read failed" })), false)
  }
  assert.equal(isSchemaCompatibilityError(new Error("Failed to fetch")), false)
})

test("invalid page sizes are rejected", async () => {
  await assert.rejects(fetchAllRows(async () => ({ data: [], error: null }), 0), /positive integer/)
})
