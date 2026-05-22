import ContactForm from "@/components/team/contact_form";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl text-center font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Contact Us
        </h1>
        <ContactForm />
      </section>
    </main>
  );
}