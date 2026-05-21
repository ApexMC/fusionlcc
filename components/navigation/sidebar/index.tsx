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
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/class-schedules" onClick={toggle}>
              <p>Class Schedules</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/staff" onClick={toggle}>
              <p>Staff</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/reminders" onClick={toggle}>
              <p>Reminders</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="/tumbling" onClick={toggle}>
              <p>Tumbling</p>
            </Link>
          </li>
          <li>
            <Link className="font-bold text-zinc-800 dark:text-zinc-200" href="https://app.jackrabbitclass.com/portal/pplogin.asp?id=522310" onClick={toggle}>
              <p>JackRabbit</p>
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
};

export default Sidebar;