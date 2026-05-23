import FAQCard from "@/components/faq/faq_card";
import { Link } from "lucide-react";

export default function FAQ() {
  return (
    <div className="flex flex-col flex-1 items-center justify-start bg-zinc-100 dark:bg-zinc-900 font-sans">
      <main className="flex flex-1 min-h-[50vh] w-full max-w-3xl flex-col items-center py-16 px-16 justify-center bg-zinc-100 dark:bg-zinc-900">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 mb-8 text-center">
          Frequently Asked Questions
        </h1>
        <FAQCard
          question="What is your inclement weather policy?"
          answer="In the event of inclement weather, classes at Limitless Cheer and Gymnastics will be cancelled if Tell City Schools cancel their classes due to weather."
        />
        <FAQCard 
          question="How do I pay for classes?"
          answer={<span>Currently our payments are processed through <a className="text-purple-400" href="https://app.jackrabbitclass.com/portal/pplogin.asp?id=522310">JackRabbit</a>. Visit the link to access your account and make payments through their platform. We are working on integrating payments directly through our website for a smoother experience.</span>}
        />
        <FAQCard 
          question="What class should I enroll my child in?"
          answer="While our coaching staff will assess every athlete for proper placement, we recommend enrolling your child in a class that matches their current skill level and age group. If you're unsure which class is best, please contact us directly for personalized recommendations based on your child's abilities and interests."
        />
        <FAQCard 
          question="What if my child misses a class?"
          answer="If your child misses a class for any reason, they are welcome to attend any make-up class at their level at any time in the current schedule. If you know your child will miss a class in advance, please notify us as soon as possible so we can find the next available make-up class for them."
        />
      </main>
    </div>
  );
}