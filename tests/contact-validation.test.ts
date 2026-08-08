import { describe, expect, it } from "vitest"

import {
  ContactValidationError,
  parseContactMessage,
} from "../lib/contact/validation"

describe("parseContactMessage", () => {
  it("normalizes a valid contact message", () => {
    expect(
      parseContactMessage({
        email: " Parent@Example.com ",
        subject: " Class question ",
        message: " I would like more information. ",
      })
    ).toEqual({
      email: "parent@example.com",
      subject: "Class question",
      message: "I would like more information.",
    })
  })

  it.each([
    [{}, "Enter a valid email address."],
    [
      { email: "invalid", subject: "Question", message: "A valid message body" },
      "Enter a valid email address.",
    ],
    [
      { email: "a@example.com", subject: "x", message: "A valid message body" },
      "Subject must be between 3 and 120 characters.",
    ],
  ])("rejects invalid input", (input, message) => {
    expect(() => parseContactMessage(input)).toThrowError(
      new ContactValidationError(message)
    )
  })
})
