const Footer = () => {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
      <div className="mx-auto px-36 py-8 grid gap-20 md:grid-cols-2">
        
        {/* Brand */}
        <div className="flex flex-col items-center justify-center">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Fusion - Limitless Cheer Co.
          </h3>
          <button className="mt-4 px-4 py-2 bg-linear-to-r from-purple-700 to-purple-500 text-white rounded hover:from-purple-500 hover:to-purple-700 transition hover:border-1 hover:border-purple-600">
            Contact Us
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col items-start">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
            Explore
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            <li><a href="/class-schedules" className="hover:text-purple-600 transition">Class Schedules</a></li>
            <li><a href="/staff" className="hover:text-purple-600 transition">Staff</a></li>
            <li><a href="/reminders" className="hover:text-purple-600 transition">Reminders</a></li>
            <li><a href="/jackrabbit" className="hover:text-purple-600 transition">JackRabbit</a></li>
            <li><a href="/tumbling" className="hover:text-purple-600 transition">Tumbling</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-sm text-zinc-700 dark:text-zinc-200">
        © {new Date().getFullYear()} Fusion - Limitless Cheer Co. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;