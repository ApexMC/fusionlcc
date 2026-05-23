import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const { parentName, childName, childDOB, email, phoneNumber, address, requestedClass } = await req.json();

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT), // 465 or 587
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.REGISTRATION_FROM_EMAIL!,
    to: process.env.CONTACT_TO_EMAIL!,
    subject: `LCC New Athlete Registration: ${parentName}`,
    text: `Parent Name: ${parentName}\nChild Name: ${childName}\nChild DOB: ${childDOB}\nEmail: ${email}\nPhone Number: ${phoneNumber}\nAddress: ${address}\nRequested Class: ${requestedClass}`,
    replyTo: email,
  });

  return Response.json({ ok: true });
}