import FAQCard from "@/components/faq/faq_card";
import { CircleAlert, Minus } from "lucide-react";
import Link from "next/link";
export default function FAQ() {
  return (
    <div className="flex flex-col flex-1 items-center justify-start bg-zinc-100 dark:bg-zinc-900 font-sans">
      <main className="flex flex-1 min-h-[50vh] w-full max-w-3xl flex-col items-center py-16 px-4 justify-center bg-zinc-100 dark:bg-zinc-900">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 mb-8 text-center">
          Frequently Asked Questions
        </h1>
        <FAQCard
          icon={<Minus className="w-5 h-5 text-black dark:text-white" />}
          question="How do I register for classes?"
          answer="Registering for classes requires creating an account and adding at least one athlete to your profile. Navigate to the Classes page and click the 'Register' button on the class you want to register for. Complete the registration form and submit. Our staff will review your registration and reach out if any additional information is needed. Once your registration is approved, you will receive a confirmation email with details about the class schedule and next steps."
        />
        <FAQCard
          icon={<CircleAlert className="w-5 h-5 text-yellow-500 dark:text-yellow-500" />}
          question="How do I pay for gymnastics classes?"
          answer={<span>Once an enrollment request has been approved by our staff, you can then begin payment for the enrollment on your <Link className="text-purple-400" href="/account">account dashboard</Link>. Payments for gymnastics classes are now structured as monthly subscriptions. This allows for consistent scheduling and replaces the need for manual monthly invoicing. Classes are billed monthly on the 1st, so starting payment for a new enrollment will present as $0.00 today, then the full monthly amount on the 1st of the following month. Once you&apos;ve subscribed to your class plan, your enrollment becomes active and your athlete is placed on the roster for the session time you selected.</span>}
        />
        <FAQCard 
          icon={<CircleAlert className="w-5 h-5 text-yellow-500 dark:text-yellow-500" />}
          question="How do I pay for competitive cheer?"
          answer={<span>Once a cheer enrollment is approved, select Pay on your <Link className="text-purple-400" href="/account">account dashboard</Link> to complete Stripe Checkout. Checkout includes both the monthly tuition and cheer fee. Tuition renews on the 1st and cheer fees renew on the 15th, with no prorated charge when billing starts.</span>}
        />
        <FAQCard 
          icon={<CircleAlert className="w-5 h-5 text-yellow-500 dark:text-yellow-500" />}
          question="How do I manage my subscriptions?"
          answer={<span>Managing your subscriptions is done through your <Link className="text-purple-400" href="/account">account dashboard</Link>. Scroll to the enrollments section and select the &quot;Manage&quot; button on any active enrollment. This will direct you to our payment portal where you can cancel active subscriptions or update on file payment methods.</span>}
        />
        <FAQCard
          icon={<Minus className="w-5 h-5 text-black dark:text-white" />}
          question="Is there a dress code for athletes?"
          answer="Athletes are encouraged to wear athletic attire for their classes. Shorts and a t-shirt or leotard are recommended. Please avoid wearing denim and remove all jewelry before class."
        />
        <FAQCard
          icon={<Minus className="w-5 h-5 text-black dark:text-white" />}
          question="What is your inclement weather policy?"
          answer="In the event of inclement weather, classes at Limitless Cheer and Gymnastics will be cancelled if Tell City Schools cancel their classes due to weather."
        />
        <FAQCard
          icon={<Minus className="w-5 h-5 text-black dark:text-white" />}
          question="What class should I enroll my child in?"
          answer="While our coaching staff will assess every athlete for proper placement, we recommend enrolling your child in a class that matches their current skill level and age group. If you're unsure which class is best, please contact us directly for personalized recommendations based on your child's abilities and interests."
        />
        <FAQCard 
          icon={<Minus className="w-5 h-5 text-black dark:text-white" />}
          question="What if my child misses a class?"
          answer={<span>If your child misses a class for any reason, they are welcome to attend any make-up class at their level at any time in the current schedule. If you know your child will miss a class in advance, please <Link className="text-purple-400" href="/contact">notify</Link> us as soon as possible so we can find the next available make-up class for them.</span>}
        />
      </main>
    </div>
  );
}
