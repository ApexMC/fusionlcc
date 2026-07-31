import RegistrationForm from "@/components/classes/registration_form";
import { notFound } from "next/navigation";
import createClient from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPublicClassBySlug } from "@/lib/classes/data";

export default async function Register({
  params,
}: {
  params: Promise<{className : string }>;
}) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
      redirect("/login")
  }

  const { className } = await params;
  const classData = await getPublicClassBySlug(className);
  if (!classData) return notFound();

  return (
    <div className="flex flex-col flex-1 items-center justify-start bg-zinc-100 dark:bg-zinc-900 font-sans">
      <main className="flex flex-1 min-h-[50vh] w-full max-w-3xl flex-col items-center py-16 px-16 justify-center bg-zinc-100 dark:bg-zinc-900">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 mb-4 text-center">
          Register for Classes
        </h1>
        <RegistrationForm
          classId={classData.classRecord.classId}
          classes={classData.classes.map((classRecord) => ({
            classId: classRecord.classId,
            className: classRecord.className,
          }))}
        />
      </main>
    </div>
  );
}
