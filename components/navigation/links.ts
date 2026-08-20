export type NavigationItem = {
  href: string
  label: string
  showInFooter: boolean
}

export const navigationItems = [
  { href: "/", label: "Home", showInFooter: false },
  { href: "/classes", label: "Classes", showInFooter: true },
  { href: "/staff", label: "Staff", showInFooter: true },
  { href: "/faq", label: "FAQ", showInFooter: true },
  {
    href: "/competitive-cheer",
    label: "Competitive Cheer",
    showInFooter: true,
  },
  {
    href: "https://app.jackrabbitclass.com/portal/pplogin.asp?id=522310",
    label: "JackRabbit",
    showInFooter: true,
  },
] satisfies NavigationItem[]

export const footerNavigationItems = navigationItems.filter(
  (item) => item.showInFooter
)
