import Link from "next/link";
import Logo from "./Logo";
import { ModeToggle } from "./theme_selector";
import SocialLinks from "./social_links";

const Navbar = ({ toggle }: { toggle: () => void }) => {
  return (
    <>
      <div className="w-full h-20 bg-linear-to-b from-zinc-100 dark:from-zinc-900 to-transparent sticky top-0 z-100">
        <div className="container mx-auto px-4 h-full">
          <div className="flex justify-between items-center h-full">
            <Logo />
            <ul className="hidden md:flex gap-x-12 text-white ">
              <li>
                <Link href="/" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Home</p>
                </Link>
              </li>
              <li>
                <Link href="/classes" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Classes</p>
                </Link>
              </li>
              <li>
                <Link href="/staff" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Staff</p>
                </Link>
              </li>
              <li>
                <Link href="/faq" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>FAQ</p>
                </Link>
              </li>
              <li>
                <Link href="/competitive-cheer" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Competitive Cheer</p>
                </Link>
              </li>
              <li>
                <Link href="https://app.jackrabbitclass.com/portal/pplogin.asp?id=522310" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>JackRabbit</p>
                </Link>
              </li>
            </ul>
            <div className="flex justify-center items-center gap-4 h-full">
              <SocialLinks />
              <ModeToggle />
              <button
                type="button"
                className="inline-flex items-center md:hidden text-zinc-800 dark:text-zinc-200"
                onClick={toggle}
              > 
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;