import Link from "next/link";
import { JSX } from "react";

const Sidebar = ({
  isOpen,
  toggle,
}: {
  isOpen: boolean;
  toggle: () => void;
}): JSX.Element => {
  return (
    <>
      <div
        className="sidebar-container fixed w-full h-full overflow-hidden justify-center bg-zinc-50 dark:bg-zinc-800 grid pt-30 left-0 z-10"
        style={{
          opacity: `${isOpen ? "1" : "0"}`,
          top: ` ${isOpen ? "0" : "-100%"}`,
        }}
      >
        <ul className="sidebar-nav text-center leading-relaxed text-xl">
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/" onClick={toggle}>
              <p>Home</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/about" onClick={toggle}>
              <p>About</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/blend-iq" onClick={toggle}>
              <p>BlendIQ</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/supply-house" onClick={toggle}>
              <p>Supply House</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/contact" onClick={toggle}>
              <p>Contact</p>
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
};

export default Sidebar;