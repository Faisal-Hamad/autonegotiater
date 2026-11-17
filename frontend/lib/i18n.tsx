"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "ar";

const arDict: Record<string, string> = {
    "Marketplace": "المتجر",
    "Workspace": "مساحة العمل",
    "Alerts": "التنبيهات",
    "My account": "حسابي",
    "Sign in": "تسجيل الدخول",
    "Get started": "ابدأ الآن",
    "Buyer": "مشتري",
    "Seller": "بائع",
    "Admin": "أدمن",
    "Buyer Account": "حساب مشتري",
    "Seller Account": "حساب بائع",
    "Admin Account": "حساب أدمن",
    "Dashboard Overview": "نظرة عامة",
    "Deals & Negotiations": "الصفقات والمفاوضات",
    "Closed Agreements": "الاتفاقيات المغلقة",
    "Reports & Analytics": "التقارير والتحليلات",
    "Audit Logs": "سجل العمليات",
    "System Metrics": "مؤشرات النظام",
    "My Products & Agent Settings": "منتجاتي وإعدادات الوكيل",
    "Browse Products": "تصفح المنتجات",
    "My Profile": "الملف الشخصي",
    "Users": "المستخدمون",
    "Sellers": "البائعون",
    "Products": "المنتجات",
    "Permissions": "الصلاحيات",
    "Notifications": "الإشعارات",
    "System Ready": "النظام جاهز",
    "Rules Engine & Privacy Guard Active": "محرك القواعد وحماية الخصوصية نشط",
    "Auto-Agent: Active": "الوكيل الذكي: نشط",
    "Active Negotiations": "المفاوضات النشطة",
    "Closed Deals": "الصفقات المكتملة",
    "Negotiation Success Rate": "نسبة نجاح التفاوض",
    "Store Inventory & Pricing Rules": "مخزون المتجر وقواعد التسعير",
    "Active & Recent Deals": "الصفقات النشطة والأخيرة",
    "Deal / Session ID": "معرف الصفقة / الجلسة",
    "Product": "المنتج",
    "Type": "النوع",
    "Status": "الحالة",
    "Round Progress": "تقدم الجولات",
    "Action": "الإجراء",
    "Open session →": "فتح الجلسة ←",
    "View Agreement →": "عرض الاتفاقية ←",
    "Multi-seller": "متعدد البائعين",
    "One-to-one": "مباشر (١ إلى ١)",
    "Nil (Manual)": "يدوي بالكامل (Nil)",
    "Semi-automated": "شبه آلي (Semi)",
    "Automated": "آلي بالكامل (Auto)",
    "Admin Analytics & Reports": "تحليلات وتقارير الأدمن",
    "Reports & Deal Intelligence": "التقارير ومؤشرات الصفقات",
    "Download PDF": "تحميل PDF",
    "Download CSV": "تحميل CSV",
    "Platform summary": "ملخص المنصة",
    "Seller report": "تقرير البائع",
    "Buyer report": "تقرير المشتري",
    "Seller Performance Comparison": "مقارنة أداء البائعين",
    "Top-Selling Products": "المنتجات الأكثر مبيعاً",
    "All time": "كل الأوقات",
    "Last 7 days": "آخر ٧ أيام",
    "Last 30 days": "آخر ٣٠ يوماً",
    "Preview and download": "معاينة وتحميل التقرير",
    "Find your next great deal": "اكتشف صفقتك القادمة",
    "Set Your Purchase Requirements": "حدد متطلبات الشراء والتفاوض",
    "Available Sellers": "البائعون المتاحون",
    "Live Negotiation": "المفاوضة الحية",
    "Final Offer Comparison": "مقارنة العروض النهائية",
    "One-to-one negotiation →": "تفاوض مباشر مع هذا البائع (١ إلى ١) ←",
    "Start Multi-Seller Negotiation": "بدء التفاوض مع البائعين",
    "Start One-to-One Negotiation": "بدء التفاوض المباشر (١ إلى ١)",
    "Send Manual Offer": "إرسال العرض اليدوي",
    "Send Counteroffer": "إرسال العرض المقابل",
    "Accept Offer": "قبول العرض",
    "Reject Offer": "رفض العرض",
};

type LanguageContextType = {
    lang: Locale;
    dir: "ltr" | "rtl";
    setLang: (next: Locale) => void;
    toggleLang: () => void;
    t: (en: string, ar?: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
    lang: "en",
    dir: "ltr",
    setLang: () => {},
    toggleLang: () => {},
    t: (en: string) => en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Locale>("en");

    useEffect(() => {
        try {
            const saved = localStorage.getItem("autonegotiater-lang");
            if (saved === "ar" || saved === "en") {
                setLangState(saved);
            }
        } catch {
            // ignore storage errors
        }
    }, []);

    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.lang = lang;
            document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        }
    }, [lang]);

    function setLang(next: Locale) {
        setLangState(next);
        try {
            localStorage.setItem("autonegotiater-lang", next);
        } catch {
            // ignore
        }
    }

    function toggleLang() {
        setLang(lang === "en" ? "ar" : "en");
    }

    function t(en: string, ar?: string): string {
        if (lang === "en") return en;
        if (ar) return ar;
        return arDict[en] ?? en;
    }

    return (
        <LanguageContext.Provider value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, toggleLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}
