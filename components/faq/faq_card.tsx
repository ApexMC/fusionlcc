"use client";

import { CircleAlert } from "lucide-react";
import { ReactNode, useState } from "react";

interface FAQCardProps {
  icon?: ReactNode;
  question: string;
  answer: ReactNode;
}

export default function FAQCard({ icon, question, answer }: FAQCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-black rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between gap-4"
        aria-expanded={isOpen}
      >
        <div className="flex flex-row gap-4 items-center">
          {icon}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {question}
          </h3>
        </div> 
        <svg
          className={`w-5 h-5 text-purple-500 dark:text-purple-500 transition-transform duration-300 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        } overflow-hidden`}
      >
        <div className="px-6 pb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}
