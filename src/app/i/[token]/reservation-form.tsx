"use client";

import type { ReactNode } from "react";
import { showToast } from "@/components/toast";
import { guestMessages, type GuestLocale } from "@/lib/i18n/guest";
import type { changeReservation } from "./actions";

export function ReservationForm({ action, locale, className, children }: {
  action: (data: FormData) => ReturnType<typeof changeReservation>;
  locale: GuestLocale;
  className?: string;
  children: ReactNode;
}) {
  async function submit(data: FormData) {
    const result = await action(data).catch(() => "failed" as const);
    showToast({
      text: guestMessages[locale][result],
      error: result !== "reservedSuccess" && result !== "released",
    });
  }

  return <form action={submit} className={className}>{children}</form>;
}
