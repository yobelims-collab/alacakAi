import type { Locale, UserRole } from "@/lib/types";

/** Page-local labels for the team settings (kept out of dictionaries.ts on purpose). */
export const ROLE_COPY: Record<Locale, Record<UserRole, { label: string; hint: string }>> = {
  tr: {
    OWNER: { label: "Sahip", hint: "Şirketi oluşturan kişi; her şeyi yönetir." },
    ADMIN: { label: "Yönetici", hint: "Finansın yaptığı her şey + ayarları ve ekibi yönetir." },
    FINANCE: { label: "Finans", hint: "Her şeyi görür ve onaylar." },
    SALES: { label: "Satış", hint: "Yalnızca kendi müşterilerini ve onlarla ilgili karar kartlarını görür." },
    VIEWER: { label: "İzleyici", hint: "Yalnızca görüntüler; değişiklik yapamaz." },
  },
  en: {
    OWNER: { label: "Owner", hint: "Created the company; manages everything." },
    ADMIN: { label: "Admin", hint: "Everything Finance can do, plus settings and team." },
    FINANCE: { label: "Finance", hint: "Sees everything and approves." },
    SALES: { label: "Sales", hint: "Sees only their own customers and the decision cards about them." },
    VIEWER: { label: "Viewer", hint: "Read only; cannot change anything." },
  },
};
