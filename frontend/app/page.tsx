"use client";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
    const { lang } = useLanguage();
    return (
        <>
            <section className="hero grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
                <div>
                    <p className="eyebrow">{lang === "ar" ? "تجارة إلكترونية أذكى" : "Smarter C2C commerce"}</p>
                    <h1 className="text-5xl sm:text-6xl">
                        {lang === "ar" ? "صفقات أفضل." : "Great deals."}
                        <br />
                        <span className="text-indigo-600">{lang === "ar" ? "بتفاوض أسرع وأذكى." : "Less back-and-forth."}</span>
                    </h1>
                    <p className="muted mt-6 max-w-lg">
                        {lang === "ar"
                            ? "اكتشف المنتجات، حدد ميزانيتك، واختر بين التفاوض المباشر (١ إلى ١) أو متعدد البائعين بالأنماط الثلاثة: اليدوي (Nil)، شبه الآلي (Semi)، أو الآلي بالكامل (Auto)."
                            : "Discover products, define your limits, and negotiate 1-to-1 or Multi-Seller in Manual (Nil), Semi-automated (Semi), or Automated (Auto) mode."}
                    </p>
                    <div className="flex gap-3 flex-wrap mt-8">
                        <Link href="/products" className="btn">
                            {lang === "ar" ? "استكشف المتجر ←" : "Explore marketplace →"}
                        </Link>
                        <Link href="/login" className="btn-secondary">
                            {lang === "ar" ? "افتح مساحة عملك" : "Open your workspace"}
                        </Link>
                    </div>
                    <p className="muted text-xs mt-5">
                        {lang === "ar" ? "حدود سرية محمية · دعم كامل للعربية والإنجليزية · أنماط Nil و Semi و Auto" : "Private limits · Transparent negotiation rounds · Nil, Semi & Auto modes"}
                    </p>
                </div>
                <div className="panel">
                    <div className="flex justify-between mb-6">
                        <span className="badge">{lang === "ar" ? "رحلة التفاوض" : "Negotiation journey"}</span>
                        <span className="muted text-xs">RULES-BASED + AI ENGINE</span>
                    </div>
                    <p className="text-sm muted">{lang === "ar" ? "صفقتك القادمة" : "Your next agreement"}</p>
                    <p className="text-3xl font-bold mt-2">{lang === "ar" ? "بشروطك واختيارك." : "On your terms."}</p>
                    <div className="space-y-4 mt-7">
                        {(lang === "ar"
                            ? [
                                  "01 · اختر المنتج والتفاوض (١ إلى ١ أو متعدد البائعين)",
                                  "02 · حدد الميزانية ونمط التفاوض (Nil / Semi / Auto)",
                                  "03 · تابع جولات التفاوض بلغتك (عربي / إنجليزي)",
                                  "04 · اعتمد الاتفاقية النهائية بأفضل سعر",
                              ]
                            : [
                                  "01 · Discover a product (1-to-1 or Multi-Seller)",
                                  "02 · Set budget & mode (Nil, Semi, or Auto)",
                                  "03 · Follow bilingual negotiation rounds",
                                  "04 · Review and approve the final agreement",
                              ]
                        ).map(t => (
                            <div className="p-4 rounded-xl bg-slate-50 text-sm font-medium" key={t}>
                                {t}
                            </div>
                        ))}
                    </div>
                    <p className="muted text-xs mt-5">
                        {lang === "ar"
                            ? "تُحسم الأسعار عبر محرك قواعد دقيق داخل حدود كل طرف، ويصيغ Gemini رسائل التفاوض."
                            : "Negotiations use a deterministic, rules-based engine. No payment is processed."}
                    </p>
                </div>
            </section>
            <section className="grid md:grid-cols-3 gap-6 mt-10">
                {(lang === "ar"
                    ? [
                          ["للمشترين (Buyers)", "تفاوض مع بائع واحد أو عدة بائعين بالنمط اليدوي أو شبه الآلي أو الآلي.", "buyer"],
                          ["للبائعين (Sellers)", "أدر منتجاتك وحدد أقل سعر سري ونمط التفاوض الخاص بك (Nil / Semi / Auto).", "seller"],
                          ["للإدارة (Admins)", "راقب الصفقات والمؤشرات وحمّل التقارير بصيغة PDF و CSV.", "admin"],
                      ]
                    : [
                          ["For buyers", "Set confidential limits and negotiate 1-to-1 or Multi-Seller in Nil, Semi, or Auto mode.", "buyer"],
                          ["For sellers", "Manage your catalog and configure private floor prices and Nil/Semi/Auto rules.", "seller"],
                          ["For administrators", "Review activity, accounts and export visual platform reports.", "admin"],
                      ]
                ).map(([title, description, role]) => (
                    <Link href={"/dashboard/" + role} className="panel hover:border-indigo-300 transition" key={role}>
                        <p className="eyebrow">{role} workspace</p>
                        <h2>{title}</h2>
                        <p className="muted text-sm mt-3">{description}</p>
                        <p className="text-indigo-600 text-sm font-semibold mt-6">{lang === "ar" ? "فتح اللوحة ←" : "Explore workspace →"}</p>
                    </Link>
                ))}
            </section>
        </>
    );
}
