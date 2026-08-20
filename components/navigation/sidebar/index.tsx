import Link from "next/link";
import { JSX } from "react";
import { navigationItems } from "../links";

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
        className="sidebar-container fixed w-full h-full overflow-hidden justify-center bg-zinc-50 dark:bg-zinc-800 grid pt-30 left-0 z-50"
        style={{
          opacity: `${isOpen ? "1" : "0"}`,
          top: ` ${isOpen ? "0" : "-100%"}`,
        }}
      >
        <ul className="sidebar-nav text-center leading-relaxed text-2xl">
          {navigationItems.map((item) => (
            <li key={item.href}>
              <Link
                className="font-bold text-zinc-800 dark:text-zinc-200"
                href={item.href}
                onClick={toggle}
              >
                <p>{item.label}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default Sidebar;
