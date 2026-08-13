import FAQCard from "@/components/faq/faq_card";
import { CircleAlert, CircleQuestionMark, Minus, MinusSquare } from "lucide-react";
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
          answer="Regstering for classes requires creating an account and adding at least one athlete to your profile. Navigate to the Classes page and click the 'Register' button on the class you want to register for. Complete the registration form and submit. Our staff will review your registration and reach out if any additional information is needed. Once your registration is approved, you will receive a confirmation email with details about the class schedule and next steps."
        />
        <FAQCard
          icon={<CircleAlert className="w-5 h-5 text-yellow-500 dark:text-yellow-500" />}
          question="How do I pay for gymnastics classes?"
          answer={<span>Once an enrollment request has been approved by our staff, you can then begin payment for the enrollment on your <a className="text-purple-400" href="/account">account dashboard</a>. Payments for gymnastics classes are now structured as monthly subscriptions. This allows for consistent scheduling and ensures that athletes can continue their training without interruption.</span>}
        />
        <FAQCard 
          icon={<CircleAlert className="w-5 h-5 text-yellow-500 dark:text-yellow-500" />}
          question="How do I pay for competitive cheer?"
          answer={<span>Currently, cheer payments are still processed through <a className="text-purple-400" href="https://app.jackrabbitclass.com/portal/pplogin.asp?id=522310">JackRabbit</a>. Cheer will be transitioned to our new in-house payment platform in the near future, however until that time, continue to access their platform to process payments.</span>}
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
          answer={<span>If your child misses a class for any reason, they are welcome to attend any make-up class at their level at any time in the current schedule. If you know your child will miss a class in advance, please <a className="text-purple-400" href="/contact">notify</a> us as soon as possible so we can find the next available make-up class for them.</span>}
        />
      </main>
    </div>
  );
}