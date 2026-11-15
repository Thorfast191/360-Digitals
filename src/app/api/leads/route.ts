import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { LIMITS, clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";

// Trimmed + length-capped so blank or multi-megabyte submissions are rejected (F-09, F-10).
const leadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
  serviceId: z.string().max(64).optional(),
  projectType: z.string().trim().max(100).optional(),
  budgetRange: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  const perIp = await hitRateLimit(
    `lead:ip:${clientIp(request.headers)}`,
    LIMITS.leadPerIp.limit,
    LIMITS.leadPerIp.windowSeconds
  );
  if (!perIp.ok) return tooManyRequests(perIp.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, email, company, message, serviceId, projectType, budgetRange } =
    parsed.data;

  const lead = await prisma.lead.create({
    data: {
      name,
      email,
      company: company || null,
      message,
      serviceId: serviceId || null,
      projectType: projectType || null,
      budgetRange: budgetRange || null,
    },
  });

  try {
    const settings = await prisma.siteSettings.findFirst();
    const fromName = settings?.smtpSenderName ?? settings?.agencyName ?? "360 Digitals";

    if (settings?.contactEmail) {
      await sendMail({
        to: settings.contactEmail,
        subject: `New lead: ${name}`,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          `Company: ${company ?? "-"}`,
          `Project type: ${projectType ?? "-"}`,
          `Budget: ${budgetRange ?? "-"}`,
          "",
          message,
        ].join("\n"),
        fromName,
      });
    }

    // The auto-reply goes to an address the visitor typed; cap it so the form
    // can't be used to mail-bomb a third party (F-04).
    const perRecipient = await hitRateLimit(
      `mail:to:${email}`,
      LIMITS.mailPerRecipient.limit,
      LIMITS.mailPerRecipient.windowSeconds
    );
    if (perRecipient.ok) await sendMail({
      to: email,
      subject: "Thanks for reaching out",
      text: `Hi ${name},\n\nThanks for your message — we'll get back to you soon.\n\n${fromName}`,
      fromName,
    });
  } catch (error) {
    console.error("[leads] failed to send notification emails", error);
  }

  return NextResponse.json({ id: lead.id }, { status: 201 });
}
