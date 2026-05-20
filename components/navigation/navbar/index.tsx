import Link from "next/link";
import Logo from "./Logo";
import { ModeToggle } from "./theme_selector";

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
                <Link href="/class-schedules" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Class Schedules</p>
                </Link>
              </li>
              <li>
                <Link href="/staff" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Staff</p>
                </Link>
              </li>
              <li>
                <Link href="/reminders" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Reminders</p>
                </Link>
              </li>
              <li>
                <Link href="/jackrabbit" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>JackRabbit</p>
                </Link>
              </li>
              <li>
                <Link href="/tumbling" className="font-bold text-zinc-800 dark:text-zinc-200">
                  <p>Tumbling</p>
                </Link>
              </li>
            </ul>
            <div className="flex justify-center items-center gap-4 h-full">
              <button
                type="button"
                className="inline-flex items-center md:hidden"
                onClick={toggle}
              > 
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#fff"
                    d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z"
                  />
                </svg>
              </button>
              <ModeToggle />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;