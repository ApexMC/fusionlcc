const Footer = () => {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
      <div className="mx-auto px-24 py-8 grid gap-12 md:gap-20 md:grid-cols-2">
        
        {/* Brand */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          <iframe 
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3146.707103994628!2d-86.75748580987452!3d37.937242089047814!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x886efdb65aa1b891%3A0x511c8f60edb5e7c9!2sFusion!5e0!3m2!1sen!2sus!4v1779291902757!5m2!1sen!2sus"
            width="200" 
            height="200" 
            style={{ border: 2, borderColor: '#545454', borderRadius: 12, borderStyle: 'solid' }} 
            allowFullScreen={false} 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade">
          </iframe>

          <div className="flex flex-col items-center justify-center">
            <h3 className="text-2xl font-semibold text-center tracking-tight text-zinc-900 dark:text-zinc-50">
              Fusion - Limitless Cheer Co.
            </h3>
            <a href="/contact" className="mt-4 px-4 py-2 font-bold bg-linear-to-r from-purple-700 to-purple-500 text-white rounded hover:from-purple-500 hover:to-purple-700 transition hover:border hover:border-purple-600">
              Contact Us
            </a>
            <h1 className="text-center text-zinc-700 dark:text-zinc-200 mt-8">
              218 US Highway 66, Tell City, IN 47586
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col items-center justify-center">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
            Explore
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-200 text-center md:text-start">
            <li><a href="/class-schedules" className="hover:text-purple-600 transition">Classes</a></li>
            <li><a href="/staff" className="hover:text-purple-600 transition">Staff</a></li>
            <li><a href="/faq" className="hover:text-purple-600 transition">FAQ</a></li>
            <li><a href="/tumbling" className="hover:text-purple-600 transition">Tumbling</a></li>
            <li><a href="https://app.jackrabbitclass.com/portal/pplogin.asp?id=522310" className="hover:text-purple-600 transition">JackRabbit</a></li>
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