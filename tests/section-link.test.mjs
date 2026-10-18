import assert from "node:assert/strict"
import test from "node:test"
import { loadTypeScriptModuleWithMocks as loadModule } from "./load-typescript.mjs"

const { SectionLink } = await loadModule("../components/navigation/section-link.tsx", {
  "next/link": { default: "Link" },
  "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
})

function fixture(t, currentUrl, sectionId) {
  const scrolls = []
  const section = { scrollIntoView: options => scrolls.push(options) }
  for (const [name, value] of Object.entries({
    window: { location: { href: currentUrl } },
    document: { getElementById: id => id === sectionId ? section : null },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original)
      else delete globalThis[name]
    })
  }

  return {
    scrolls,
    navigate(href) {
      let prevented = false
      const link = SectionLink({ href })
      link.props.onNavigate({ preventDefault: () => { prevented = true } })
      return prevented
    },
  }
}

test("repeated section links scroll every time without another navigation", t => {
  const f = fixture(t, "https://fusion.test/account#athletes", "athletes")
  for (const href of ["#athletes", "/account#athletes", "https://fusion.test/account#athletes", "#athletes"]) {
    assert.equal(f.navigate(href), true)
  }
  assert.deepEqual(f.scrolls, Array(4).fill({ block: "start" }))
})

test("first clicks, other sections, and different pages retain normal routing", t => {
  const f = fixture(t, "https://fusion.test/account?view=family#athletes", "athletes")
  for (const href of ["#billing", "/account?view=family", "/account#athletes", "/classes#athletes", "https://other.test/account?view=family#athletes"]) {
    assert.equal(f.navigate(href), false, href)
  }
  assert.deepEqual(f.scrolls, [])
})

test("encoded section IDs work when the URL and query are already selected", t => {
  const f = fixture(t, "https://fusion.test/classes?view=all#class%20discounts", "class discounts")
  assert.equal(f.navigate("#class%20discounts"), true)
  assert.equal(f.scrolls.length, 1)
})

test("missing sections leave routing available for content that loads later", t => {
  const f = fixture(t, "https://fusion.test/account#credit-balance", "billing")
  assert.equal(f.navigate("#credit-balance"), false)
  assert.deepEqual(f.scrolls, [])
})

test("malformed section fragments do not throw in the repeat-click handler", t => {
  const f = fixture(t, "https://fusion.test/account#%invalid", "billing")
  assert.equal(f.navigate("#%invalid"), false)
  assert.deepEqual(f.scrolls, [])
})
